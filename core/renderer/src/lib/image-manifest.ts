import { IMAGE_ORIGIN, IMAGE_RECIPE, imageAsset, type ImageManifest } from "./image-variants";
import bundled from '../image-manifests.json';
import { sitePath } from './urls.js';

const prepared = new Map((bundled as ImageManifest[]).map(manifest => {
  const original = sitePath(manifest.original);
  return [original, { ...manifest, original, variants: manifest.variants.map(variant => ({ ...variant, url: sitePath(variant.url) })) }];
}));
export const hasImageManifest = (url: string) => prepared.has(url) || imageAsset(url) !== null;

const cache = new Map<string, { expires: number; value: Promise<ImageManifest | null> }>();
export async function readImageManifest(url: string): Promise<ImageManifest | null> {
  const bundled = prepared.get(url);
  // Local bundles are self-contained. Refresh older hosted snapshots when a
  // new recipe exists, including sites created before the starter was updated.
  if (bundled && (!imageAsset(url) || bundled.version === IMAGE_RECIPE)) return bundled;
  const asset = imageAsset(url);
  if (!asset) return null;
  const key = `${IMAGE_ORIGIN}/${asset.prefix}/manifest.json`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  if (cache.size >= 512) cache.delete(cache.keys().next().value!);
  // Keep an in-flight request shared even when a slow response takes >2 seconds.
  const entry = { expires: Infinity, value: Promise.resolve<ImageManifest | null>(null) };
  entry.value = (async () => {
    let response = await fetch(key, { credentials: "omit", headers: typeof window === "undefined" ? { "User-Agent": "Lettercamp/1.0" } : undefined, signal: AbortSignal.timeout(15_000), cache: "no-store" });
    // Existing uploads remain optimized until they are regenerated for the current recipe.
    // Keep this fallback short-lived so a newly prepared recipe is picked up.
    const legacy = response.status === 404;
    if (legacy && bundled) { entry.expires = Date.now() + 2000; return bundled; }
    for (const version of ['v2', 'v1']) {
      if (response.status !== 404) break;
      response = await fetch(key.replace(`/${IMAGE_RECIPE}/`, `/${version}/`), {
        credentials: "omit", signal: AbortSignal.timeout(15_000), cache: "no-store",
      });
    }
    entry.expires = Date.now() + 2000;
    if (response.status === 404) return null; // Older uploads remain usable until backfilled.
    if (!response.ok) throw new Error(`Unable to read image variants (${response.status}).`);
    const manifest = await response.json() as ImageManifest;
    if (!legacy && (manifest.status === "ready" || manifest.status === "skipped")) entry.expires = Date.now() + 300_000;
    return manifest;
  })();
  cache.set(key, entry);
  try { return await entry.value; }
  catch (error) { if (cache.get(key) === entry) cache.delete(key); throw error; }
}
