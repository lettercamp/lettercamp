import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { AstroIntegration } from 'astro';

// Keep Vite's CSS/React HMR when available. Some browsers or local proxies leave
// its WebSocket handshake pending indefinitely, so offer a plain HTTP fallback.
export function liveReload(contentRoot: string, base: string): AstroIntegration {
  const endpoint = `${base.replace(/\/$/, '')}/__lettercamp/reload`;
  const session = randomUUID();
  let revision = 0;
  return {
    name: 'lettercamp-live-reload',
    hooks: {
      'astro:config:setup': ({ injectScript, updateConfig }) => {
        injectScript('page', `
          if (import.meta.hot) {
            const hot = import.meta.hot;
            let connected = false;
            let previous;
            let timer;
            let stopped = false;
            let checking = false;
            const controller = new AbortController();
            const check = async () => {
              if (stopped || connected || checking) return;
              checking = true;
              clearTimeout(timer);
              try {
                const response = await fetch(${JSON.stringify(endpoint)}, {
                  cache: 'no-store',
                  signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3000)]),
                });
                if (!response.ok) throw new Error('Preview unavailable');
                const current = (await response.json()).revision;
                if (!stopped && !connected && previous !== undefined && previous !== current) {
                  stop();
                  location.reload();
                  return;
                }
                previous = current;
              } catch { /* Retry while the development server restarts. */ }
              finally {
                checking = false;
                if (!stopped && !connected) timer = setTimeout(check, 1000);
              }
            };
            const ready = () => { connected = true; clearTimeout(timer); };
            const disconnected = () => { connected = false; void check(); };
            const visible = () => { if (!document.hidden) void check(); };
            const stop = () => {
              stopped = true;
              clearTimeout(timer);
              controller.abort();
              document.removeEventListener('visibilitychange', visible);
              window.removeEventListener('pagehide', stop);
              hot.off('lettercamp:hmr-ready', ready);
              hot.off('vite:ws:disconnect', disconnected);
            };
            hot.on('lettercamp:hmr-ready', ready);
            hot.on('vite:ws:disconnect', disconnected);
            // Queued until connected, with a reply so we cannot miss an earlier
            // vite:ws:connect event while this module was still loading.
            hot.send('lettercamp:hmr-check');
            document.addEventListener('visibilitychange', visible);
            window.addEventListener('pagehide', stop);
            hot.dispose(stop);
            void check();
          }
        `);
        updateConfig({ vite: { plugins: [{
          name: 'lettercamp-reload-fallback',
          configureServer(vite) {
            const roots = ['pages', 'components', 'styles', 'lib', 'assets', 'public'].map(name => path.join(contentRoot, name));
            const settings = path.join(contentRoot, 'settings.json');
            let timer: ReturnType<typeof setTimeout> | undefined;
            const changed = (event: string, file: string) => {
              if (!['add', 'change', 'unlink'].includes(event)) return;
              if (file !== settings && !roots.some(root => file.startsWith(root + path.sep))) return;
              clearTimeout(timer);
              // Coalesce multi-file saves and let Vite invalidate its modules
              // before a browser asks for the new page.
              timer = setTimeout(() => { revision++; }, 100);
            };
            vite.watcher.add([settings, ...roots]);
            vite.watcher.on('all', changed);
            vite.ws.on('lettercamp:hmr-check', (_data, client) => {
              client.send({ type: 'custom', event: 'lettercamp:hmr-ready', data: {} });
            });
            vite.middlewares.use((request, response, next) => {
              // Astro may have stripped the configured base before this handler.
              const pathname = request.url?.split('?', 1)[0];
              if (pathname !== endpoint && pathname !== '/__lettercamp/reload') return next();
              response.setHeader('Cache-Control', 'no-store');
              response.setHeader('Content-Type', 'application/json');
              response.end(JSON.stringify({ revision: `${session}:${revision}` }));
            });
            vite.httpServer?.once('close', () => {
              clearTimeout(timer);
              vite.watcher.off('all', changed);
            });
          },
        }] } });
      },
    },
  };
}
