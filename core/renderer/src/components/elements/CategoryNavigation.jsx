import { sitePath } from '../../lib/urls.js';

export function CategoryNavigation({ categories = [], category = '', allLabel = 'All', className = '', style }) {
  return <nav className={`category-selector lettercamp-categories ${className}`.trim().replace(/\s+/g, ' ')} style={style} aria-label="Filter posts by category">
    <a href={sitePath('/')} data-category="" aria-current={!category ? 'page' : undefined}>{allLabel}</a>
    {categories.map(item => <a key={item.href} href={item.href} data-category={item.name} aria-current={category === item.name ? 'page' : undefined}>{item.name}</a>)}
  </nav>;
}
