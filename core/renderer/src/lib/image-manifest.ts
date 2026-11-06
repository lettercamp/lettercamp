import { IMAGE_ORIGIN, imageAsset, type ImageManifest } from "./image-variants";

const cache = new Map<string, { expires: number; value: Promise<ImageManifest | null> }>();
export async function readImageManifest(url: string): Promise<ImageManifest | null> {
  const asset = imageAsset(url);
  if (!asset) return null;
  const key = `${IMAGE_ORIGIN}/${asset.prefix}/manifest.json`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  if (cache.size >= 512) cache.delete(cache.keys().next().value!);
  // Keep an in-flight request shared even when a slow response takes >2 seconds.
  const entry = { expires: Infinity, value: Promise.resolve<ImageManifest | null>(null) };
  entry.value = (async () => {
    const response = await fetch(key, { credentials: "omit", headers: typeof window === "undefined" ? { "User-Agent": "Lettercamp/1.0" } : undefined, signal: AbortSignal.timeout(15_000), cache: "no-store" });
    entry.expires = Date.now() + 2000;
    if (response.status === 404) return null; // Older uploads remain usable until backfilled.
    if (!response.ok) throw new Error(`Unable to read image variants (${response.status}).`);
    const manifest = await response.json() as ImageManifest;
    if (manifest.status === "ready" || manifest.status === "skipped") entry.expires = Date.now() + 300_000;
    return manifest;
  })();
  cache.set(key, entry);
  try { return await entry.value; }
  catch (error) { if (cache.get(key) === entry) cache.delete(key); throw error; }
}
