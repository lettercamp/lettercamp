import { useId } from 'react';
import defaultSite from '../../site.js';
import { PostCard } from '../layouts/resolve.jsx';

export function RelatedPosts({ posts = [], site = defaultSite, title = 'Related', pathname, className = '', style, hidden, show = site.post?.showRelatedPosts !== false }) {
  const id = useId();
  if (!show || !posts.length) return null;
  return <section className={`related-posts lettercamp-related-posts ${className}`.trim().replace(/\s+/g, ' ')} style={style} hidden={hidden} aria-labelledby={id}>
    <h2 id={id}>{title}</h2>
    <div className="post-list">{posts.map(post => <div key={post.href} data-lettercamp-post-card={JSON.stringify({ post })} style={{ display: 'contents' }}><PostCard post={post} site={site} pathname={pathname} /></div>)}</div>
  </section>;
}
