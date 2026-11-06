import { sitePath } from './urls.js';
import { pages, contentPrefix } from '../content.js';
import { categoryRoutes } from './category-routes.js';

export function getCategories() {
  return categoryRoutes(getPosts().map(post => post.category)).map(category => ({ ...category, href: sitePath(category.href) }));
}

export function pageSlug(filename) {
  return filename.slice(contentPrefix.length).replace(/\.(md|mdx)$/, '');
}

export function postDate(value, language = 'en', timeZone = 'UTC') {
  if (!value) return { iso: '', label: '', timestamp: -Infinity };
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.valueOf())) return { iso: '', label: '', timestamp: -Infinity };
  // A calendar date has no time zone; shifting midnight changes its intended day.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  return {
    iso: dateOnly ? String(value) : date.toISOString(),
    label: new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', year: 'numeric', timeZone: dateOnly ? 'UTC' : timeZone }).format(date),
    timestamp: date.valueOf(),
  };
}

export function getPosts(language = 'en', timeZone = 'UTC') {
  return Object.entries(pages)
    .map(([filename, page]) => {
      const frontmatter = page.frontmatter ?? {};
      const slug = pageSlug(filename);
      return {
        ...frontmatter,
        title: frontmatter.title ?? slug,
        category: typeof frontmatter.category === 'string' ? frontmatter.category.trim() : '',
        href: sitePath(`/${slug.split('/').map(encodeURIComponent).join('/')}/`),
        date: postDate(frontmatter.date, language, timeZone),
      };
    })
    .sort((a, b) => b.date.timestamp - a.date.timestamp || a.href.localeCompare(b.href));
}
