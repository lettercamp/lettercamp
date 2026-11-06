import { resolveCodeLanguage } from "./code-detection.js";
import { languages } from "@codemirror/language-data";
import { classHighlighter, highlightTree } from "@lezer/highlight";
import { readCodeSettings } from "./code-block.js";

type Text = { type: "text"; value: string };
type Element = { type: "element"; tagName: string; properties: Record<string, string | number | boolean | string[]>; children: (Element | Text)[] };
type MarkdownNode = { type: string; value?: string; lang?: string | null; meta?: string | null; children?: MarkdownNode[]; data?: object };
const element = (tagName: string, properties: Element["properties"], children: Element["children"]): Element => ({ type: "element", tagName, properties, children });

export function findCodeLanguage(language: string) {
  const name = language.toLowerCase();
  if (!name || ["text", "txt", "plaintext"].includes(name)) return undefined;
  return languages.find(item => item.alias.includes(name) || item.name.toLowerCase() === name || item.name.toLowerCase().replace(/\s+/g, "-") === name || item.extensions.includes(name));
}

export async function renderCodeBlock(code: string, language = "", meta = "") {
  const settings = readCodeSettings(meta);
  const lines: Element[] = [element("span", { className: ["code-line"] }, [])];
  const append = (value: string, classes?: string) => {
    value.split("\n").forEach((part, index) => {
      if (index) lines.push(element("span", { className: ["code-line"] }, []));
      if (part) lines.at(-1)!.children.push(classes ? element("span", { className: classes.split(" ") }, [{ type: "text", value: part }]) : { type: "text", value: part });
    });
  };
  let offset = 0;
  try {
    const support = await findCodeLanguage(await resolveCodeLanguage(code, language))?.load();
    if (support) highlightTree(support.language.parser.parse(code), classHighlighter, (from, to, classes) => {
      append(code.slice(offset, from)); append(code.slice(from, to), classes); offset = to;
    });
  } catch { /* Unknown or unavailable grammars still render as readable code. */ }
  append(code.slice(offset));
  const children: Element[] = [element("pre", { tabIndex: 0 }, [element("code", {}, lines.flatMap((line, index) => index ? [{ type: "text" as const, value: "\n" }, line] : [line]))])];
  if (settings.caption) children.push(element("figcaption", {}, [{ type: "text", value: settings.caption }]));
  return element("figure", { dataLettercampCode: "", dataCodeWidth: settings.width, dataCodeWrap: String(settings.wrap), dataCodeTheme: settings.theme }, children);
}

// Render a custom block node so Markdown and MDX do not add a second pre wrapper.
export function codeBlocks() {
  return async (tree: MarkdownNode) => {
    const visit = async (node: MarkdownNode): Promise<void> => {
      if (node.type === "code") {
        const block = await renderCodeBlock(node.value ?? "", node.lang ?? "", node.meta ?? "");
        node.type = "lettercampCode";
        node.data = { ...node.data, hName: block.tagName, hProperties: block.properties, hChildren: block.children };
      }
      await Promise.all((node.children ?? []).map(visit));
    };
    await visit(tree);
  };
}
