import { subscribeDefaults, subscribeTitle } from "./subscribe.js";
import { normalizeEmbed, embedFrame, embedProvider } from "./embeds.js";
import type { Nodes, Root, RootContent } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx";
import { readCodeSettings, writeCodeSettings } from "./code-block.js";
import { textStyleString } from "./text-styles.js";

export const contentComponentNames = ["Subscribe", "KeyTakeaways", "FAQ", "FAQItem", "Image", "Video", "Audio", "Embed", "CodeBlock", "Table", "TableRow", "TableCell"] as const;
export type ContentElement = MdxJsxFlowElement | MdxJsxTextElement;
export type ComponentValue = string | number | boolean | number[];
export const isContentElement = (node: Nodes): node is ContentElement => node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";
export const isContentComponent = (node: Nodes): node is ContentElement => isContentElement(node) && contentComponentNames.includes(node.name as typeof contentComponentNames[number]);

// Only literal values are interpreted. Expressions, spreads, and user code stay opaque.
export function componentProps(node: ContentElement): Record<string, ComponentValue> | null {
  const props: Record<string, ComponentValue> = {};
  for (const attribute of node.attributes) {
    if (attribute.type !== "mdxJsxAttribute" || Object.hasOwn(props, attribute.name)) return null;
    if (attribute.value == null) props[attribute.name] = true;
    else if (typeof attribute.value === "string") props[attribute.name] = attribute.value;
    else {
      const statement = attribute.value.data?.estree?.body[0];
      const expression = statement?.type === "ExpressionStatement" ? statement.expression : null;
      if (expression?.type === "Literal" && ["string", "number", "boolean"].includes(typeof expression.value)) props[attribute.name] = expression.value as ComponentValue;
      else if (expression?.type === "ArrayExpression" && expression.elements.every(item => item?.type === "Literal" && typeof item.value === "number")) {
        props[attribute.name] = expression.elements.map(item => (item as { value: number }).value);
      } else {
        // Source writers can construct literal attributes before a parser has
        // attached ESTree metadata. JSON parsing never evaluates user code.
        let value: unknown;
        try { value = JSON.parse(attribute.value.value); } catch { return null; }
        if (["string", "number", "boolean"].includes(typeof value) || Array.isArray(value) && value.every(item => typeof item === "number")) props[attribute.name] = value as ComponentValue;
        else return null;
      }
    }
  }
  return props;
}

export function contentElement(name: string, props: Record<string, ComponentValue | undefined>, children: Nodes[] = [], inline = false): ContentElement {
  return {
    type: inline ? "mdxJsxTextElement" : "mdxJsxFlowElement", name,
    attributes: Object.entries(props).filter(([, value]) => value !== undefined).map(([name, value]) => ({
      type: "mdxJsxAttribute", name, value: typeof value === "string" ? value : value === true ? null : {
        type: "mdxJsxAttributeValueExpression", value: JSON.stringify(value),
      },
    })), children, data: { lettercampBuiltin: true },
  } as ContentElement;
}

// Legacy HTML uses string attributes so existing editor visitors can read it.
const html = (name: string, props: Record<string, ComponentValue | undefined>, children: Nodes[] = [], inline = false) =>
  contentElement(name, Object.fromEntries(Object.entries(props).map(([key, value]) => [key, value === undefined ? undefined : String(value)])), children, inline);
const meaningful = (nodes: Nodes[]) => nodes.filter(node => node.type !== "text" || node.value.trim());
const widthOf = (value: ComponentValue | undefined) => value === "wide" || value === "full" ? value : "regular";
const positive = (value: ComponentValue | undefined) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : undefined;
const allowed = (props: Record<string, ComponentValue>, names: string[]) => Object.keys(props).every(name => names.includes(name));

