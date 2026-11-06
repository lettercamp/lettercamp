import { open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { imageMetadata } from 'astro/assets/utils';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';

type Size = { width: number; height: number };
type Attribute = { type: string; name?: string | null; value?: unknown };
type Node = {
  type: string; name?: string | null; tagName?: string; url?: string; identifier?: string; value?: string;
  attributes?: Attribute[]; properties?: Record<string, unknown>;
  data?: object; children?: Node[];
};
type File = { path?: string; data: Record<string, unknown> };
const positive = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : undefined;
const maxProbeBytes = 1024 * 1024;

// Derive dimensions in the build, so visitors receive reserved space in the HTML.
// Probe only publication files and our asset origin; arbitrary external embeds
// retain their authored dimensions and never cause new server-side requests.
export function mediaDimensions(options: { root: string }) {
  const cache = new Map<string, Promise<Size | undefined>>();
  async function probe(src: string, file: File): Promise<Size | undefined> {
    try {
      if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(src)) {
        const url = new URL(src);
        if (url.origin !== 'https://assets.lettercamp.com' || url.username || url.password) return;
        const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000) });
        if (!response.body) return;
        if (!response.ok) { await response.body.cancel(); return; }
        const reader = response.body.getReader();
        let bytes = new Uint8Array();
        try {
          while (bytes.length < maxProbeBytes) {
            const { done, value } = await reader.read();
            if (done) break;
            const next = new Uint8Array(Math.min(maxProbeBytes, bytes.length + value.length));
            next.set(bytes); next.set(value.subarray(0, next.length - bytes.length), bytes.length); bytes = next;
            try { return await imageMetadata(bytes, src); } catch { /* Read until the header is complete. */ }
          }
        } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
        return;
      }
      const pathname = decodeURIComponent(src.split(/[?#]/, 1)[0]);
      const filename = await realpath(pathname.startsWith('/') ? path.resolve(options.root, 'public', '.' + pathname) : path.resolve(path.dirname(file.path ?? path.join(options.root, 'pages', 'index.md')), pathname));
      const root = await realpath(options.root);
      if (!filename.startsWith(root + path.sep)) return;
      const handle = await open(filename, 'r');
      try {
        const bytes = Buffer.alloc(maxProbeBytes);
        const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
        return await imageMetadata(bytes.subarray(0, bytesRead), src);
      } finally { await handle.close(); }
    } catch { return; } // Unavailable images must not prevent publication.
  }
  function size(src: string, file: File) {
    const key = /^(?:https?:|\/)/.test(src) ? src : `${file.path ?? ''}:${src}`;
    let pending = cache.get(key);
    if (!pending) { pending = probe(src, file); cache.set(key, pending); }
    return pending;
  }
  async function transform(tree: Node, file: File) {
    const jobs: (() => Promise<void>)[] = [];
    const definitions = new Map<string, string>();
    function findDefinitions(node: Node) {
      if (node.type === 'definition' && node.identifier && node.url) definitions.set(node.identifier.toLowerCase(), node.url);
      node.children?.forEach(findDefinitions);
    }
    findDefinitions(tree);
    function visit(node: Node) {
      if (['html', 'raw'].includes(node.type) && node.value && /<img\b/i.test(node.value)) jobs.push(async () => {
        const fragment = fromHtml(node.value!, { fragment: true });
        await transform(fragment, { path: file.path, data: {} });
        // Replace only image tags; parsing an isolated opening <div> must not
        // insert a closing tag ahead of the following Markdown block.
        const replacements: { start: number; end: number; html: string }[] = [];
        function collect(element: typeof fragment | (typeof fragment.children)[number]) {
          if (element.type === 'element' && element.tagName === 'img' && element.position?.start.offset !== undefined && element.position.end.offset !== undefined) {
            replacements.push({ start: element.position.start.offset, end: element.position.end.offset, html: toHtml(element) });
          }
          if ('children' in element) element.children.forEach(collect);
        }
        collect(fragment);
        for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
          node.value = node.value!.slice(0, replacement.start) + replacement.html + node.value!.slice(replacement.end);
        }
      });
      const jsx = ['mdxJsxFlowElement', 'mdxJsxTextElement'].includes(node.type) && node.name === 'img';
      const markdown = node.type === 'image' || node.type === 'imageReference';
      const component = node.type === 'lettercampElement' && (node.data as { hName?: string } | undefined)?.hName === 'img';
      if (jsx || markdown || component || node.type === 'element' && node.tagName === 'img') {
        const properties = jsx ? Object.fromEntries((node.attributes ?? []).filter(a => a.type === 'mdxJsxAttribute').map(a => [a.name, a.value]))
          : markdown || component ? (node.data as { hProperties?: Record<string, unknown> } | undefined)?.hProperties ?? {} : node.properties ?? {};
        const src = markdown ? node.url ?? definitions.get(node.identifier?.toLowerCase() ?? '') : properties.src;
        const width = positive(properties.width), height = positive(properties.height);
        // Leave dynamic dimensions and explicit sizing under the author's control.
        const dynamic = jsx && node.attributes?.some(a => a.type !== 'mdxJsxAttribute' || ['width', 'height'].includes(a.name ?? '') && typeof a.value !== 'string');
        const customSize = properties.width != null && !width || properties.height != null && !height;
        if (typeof src === 'string' && !(width && height) && !dynamic && !customSize) jobs.push(async () => {
          const dimensions = await size(src, file);
          if (!dimensions) return;
          const w = width ?? (height ? Math.round(height * dimensions.width / dimensions.height) : dimensions.width);
          const h = height ?? Math.max(1, Math.round(w * dimensions.height / dimensions.width));
          const attrs = { width: w, height: h, ...(!width && !height ? { 'data-media-sized': 'true' } : {}) };
          if (jsx) {
            node.attributes = (node.attributes ?? []).filter(a => !['width', 'height'].includes(a.name ?? ''));
            for (const [name, value] of Object.entries(attrs)) node.attributes.push({ type: 'mdxJsxAttribute', name, value: String(value) });
          } else if (markdown || component) node.data = { ...node.data, hProperties: { ...properties, ...attrs } };
          else node.properties = { ...properties, ...attrs };
        });
      }
      node.children?.forEach(visit);
    }
    visit(tree);
    const frontmatter = (file.data.astro as { frontmatter?: Record<string, unknown> } | undefined)?.frontmatter;
    const cover = frontmatter?.image ?? frontmatter?.ogImage;
    if (frontmatter && typeof cover === 'string' && cover && !(positive(frontmatter.coverImageWidth) && positive(frontmatter.coverImageHeight))) jobs.push(async () => {
      const width = frontmatter.image ? positive(frontmatter.imageWidth) : undefined;
      const height = frontmatter.image ? positive(frontmatter.imageHeight) : undefined;
      const dimensions = width && height ? { width, height } : await size(cover, file);
      if (dimensions) { frontmatter.coverImageWidth = dimensions.width; frontmatter.coverImageHeight = dimensions.height; }
    });
    for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map(job => job()));
  }
  return transform;
}
