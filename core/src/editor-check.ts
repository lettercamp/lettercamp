import type { Nodes } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { gfm } from 'micromark-extension-gfm';
import { mdxjs } from 'micromark-extension-mdxjs';
import { isMap, parseDocument } from 'yaml';
import { expandContentComponent, importedComponentNames, isContentElement } from './content-components.js';
import type { SourceFile } from './deployment-images.js';
import { textStyles } from './text-styles.js';

export type EditorWarning = { code: 'editor-source-only' | 'editor-placeholders-only'; file: string; message: string };

function hasEditableContent(node: Nodes, imported: Set<string>): boolean {
  if (isContentElement(node)) {
    if (!node.name || imported.has(node.name)) return false;
    if (expandContentComponent(node)) return true;

    // Older posts can contain the editor's own serialized media, styles and blocks.
    // Give these shapes the benefit of the doubt. A custom wrapper's children,
    // including ordinary text, are hidden inside its placeholder.
    const attr = (name: string) => node.attributes.find(a => a.type === 'mdxJsxAttribute' && a.name === name);
    switch (node.name) {
      case 'img': case 'video': case 'audio': return !!attr('src');
      case 'figure': case 'a': return node.children.some(child => isContentElement(child) && hasEditableContent(child, imported));
      case 'div': case 'span': {
        if (node.attributes.some(a => a.type === 'mdxJsxAttribute' &&
          /^data-lettercamp-(?:key-takeaways|table|faq|subscribe|embed)$/.test(a.name))) return true;
        const style = attr('style');
        if (style?.type === 'mdxJsxAttribute' && Object.keys(textStyles(style.value)).length) {
          return node.children.some(child => hasEditableContent(child, imported));
        }
        return node.name === 'span' && node.children.some(child => isContentElement(child) && hasEditableContent(child, imported));
      }
      default: return false;
    }
  }
  switch (node.type) {
    case 'text': case 'inlineCode': return !!node.value.trim();
    case 'image': case 'code': case 'table': case 'thematicBreak': return true;
    default: return 'children' in node && node.children.some(child => hasEditableContent(child, imported));
  }
}

function checkPage(file: string, source: string): EditorWarning | undefined {
  const frontmatter = /^\uFEFF?---\r?\n(?:([\s\S]*?)\r?\n)?---(?:\r?\n|$)/.exec(source);
  const body = source.slice(frontmatter?.[0].length ?? 0).trim();
  if (!body) return;
  if (/^\uFEFF?---\r?\n/.test(source)) {
    const yaml = parseDocument(frontmatter?.[1] ?? '');
    if (!frontmatter || yaml.errors.length || (yaml.contents !== null && !isMap(yaml.contents))) {
      return { code: 'editor-source-only', file, message: 'Edit mode cannot read the frontmatter. Use a YAML mapping between two --- lines.' };
    }
  }
  try {
    // The rich editor parses both .md and .mdx bodies with MDX enabled.
    const tree = fromMarkdown(body, { extensions: [gfm(), mdxjs()], mdastExtensions: [gfmFromMarkdown(), mdxFromMarkdown()] });
    if (tree.children.some(node => node.type === 'definition' || node.type === 'footnoteDefinition')) {
      return { code: 'editor-source-only', file, message: 'The rich editor cannot import reference definitions. Use inline links or images, or edit this post in Source.' };
    }
    const imported = importedComponentNames(tree);
    if (!tree.children.some(node => hasEditableContent(node, imported))) {
      return { code: 'editor-placeholders-only', file, message: 'The body appears to have no editable article content. Put article copy in Markdown or built-in content blocks. Custom components can stay alongside it.' };
    }
  } catch {
    return { code: 'editor-source-only', file, message: 'The rich editor could not parse the article body. Check its Markdown or MDX syntax in Source.' };
  }
}

export function editorWarnings(files: SourceFile[]): EditorWarning[] {
  const warnings: EditorWarning[] = [];
  for (const file of files) {
    if (!/^pages\/(?!index\.mdx?$)[^/]+\.mdx?$/.test(file.path)) continue;
    const warning = checkPage(file.path, Buffer.from(file.content, 'base64').toString('utf8'));
    if (warning) warnings.push(warning);
  }
  return warnings;
}
