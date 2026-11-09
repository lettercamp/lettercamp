import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import type { Element, Root, RootContent } from 'hast';
import { imageAttributes, type ImageManifest } from './image-variants';
import { hasImageManifest, readImageManifest } from './image-manifest';

const classes = (node: Element) => Array.isArray(node.properties.className) ? node.properties.className : [];
const has = (nodes: Element[], name: string) => nodes.some(node => classes(node).includes(name));
const viewport = (max: number) => `(max-width: 600px) min(${max}px, calc(100vw - 32px)), (max-width: 900px) min(${max}px, calc(100vw - 48px)), min(${max}px, calc(100vw - 64px))`;

function managedImage(node: Element, parents: Element[]) {
  if (node.tagName !== 'img' || typeof node.properties.src !== 'string' || node.properties.srcSet) return false;
  // Hydrated components own their DOM and props. Rewriting their server HTML
  // would disagree with the client render and can restore the original URL.
  if (parents.some(parent => parent.tagName === 'astro-island')) return false;
  return !parents.some(parent => parent.tagName === 'picture' && parent.children.some(child => child.type === 'element' && child.tagName === 'source'));
}

function sizesFor(node: Element, parents: Element[]) {
  const props = node.properties;
  if (typeof props.sizes === 'string') return props.sizes;
  if (has([...parents, node], 'author-portrait')) return '24px';
  if (has(parents, 'brand')) return `${Number(props.width) || 30}px`;
  if (has(parents, 'post-card-cover')) {
    const home = parents.find(parent => classes(parent).includes('blog-home'));
    if (home?.properties.dataHomeLayout === 'column') {
      return viewport(Math.min(Number(home.properties.dataImageContentWidth) || 640, 1280));
    }
    const max = Number(String(home?.properties.style).match(/--home-content-width:\s*([\d.]+)px/)?.[1]) || 1280;
    const sizes = [];
    // The site's container queries use 552/852px; viewport gutters also change.
    for (const [limit, gutter] of [[600, 32], [900, 48], [100000, 64]]) {
      const container = `min(${max}px, calc(100vw - ${gutter}px))`;
      if (home?.properties.dataHomeLayout === 'rows') {
        sizes.push(max <= 552 || limit === 600
          ? `(max-width: ${limit}px) calc(${container} - 2px)`
          : `(max-width: ${limit}px) calc((${container} - 32px) * .4 - 2px)`);
      } else {
        if (max <= 552) sizes.push(`(max-width: ${limit}px) calc(${container} - 2px)`);
        else {
          sizes.push(`(max-width: ${Math.min(limit, 552 + gutter)}px) calc(${container} - 2px)`);
          if (max <= 852) sizes.push(`(max-width: ${limit}px) calc((${container} - 32px) / 2 - 2px)`);
          else {
            sizes.push(`(max-width: ${Math.min(limit, 852 + gutter)}px) calc((${container} - 32px) / 2 - 2px)`);
            sizes.push(`(max-width: ${limit}px) calc((${container} - 96px) / 3 - 2px)`);
          }
        }
      }
    }
    return sizes.join(', ') + ', 400px';
  }
  const hero = parents.find(parent => classes(parent).includes('article-hero-image'));
  if (hero) {
    const article = parents.find(parent => classes(parent).includes('publication-post'));
    const width = Number(article?.properties.dataImageContentWidth) || 640;
    const mode = hero.properties.dataImageWidth;
    const fixed = Number(String(hero.properties.style).match(/--cover-image-width:\s*([\d.]+)px/)?.[1]);
    const max = mode === 'full' ? 1280 : mode === 'regular' ? Math.min(fixed || width, width) : width + 128;
    if (article?.properties.dataPostHero === 'split') return `(max-width: 600px) min(${max}px, calc(100vw - 32px)), (max-width: 760px) min(${max}px, calc(100vw - 48px)), (max-width: 900px) min(${max}px, calc((100vw - 80px) / 2)), min(${max}px, calc((min(1280px, 100vw - 64px) - 64px) / 2))`;
    return viewport(max);
  }
  // Lazy images use their actual layout size in supporting browsers, including
  // custom blocks. The fallback supports older browsers without runtime JS.
  return viewport(Number(props.width) || 800);
}

