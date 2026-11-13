export function SearchButton({ children, className = '', ...props }) {
  return <button aria-label="Search articles" {...props} type="button" className={`post-search-trigger lettercamp-search-button ${className}`.trim().replace(/\s+/g, ' ')} data-lettercamp-search=""
    aria-haspopup="dialog" aria-controls="post-search-dialog">
    {children ?? <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg><span>Search articles…</span></>}
  </button>;
}
