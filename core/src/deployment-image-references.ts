import { parse, parseExpression } from '@babel/parser';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { mdxjs } from 'micromark-extension-mdxjs';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { isScalar, parseDocument, visit } from 'yaml';
import { contentComponentSyntax } from './content-component-syntax.js';

export const imageFile = /\.(?:jpe?g|png|webp|gif|svg|avif|bmp|ico|tiff?|heic|heif)$/i;
type Image = { url: string; width: number; height: number; format: string };
type Resolve = (url: string) => Promise<Image | null>;
type Edit = { start: number; end: number; value: string };
const imageKeys = new Set(['logo', 'favicon', 'image', 'ogImage', 'twitterImage', 'poster']);
const isImage = (value: string) => imageFile.test(value.split(/[?#]/, 1)[0]);
const apply = (source: string, edits: Edit[]) => {
  for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
  return source;
};

async function metadata(source: string, resolve: Resolve) {
  const document = parseDocument(source);
  if (document.errors.length) throw document.errors[0];
  const edits: Edit[] = [];
  const jobs: Promise<void>[] = [];
  visit(document, { Pair(_key, pair) {
    if (!isScalar(pair.key) || !imageKeys.has(String(pair.key.value)) || !isScalar(pair.value) || typeof pair.value.value !== 'string' || !pair.value.range) return;
    const { value, range } = pair.value;
    jobs.push(resolve(value).then(image => { if (image) edits.push({ start: range[0], end: range[1], value: JSON.stringify(image.url) }); }));
  } });
  await Promise.all(jobs);
  return apply(source, edits);
}

async function urls(value: string, resolve: Resolve, srcset = false): Promise<string> {
  if (!srcset) return (await resolve(value))?.url ?? value;
  // Data URLs contain commas and are not local files.
  if (/\bdata:/i.test(value)) return value;
  return (await Promise.all(value.split(',').map(async candidate => {
    const match = /^(\s*)(\S+)([\s\S]*)$/.exec(candidate);
    return match ? match[1] + await urls(match[2], resolve) + match[3] : candidate;
  }))).join(',');
}

async function css(source: string, resolve: Resolve) {
  const edits: Edit[] = [];
  // Keep comment offsets intact while ignoring examples inside comments.
  const searchable = source.replace(/\/\*[\s\S]*?\*\//g, comment => ' '.repeat(comment.length));
  for (const match of searchable.matchAll(/url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^)]*?))\s*\)/gi)) {
    const value = (match[1] ?? match[2] ?? match[3]).trim().replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/\\(.)/g, '$1');
    if (!isImage(value)) continue;
    const image = await resolve(value);
    if (image) edits.push({ start: match.index!, end: match.index! + match[0].length, value: `url("${image.url}")` });
  }
  return apply(source, edits);
}

