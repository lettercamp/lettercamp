import { imageOptimization } from "./image-optimization.js";
import { publicationLinks } from './publication-links.js';
import { codeBlocks } from "./code-highlight.js";
import { contentComponents } from "./content-component-syntax.js";
import { componentBlocks } from "./component-blocks.js";
import path from 'node:path';
import { build } from 'astro';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import { prepareWorkspace } from './workspace.js';
import { readingTime } from './reading-time.js';
import { searchContent } from './search-content.js';
import { mediaDimensions } from './media-dimensions.js';
import { reactViteConfig } from './react.js';
import { assertRemoteBuiltAssets, assertRemoteSourceAssets } from './remote-assets.js';

export type BuildOptions = { site: string; outDir?: string; assetsPrefix?: string; remoteAssetsOnly?: boolean };

export async function buildSite(directory: string, options: BuildOptions) {
  const origin = new URL(options.site);
  if (!['https:', 'http:'].includes(origin.protocol)) throw new Error('Use an HTTP or HTTPS site URL.');
  if (origin.username || origin.password || origin.search || origin.hash) throw new Error('Use a site URL without credentials, query parameters, or a fragment.');
  const root = path.resolve(directory);
  const remoteAssetsOnly = options.remoteAssetsOnly || process.env.LETTERCAMP_CLOUD_BUILD === '1';
  if (remoteAssetsOnly) await assertRemoteSourceAssets(root);
  const outDir = path.resolve(root, options.outDir ?? 'dist');
  const overlaps = (a: string, b: string) => a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
  if (outDir === root || root.startsWith(outDir + path.sep) || ['pages', 'public', 'components'].some(name => overlaps(outDir, path.join(root, name)))) {
    throw new Error('Output must not replace the publication or its source files.');
  }
  const { workspace, cleanup } = await prepareWorkspace(root);
  const previousCwd = process.cwd();
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    // The React integration imports react-dom to detect its version. Select the
    // production runtime before loading it, as Astro's CLI does before a build.
    process.env.NODE_ENV = 'production';
    const { default: react } = await import('@astrojs/react');
    // Astro 7 places temporary prerender modules relative to cwd when outDir
    // is external. Keep them beside the renderer's node_modules, not the content.
    process.chdir(workspace);
    await build({
      root: workspace, configFile: false, site: origin.origin, base: origin.pathname, trailingSlash: 'always',
      cacheDir: path.join(workspace, '.cache'),
      publicDir: remoteAssetsOnly ? path.join(workspace, '.lettercamp-no-public') : path.join(root, 'public'), outDir, output: 'static',
      integrations: [mdx(), react(), imageOptimization(workspace)],
      vite: reactViteConfig,
      markdown: { syntaxHighlight: false, processor: unified({ remarkPlugins: [contentComponents, readingTime, searchContent, codeBlocks, componentBlocks, [mediaDimensions, { root }], [publicationLinks, { basePath: origin.pathname }]], rehypePlugins: [[mediaDimensions, { root }]] }) },
      // Ship the publication's CSS with the document, avoiding a render-blocking
      // HTML -> stylesheet round trip on every cold landing.
      build: { format: 'directory', inlineStylesheets: 'always', ...(options.assetsPrefix ? { assetsPrefix: options.assetsPrefix } : {}) },
    });
    if (remoteAssetsOnly) await assertRemoteBuiltAssets(outDir);
    return outDir;
  } finally {
    process.chdir(previousCwd);
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    await cleanup();
  }
}
