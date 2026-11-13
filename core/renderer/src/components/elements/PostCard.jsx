import defaultSite from '../../site.js';
import AuthorByline from '../AuthorByline.jsx';
import { postAsset as sitePath } from '../../lib/post-data.js';
export default function PostCard({ post, site = defaultSite, priority = false, className = '', style }) {
  const image = sitePath(post.image ?? post.ogImage ?? site.seo?.ogImage);

  return (<article className={`post-card lettercamp-post-card ${className}`.trim().replace(/\s+/g, ' ')} style={style} data-post-category={post.category}>
    <div className="post-card-layout">
      {image && <div className="post-card-cover" suppressHydrationWarning>
        <img src={image} alt="" width="1200" height="630" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} />
      </div>}
      <div className="post-card-content">
        {(post.category || post.date?.label) && <div className="post-card-details">
          {post.date?.label && <time className="post-card-date" dateTime={post.date.iso}>{post.date.label}</time>}
          {post.category && <span className="post-card-category">{post.category}</span>}
        </div>}
        <h3><a className="post-card-link" href={post.href}>{post.title}</a></h3>
        {post.description && <p className="post-card-description">{post.description}</p>}
        <div className="post-card-meta">
          <AuthorByline post={post} site={site} variant="listing" date={null} />
        </div>
      </div>
    </div>
  </article>);
}
