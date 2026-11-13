import { readFile } from "node:fs/promises";
import { mdxjs } from "micromark-extension-mdxjs";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfm } from "micromark-extension-gfm";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { mdxFromMarkdown } from "mdast-util-mdx";
import type { Construct, Extension, State } from "micromark-util-types";
import type { Root, Nodes } from "mdast";
import { contentComponentNames, isContentComponent, renderContentComponents } from "./content-components.js";

// Opt .md files into JSX only for built-in tags. Ordinary HTML, autolinks,
// indented code, and prose containing braces retain normal Markdown behavior.
export function contentComponentSyntax(): Extension {
  const jsx = mdxjs();
  const gate = (construct: Construct | Construct[]): Construct => ({
    name: "lettercampComponent",
    tokenize(effects, ok, nok) {
      const check: Construct = { partial: true, tokenize(effects, ok, nok) {
        let name = "", first = true;
        return start;
        function start(code: number | null): ReturnType<State> {
          if (first) { first = false; effects.enter("data"); effects.consume(code!); return start; }
          if (code === 47 && !name) { effects.consume(code); return nameStart; }
          return nameStart(code);
        }
        function nameStart(code: number | null): ReturnType<State> {
          if (code !== null && /[A-Za-z]/.test(String.fromCharCode(code))) { name += String.fromCharCode(code); effects.consume(code); return nameStart; }
          effects.exit("data");
          return contentComponentNames.includes(name as typeof contentComponentNames[number]) && (code === 62 || code === 47 || code === 32 || code === 9 || code === -4 || code === -5 || code === -3) ? ok(code) : nok(code);
        }
      } };
      return effects.check(check, effects.attempt(construct, ok, nok), nok);
    },
  });
  return { flow: { 60: gate(jsx.flow![60]!) }, text: { 60: gate(jsx.text![60]!) } };
}

// JSX indentation inside a built-in is layout, not an indented code block.
// Reparse only those source ranges, retaining ordinary Markdown everywhere else.
export function normalizeContentComponentSyntax(tree: Root, source: string) {
  const visit = (node: Nodes): Nodes => {
    if (isContentComponent(node) && node.position?.start.offset !== undefined && node.position.end.offset !== undefined) {
      const parsed = fromMarkdown(source.slice(node.position.start.offset, node.position.end.offset), {
        extensions: [gfm(), contentComponentSyntax(), { disable: { null: ["codeIndented"] } }],
        mdastExtensions: [gfmFromMarkdown(), mdxFromMarkdown()],
      });
      if (parsed.children.length === 1 && isContentComponent(parsed.children[0])) return parsed.children[0];
    }
    if ("children" in node) node.children = node.children.map(visit) as typeof node.children;
    return node;
  };
  tree.children = tree.children.map(visit) as Root["children"];
}

export function contentComponents(this: { data(): object }, options: { settingsPath?: string } = {}) {
  const data = this.data() as Record<string, unknown>;
  for (const [name, extension] of [["micromarkExtensions", contentComponentSyntax()], ["fromMarkdownExtensions", mdxFromMarkdown()]] as const) {
    const extensions = (data[name] ??= []) as unknown[];
    extensions.push(extension);
  }
  return async (tree: Root, file: { extname?: string; value: unknown }) => {
    if (file.extname !== ".mdx") normalizeContentComponentSyntax(tree, String(file.value));
    const siteName = options.settingsPath ? JSON.parse(await readFile(options.settingsPath, "utf8")).name : undefined;
    renderContentComponents(tree, siteName);
  };
}
