import { PostHeader, TableOfContents, RelatedPosts } from 'lettercamp/components';

export default function PostLayout({ site, post, headings, relatedPosts, pathname, children }) {
  const layout = site.post ?? {};
  const width = Number.isFinite(layout.contentWidthEm) && layout.contentWidthEm > 0 ? layout.contentWidthEm : 40;
  return <article className="publication publication-post" data-post-hero={layout.heroLayout ?? 'stacked'}
    data-reading-minutes={post.readingMinutes}
    data-image-content-width={width * (Number(site.design?.typography?.bodyBaseSizePx) || 16)}
    data-post-toc={layout.showTableOfContents === false ? 'hidden' : 'visible'}
    style={{ '--post-content-width': `calc(var(--text-base) * ${width})` }}>
    <PostHeader site={site} post={post} />
    <div className={`article-body ${headings.length ? 'article-body-with-toc' : ''}`}>
      <TableOfContents site={site} headings={headings} variant={layout.heroLayout === 'split' ? 'sidebar' : 'floating'} />
      {children}
    </div>
    <RelatedPosts site={site} posts={relatedPosts} pathname={pathname} />
  </article>;
}
