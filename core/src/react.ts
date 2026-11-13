import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
export const reactIntegrationDirectory = path.dirname(require.resolve('@astrojs/react/package.json'));

// Astro resolves renderer entrypoints from the temporary workspace. Locate the
// CLI's integration even when npm puts it in a nested node_modules folder.
// The integration deduplicates React against the workspace's CLI dependencies.
export const reactViteConfig = (workspace: string) => ({
  // node_modules is shared through a symlink. Keep optimized dependencies in
  // this workspace so builds and other previews cannot replace its React runtime.
  cacheDir: path.join(workspace, '.vite'),
  resolve: {
    alias: [{ find: /^lettercamp\/components$/, replacement: path.join(workspace, 'src/components/public.jsx') }, ...Object.keys(require('@astrojs/react/package.json').exports).map(entry => {
      const id = '@astrojs/react' + (entry === '.' ? '' : entry.slice(1));
      return { find: new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), replacement: require.resolve(id) };
    })],
  },
});