export function expandContentComponent(node: Nodes, siteName?: string): Nodes | null {
  if (!isContentComponent(node)) return null;
  const props = componentProps(node);
  if (!props) return null;
  if (props.width !== undefined && !["regular", "wide", "full"].includes(String(props.width))) return null;
  const inline = node.type === "mdxJsxTextElement";
  switch (node.name) {
    case "Subscribe": {
      if (inline || !allowed(props, ["title", "description", "buttonLabel", "width"]) || meaningful(node.children).length) return null;
      if (["title", "description", "buttonLabel"].some(key => props[key] !== undefined && typeof props[key] !== "string")) return null;
      const title = props.title ?? subscribeTitle(siteName), description = props.description ?? subscribeDefaults.description;
      const buttonLabel = props.buttonLabel || subscribeDefaults.buttonLabel;
      return html("div", { "data-lettercamp-subscribe": "true", "data-block-width": widthOf(props.width),
        "data-subscribe-props": JSON.stringify(props), "data-subscribe-card": "" }, [
        ...(title ? [html("h2", { "data-subscribe-title": "", "data-subscribe-default-title": props.title === undefined ? "" : undefined }, [{ type: "text", value: String(title) }])] : []),
        ...(description ? [html("p", { "data-subscribe-description": "" }, [{ type: "text", value: String(description) }])] : []),
        html("form", { "data-subscribe-form": "", "data-lettercamp-native-subscribe": "", method: "post" }, [
          html("label", { "data-subscribe-label": "" }, [html("input", { type: "email", name: "email", autoComplete: "email", "aria-label": "Email address", placeholder: "Type your email...", required: true, maxLength: 254 })]),
          html("label", { "data-subscribe-trap": "", "aria-hidden": "true" }, [{ type: "text", value: "Website" }, html("input", { type: "text", name: "website", tabIndex: -1, autoComplete: "off" })]),
          html("button", { "data-subscribe-button": "", type: "submit", disabled: true }, [{ type: "text", value: String(buttonLabel) }]),
        ]),
        html("p", { "data-subscribe-message": "", role: "status", "aria-live": "polite" }),
      ]);
    }
    case "Embed": {
      if (inline || !allowed(props, ["src", "title", "pixelWidth", "pixelHeight", "width", "caption", "fallback"]) || typeof props.src !== "string" || meaningful(node.children).length) return null;
      const embed = normalizeEmbed({ src: props.src, title: typeof props.title === "string" ? props.title : undefined,
        pixelWidth: positive(props.pixelWidth), pixelHeight: positive(props.pixelHeight), width: widthOf(props.width), caption: typeof props.caption === "string" ? props.caption : undefined, fallback: typeof props.fallback === "string" ? props.fallback : undefined });
      const frame = embedFrame(embed);
      return html("div", { "data-lettercamp-embed": "true", "data-embed-src": embed.src, "data-embed-title": embed.title,
        "data-embed-width": embed.pixelWidth, "data-embed-height": embed.pixelHeight, "data-block-width": embed.width, "data-embed-caption": embed.caption, "data-embed-text-value": embed.fallback,
      }, frame ? [...(embedProvider(embed.src)?.provider === "x" ? [html("blockquote", { "data-embed-text": "true" }, [{ type: "text", value: embed.fallback || "View this post on X" }])] : []), html("iframe", { ...frame, style: `--embed-ratio: ${embed.pixelWidth} / ${embed.pixelHeight}` }),
        ...(embed.caption ? [html("figcaption", {}, [{ type: "text", value: embed.caption }])] : [])] : []);
    }
    case "FAQ": {
      if (inline || !allowed(props, ["width"])) return null;
      const items = meaningful(node.children.flatMap<Nodes>(child => child.type === "paragraph" ? child.children : [child]));
      const details: ContentElement[] = [];
      for (const item of items) {
        if (!isContentElement(item) || item.name !== "FAQItem") return null;
        const itemProps = componentProps(item);
        if (!itemProps || !allowed(itemProps, ["question"]) || typeof itemProps.question !== "string") return null;
        details.push(html("details", {}, [
          html("summary", {}, [{ type: "paragraph", children: [{ type: "text", value: itemProps.question }] }]),
          html("div", { "data-faq-answer": "true" }, item.children),
        ]));
      }
      return html("div", { "data-lettercamp-faq": "true", "data-block-width": widthOf(props.width) }, details);
    }
    case "KeyTakeaways":
      return allowed(props, ["width"]) && !inline ? html("div", { "data-lettercamp-key-takeaways": "true", "data-block-width": widthOf(props.width) }, node.children) : null;
    case "Image": case "Video": case "Audio": {
      const image = node.name === "Image", audio = node.name === "Audio";
      if (!allowed(props, ["src", "alt", "width", "caption", "title", "pixelWidth", "pixelHeight", ...(image ? ["href", "newTab"] : [])]) || typeof props.src !== "string" || meaningful(node.children).length) return null;
      if (props.newTab !== undefined && typeof props.newTab !== "boolean") return null;
      let media = html(image ? "img" : audio ? "audio" : "video", {
        src: props.src, ...(image ? { alt: props.alt ?? "" } : { controls: "" }), title: props.title,
        width: positive(props.pixelWidth), height: positive(props.pixelHeight),
        "data-image-width": audio ? undefined : widthOf(props.width), "data-block-width": audio ? widthOf(props.width) : undefined,
      }, [], inline);
      if (image && typeof props.href === "string" && props.href) media = html("a", { href: props.href, ...(props.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {}) }, [media], inline);
      if (typeof props.caption === "string" && props.caption) {
        const caption: Nodes = { type: "text", value: props.caption };
        media = html(inline ? "span" : "figure", {}, [media, html(inline ? "small" : "figcaption", {}, [inline ? caption : { type: "paragraph", children: [caption] }], inline)], inline);
      }
      return media;
    }
    case "CodeBlock": {
      const children = meaningful(node.children), code = children[0];
      if (!allowed(props, ["width", "caption", "wrap", "theme"]) || inline || children.length !== 1 || code?.type !== "code") return null;
      if (props.wrap !== undefined && typeof props.wrap !== "boolean") return null;
      if (props.theme !== undefined && !["classic", "ocean", "forest", "mono"].includes(String(props.theme))) return null;
      const settings = readCodeSettings(code.meta ?? "");
      return { ...code, meta: writeCodeSettings(code.meta ?? "", { ...settings,
        ...(props.width !== undefined ? { width: widthOf(props.width) } : {}),
        ...(typeof props.caption === "string" ? { caption: props.caption } : {}),
        ...(typeof props.wrap === "boolean" ? { wrap: props.wrap } : {}),
        ...(props.theme !== undefined ? { theme: props.theme as typeof settings.theme } : {}),
      }) };
    }
    case "Table": return !inline ? expandTable(node, props) : null;
    default: return null;
  }
}

