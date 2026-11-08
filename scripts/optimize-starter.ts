import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { BundledImage } from '../core/src/bundled-images.js';

// Maintainer-only: commit the output so creating and building a publication
// never needs an image transformation service or a local encoding step.
const starter = fileURLToPath(new URL('../core/starter/', import.meta.url));
const images = path.join(starter, 'public/images');
const manifests: BundledImage[] = [];
let saved = 0;
async function visit(directory: string) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.name === 'variants') continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) { await visit(filename); continue; }
    if (!/\.webp$/.test(entry.name)) continue;
    const bytes = await readFile(filename);
    const { width, height, pages } = await sharp(bytes).metadata();
    if (!width || !height || pages && pages > 1) throw new Error(`Expected a static starter image: ${filename}`);
    const relative = path.relative(images, filename).split(path.sep).join('/');
    const original = '/images/' + relative;
    const variants = [];
    for (const target of new Set([64, 400, 800, width].map(size => Math.min(size, width)))) {
      const { data, info } = await sharp(bytes).resize({ width: target, withoutEnlargement: true }).webp({ quality: 82, effort: 6 }).toBuffer({ resolveWithObject: true });
      if (target === width && data.length >= bytes.length) {
        variants.push({ url: original, width, height, bytes: bytes.length });
        continue;
      }
      const url = `/images/variants/${relative}/${target}.webp`;
      const output = path.join(starter, 'public', url);
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, data);
      variants.push({ url, width: info.width, height: info.height, bytes: data.length });
      saved++;
    }
    manifests.push({ version: 'v1', original, originalHash: createHash('sha256').update(bytes).digest('hex'), width, height, status: 'ready', variants });
  }
}
await visit(images);
await mkdir(path.join(starter, 'lib'), { recursive: true });
await writeFile(path.join(starter, 'lib/image-variants.json'), JSON.stringify(manifests, null, 2) + '\n');
console.log(`Prepared ${saved} variants for ${manifests.length} starter images.`);
