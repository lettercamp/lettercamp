export function readContentWidthEm(layout: { contentWidthEm?: unknown } = {}) {
  const width = layout.contentWidthEm;
  if (typeof width === "number" && Number.isFinite(width) && width > 0) return width;
  return 40;
}
