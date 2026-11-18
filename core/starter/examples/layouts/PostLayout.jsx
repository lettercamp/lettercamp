// @ts-check
import { PostHeader, TableOfContents, RelatedPosts } from 'lettercamp/components';

/** @param {import('lettercamp/components').PostLayoutProps} props */
export default function PostLayout({ site, post, headings, relatedPosts, pathname, children }) {
  const layout = site.post ?? {};
  const configuredWidth = layout.contentWidthEm ?? 40;
  const width = Number.isFinite(configuredWidth) && configuredWidth > 0 ? configuredWidth : 40;
  /** @type {import('lettercamp/components').ComponentStyle} */
  const style = { '--post-content-width': `calc(var(--text-base) * ${width})` };
  return <article className="publication publication-post" data-post-hero={layout.heroLayout ?? 'stacked'}
    data-reading-minutes={post.readingMinutes}
    data-image-content-width={width * (Number(site.design?.typography?.bodyBaseSizePx) || 16)}
    data-post-toc={layout.showTableOfContents === false ? 'hidden' : 'visible'}
    style={style}>
    <PostHeader site={site} post={post} />
    <div className={`article-body ${headings.length ? 'article-body-with-toc' : ''}`}>
      <TableOfContents site={site} headings={headings} variant={layout.heroLayout === 'split' ? 'sidebar' : 'floating'} />
      {children}
    </div>
    <RelatedPosts site={site} posts={relatedPosts} pathname={pathname} />
  </article>;
}
