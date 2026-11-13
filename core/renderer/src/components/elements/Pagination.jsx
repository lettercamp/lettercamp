import { paginationItems, pagePath } from '../../lib/pagination';

function Chevron({ previous = false }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={previous ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} /></svg>;
}

export function Pagination({ current, total, base, className = '', style }) {
  if (total <= 1) return null;
  return <nav className={`pagination lettercamp-pagination ${className}`.trim().replace(/\s+/g, ' ')} style={style} data-many-pages={total > 4 ? '' : undefined} aria-label="Article pages">
    {current > 1 ? <a href={pagePath(base, current - 1)} rel="prev" className="pagination-direction" aria-label="Previous page"><Chevron previous /></a>
      : <span className="pagination-direction" aria-disabled="true" aria-label="Previous page"><Chevron previous /></span>}
    <div className="pagination-pages">{paginationItems(current, total).map((page, index) => page === null
      ? <span key={`gap-${index}`} className="pagination-gap" aria-hidden="true">…</span>
      : <a key={page} href={pagePath(base, page)} aria-label={`Page ${page}`} aria-current={page === current ? 'page' : undefined}>{page}</a>)}</div>
    {current < total ? <a href={pagePath(base, current + 1)} rel="next" className="pagination-direction" aria-label="Next page"><Chevron /></a>
      : <span className="pagination-direction" aria-disabled="true" aria-label="Next page"><Chevron /></span>}
  </nav>;
}
