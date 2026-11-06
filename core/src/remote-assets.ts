import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fromHtml } from 'hast-util-from-html';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { mdxjs } from 'micromark-extension-mdxjs';
import { parse } from 'yaml';
import { contentComponentSyntax } from './content-component-syntax.js';

const media = new Set(['img', 'image', 'video', 'audio', 'source', 'track', 'embed', 'object']);
const assetKeys = new Set(['logo', 'favicon', 'image', 'ogImage', 'twitterImage', 'ogVideo', 'poster']);
const mediaFile = /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp|woff2?|ttf|otf|eot|mp4|webm|mov|mp3|m4a|wav|ogg|pdf)$/i;

function checker(filename: string) {
  return (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return;
    try {
      const url = new URL(value.startsWith('//') ? `https:${value}` : value);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return;
    } catch { /* Relative URLs are local assets. */ }
    throw new Error(`Lettercamp Cloud requires remotely hosted assets. ${filename} references ${JSON.stringify(value)}. Upload the asset with lettercamp upload, then replace its reference with the returned URL. Local assets remain supported by lettercamp dev and lettercamp build.`);
  };
}

function cssAssets(css: string, check: ReturnType<typeof checker>) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
    const url = (match[1] ?? match[2] ?? match[3]).trim()
      .replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/\\(.)/g, '$1');
    if (!url.startsWith('#')) check(url); // Inline SVG filters are not file references.
  }
}

function elementAssets(tag: string, props: Record<string, unknown>, check: ReturnType<typeof checker>) {
  tag = tag.toLowerCase();
  if (media.has(tag)) {
    for (const key of ['src', 'poster', 'data', ...(tag === 'image' ? ['href', 'xLinkHref'] : [])]) check(props[key]);
    const srcset = props.srcSet ?? props.srcset;
    if (typeof srcset === 'string') for (const candidate of srcset.split(',')) check(candidate.trim().split(/\s+/, 1)[0]);
  }
  if (tag === 'link') {
    const rel = String(props.rel ?? '').toLowerCase();
    if (/icon/.test(rel) || rel === 'preload' && ['image', 'font', 'video', 'audio'].includes(String(props.as))) check(props.href);
  }
  if (tag === 'meta' && /^(?:og:(?:image|video|audio)(?::url|:secure_url)?|twitter:image(?::src)?)$/.test(String(props.property ?? props.name))) check(props.content);
  if (typeof props.style === 'string') cssAssets(props.style, check);
}

function htmlAssets(html: string, check: ReturnType<typeof checker>) {
  const tree = fromHtml(html, { fragment: true });
  function visit(node: typeof tree | (typeof tree.children)[number]) {
    if (node.type === 'element') {
      elementAssets(node.tagName, node.properties, check);
      if (node.tagName === 'style') cssAssets(node.children.filter(child => child.type === 'text').map(child => child.value).join(''), check);
    }
    if ('children' in node) for (const child of node.children) visit(child);
  }
  visit(tree);
}

function metadataAssets(value: unknown, check: ReturnType<typeof checker>, parent = '') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (assetKeys.has(key) || key === 'url' && ['headingFont', 'bodyFont'].includes(parent)) check(child);
    else metadataAssets(child, check, key);
  }
}

// Include drafts and settings that may not appear in the current rendered pages.
export async function assertRemoteSourceAssets(directory: string) {
  const settings = JSON.parse(await readFile(path.join(directory, 'settings.json'), 'utf8'));
  if (settings.design?.typography?.localFonts === true) {
    throw new Error('Lettercamp Cloud requires remotely hosted fonts. Remove design.typography.localFonts or set it to false before deploying.');
  }
  metadataAssets(settings, checker('settings.json'));
  for (const name of await readdir(path.join(directory, 'pages'))) {
    if (!/\.mdx?$/.test(name)) continue;
    const check = checker(`pages/${name}`);
    let source = await readFile(path.join(directory, 'pages', name), 'utf8');
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
    if (frontmatter) {
      metadataAssets(parse(frontmatter[1]), check);
      source = source.slice(frontmatter[0].length);
    }
    const tree = fromMarkdown(source, {
      extensions: [name.endsWith('.mdx') ? mdxjs() : contentComponentSyntax()],
      mdastExtensions: [mdxFromMarkdown()],
    });
    const definitions = new Map<string, string>();
    function definitionsIn(node: (typeof tree) | (typeof tree.children)[number]) {
      if (node.type === 'definition') definitions.set(node.identifier, node.url);
      if ('children' in node) for (const child of node.children) definitionsIn(child);
    }
    definitionsIn(tree);
    function visit(node: (typeof tree) | (typeof tree.children)[number]) {
      if (node.type === 'image') check(node.url);
      if (node.type === 'imageReference') check(definitions.get(node.identifier));
      if (node.type === 'html') htmlAssets(node.value, check);
      if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
        const props: Record<string, unknown> = {};
        for (const attr of node.attributes) {
          if (attr.type !== 'mdxJsxAttribute') continue;
          if (typeof attr.value === 'string') props[attr.name] = attr.value;
          else if (attr.value) {
            const statement = attr.value.data?.estree?.body[0];
            if (statement?.type === 'ExpressionStatement' && statement.expression.type === 'Literal') props[attr.name] = statement.expression.value;
          }
        }
        elementAssets(node.name ?? '', props, check);
      }
      if ('children' in node) for (const child of node.children) visit(child);
    }
    visit(tree);
  }
}

// Check actual output too: components and imported styles can introduce assets
// that do not appear as literal references in Markdown or settings.
export async function assertRemoteBuiltAssets(directory: string) {
  async function visit(relative: string) {
    for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
      const filename = path.join(relative, entry.name);
      if (entry.isDirectory()) await visit(filename);
      else if (mediaFile.test(entry.name)) throw new Error(`Lettercamp Cloud cannot publish local asset ${filename}. Upload it with lettercamp upload and use its hosted URL.`);
      else if (/\.(html|css)$/.test(entry.name)) {
        const source = await readFile(path.join(directory, filename), 'utf8');
        if (entry.name.endsWith('.html')) htmlAssets(source, checker(filename));
        else cssAssets(source, checker(filename));
      }
    }
  }
  await visit('');
}
