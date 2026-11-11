type Node = { type: string; url?: string; data?: object; attributes?: { type: string; name?: string | null; value?: unknown }[]; children?: Node[] };

// Root-relative links in Markdown and literal MDX attributes belong to the publication.
// Absolute URLs and anchors retain their authored meaning.
export function publicationLinks(options: { basePath: string }) {
  const base = options.basePath.replace(/\/+$/, '');
  const prefix = (value: string) => value.startsWith('/') && !value.startsWith('//') ? base + value.replace(/^\/(?=[?#]|$)/, '') : value;
  return (tree: Node) => {
    if (!base) return;
    function visit(node: Node) {
      if (['link', 'image', 'definition'].includes(node.type) && node.url) node.url = prefix(node.url);
      if (node.type === 'lettercampElement') {
        const properties = (node.data as { hProperties?: Record<string, unknown> } | undefined)?.hProperties;
        for (const name of ['href', 'src', 'poster']) {
          if (properties && typeof properties[name] === 'string') properties[name] = prefix(properties[name]);
        }
      }
      if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
        for (const attribute of node.attributes ?? []) {
          if (attribute.type === 'mdxJsxAttribute' && ['href', 'src', 'poster'].includes(attribute.name ?? '') && typeof attribute.value === 'string') attribute.value = prefix(attribute.value);
        }
      }
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree);
  };
}
