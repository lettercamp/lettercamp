import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Generate direct Astro imports so React hydration and CSS imports use the same
// Vite pipeline as article components. Only reserved filenames opt in.
export const layoutNames = ['Header', 'Footer', 'PostList', 'PostCard', 'PostLayout'] as const;

export async function findCustomLayouts(contentRoot: string) {
  const directories = ['components/layouts', 'components'];
  const entries = await Promise.all(directories.map(directory => readdir(path.join(contentRoot, directory), { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  })));
  return Object.fromEntries(layoutNames.map(name => {
    for (const [index, directory] of directories.entries()) {
      const matches = entries[index].filter(entry => (entry.isFile() || entry.isSymbolicLink()) && [name + '.jsx', name + '.tsx'].includes(entry.name));
      if (matches.length > 1) throw new Error(`Use only one of ${directory}/${name}.jsx and ${directory}/${name}.tsx.`);
      if (matches.length) return [name, `${directory}/${matches[0].name}`];
    }
    return [name, undefined];
  }));
}

export async function findSubscribeOverride(contentRoot: string) {
  const directory = path.join(contentRoot, 'components/elements');
  const entries = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const matches = entries.filter(name => /^Subscribe\.(jsx|tsx)$/.test(name));
  if (matches.length > 1) throw new Error('Use only one of components/elements/Subscribe.jsx and Subscribe.tsx.');
  return matches[0] ? `components/elements/${matches[0]}` : undefined;
}

export async function writeCustomLayout(workspace: string, contentRoot: string) {
  const components = await findCustomLayouts(contentRoot);
  const sources = ['Header', 'Footer'].map(name => {
    const filename = components[name];
    const region = name.toLowerCase();
    const source = filename
      ? `---\nimport Component from ${JSON.stringify(path.join(contentRoot, filename).replaceAll('\\', '/'))};\nconst { site, pathname } = Astro.props;\nconst basePath = import.meta.env.BASE_URL.replace(/\\/+$/, '');\n---\n<lettercamp-custom-${region} data-component="${filename.slice('components/'.length)}" style="display: contents"><Component site={site} pathname={pathname} basePath={basePath} client:load /></lettercamp-custom-${region}>\n`
      : `---\nimport Component from './${name}.astro';\n---\n<Component {...Astro.props} />\n`;
    return { file: path.join(workspace, 'src', 'components', `${name}Slot.astro`), source };
  });
  const postNames = ['PostList', 'PostCard', 'PostLayout'];
  sources.push({ file: path.join(workspace, 'src', 'custom-posts.js'), source:
    postNames.map(name => components[name]
      ? `export { default as ${name} } from ${JSON.stringify(path.join(contentRoot, components[name]).replaceAll('\\', '/'))};`
      : `export const ${name} = undefined;`).join('\n') +
    `\nexport const customPostFiles = ${JSON.stringify(Object.fromEntries(postNames.filter(name => components[name]).map(name => [name, components[name]!.slice('components/'.length)])))};\n` });
  const subscribe = await findSubscribeOverride(contentRoot);
  sources.push({ file: path.join(workspace, 'src', 'custom-subscribe.js'), source: subscribe
    ? `export function installSubscribeOverride() {
  if (!document.querySelector('[data-lettercamp-subscribe]') && new URLSearchParams(location.search).get('__lettercamp_preview') !== '1') return;
  Promise.all([import('./lib/subscribe-override.jsx'), import(${JSON.stringify(path.join(contentRoot, subscribe).replaceAll('\\', '/'))})]).then(([runtime, custom]) => runtime.install(custom.default)).catch(() => {});
}
`
    : 'export function installSubscribeOverride() {}\n' });
  for (const { file, source } of sources) {
    const previous = await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return '';
      throw error;
    });
    if (previous !== source) await writeFile(file, source);
  }
}
