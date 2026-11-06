export const codeThemes = { classic: "Classic", ocean: "Ocean", forest: "Forest", mono: "Monochrome" } as const;
export type CodeBlockSettings = { width: "regular" | "wide" | "full"; wrap: boolean; theme: keyof typeof codeThemes; caption: string };
const settingPattern = /(?:^|\s)lc-(width|wrap|theme|caption)=([^\s]*)/g;

export function readCodeSettings(meta = ""): CodeBlockSettings {
  const settings: CodeBlockSettings = { width: "regular", wrap: true, theme: "classic", caption: "" };
  for (const match of meta.matchAll(settingPattern)) {
    const [, key, value] = match;
    if (key === "width" && (value === "regular" || value === "wide" || value === "full")) settings.width = value;
    if (key === "theme" && Object.hasOwn(codeThemes, value)) settings.theme = value as CodeBlockSettings["theme"];
    if (key === "wrap") settings.wrap = value !== "false";
    if (key === "caption") { try { settings.caption = decodeURIComponent(value); } catch { /* Keep malformed source editable. */ } }
  }
  return settings;
}

export function writeCodeSettings(meta: string, patch: Partial<CodeBlockSettings>) {
  const settings = { ...readCodeSettings(meta), ...patch };
  return [meta.replace(settingPattern, "").trim(), `lc-width=${settings.width}`, `lc-wrap=${settings.wrap}`, `lc-theme=${settings.theme}`,
    ...(settings.caption ? [`lc-caption=${encodeURIComponent(settings.caption)}`] : [])].filter(Boolean).join(" ");
}

// The editor and both publication renderers use the same token classes and palette.
export const codeBlockStyles = `
[data-lettercamp-code] { --code-keyword: color-mix(in srgb, #8250a0, var(--site-foreground, #000000) var(--site-code-tint, 0%)); --code-string: color-mix(in srgb, #3d7757, var(--site-foreground, #000000) var(--site-code-tint, 0%)); --code-number: color-mix(in srgb, #a15c32, var(--site-foreground, #000000) var(--site-code-tint, 0%)); --code-name: color-mix(in srgb, #326b99, var(--site-foreground, #000000) var(--site-code-tint, 0%)); --code-comment: var(--site-text-muted, #93939b); color: var(--site-text-strong, #414146); }
[data-lettercamp-code][data-code-width] { margin-block: 24px; }
[data-lettercamp-code][data-code-theme="ocean"] { --code-keyword: color-mix(in srgb, #3d62a8, var(--site-foreground, #000000) var(--site-code-tint, 0%)); --code-string: color-mix(in srgb, #277c85, var(--site-foreground, #000000) var(--site-code-tint, 0%)); --code-number: color-mix(in srgb, #98623e, var(--site-foreground, #000000) var(--site-code-tint, 0%)); --code-name: color-mix(in srgb, #6961a4, var(--site-foreground, #000000) var(--site-code-tint, 0%)); }
[data-lettercamp-code][data-code-theme="forest"] { --code-keyword: color-mix(in srgb, #47724a, var(--site-foreground, #000000) var(--site-code-tint, 0%)); --code-string: color-mix(in srgb, #827030, var(--site-foreground, #000000) var(--site-code-tint, 0%)); --code-number: color-mix(in srgb, #a25d47, var(--site-foreground, #000000) var(--site-code-tint, 0%)); --code-name: color-mix(in srgb, #3c7b79, var(--site-foreground, #000000) var(--site-code-tint, 0%)); }
[data-lettercamp-code][data-code-theme="mono"] { --code-keyword: var(--site-text-strong, #45454a); --code-string: var(--site-text-secondary, #62626a); --code-number: var(--site-text-secondary, #62626a); --code-name: var(--site-text-strong, #45454a); }
[data-lettercamp-code] .tok-keyword, [data-lettercamp-code] .tok-operator { color: var(--code-keyword); }
[data-lettercamp-code] .tok-string, [data-lettercamp-code] .tok-string2, [data-lettercamp-code] .tok-inserted { color: var(--code-string); }
[data-lettercamp-code] .tok-number, [data-lettercamp-code] .tok-bool, [data-lettercamp-code] .tok-atom, [data-lettercamp-code] .tok-literal { color: var(--code-number); }
[data-lettercamp-code] .tok-typeName, [data-lettercamp-code] .tok-className, [data-lettercamp-code] .tok-propertyName, [data-lettercamp-code] .tok-definition, [data-lettercamp-code] .tok-variableName2, [data-lettercamp-code] .tok-labelName { color: var(--code-name); }
[data-lettercamp-code] .tok-comment, [data-lettercamp-code] .tok-meta { color: var(--code-comment); }
[data-lettercamp-code] .tok-invalid, [data-lettercamp-code] .tok-deleted { color: color-mix(in srgb, #aa4747, var(--site-foreground, #000000) var(--site-code-tint, 0%)); }
[data-lettercamp-code] .tok-strong { font-weight: 600; }
[data-lettercamp-code] .tok-emphasis { font-style: italic; }
figure[data-lettercamp-code] > pre { --code-comment: var(--site-text-on-surface, #6c6c6c); box-sizing: border-box; margin: 0; padding: 16px 0; overflow-x: auto; border-radius: 8px; background: var(--site-surface, #fafafa); color: var(--site-text-strong, #414146); font: 13px/1.7 ui-monospace, SFMono-Regular, Menlo, monospace; tab-size: 4; }
figure[data-lettercamp-code] > pre > code { display: block; width: max-content; min-width: 100%; padding: 0; background: transparent; color: inherit; font: inherit; white-space: normal; counter-reset: code-line; }
[data-lettercamp-code] .code-line { position: relative; display: block; box-sizing: border-box; min-height: 1.7em; padding: 0 18px 0 calc(var(--code-gutter, 3ch) + 24px); white-space: pre; }
[data-lettercamp-code] .code-line::before { position: absolute; left: 8px; width: var(--code-gutter, 3ch); text-align: right; content: counter(code-line); counter-increment: code-line; color: var(--site-text-on-surface, #6c6c6c); user-select: none; font-variant-numeric: tabular-nums; }
[data-lettercamp-code][data-code-wrap="true"] > pre > code { width: 100%; }
[data-lettercamp-code][data-code-wrap="true"] .code-line { white-space: pre-wrap; overflow-wrap: anywhere; }
figure[data-lettercamp-code] > figcaption { margin: 8px 0 0; color: var(--site-text-muted, #888); font: 13px/1.5 var(--font-family, inherit); text-align: center; overflow-wrap: anywhere; }
`;
