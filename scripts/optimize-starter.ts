import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { BundledImage } from '../core/src/bundled-images.js';
import { IMAGE_RECIPE, IMAGE_QUALITY, imageWidths } from '../core/renderer/src/lib/image-variants.js';

// Maintainer-only: commit prepared assets so creation/builds need neither an
// encoder nor the network. sourceUrl keeps regeneration tied to the master,
// avoiding repeated lossy recompression of the bundled originals.
const option = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const starter = path.resolve(option('--directory', fileURLToPath(new URL('../core/starter/', import.meta.url))));
const cache = path.resolve(option('--cache', path.join(tmpdir(), 'lettercamp-starter-images')));
const images = path.join(starter, 'public/images');
const manifestPath = path.join(starter, 'lib/image-variants.json');
const old = JSON.parse(await readFile(manifestPath, 'utf8').catch(error => {
  if (error.code === 'ENOENT') return '[]';
  throw error;
})) as BundledImage[];
const sources = new Map(old.filter(item => item.sourceUrl).map(item => [item.original, item.sourceUrl!]));
const sourceManifest = option('--source-manifest', '');
if (sourceManifest) {
  const hosted = JSON.parse(await readFile(sourceManifest, 'utf8')) as BundledImage[];
  for (const item of hosted) {
    const pathname = new URL(item.original).pathname;
    const content = /\/(covers|authors)\/(.+)\.[^.]+$/.exec(pathname);
    const local = content ? `/images/${content[1]}/${content[2]}.webp`
      : pathname.includes('/starter/presets/dark/logo-') ? '/images/branding/logo-white.webp'
      : `/images/branding/${path.basename(pathname)}`;
    sources.set(local, item.original);
  }
}
async function master(url: string) {
  const filename = path.join(cache, new URL(url).pathname);
  const cached = await readFile(filename).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (cached) return cached;
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Unable to download starter source ${url}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, bytes);
  return bytes;
}
const manifests: BundledImage[] = [];
const generated = new Set<string>();
const renamed = new Map<string, string>();
const obsolete = new Set<string>();
async function visit(directory: string) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.name === 'variants') continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) { await visit(filename); continue; }
    if (!/\.(?:webp|jpe?g|png)$/.test(entry.name)) continue;
    const previous = '/images/' + path.relative(images, filename).split(path.sep).join('/');
    // Ignore replacements left by an interrupted run, while allowing new sources.
    if (old.some(item => item.original.replace(/\.[^.]+$/, '') === previous.replace(/\.[^.]+$/, ''))
      && !old.some(item => item.original === previous)) continue;
    const sourceUrl = sources.get(previous);
    const bytes = sourceUrl ? await master(sourceUrl) : await readFile(filename);
    const metadata = await sharp(bytes).metadata();
    if (!metadata.width || !metadata.height || metadata.pages && metadata.pages > 1) throw new Error(`Expected a static starter image: ${filename}`);
    const oriented = metadata.orientation != null && metadata.orientation >= 5 && metadata.orientation <= 8;
    const sourceWidth = oriented ? metadata.height : metadata.width;
    // Social metadata and favicon URLs keep JPEG/PNG originals. Only the page's
    // responsive variants use AVIF; retain the master URL for future recipes.
    const extension = metadata.hasAlpha ? 'png' : 'jpg';
    const relative = path.relative(images, filename).split(path.sep).join('/').replace(/\.[^.]+$/, '.' + extension);
    const original = '/images/' + relative;
    if (previous !== original) { renamed.set(previous, original); obsolete.add(filename); }
    const largest = imageWidths(sourceWidth).at(-1)!;
    const pipeline = sharp(bytes).rotate().resize({ width: largest, withoutEnlargement: true });
    const { data: bundled, info: dimensions } = await (extension === 'png'
      ? pipeline.png({ compressionLevel: 9 }) : pipeline.jpeg({ quality: 85, mozjpeg: true })).toBuffer({ resolveWithObject: true });
    const { width, height } = dimensions;
    const variants = [];
    for (const target of imageWidths(width)) {
      const { data, info } = await sharp(bytes).rotate().resize({ width: target, withoutEnlargement: true })
        .avif({ quality: IMAGE_QUALITY, effort: 6 }).toBuffer({ resolveWithObject: true });
      const url = `/images/variants/${IMAGE_RECIPE}/${relative}/${target}.avif`;
      const output = path.join(starter, 'public', url);
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, data);
      generated.add(output);
      variants.push({ url, width: info.width, height: info.height, bytes: data.length });
    }
    await writeFile(path.join(images, relative), bundled);
    manifests.push({ version: IMAGE_RECIPE, original, ...(sourceUrl ? { sourceUrl } : {}), originalHash: createHash('sha256').update(bundled).digest('hex'), width, height, status: 'ready', variants });
  }
}
await visit(images);
// Update authored references only after every replacement is ready.
async function rewrite(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['public', 'assets', 'node_modules', 'dist', 'image-variants.json'].includes(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) { await rewrite(filename); continue; }
    if (!/\.(?:json|mdx?|[cm]?[jt]sx?|s?css)$/.test(entry.name)) continue;
    const source = await readFile(filename, 'utf8');
    let updated = source;
    for (const [before, after] of renamed) updated = updated.replaceAll(before, after);
    if (updated !== source) await writeFile(filename, updated);
  }
}
await rewrite(starter);
await mkdir(path.dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, JSON.stringify(manifests, null, 2) + '\n');
// Remove only obsolete generated files, after all replacements are prepared.
async function prune(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await prune(filename);
      if (!(await readdir(filename)).length) await rm(filename, { recursive: true });
    } else if (!generated.has(filename)) await rm(filename);
  }
}
await prune(path.join(images, 'variants'));
for (const filename of obsolete) await rm(filename);
console.log(`Prepared ${generated.size} variants for ${manifests.length} starter images (${IMAGE_RECIPE}, AVIF quality ${IMAGE_QUALITY}).`);
