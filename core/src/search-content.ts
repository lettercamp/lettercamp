import { fromHtml } from 'hast-util-from-html';

type Node = { type: string; name?: string | null; tagName?: string; value?: string; alt?: string | null; children?: Node[] };

// Extract authored text during compilation, never imports, JSX props, or
// expressions. Dynamic component output is not part of the static index.
export function searchContent() {
  return (tree: Node, file: { data: Record<string, unknown> }) => {
    const parts: string[] = [];
    function visit(node: Node) {
      if (['script', 'style', 'template'].includes((node.tagName ?? node.name ?? '').toLowerCase())) return;
      if (['text', 'inlineCode', 'code'].includes(node.type)) parts.push(node.value ?? '');
      if (node.type === 'image') parts.push(node.alt ?? '');
      if (node.type === 'html') visit(fromHtml(node.value ?? '', { fragment: true }));
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree);
    const astro = file.data.astro as { frontmatter?: Record<string, unknown> } | undefined;
    if (astro?.frontmatter) astro.frontmatter.searchText = parts.join(' ').replace(/\s+/g, ' ').trim();
  };
}