function expandTable(node: ContentElement, props: Record<string, ComponentValue>): Nodes | null {
  if (!allowed(props, ["width", "pixelWidth", "columnWidths", "rowHeight"])) return null;
  const children = meaningful(node.children.flatMap(child => child.type === "paragraph" ? child.children : [child]));
  let rows: ContentElement[];
  if (children.length === 1 && children[0].type === "table") {
    const table = children[0];
    rows = table.children.map((row, r) => contentElement("TableRow", {}, row.children.map((cell, c) => contentElement("TableCell", {
      header: r === 0 || undefined, align: table.align?.[c] ?? undefined,
    }, [{ type: "paragraph", children: cell.children }]))));
  } else if (children.every(child => isContentElement(child) && child.name === "TableRow")) rows = children as ContentElement[];
  else return null;
  if (!rows.length) return null;
  const converted: ContentElement[] = [];
  const occupied: boolean[][] = rows.map(() => []);
  const heights = rows.map(row => positive(componentProps(row)?.height) ?? positive(props.rowHeight));
  let columnCount = 0;
  for (const [r, row] of rows.entries()) {
    const rowProps = componentProps(row);
    if (!rowProps || !allowed(rowProps, ["height"])) return null;
    const cells: ContentElement[] = [];
    let c = 0;
    for (const cell of meaningful(row.children.flatMap(child => child.type === "paragraph" ? child.children : [child]))) {
      if (!isContentElement(cell) || cell.name !== "TableCell") return null;
      const p = componentProps(cell);
      if (!p || !allowed(p, ["header", "colSpan", "rowSpan", "align", "color", "background"]) || p.header !== undefined && typeof p.header !== "boolean") return null;
      while (occupied[r][c]) c++;
      const colSpan = Math.max(1, Math.floor(positive(p.colSpan) ?? 1)), rowSpan = Math.min(rows.length - r, Math.max(1, Math.floor(positive(p.rowSpan) ?? 1)));
      for (let y = r; y < r + rowSpan; y++) for (let x = c; x < c + colSpan; x++) occupied[y][x] = true;
      const style = textStyleString([p.color && `color: ${p.color}`, p.background && `background-color: ${p.background}`, p.align && `text-align: ${p.align}`].filter(Boolean).join("; "));
      const cellHeights = heights.slice(r, r + rowSpan);
      const height = (rowSpan > 1 || colSpan > 1) && cellHeights.every(value => value !== undefined) ? Math.max(0, cellHeights.reduce((sum, value) => sum + value!, 0) - 1) : undefined;
      // The same content viewport preserves merged-cell heights in editor and output.
      cells.push(html(p.header ? "th" : "td", { colSpan: colSpan > 1 ? colSpan : undefined, rowSpan: rowSpan > 1 ? rowSpan : undefined,
        style: [style, height !== undefined ? `--table-cell-height: ${height}px` : ""].filter(Boolean).join("; ") || undefined,
        "data-table-cell-height": height,
      }, [html("span", { "data-table-content": "true" }, cell.children.flatMap(child => child.type === "paragraph" ? child.children : [child]), true)]));
      c += colSpan;
    }
    columnCount = Math.max(columnCount, occupied[r].length);
    converted.push(html("tr", { height: heights[r] }, cells));
  }
  const requested = Array.isArray(props.columnWidths) ? props.columnWidths : typeof props.columnWidths === "string" ? props.columnWidths.split(",").map(Number) : undefined;
  if (requested && (requested.length !== columnCount || requested.some(value => !Number.isFinite(value) || value <= 0))) return null;
  const widths = requested ?? Array<number>(columnCount).fill(1), total = widths.reduce((sum, width) => sum + width, 0);
  const pixelWidth = positive(props.pixelWidth);
  return html("div", { "data-lettercamp-table": "true", "data-table-width": widthOf(props.width), "data-table-pixel-width": pixelWidth,
    style: pixelWidth ? `--table-pixel-width: ${pixelWidth}px` : undefined, "data-row-height": positive(props.rowHeight) }, [html("table", {}, [
    html("colgroup", {}, widths.map(width => html("col", { width: `${width / total * 100}%` }))), html("tbody", {}, converted),
  ])]);
}

