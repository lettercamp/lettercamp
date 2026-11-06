import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { imageMetadata } from 'astro/assets/utils';
import { apiOrigin, readConfig, saveConfig, type ApiSite } from './account.js';
import { uploadBytes } from './upload.js';
import { imageFile, rewriteImageReferences } from './deployment-image-references.js';

export type SourceFile = { path: string; content: string };
type LocalImage = { filename: string; hash: string; url: string; width: number; height: number; format: string };
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const remote = /^(?:[a-z][\w+.-]*:|\/\/|#)/i;
const roots = new Set(['public', 'pages', 'assets', 'components', 'lib', 'styles']);

async function readLocalImage(root: string, filename: string) {
  const relative = path.relative(root, filename);
  const parts = relative.split(path.sep);
  if (!roots.has(parts[0]) || parts.some(part => part.startsWith('.') || ['node_modules', 'dist', 'build', 'coverage'].includes(part))) {
    throw new Error('Local images must be inside the publication’s public, pages, assets, components, lib, or styles directories.');
  }
  // Refuse symlinks in every segment, including directories outside the source snapshot.
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw new Error(`Image uploads do not follow symlinks: ${relative}`);
  }
  const resolved = await realpath(filename);
  if (!resolved.startsWith(root + path.sep)) throw new Error('Local images must stay inside the publication.');
  const handle = await open(resolved, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await handle.stat();
    if (!info.isFile() || !info.size || info.size > 100 * 1024 * 1024) throw new Error('Choose a nonempty image no larger than 100 MB.');
    const bytes = await handle.readFile();
    if (bytes.length > 100 * 1024 * 1024) throw new Error('Images must be 100 MB or smaller.');
    return bytes;
  } finally { await handle.close(); }
}

export async function prepareDeploymentImages(directory: string, files: SourceFile[]) {
  const root = await realpath(directory);
  const images = new Map<string, Promise<LocalImage>>();
  let reading = Promise.resolve();
  const prefix = `https://lettercamp-deploy.invalid/${randomUUID()}/`;
  const prepared: SourceFile[] = [];
  for (const file of files) {
    if (!/\.(?:json|mdx?|[cm]?[jt]sx?|s?css)$/i.test(file.path)) { prepared.push(file); continue; }
    const source = Buffer.from(file.content, 'base64').toString('utf8');
    const content = await rewriteImageReferences(source, file.path, async value => {
      if (!value || remote.test(value)) return null;
      const pathname = value.split(/[?#]/, 1)[0];
      if (!imageFile.test(pathname)) return null;
      try {
        if (!/\.(?:jpe?g|png|webp|gif)$/i.test(pathname)) throw new Error('Cloud image uploads support JPEG, PNG, WebP, and GIF. Convert this image or use a hosted URL.');
        const decoded = decodeURIComponent(pathname);
        if (/[\\\x00-\x1f\x7f]/.test(decoded)) throw new Error('Use a local image path with forward slashes.');
        const filename = decoded.startsWith('/') ? path.resolve(root, 'public', '.' + decoded) : path.resolve(root, path.dirname(file.path), decoded);
        let pending = images.get(filename);
        if (!pending) {
          const index = images.size;
          pending = reading.then(async () => {
            const bytes = await readLocalImage(root, filename);
            // Check the actual bytes before transmitting a file based on its extension.
            const dimensions = await imageMetadata(bytes, filename);
            if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(dimensions.format)) throw new Error('Choose a JPEG, PNG, WebP, or GIF image.');
            return { filename, hash: hash(bytes), url: `${prefix}${index}${path.extname(filename)}`, width: dimensions.width, height: dimensions.height, format: dimensions.format };
          });
          // A settings file or srcset can reference many large originals. Read one at a time.
          reading = pending.then(() => undefined, () => undefined);
          images.set(filename, pending);
        }
        return await pending;
      } catch (error) { throw new Error(`${file.path}: cannot upload ${JSON.stringify(value)}. ${error instanceof Error ? error.message : error}`); }
    });
    prepared.push({ path: file.path, content: Buffer.from(content).toString('base64') });
  }
  return { root, files: prepared, images: await Promise.all(images.values()) };
}

function siteImage(url: unknown, siteId: string): url is string {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.origin === 'https://assets.lettercamp.com' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash
      && parsed.pathname.startsWith(`/sites/${siteId}/`) && /^\/sites\/[^/]+\/[a-f0-9-]{36}\.(?:jpe?g|png|webp|gif)$/i.test(parsed.pathname);
  } catch { return false; }
}

export async function uploadDeploymentImages(plan: Awaited<ReturnType<typeof prepareDeploymentImages>>, site: ApiSite, token: string) {
  if (!plan.images.length) return plan.files;
  const cacheName = `image-uploads-${hash(`${apiOrigin()}\n${site.id}`)}.json`;
  const cached = await readConfig<Record<string, string>>(cacheName) ?? {};
  const uploaded = new Map<string, string>();
  const replacements = new Map<string, string>();
  for (const image of plan.images) {
    const bytes = await readLocalImage(plan.root, image.filename);
    if (hash(bytes) !== image.hash) throw new Error(`${path.relative(plan.root, image.filename)} changed while preparing deployment. Run lettercamp deploy again.`);
    let url = uploaded.get(image.hash);
    if (!url && siteImage(cached[image.hash], site.id)) {
      // Assets are public. Never forward the CLI credential to the asset origin.
      const response = await fetch(cached[image.hash], { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(15_000) });
      if (response.ok) url = cached[image.hash];
      else if (response.status !== 404) throw new Error(`Unable to check a previous image upload (HTTP ${response.status}). Run lettercamp deploy again.`);
    }
    if (!url) {
      console.error(`Uploading image ${path.relative(plan.root, image.filename)}…`);
      const result = await uploadBytes(bytes, image.filename, site.slug, token);
      if (!siteImage(result.url, site.id)) throw new Error('Lettercamp returned an unexpected image URL.');
      url = result.url;
      cached[image.hash] = url;
      await saveConfig(cacheName, cached);
    }
    uploaded.set(image.hash, url);
    replacements.set(image.url, url);
  }
  return plan.files.map(file => {
    let source = Buffer.from(file.content, 'base64').toString('utf8');
    // Only generated placeholders are replaced, never authored URLs or prose.
    if (!source.includes('https://lettercamp-deploy.invalid/')) return file;
    for (const [placeholder, url] of replacements) source = source.replaceAll(placeholder, url);
    return { path: file.path, content: Buffer.from(source).toString('base64') };
  });
}
