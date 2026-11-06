import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Generate direct Astro imports so React hydration and CSS imports use the same
// Vite pipeline as article components. Only the two reserved filenames opt in.
export async function writeCustomLayout(workspace: string, contentRoot: string) {
  const directory = path.join(contentRoot, 'components');
  const entries = await readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const sources = ['Header', 'Footer'].map(name => {
    const matches = entries.filter(entry => (entry.isFile() || entry.isSymbolicLink()) && [name + '.jsx', name + '.tsx'].includes(entry.name));
    if (matches.length > 1) throw new Error(`Use only one of components/${name}.jsx and components/${name}.tsx.`);
    const filename = matches[0]?.name;
    const region = name.toLowerCase();
    const source = filename
      ? `---\nimport Component from ${JSON.stringify(path.join(directory, filename).replaceAll('\\', '/'))};\nconst { site, pathname } = Astro.props;\nconst basePath = import.meta.env.BASE_URL.replace(/\\/+$/, '');\n---\n<lettercamp-custom-${region} data-component="${filename}" style="display: contents"><Component site={site} pathname={pathname} basePath={basePath} client:load /></lettercamp-custom-${region}>\n`
      : `---\nimport Component from './${name}.astro';\n---\n<Component {...Astro.props} />\n`;
    return { file: path.join(workspace, 'src', 'components', `${name}Slot.astro`), source };
  });
  for (const { file, source } of sources) {
    const previous = await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return '';
      throw error;
    });
    if (previous !== source) await writeFile(file, source);
  }
}
