import { imageOptimization } from "./image-optimization.js";
import { codeBlocks } from "./code-highlight.js";
import { contentComponents } from "./content-component-syntax.js";
import { componentBlocks } from "./component-blocks.js";
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dev } from 'astro';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import { unified } from '@astrojs/markdown-remark';
import { prepareWorkspace } from './workspace.js';
import { selectDefaultPort } from './ports.js';
import { readingTime } from './reading-time.js';
import { searchContent } from './search-content.js';
import { mediaDimensions } from './media-dimensions.js';
import { reactIntegrationDirectory, reactViteConfig } from './react.js';
import { writeCustomLayout } from './custom-layout.js';
import { liveReload } from './live-reload.js';
import { bundledImagesPath, readBundledImages } from './bundled-images.js';

export type DevOptions = { port: number; host: string; open: boolean; useDefaultPorts?: boolean; base?: string; middleware?: string; strictPort?: boolean };

export async function startDev(directory: string, options: DevOptions) {
  // Astro is bundled with Lettercamp; users update it through the Lettercamp CLI.
  process.env.ASTRO_DISABLE_UPDATE_CHECK = 'true';
  const { workspace, contentRoot, modules } = await prepareWorkspace(directory);
  let server: Awaited<ReturnType<typeof dev>> | undefined;
  let closeVite: (() => Promise<void>) | undefined;
  let stopping = false;
  const cleanup = async () => {
    if (stopping) return;
    stopping = true;
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    try {
      if (server) await server.stop();
      else await closeVite?.();
    } finally {
      await rm(workspace, { recursive: true, force: true, maxRetries: 3 });
    }
  };
  const stop = () => {
    cleanup().catch((error) => {
      console.error(`Unable to clean up preview: ${error.message}`);
      process.exitCode = 1;
    });
  };

  try {
    const port = (options.useDefaultPorts ?? options.port === 3000)
      ? await selectDefaultPort(options.host)
      : options.port;
    server = await dev({
      root: workspace,
      logLevel: 'warn',
      configFile: false,
      base: options.base ?? '/',
      // The middleware below redirects trailing slashes instead of Astro's dev-only 404.
      trailingSlash: 'ignore',
      publicDir: path.join(contentRoot, 'public'),
      output: 'static',
      integrations: [mdx(), react(), imageOptimization(workspace), liveReload(contentRoot, options.base ?? '/'), ...(options.middleware ? [{
        name: 'lettercamp-editor-preview',
        hooks: { 'astro:config:setup': ({ addMiddleware }: { addMiddleware: (middleware: { entrypoint: string; order: 'post' }) => void }) => {
          addMiddleware({ entrypoint: options.middleware!, order: 'post' });
        } },
      }] : [])],
      markdown: { syntaxHighlight: false, processor: unified({ remarkPlugins: [[contentComponents, { settingsPath: path.join(contentRoot, 'settings.json') }], readingTime, searchContent, codeBlocks, componentBlocks, [mediaDimensions, { root: contentRoot }]], rehypePlugins: [[mediaDimensions, { root: contentRoot }]] }) },
      devToolbar: { enabled: false },
      server: { port, host: options.host, open: options.open },
      vite: {
        ...reactViteConfig(workspace),
        clearScreen: false,
        logLevel: 'warn',
        plugins: [{
          name: 'lettercamp-content',
          configureServer(vite) {
            closeVite = () => vite.close();
            // Astro rejects mismatched slashes in dev; mirror hosted redirects instead.
            vite.middlewares.use((request, response, next) => {
              const url = new URL(request.originalUrl ?? request.url ?? '/', 'http://localhost');
              const home = (options.base ?? '/').replace(/\/+$/, '') + '/';
              if (!['GET', 'HEAD'].includes(request.method ?? '') || url.pathname === '/' || url.pathname === home || !url.pathname.endsWith('/')) return next();
              response.statusCode = 308;
              response.setHeader('Location', url.pathname.replace(/\/+$/, '') + url.search);
              response.setHeader('Cache-Control', 'no-store');
              response.end();
            });
            if (options.middleware) vite.middlewares.use((request, _response, next) => {
              // Astro removes query parameters from prerendered page requests.
              // Preserve the original URL through its dev-adapter locals channel.
              const key = Symbol.for('astro.locals');
              Reflect.set(request, key, { ...Reflect.get(request, key), lettercampRequestUrl: request.url });
              next();
            });
            // Lettercamp has no Socket.IO endpoint. Stray polling clients should
            // receive a 404 without repeatedly triggering Astro's page warnings.
            vite.middlewares.use((request, response, next) => {
              const pathname = request.url?.split('?', 1)[0];
              if (pathname !== '/socket.io' && pathname !== '/socket.io/') return next();
              response.statusCode = 404;
              response.setHeader('Cache-Control', 'no-store');
              response.setHeader('Content-Type', 'text/plain; charset=utf-8');
              response.end('Not found');
            });
            // Imported files are watched automatically, but external folders
            // must be registered for newly created pages to be discovered.
            const components = path.join(contentRoot, 'components');
            vite.watcher.add([path.join(contentRoot, 'pages'), path.join(contentRoot, 'settings.json'), components]);
            let updatingLayout = Promise.resolve();
            const updateLayout = (file: string) => {
              if (![components, path.join(components, 'layouts'), path.join(components, 'elements')].includes(path.dirname(file)) || !/^(Header|Footer|PostList|PostCard|PostLayout|Subscribe)\.(jsx|tsx)$/.test(path.basename(file))) return;
              updatingLayout = updatingLayout.then(async () => {
                await writeCustomLayout(workspace, contentRoot);
                // Also clear an earlier duplicate-file error when the valid
                // slot source did not change. Add/remove is a rare full reload.
                vite.moduleGraph.invalidateAll();
                vite.ws.send({ type: 'full-reload' });
              }).catch(error => {
                vite.config.logger.error(error.message);
                vite.ws.send({ type: 'error', err: { message: error.message, stack: '' } });
              });
            };
            vite.watcher.on('add', updateLayout).on('unlink', updateLayout);
            const manifest = path.join(contentRoot, bundledImagesPath);
            const publicRoot = path.join(contentRoot, 'public') + path.sep;
            vite.watcher.add([manifest, publicRoot]);
            let imageTimer: ReturnType<typeof setTimeout> | undefined;
            let updatingImages = Promise.resolve();
            const updateImages = (event: string, file: string) => {
              if (!['add', 'change', 'unlink'].includes(event) || file !== manifest && !file.startsWith(publicRoot)) return;
              clearTimeout(imageTimer);
              imageTimer = setTimeout(() => {
                updatingImages = updatingImages.then(async () => {
                  await writeFile(path.join(workspace, 'src/image-manifests.json'), JSON.stringify(await readBundledImages(contentRoot)));
                }).catch(error => vite.config.logger.error(error.message));
              }, 100);
            };
            vite.watcher.on('all', updateImages);
            vite.httpServer?.once('close', () => {
              clearTimeout(imageTimer);
              vite.watcher.off('all', updateImages);
            });
          },
        }],
        server: { strictPort: options.strictPort ?? false, fs: { allow: [workspace, contentRoot, modules, reactIntegrationDirectory,
          ...(options.middleware ? [path.dirname(options.middleware)] : [])] } },
      },
    });
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    return { stop: cleanup, server, contentRoot };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
