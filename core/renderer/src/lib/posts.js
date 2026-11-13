import { postDate } from './post-data.js';
export { postDate } from './post-data.js';
import { sitePath } from './urls.js';
import { pages, contentPrefix } from '../content.js';
import { categoryRoutes } from './category-routes.js';
import site from '../site.js';

export function getCategories() {
  return categoryRoutes(getPosts().map(post => post.category)).map(category => ({ ...category, href: sitePath(category.href) }));
}

export function pageSlug(filename) {
  return filename.slice(contentPrefix.length).replace(/\.(md|mdx)$/, '');
}


export function getPosts(language = 'en', timeZone = 'UTC') {
  // Optional editorial order uses page slugs; unlisted posts retain date order.
  const order = new Map((Array.isArray(site.home?.postOrder) ? site.home.postOrder : [])
    .filter(slug => typeof slug === 'string')
    .map((slug, index) => [sitePath(`/${slug.split('/').map(encodeURIComponent).join('/')}`), index]));
  return Object.entries(pages)
    .map(([filename, page]) => {
      const frontmatter = page.frontmatter ?? {};
      const slug = pageSlug(filename);
      return {
        ...frontmatter,
        title: frontmatter.title ?? slug,
        category: typeof frontmatter.category === 'string' ? frontmatter.category.trim() : '',
        href: sitePath(`/${slug.split('/').map(encodeURIComponent).join('/')}`),
        date: postDate(frontmatter.date, language, timeZone),
      };
    })
    .sort((a, b) => (order.get(a.href) ?? Infinity) - (order.get(b.href) ?? Infinity)
      || b.date.timestamp - a.date.timestamp || a.href.localeCompare(b.href));
}
