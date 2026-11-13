import { SearchButton, CategoryNavigation, Pagination } from 'lettercamp/components';

export default function PostList({ site, posts, categories, category, pagination, PostCard }) {
  const home = site.home ?? {};
  const width = Number.isFinite(home.contentWidthPx) && home.contentWidthPx > 0 ? home.contentWidthPx : 1280;
  const readingWidth = Number.isFinite(site.post?.contentWidthEm) && site.post.contentWidthEm > 0 ? site.post.contentWidthEm : 40;
  const count = pagination.count;
  return <div className="blog-home" data-blog-home="" data-home-layout={home.feedLayout ?? 'grid'}
    data-image-content-width={readingWidth * (Number(site.design?.typography?.bodyBaseSizePx) || 16)}
    style={{ '--home-content-width': `${width}px`, '--post-content-width': `calc(var(--text-base) * ${readingWidth})` }}>
    <header className="blog-heading">
      <h1>{category || (home.title ?? `${site.name} Blog`)}</h1>
      {site.description && <p className="description" style={{ marginTop: 12 }}>{site.description}</p>}
    </header>
    <div className="blog-toolbar">
      {categories.length ? <CategoryNavigation categories={categories} category={category} /> : <p className="post-count">{count} {count === 1 ? 'post' : 'posts'}</p>}
      <SearchButton />
    </div>
    <p className="sr-only">{count} articles — Page {pagination.current} of {pagination.total}</p>
    <section aria-label="Recent articles">
      <h2 className="sr-only">Recent articles</h2>
      <div className="post-list">
        {posts.map((post, index) => <PostCard key={post.href} post={post} priority={index === 0} />)}
      </div>
      {!posts.length && <p className="empty-state">No articles here yet.</p>}
    </section>
    <Pagination {...pagination} />
  </div>;
}
