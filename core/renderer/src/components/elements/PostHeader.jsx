import defaultSite from '../../site.js';
import { postAsset, postDate } from '../../lib/post-data.js';
import { readContentWidthEm } from '../../lib/post-layout';
import { PostByline } from './PostByline.jsx';
import { ShareButton } from './ShareButton.jsx';

export function PostHeader({ post, site = defaultSite, layout = site.post?.heroLayout ?? 'stacked', showCover = site.post?.showCover !== false, showShare = true, className = '', style }) {
  showCover = showCover && post.showCover !== false;
  const image = postAsset(post.image ?? post.ogImage);
  const width = Number(post.coverImageWidth ?? (post.image ? post.imageWidth : undefined));
  const height = Number(post.coverImageHeight ?? (post.image ? post.imageHeight : undefined));
  const sized = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
  const coverWidthMode = ['regular', 'wide', 'full'].includes(post.coverWidthMode) ? post.coverWidthMode : 'wide';
  const coverWidth = /^[0-9]+$/.test(String(post.coverWidth)) && Number(post.coverWidth) > 0 ? `${post.coverWidth}px` : undefined;
  const date = post.date && typeof post.date === 'object' && 'label' in post.date ? post.date : postDate(post.date, site.language, site.timeZone);
  return <header className={`article-header article-hero lettercamp-post-header ${image && showCover ? 'article-hero-with-image' : ''} ${className}`.trim().replace(/\s+/g, ' ')}
    data-post-hero={layout} data-post-cover={showCover ? 'visible' : 'hidden'}
    style={{ '--post-content-width': `calc(var(--text-base) * ${readContentWidthEm(site.post)})`, ...style }}>
    <div className="article-intro">
      <div className="article-meta-row">
        {post.category && <p className="article-category"><a href={post.categoryHref}>{post.category}</a></p>}
        {showShare && <ShareButton />}
      </div>
      <h1>{post.title ?? site.name}</h1>
      {post.description && <p className="description">{post.description}</p>}
      <div className="byline">
        <PostByline post={post} site={site} date={date} />
        {showShare && <ShareButton />}
      </div>
    </div>
    {image && post.showCover !== false && <figure className="article-hero-image" hidden={!showCover} data-image-width={coverWidthMode} style={{ '--cover-image-width': coverWidth }}>
      {/* The shared image observer adds a measured radius before hydration. */}
      <img suppressHydrationWarning src={image} alt={post.imageAlt ?? ''} width={sized ? width : 1600} height={sized ? height : 900} fetchPriority="high" />
    </figure>}
  </header>;
}
