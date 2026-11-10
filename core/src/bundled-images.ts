import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const bundledImagesPath = 'lib/image-variants.json';
export type BundledImage = {
  version: 'v1' | 'v2' | 'v3';
  original: string;
  originalHash?: string;
  sourceUrl?: string;
  width: number;
  height: number;
  status: 'ready' | 'skipped' | 'pending' | 'failed';
  variants: { url: string; width: number; height: number; bytes: number }[];
};

// A starter's prepared variants must stop applying if its original is replaced
// or any of the bundled files are removed. Hosted manifests need no local files.
export async function readBundledImages(root: string, source?: string): Promise<BundledImage[]> {
  source ??= await readFile(path.join(root, bundledImagesPath), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return '[]';
    throw error;
  });
  const manifests = JSON.parse(source) as BundledImage[];
  const available: BundledImage[] = [];
  const filename = (url: string) => {
    if (!url.startsWith('/') || url.startsWith('//')) return null;
    const publicRoot = path.join(root, 'public');
    const file = path.resolve(publicRoot, '.' + decodeURIComponent(url));
    return file.startsWith(publicRoot + path.sep) ? file : null;
  };
  for (const manifest of manifests) {
    if (/^https?:\/\//.test(manifest.original)) { available.push(manifest); continue; }
    try {
      const original = filename(manifest.original);
      if (!original || !manifest.originalHash) continue;
      const hash = createHash('sha256').update(await readFile(original)).digest('hex');
      if (hash !== manifest.originalHash) continue;
      if (!(await Promise.all(manifest.variants.map(async variant => {
        const file = filename(variant.url);
        return file !== null && (await stat(file)).isFile();
      }))).every(Boolean)) continue;
      available.push(manifest);
    } catch { /* An edited starter can always fall back to the authored original. */ }
  }
  return available;
}
