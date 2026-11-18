import { sitePath } from './urls.js';

// Homepage order shared by the build and the editor preview.
// settings.home.postOrder lists page slugs ("my-post" or "guides/setup") to show first, in that
// order. Unlisted posts follow, newest first. Without postOrder every post is newest first.
export function sortPosts(posts, postOrder) {
  const order = new Map();
  for (const slug of Array.isArray(postOrder) ? postOrder : []) {
    if (typeof slug !== 'string') continue;
    const path = slug.trim().replace(/^\/+|\/+$/g, '');
    if (!path) continue;
    const href = sitePath(`/${path.split('/').map(encodeURIComponent).join('/')}`);
    if (!order.has(href)) order.set(href, order.size);
  }
  return [...posts].sort((a, b) => (order.get(a.href) ?? Infinity) - (order.get(b.href) ?? Infinity)
    || b.date.timestamp - a.date.timestamp || a.href.localeCompare(b.href));
}
