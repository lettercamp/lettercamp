export const homeLayouts = ["grid", "rows", "column"] as const;
export type HomeLayout = typeof homeLayouts[number];

export function readHomeLayout(layout: { feedLayout?: unknown } = {}): HomeLayout {
  return layout.feedLayout === "rows" || layout.feedLayout === "column" ? layout.feedLayout : "grid";
}

export function readHomeWidthPx(layout: { contentWidthPx?: unknown; feedLayout?: unknown } = {}) {
  const width = layout.contentWidthPx;
  return typeof width === "number" && Number.isFinite(width) && width > 0 ? width : 1280;
}
