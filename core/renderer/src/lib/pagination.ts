export const POSTS_PER_PAGE = 12;

export const pageCount = (total: number) => Math.max(1, Math.ceil(total / POSTS_PER_PAGE));

export function pagePath(base: string, page: number) {
  return page === 1 ? base : `${base.replace(/\/+$/, "")}/page/${page}`;
}

// Show seven slots: expand near either end, with ellipses around middle pages.
export function paginationItems(current: number, total: number): (number | null)[] {
  const pages = new Set([1, total]);
  const start = total <= 7 || current <= 4 ? 1 : current >= total - 3 ? total - 4 : current - 1;
  const end = total <= 7 ? total : current <= 4 ? 5 : current >= total - 3 ? total : current + 1;
  for (let page = start; page <= end; page++) pages.add(page);
  const items: (number | null)[] = [];
  for (const page of [...pages].sort((a, b) => a - b)) {
    const previous = items.at(-1);
    if (typeof previous === "number" && page - previous === 2) items.push(previous + 1);
    else if (typeof previous === "number" && page - previous > 2) items.push(null);
    items.push(page);
  }
  return items;
}
