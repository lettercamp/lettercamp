import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
export const reactIntegrationDirectory = path.dirname(require.resolve('@astrojs/react/package.json'));

// Astro resolves renderer entrypoints from the temporary workspace. Locate the
// CLI's integration even when npm puts it in a nested node_modules folder.
// The integration deduplicates React against the workspace's CLI dependencies.
export const reactViteConfig = {
  resolve: {
    alias: Object.keys(require('@astrojs/react/package.json').exports).map(entry => {
      const id = '@astrojs/react' + (entry === '.' ? '' : entry.slice(1));
      return { find: new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), replacement: require.resolve(id) };
    }),
  },
};
