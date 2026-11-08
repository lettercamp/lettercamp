import { cp, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapePath } from 'tinyglobby';
import { writeCustomLayout } from './custom-layout.js';
import { readBundledImages } from './bundled-images.js';
const require = createRequire(import.meta.url);
const renderer = fileURLToPath(new URL('../renderer/', import.meta.url));

export async function prepareWorkspace(directory: string) {
  const contentRoot = await realpath(directory);
  JSON.parse(await readFile(path.join(contentRoot, 'settings.json'), 'utf8'));
  if (!(await stat(path.join(contentRoot, 'pages'))).isDirectory()) throw new Error('Missing pages directory.');
  const workspace = await realpath(await mkdtemp(path.join(tmpdir(), 'lettercamp-')));
  try {
    await cp(renderer, workspace, { recursive: true });
    await writeFile(path.join(workspace, 'src', 'image-manifests.json'), JSON.stringify(await readBundledImages(contentRoot)));
    await writeCustomLayout(workspace, contentRoot);
    await writeFile(path.join(workspace, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    // Dependencies stay in the CLI installation; the glob uses real source paths
    // so Vite sees additions and deletions without a symlink/realpath mismatch.
    const modules = path.dirname(path.dirname(require.resolve('astro/package.json')));
    await symlink(modules, path.join(workspace, 'node_modules'), 'junction');
    const contentPrefix = path.relative(path.join(workspace, 'src'), path.join(contentRoot, 'pages')).replaceAll('\\', '/') + '/';
    await writeFile(path.join(workspace, 'src', 'content.js'),
      `export const contentPrefix = ${JSON.stringify(contentPrefix)};\n` +
      `const allPages = import.meta.glob(${JSON.stringify(escapePath(contentPrefix) + '*.{md,mdx}')}, { eager: true });\n` +
      `export const pages = Object.fromEntries(Object.entries(allPages).filter(([filename, page]) => !/\\/index\\.mdx?$/.test(filename) && page.frontmatter?.draft !== true));\n`);
    await writeFile(path.join(workspace, 'src', 'site.js'),
      `import source from ${JSON.stringify(path.join(contentRoot, 'settings.json').replaceAll('\\', '/'))};\n` +
      `import { withDefaultBranding } from './lib/branding.js';\n` +
      `export default withDefaultBranding(source);\n`);

    return { workspace, contentRoot, modules, cleanup: () => rm(workspace, { recursive: true, force: true, maxRetries: 3 }) };
  } catch (error) {
    await rm(workspace, { recursive: true, force: true });
    throw error;
  }
}
