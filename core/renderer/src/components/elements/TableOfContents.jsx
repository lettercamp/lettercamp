import { useEffect, useId, useRef } from 'react';
import defaultSite from '../../site.js';
import { mountTableOfContents } from '../../lib/toc.js';

export function TableOfContents({ headings = [], site = defaultSite, title = 'Contents', variant = 'floating', className = '', style, show = site.post?.showTableOfContents !== false }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!ref.current) return;
    return mountTableOfContents(ref.current);
  }, [headings, show, variant]);
  if (!show || !headings.length) return null;
  return <aside ref={ref} data-lettercamp-toc="" data-toc-variant={variant} className={`lettercamp-toc ${variant === 'sidebar' ? 'article-sidebar' : ''} ${className}`.trim().replace(/\s+/g, ' ')} style={style}>
    <nav id={id} className="article-toc" aria-label="Table of contents">
      <h2>{title}</h2>
      <ol>{headings.map(({ depth, slug, text }) => <li key={slug} className={depth === 3 ? 'toc-subheading' : undefined}>
        <a href={`#${slug}`} title={text}><span className="toc-label">{text}</span></a>
      </li>)}</ol>
    </nav>
  </aside>;
}
