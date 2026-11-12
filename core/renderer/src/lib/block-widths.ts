// One sizing contract for editor surfaces and published body blocks.
const blocks = ':is(.publication-post .prose > table, [data-lettercamp-table], [data-lettercamp-code][data-code-width], [data-block-width], .publication-post .prose :is(img, video)[data-image-width]:not([width]), .publication-post .prose :is(img, video):is([data-image-width="wide"], [data-image-width="full"]))';
const wide = ':is([data-table-width="wide"], [data-code-width="wide"], [data-block-width="wide"], [data-image-width="wide"])';
const full = ':is([data-table-width="full"], [data-code-width="full"], [data-block-width="full"], [data-image-width="full"])';

export const blockWidthStyles = `
.publication-post { container-type: inline-size; }
.publication-post .article-body, .publication-post .prose { width: 100%; min-width: 0; }
.publication-post .prose { contain: inline-size; }
.publication-post .prose [data-lettercamp-component] { display: grid; grid-template-columns: minmax(0, 1fr); }
.publication-post .prose [data-lettercamp-component] > :not(style, script),
.publication-post .prose [data-lettercamp-component] > astro-island > :not(style, script) {
  box-sizing: border-box; width: 100%; max-width: 100%; min-width: 0;
}
${blocks} {
  --block-normal-width: 100%;
  --block-display-width: var(--block-normal-width);
  box-sizing: border-box; width: var(--block-display-width); max-width: var(--block-normal-width); margin-inline: auto;
}
${blocks}${wide} {
  --block-display-width: max(var(--block-normal-width), min(calc(var(--block-normal-width) + 128px), var(--block-available-width, 100cqw)));
  max-width: none; margin-inline: calc((100% - var(--block-display-width)) / 2);
  margin-left: calc((100% - var(--block-display-width)) / 2 + min(0px, (var(--block-available-width, 100cqw) - var(--block-display-width)) / 2 - var(--block-column-offset, 0px)));
}
${blocks}${full} {
  --block-display-width: max(var(--block-normal-width), var(--block-available-width, 100cqw));
  max-width: none; margin-inline: calc((100% - var(--block-display-width)) / 2);
  margin-left: calc((100% - var(--block-display-width)) / 2 - var(--block-column-offset, 0px));
}
${blocks}[data-table-pixel-width] {
  --block-display-width: min(var(--table-pixel-width), var(--block-available-width, 100cqw));
  max-width: none; margin-inline: calc((100% - var(--block-display-width)) / 2);
  margin-left: calc((100% - var(--block-display-width)) / 2 + min(0px, (var(--block-available-width, 100cqw) - var(--block-display-width)) / 2 - var(--block-column-offset, 0px)));
}
`;