// Parse JavaScript/JSX instead of replacing quoted text in comments or code samples.
type SyntaxNode = { type: string; start?: number | null; end?: number | null; [key: string]: unknown };
async function javascript(source: string, resolve: Resolve, expression = false, mdx = false) {
  if (expression && !source.replace(/\/\*[\s\S]*?\*\//g, '').trim()) return source;
  const options = { plugins: ['jsx', 'typescript'] as ('jsx' | 'typescript')[] };
  const tree = expression ? parseExpression(source, options) : parse(source, { ...options, sourceType: 'module' });
  const edits: Edit[] = [];
  async function walk(value: unknown): Promise<void> {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { for (const child of value) await walk(child); return; }
    const node = value as SyntaxNode;
    if (node.type === 'ImportDeclaration') {
      const imported = node.source as SyntaxNode;
      if (typeof imported.value === 'string' && isImage(imported.value)) {
        const image = await resolve(imported.value);
        if (image) {
          const specifiers = node.specifiers as SyntaxNode[];
          if (specifiers.length !== 1 || specifiers[0].type !== 'ImportDefaultSpecifier') throw new Error('Local image imports must use a default import.');
          const name = (specifiers[0].local as SyntaxNode).name;
          // Astro image imports expose metadata; ?url explicitly requests a URL.
          const result = imported.value.endsWith('?url') ? image.url : { src: image.url, width: image.width, height: image.height, format: image.format };
          edits.push({ start: node.start!, end: node.end!, value: `${mdx ? 'export ' : ''}const ${name} = ${JSON.stringify(result)};` });
        }
      }
      return;
    }
    if (node.type === 'JSXAttribute') {
      const name = String((node.name as SyntaxNode).name);
      const attribute = node.value as SyntaxNode | null;
      if (attribute?.type === 'StringLiteral') {
        const original = String(attribute.value);
        const value = /^(srcset|imagesrcset)$/i.test(name) ? await urls(original, resolve, true)
          : name === 'style' ? await css(original, resolve) : isImage(original) ? await urls(original, resolve) : original;
        if (value !== original) edits.push({ start: attribute.start!, end: attribute.end!, value: JSON.stringify(value) });
        return;
      }
    }
    const literal = node.type === 'StringLiteral' ? node.value : node.type === 'TemplateLiteral' && !(node.expressions as unknown[]).length
      ? ((node.quasis as SyntaxNode[])[0].value as { cooked: string }).cooked : null;
    if (typeof literal === 'string') {
      const next = isImage(literal) ? await urls(literal, resolve) : /url\(/i.test(literal) ? await css(literal, resolve)
        : /\s\d+(?:\.\d+)?[wx](?:\s*,|\s*$)/.test(literal) ? await urls(literal, resolve, true) : literal;
      if (next !== literal) edits.push({ start: node.start!, end: node.end!, value: JSON.stringify(next) });
      return;
    }
    for (const [key, child] of Object.entries(node)) if (!['loc', 'comments', 'tokens', 'extra'].includes(key)) await walk(child);
  }
  await walk(tree);
  return apply(source, edits);
}

async function html(source: string, resolve: Resolve) {
  const tree = fromHtml(source, { fragment: true });
  let changed = false;
  async function walk(node: (typeof tree.children)[number]): Promise<void> {
    if (node.type === 'element') {
      for (const [key, value] of Object.entries(node.properties)) {
        if (typeof value !== 'string') continue;
        const next = /^(srcset|imagesrcset)$/i.test(key) ? await urls(value, resolve, true)
          : key === 'style' ? await css(value, resolve)
          : ['src', 'href', 'poster', 'content', 'xLinkHref'].includes(key) && isImage(value) ? await urls(value, resolve) : value;
        if (next !== value) { node.properties[key] = next; changed = true; }
      }
      if (node.tagName === 'style') for (const child of node.children) if (child.type === 'text') {
        const next = await css(child.value, resolve);
        if (next !== child.value) { child.value = next; changed = true; }
      }
    }
    if ('children' in node) for (const child of node.children) await walk(child);
  }
  for (const node of tree.children) await walk(node);
  return changed ? toHtml(tree) : source;
}

export async function rewriteImageReferences(source: string, filename: string, resolve: Resolve): Promise<string> {
  if (/\.json$/i.test(filename)) return metadata(source, resolve);
  if (/\.[cm]?[jt]sx?$/i.test(filename)) return javascript(source, resolve);
  if (/\.(?:css|scss)$/i.test(filename)) return css(source, resolve);
  if (!/\.mdx?$/i.test(filename)) return source;
  const frontmatter = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/.exec(source);
  let prefix = '';
  if (frontmatter) {
    prefix = frontmatter[1] + await metadata(frontmatter[2], resolve) + frontmatter[3];
    source = source.slice(frontmatter[0].length);
  }
  const tree = fromMarkdown(source, {
    extensions: [filename.endsWith('.mdx') ? mdxjs() : contentComponentSyntax()],
    mdastExtensions: [mdxFromMarkdown()],
  });
  const edits: Edit[] = [];
  const references = new Set<string>();
  function collect(node: (typeof tree.children)[number] | typeof tree) {
    if (node.type === 'imageReference') references.add(node.identifier);
    if ('children' in node) for (const child of node.children) collect(child);
  }
  collect(tree);
  async function walk(node: (typeof tree.children)[number] | typeof tree): Promise<void> {
    const start = node.position?.start.offset, end = node.position?.end.offset;
    if (start !== undefined && end !== undefined) {
      const original = source.slice(start, end);
      let value = original;
      if (node.type === 'image' || node.type === 'definition' && references.has(node.identifier)) {
        const image = await resolve(node.url);
        if (image) {
          const title = node.title ? ` ${JSON.stringify(node.title)}` : '';
          value = node.type === 'image' ? `![${(node.alt ?? '').replace(/[\\[\]]/g, '\\$&')}](${image.url}${title})`
            : `${original.slice(0, original.indexOf(']:') + 2)} ${image.url}${title}`;
        }
      } else if (node.type === 'html') value = await html(original, resolve);
      else if (node.type === 'mdxjsEsm') value = await javascript(original, resolve, false, true);
      else if (node.type === 'mdxFlowExpression' || node.type === 'mdxTextExpression') value = `{${await javascript(node.value, resolve, true)}}`;
      else if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
        for (const attribute of node.attributes) {
          if (attribute.type !== 'mdxJsxAttribute' || !attribute.position) continue;
          const a = attribute.position.start.offset!, b = attribute.position.end.offset!;
          if (typeof attribute.value === 'string') {
            const next = /^(srcset|imagesrcset)$/i.test(attribute.name) ? await urls(attribute.value, resolve, true)
              : attribute.name === 'style' ? await css(attribute.value, resolve)
              : isImage(attribute.value) ? await urls(attribute.value, resolve) : attribute.value;
            if (next !== attribute.value) edits.push({ start: a, end: b, value: `${attribute.name}=${JSON.stringify(next)}` });
          } else if (attribute.value) {
            const next = await javascript(attribute.value.value, resolve, true);
            if (next !== attribute.value.value) edits.push({ start: a, end: b, value: `${attribute.name}={${next}}` });
          }
        }
      }
      if (value !== original) { edits.push({ start, end, value }); return; }
    }
    if ('children' in node) for (const child of node.children) await walk(child);
  }
  await walk(tree);
  return prefix + apply(source, edits);
}
