import { mkdir, readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { readBundledImages, type BundledImage } from './bundled-images.js';

// Match the hosted image recipe. Originals and authored source stay untouched.
const widths = [64, 394, 668, 786, 1536];
export async function preparePublicImages(root: string, workspace: string) {
  const manifests = await readBundledImages(root);
  const prepared = new Set(manifests.filter(image => image.status === 'ready').flatMap(image => [image.original, ...image.variants.map(variant => variant.url)]));
  const generated: { path: string; filename: string }[] = [];
  const started = Date.now();
  let generatedBytes = 0;
  async function visit(directory: string, relative = '') {
    for (const name of await readdir(directory).catch(error => { if (error.code === 'ENOENT') return []; throw error; })) {
      const filename = path.join(directory, name), local = relative + name;
      const info = await lstat(filename);
      if (info.isSymbolicLink()) throw new Error(`Public files must not be symlinks: ${local}`);
      if (info.isDirectory()) { await visit(filename, local + '/'); continue; }
      if (!/\.(?:jpe?g|png|webp)$/i.test(name) || prepared.has('/' + local) || Date.now() - started > 60_000) continue;
      try {
        const bytes = await readFile(filename);
        const input = sharp(bytes, { limitInputPixels: 50_000_000, animated: true });
        const metadata = await input.metadata();
        if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) continue;
        const rotated = (metadata.orientation ?? 1) >= 5;
        const width = rotated ? metadata.height : metadata.width, height = rotated ? metadata.width : metadata.height;
        const hash = createHash('sha256').update(bytes).digest('hex');
        const image: BundledImage = { version: 'v3', original: '/' + local, width, height, status: 'ready', variants: [] };
        for (const size of [...new Set(widths.map(size => Math.min(size, width)))]) {
          if (Date.now() - started > 60_000) break;
          const result = await sharp(bytes, { limitInputPixels: 50_000_000 }).rotate().resize({ width: size, withoutEnlargement: true })
            .avif({ quality: 50, effort: 2 }).timeout({ seconds: 5 }).toBuffer({ resolveWithObject: true });
          if (result.data.length >= bytes.length || generatedBytes + result.data.length > 25 * 1048576) continue;
          const localPath = `_lettercamp/images/${hash}/v3/${size}.avif`;
          const target = path.join(workspace, 'public-variants', localPath);
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, result.data);
          generatedBytes += result.data.length;
          generated.push({ path: localPath, filename: target });
          image.variants.push({ url: '/' + localPath, width: result.info.width, height: result.info.height, bytes: result.data.length });
        }
        if (image.variants.length) {
          const index = manifests.findIndex(existing => existing.original === image.original);
          if (index >= 0) manifests[index] = image; else manifests.push(image);
        }
      } catch { console.warn(`Could not optimize public/${local}; using the original.`); }
    }
  }
  await visit(path.join(root, 'public'));
  await writeFile(path.join(workspace, 'src/image-manifests.json'), JSON.stringify(manifests));
  return generated;
}
