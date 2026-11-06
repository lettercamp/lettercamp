type MarkdownNode = {
  type: string;
  name?: string | null;
  attributes?: { type: string; name?: string; value?: unknown }[] | Record<string, string | null | undefined> | null;
  children?: MarkdownNode[];
  data?: object;
};

// Give standalone components a real layout container without passing editor
// props to user code. Keep component children opaque and inline JSX inline.
export function componentBlocks() {
  return (tree: MarkdownNode) => {
    const visit = (parent: MarkdownNode) => {
      if (!parent.children) return;
      parent.children = parent.children.map(node => {
        if (node.type === "mdxJsxFlowElement") {
          if (Array.isArray(node.attributes) && node.attributes.some(attribute => attribute.type === "mdxJsxAttribute" && attribute.name === "data-lettercamp-component")) return node;
          if (!node.name || !/^[a-z][a-z0-9-]*$/.test(node.name)) return wrap(node);
        } else if (node.type === "mdxFlowExpression" && (node.data as { estree?: { body: unknown[] } | null })?.estree?.body.length) return wrap(node);
        else if (node.type !== "mdxJsxTextElement") visit(node);
        return node;
      });
    };
    visit(tree);
  };
}

function wrap(node: MarkdownNode): MarkdownNode {
  return {
    type: "mdxJsxFlowElement", name: "div",
    attributes: [{ type: "mdxJsxAttribute", name: "data-lettercamp-component", value: "" },
      { type: "mdxJsxAttribute", name: "data-block-width", value: "regular" }],
    children: [node],
  };
}
