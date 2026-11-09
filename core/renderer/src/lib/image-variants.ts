// Shared by uploads, the editor, and the published renderer. Changing the recipe
// requires a new version: existing immutable objects must never change in place.
export const IMAGE_RECIPE = "v3";
export const IMAGE_WIDTHS = [64, 394, 668, 786, 1536] as const;
export const IMAGE_QUALITY = 50;
export const IMAGE_ORIGIN = "https://assets.lettercamp.com";
export type ImageVariant = { url: string; width: number; height: number; bytes: number };
export type ImageManifest = {
  version: "v1" | "v2" | typeof IMAGE_RECIPE; original: string; width: number; height: number;
  status: "pending" | "ready" | "skipped" | "failed"; variants: ImageVariant[];
};

export function imageAsset(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== IMAGE_ORIGIN || parsed.search || parsed.hash) return null;
    const match = /^\/sites\/([a-f0-9-]{36})\/([a-f0-9-]{36})\.(jpg|jpeg|png|webp|gif|avif)$/i.exec(parsed.pathname);
    if (match) return { key: parsed.pathname.slice(1), siteId: match[1], id: match[2], prefix: `sites/${match[1]}/${match[2]}/${IMAGE_RECIPE}` };
    // Shared originals keep their existing URLs. Include the full original key
    // (and extension) so different source libraries cannot collide.
    if (/^\/(?:starter\/(?:v\d+\/(?:covers|authors)|presets)|system\/(?:branding|starter))\/[a-z0-9_./-]+\.(jpg|jpeg|png|webp|gif|avif)$/i.test(parsed.pathname)) {
      const key = parsed.pathname.slice(1);
      return { key, siteId: null, id: key, prefix: `starter/assets/${IMAGE_RECIPE}/${key}` };
    }
    return null;
  } catch { return null; }
}

export function imageWidths(width: number): number[] {
  return [...new Set(IMAGE_WIDTHS.map(size => Math.min(size, width)))];
}

export function imageTransformOptions(width: number) {
  return { width, fit: "scale-down" as const, format: "avif" as const, quality: IMAGE_QUALITY, metadata: "none" as const };
}

export function imageAttributes(manifest: ImageManifest | null | undefined, sizes: string, fallbackWidth = 786) {
  if (manifest?.status !== "ready" || !manifest.variants.length) return null;
  const variants = manifest.variants;
  const fallback = variants.find(variant => variant.width >= fallbackWidth) ?? variants[variants.length - 1];
  return { sizes, srcSet: variants.map(variant => `${variant.url} ${variant.width}w`).join(", "), src: fallback.url };
}

// GIFs remain intact. Detect animated PNG/WebP by their container chunks, never
// by guessing whether an image is a photo, illustration, or screenshot.
export function animatedImage(bytes: Uint8Array, format: string): boolean {
  if (format === "gif") return true;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const name = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  // AVIF sequences advertise the avis brand in the ftyp box.
  if (format === "avif" || format === "heif") {
    if (bytes.length < 16 || name(4) !== "ftyp") return true;
    const end = Math.min(view.getUint32(0), bytes.length);
    for (let offset = 8; offset + 4 <= end; offset += 4) {
      if (offset !== 12 && name(offset) === "avis") return true;
    }
    return false;
  }
  if (format === "png") {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset);
      if (name(offset + 4) === "acTL") return true;
      if (name(offset + 4) === "IDAT") return false;
      offset += length + 12;
    }
  }
  if (format === "webp") {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const length = view.getUint32(offset + 4, true);
      if (name(offset) === "ANIM") return true;
      if (name(offset) === "VP8X" && length > 0 && offset + 8 < bytes.length) return (bytes[offset + 8] & 2) !== 0;
      if (name(offset) === "VP8 " || name(offset) === "VP8L") return false;
      offset += 8 + length + (length % 2);
    }
  }
  return format === "png" || format === "webp";
}
