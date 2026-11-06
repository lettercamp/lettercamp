type ContentNode = { type: string; value?: string; children?: ContentNode[] };

// Runs on parsed Markdown/MDX, so frontmatter, imports, URLs, and JSX
// attributes never count as prose. Runtime-generated component text is unknown.
export function readingTime() {
  return (tree: ContentNode, file: { data: Record<string, unknown> }) => {
    const text: string[] = [];
    function visit(node: ContentNode) {
      if (node.type === 'text' || node.type === 'inlineCode') text.push(node.value ?? '');
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree);
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    let words = 0;
    for (const segment of segmenter.segment(text.join(' '))) {
      if (segment.isWordLike) words++;
    }
    const astro = file.data.astro as { frontmatter?: Record<string, unknown> } | undefined;
    if (astro?.frontmatter) {
      // Always overwrite frontmatter: this is derived content, not an override.
      astro.frontmatter.readingMinutes = Math.max(1, Math.ceil(words / 200));
    }
  };
}
