import { postDate } from './post-data.js';
export { postDate } from './post-data.js';
import { sitePath } from './urls.js';
import { pages, contentPrefix } from '../content.js';
import { categoryRoutes } from './category-routes.js';
import { sortPosts } from './post-order.js';
import { isStandalonePage, pageRoute } from './page-routes.js';
import site from '../site.js';

export function getCategories() {
  return categoryRoutes(getPosts().map(post => post.category)).map(category => ({ ...category, href: sitePath(category.href) }));
}

export function pageSlug(filename) {
  return pageRoute(`pages/${filename.slice(contentPrefix.length)}`).normalize();
}

export function standalone(filename, frontmatter) {
  return isStandalonePage(filename.slice(contentPrefix.length), frontmatter);
}

export function getPosts(language = 'en', timeZone = 'UTC') {
  return getPages(language, timeZone, false);
}

export function getPages(language = 'en', timeZone = 'UTC', includeStandalone = true) {
  return sortPosts(Object.entries(pages)
    .filter(([filename, page]) => includeStandalone || !standalone(filename, page.frontmatter))
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
    }), site.home?.postOrder);
}