export async function optimizeImageHtml(html: string) {
  if (!html.includes('<img')) return html;
  const tree = fromHtml(html);
  const elements: { node: Element; parents: Element[] }[] = [];
  function walk(node: Root | RootContent, parents: Element[] = []) {
    if (node.type === 'element') elements.push({ node, parents });
    if ('children' in node) for (const child of node.children) walk(child, node.type === 'element' ? [...parents, node] : parents);
  }
  walk(tree);
  const urls = new Set<string>();
  const authors = new Map<Element, { image?: string; imageAttributes?: unknown }[]>();
  const add = (url: unknown) => { if (typeof url === 'string' && hasImageManifest(url)) urls.add(url); };
  for (const { node, parents } of elements) {
    if (managedImage(node, parents)) add(node.properties.src);
    if (node.tagName === 'button' && classes(node).includes('author-more') && typeof node.properties.dataAuthors === 'string') {
      const data = JSON.parse(node.properties.dataAuthors);
      authors.set(node, data); data.forEach((author: { image?: string }) => add(author.image));
    }

  }
  if (!urls.size) return html;
  const manifests = new Map<string, ImageManifest | null>();
  const pending = [...urls];
  // Bound build concurrency; repeated pages reuse the shared manifest cache.
  await Promise.all(Array.from({ length: Math.min(8, pending.length) }, async () => {
    for (;;) {
      const url = pending.shift();
      if (!url) break;
      try { manifests.set(url, await readImageManifest(url)); }
      catch { /* Variant metadata is optional; keep the original image available. */ }
    }
  }));
  const priority = new Map<string, ReturnType<typeof imageAttributes>>();
  for (const { node, parents } of elements) {
    if (!managedImage(node, parents)) continue;
    const original = node.properties.src as string;
    const manifest = manifests.get(original);
    const small = has(parents, 'brand') || has(parents, 'author-portrait');
    const loading = node.properties.loading ?? (!small && node.properties.fetchPriority !== 'high' ? 'lazy' : undefined);
    const specifiedSizes = sizesFor(node, parents);
    const sizes = `${loading === 'lazy' && !/^auto(?:\s*,|$)/.test(specifiedSizes) ? 'auto, ' : ''}${specifiedSizes}`;
    const attrs = imageAttributes(manifest, sizes, small ? 64 : 786);
    if (!attrs) continue;
    Object.assign(node.properties, attrs, { loading, decoding: 'async', dataImageOriginal: original });
    if (manifest) {
      const width = Number(node.properties.width), height = Number(node.properties.height);
      if (!width && !height) Object.assign(node.properties, { width: manifest.width, height: manifest.height });
      else if (width > 0 && !node.properties.height) node.properties.height = Math.max(1, Math.round(width * manifest.height / manifest.width));
      else if (height > 0 && !node.properties.width) node.properties.width = Math.max(1, Math.round(height * manifest.width / manifest.height));
    }
    if (node.properties.fetchPriority === 'high') priority.set(original, attrs);
  }
  for (const { node } of elements) {
    if (node.tagName === 'link' && node.properties.as === 'image') {
      const attrs = priority.get(String(node.properties.href));
      if (attrs) Object.assign(node.properties, { href: attrs.src, imageSrcSet: attrs.srcSet, imageSizes: attrs.sizes });
    }
  }
  for (const [node, data] of authors) {
    for (const author of data) if (author.image) author.imageAttributes = imageAttributes(manifests.get(author.image), '24px', 64);
    node.properties.dataAuthors = JSON.stringify(data);
  }
  return toHtml(tree);
}
