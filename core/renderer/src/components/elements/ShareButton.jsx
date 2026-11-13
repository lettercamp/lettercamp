
export function ShareButton({ children, className = '', ...props }) {
  return <button {...props} type="button" className={`post-share-button lettercamp-share-button ${className}`.trim().replace(/\s+/g, ' ')} aria-haspopup="dialog">
    {children ?? <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M5 13v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" /></svg><span>Share</span></>}
  </button>;
}
