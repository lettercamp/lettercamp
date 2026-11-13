import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { PostList, PostCard, PostLayout } from '../components/layouts/resolve.jsx';
import { customPostFiles } from '../custom-posts.js';
import { basePath, sitePath } from './urls.js';
import { postDate } from './post-data.js';
import { resolveAuthors } from './authors.js';
import { categoryRoutes } from './category-routes.js';
import { createRelatedPostSelector } from './related-posts';
import { POSTS_PER_PAGE, pageCount } from './pagination';
import { readContentWidthEm } from './post-layout';

class PreviewBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(previous) {
    if (this.state.error && previous.revision !== this.props.revision) this.setState({ error: null });
  }
  render() {
    return this.state.error
      ? <p role="alert">Custom component could not render: {this.state.error.message}</p>
      : this.props.children;
  }
}

export function installThemePreview() {
  const snapshot = JSON.parse(document.querySelector('[data-lettercamp-theme]').textContent);
  const originalBody = document.querySelector('[data-lettercamp-body] .prose')?.innerHTML ?? '';
  const roots = new Map();
  let pageContainer;
  let revision = 0;
  const render = (container, component) => {
    let root = roots.get(container);
    if (!root) { root = createRoot(container); roots.set(container, root); }
    flushSync(() => root.render(<PreviewBoundary revision={revision}>{component}</PreviewBoundary>));
  };
  const logicalPath = href => basePath && href.startsWith(basePath + '/') ? href.slice(basePath.length) : href;

  window.__lettercampThemePreview = {
    components: customPostFiles,
    snapshot,
    handlesPost: !!customPostFiles.PostLayout,
    render(data, resolveAsset) {
      revision++;
      const site = { ...snapshot.site, ...data.siteSettings };
      const posts = new Map(snapshot.posts.map(post => [post.href, post]));
      for (const update of data.posts ?? []) {
        const href = sitePath(update.href);
        const previous = posts.get(href) ?? {};
        // A rename replaces its old card rather than leaving two entries.
        if (update.previousHref) posts.delete(sitePath(update.previousHref));
        const post = { ...previous, ...update, href };
        if (post.draft) posts.delete(href);
        else posts.set(href, post);
      }
      const prepare = post => ({ ...post,
        date: postDate(post.date?.iso ?? post.date, site.language, site.timeZone),
        image: resolveAsset(post.image ?? post.ogImage),
        authors: resolveAuthors(post).map(author => ({ ...author, image: resolveAsset(author.image) })),
      });
      const allPosts = [...posts.values()].map(prepare)
        .sort((a, b) => b.date.timestamp - a.date.timestamp || a.href.localeCompare(b.href));
      const categories = categoryRoutes(allPosts.map(post => post.category ?? '')).map(category => ({ ...category, href: sitePath(category.href) }));
      const isPost = !!data.post || snapshot.kind === 'post';
      const pathname = data.post ? sitePath(data.post.pathname) : location.pathname;
      const shared = { site, pathname, basePath };
      let component;
      if (isPost && customPostFiles.PostLayout) {
        const source = data.post?.settings ?? snapshot.props.post;
        const href = data.post ? pathname.replace(/\/+$/, '') || '/' : source.href;
        const post = prepare({ ...source, title: source.title ?? site.name, href });
        post.categoryHref = categories.find(category => category.name === post.category)?.href;
        const body = document.createElement('div');
        body.innerHTML = data.post?.html ?? originalBody;
        for (const node of data.post ? body.querySelectorAll('[href], [src], [poster]') : []) {
          for (const attr of ['href', 'src', 'poster']) {
            const value = node.getAttribute(attr);
            if (value) node.setAttribute(attr, attr === 'href' ? sitePath(value) : resolveAsset(value));
          }
        }
        const relatedPosts = createRelatedPostSelector(allPosts, site.language)(post);
        component = <PostLayout {...shared} post={post} headings={data.post?.headings ?? snapshot.props.headings} relatedPosts={relatedPosts}>
          <div className="publication-post lettercamp-post-body" data-lettercamp-body="" style={{ '--post-content-width': `calc(var(--text-base) * ${readContentWidthEm(site.post)})` }}>
            <div className="prose" dangerouslySetInnerHTML={{ __html: body.innerHTML }} />
          </div>
        </PostLayout>;
      } else if (!isPost && customPostFiles.PostList) {
        const category = data.category ?? snapshot.props.category;
        const matching = category ? allPosts.filter(post => post.category === category) : allPosts;
        const current = snapshot.props.current;
        component = <PostList {...shared} category={category} categories={categories}
          posts={matching.slice((current - 1) * POSTS_PER_PAGE, current * POSTS_PER_PAGE)}
          current={current} total={pageCount(matching.length)} count={matching.length} base={snapshot.props.base} />;
      }
      // Remove obsolete roots before the legacy preview replaces their parents.
      for (const [container, root] of roots) if (!container.isConnected) { root.unmount(); roots.delete(container); }
      if (component) {
        if (!pageContainer) {
          pageContainer = document.createElement('div');
          pageContainer.style.display = 'contents';
          document.querySelector('main').replaceChildren(pageContainer);
        }
        render(pageContainer, component);
      } else {
        for (const container of document.querySelectorAll('[data-lettercamp-post-card]')) {
          const props = JSON.parse(container.dataset.lettercampPostCard);
          const post = allPosts.find(post => post.href === props.post.href) ?? prepare(props.post);
          render(container, <PostCard {...shared} post={post} priority={props.priority} />);
        }
      }
      return allPosts.map(post => ({ pathname: logicalPath(post.href), title: post.title }));
    },
  };
  document.dispatchEvent(new Event('lettercamp:theme-ready'));
}
