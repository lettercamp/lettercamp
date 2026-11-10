import { cp, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundledImagesPath, readBundledImages, type BundledImage } from './bundled-images.js';

export type StarterOptions = { remoteAssets?: boolean };

// Both CLI creation and Cloud release preparation use the starter in this package.
// Asset uploads happen before release; copying a starter never needs the network.
export async function copyStarter(destination: string, { remoteAssets = false }: StarterOptions = {}) {
  const source = fileURLToPath(new URL('../starter/', import.meta.url));
  if (!remoteAssets) {
    await cp(source, destination, { recursive: true });
    return;
  }

  const images = JSON.parse(await readFile(path.join(source, bundledImagesPath), 'utf8')) as BundledImage[];
  const available = new Set((await readBundledImages(source)).map(image => image.original));
  const replacements = new Map<string, string>();
  const remote = images.map(image => {
    const hosted = image.remote;
    if (!available.has(image.original) || !hosted || hosted.original !== image.sourceUrl
      || !hosted.original.startsWith('https://') || !['ready', 'skipped'].includes(hosted.status)
      || hosted.status === 'ready' && !hosted.variants.length
      || hosted.variants.some(variant => !variant.url.startsWith('https://'))) {
      throw new Error(`Missing or outdated remote starter asset: ${image.original}. Refresh the starter's asset metadata before releasing it.`);
    }
    replacements.set(image.original, hosted.original);
    return hosted;
  });

  await cp(source, destination, {
    recursive: true,
    filter: filename => path.relative(source, filename).split(path.sep)[0] !== 'public',
  });
  async function rewrite(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) { await rewrite(filename); continue; }
      if (filename === path.join(destination, bundledImagesPath) || !/\.(?:json|mdx?|[cm]?[jt]sx?|css)$/.test(entry.name)) continue;
      const content = await readFile(filename, 'utf8');
      // Starter-owned references only; leave external URLs and navigation alone.
      const updated = content.replace(/(?<![\w/:])\/images\/[^\s"'`()<>?#]+\.(?:jpe?g|png|webp|gif|svg|avif|ico)\b/g, local => {
        const url = replacements.get(local);
        if (!url) throw new Error(`Missing remote starter asset for ${local} in ${path.relative(destination, filename)}.`);
        return url;
      });
      if (updated !== content) await writeFile(filename, updated);
    }
  }
  await rewrite(destination);
  await writeFile(path.join(destination, bundledImagesPath), JSON.stringify(remote, null, 2) + '\n');
  const settingsPath = path.join(destination, 'settings.json');
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  settings.design.typography.localFonts = false;
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}
