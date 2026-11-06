// Shared by the editable table, safe preview, and published renderer.
export const tableStyles = `
[data-lettercamp-table] { position: relative; margin-block: 24px 32px; color: var(--site-text-strong, #303034); font: inherit; }
[data-lettercamp-table] > table { width: 100%; border-collapse: collapse; table-layout: fixed; border-spacing: 0; font: inherit; color: inherit; }
[data-lettercamp-table] > table > tbody > tr > :is(td, th) { position: relative; border: 1px solid var(--site-border, #f0f0f0); padding: 0; min-width: 0; vertical-align: top; font: inherit; text-align: left; }
[data-lettercamp-table] [data-table-content] { display: block; box-sizing: border-box; min-height: calc(1.8em + 16px); padding: 8px 12px; line-height: inherit; overflow-wrap: anywhere; white-space: pre-wrap; outline: none; }
[data-lettercamp-table] [data-table-cell-height] [data-table-content] { height: var(--table-cell-height); min-height: 0; overflow: auto; }
[data-lettercamp-table] :is(td, th) > p, [data-lettercamp-table] [data-table-content] > p { margin: 0; padding: 0; min-height: 0; }
[data-lettercamp-table] [data-table-content] code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85em; padding: .18em .35em; background: var(--site-surface-hover, #f3f3f3); border-radius: 3px; }
[data-lettercamp-table] [data-table-content] a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
`;