export function codeComponent(code: Extract<Nodes, { type: "code" }>): ContentElement {
  const settings = readCodeSettings(code.meta ?? "");
  const meta = (code.meta ?? "").replace(/(?:^|\s)lc-(width|wrap|theme|caption)=[^\s]*/g, "").trim();
  return contentElement("CodeBlock", {
    width: settings.width === "regular" ? undefined : settings.width,
    wrap: settings.wrap ? undefined : false, theme: settings.theme === "classic" ? undefined : settings.theme,
    caption: settings.caption || undefined,
  }, [{ ...code, meta: meta || null }]);
}

// Imported JSX components with matching names retain their original meaning.
export function importedComponentNames(tree: Root): Set<string> {
  const names = new Set<string>();
  for (const node of tree.children) if (node.type === "mdxjsEsm") {
    for (const statement of node.data?.estree?.body ?? []) if (statement.type === "ImportDeclaration") {
      for (const specifier of statement.specifiers) names.add(specifier.local.name);
    }
  }
  return names;
}

// Lower built-ins to the existing HTML contract before highlighting and layout.
// Generic mdast nodes with hName work in both Markdown and Astro's MDX compiler.
export function renderContentComponents(tree: Root, siteName?: string) {
  const imported = importedComponentNames(tree);
  // Markdown needs a paragraph context to escape question text when exporting
  // legacy HTML. A native summary only accepts phrasing content on the page.
  const childrenOf = (node: Nodes & { children: Nodes[] }): Nodes[] =>
    isContentElement(node) && node.name === "summary"
      ? node.children.flatMap<Nodes>(child => child.type === "paragraph" ? child.children : [child]) : node.children;
  const visit = (node: Nodes): Nodes => {
    // Plain Markdown tables use the same layout as tables edited in rich mode.
    if (node.type === "table") return lower(expandTable(contentElement("Table", {}, [node]), {})!);
    if (isContentComponent(node) && !imported.has(node.name!)) {
      const expanded = expandContentComponent(node, siteName);
      if (!expanded) throw new Error(`Invalid <${node.name}> component. Use supported literal properties and children.`);
      return lower(expanded);
    }
    if ("children" in node) node.children = childrenOf(node).map(visit) as typeof node.children;
    return node;
  };
  const lower = (node: Nodes): Nodes => {
    if (isContentElement(node) && node.name && /^[a-z]/.test(node.name)) {
      const properties = componentProps(node) ?? {};
      // HAST/Astro require a boolean here; an empty JSX string is falsy and
      // would silently remove playback controls from published MDX pages.
      if (Object.hasOwn(properties, "controls")) properties.controls = true;
      const children = childrenOf(node).map(child => isContentElement(child) && child.name && /^[a-z]/.test(child.name) ? lower(child) : visit(child));
      return { type: "lettercampElement", data: { hName: node.name, hProperties: properties }, children } as unknown as Nodes;
    }
    return visit(node);
  };
  tree.children = tree.children.map(visit) as RootContent[];
}
