import { PostList as CustomPostList, PostCard as CustomPostCard, PostLayout as CustomPostLayout } from '../../custom-posts.js';
import DefaultPostCard from '../elements/PostCard.jsx';
import { basePath } from '../../lib/urls.js';
import { postAsset as sitePath } from '../../lib/post-data.js';
import { resolveAuthors } from '../../lib/authors.js';
import { pagePath } from '../../lib/pagination';

// href and date are prepared by the publication. Resolve media once at the
// custom-component boundary; the default card still accepts authored paths.
export function customPost(post) {
  return { ...post, image: sitePath(post.image ?? post.ogImage),
    authors: resolveAuthors(post).map(author => ({ ...author, image: sitePath(author.image) })) };
}

export function PostCard({ post, site, pathname = post.href, priority = false }) {
  return CustomPostCard
    ? <CustomPostCard post={customPost(post)} site={site} pathname={pathname} basePath={basePath} priority={priority} />
    : <DefaultPostCard post={post} site={site} priority={priority} />;
}

export function PostList(props) {
  const { site, posts, current, total, base } = props;
  // This adapter lives inside React so component functions never cross Astro's
  // serialized props boundary. A supplied card receives the listing's site.
  const Card = ({ post, ...rest }) => <PostCard post={post} site={site} pathname={props.pathname} {...rest} />;
  return <CustomPostList {...props} posts={posts.map(customPost)} basePath={basePath}
    PostCard={Card} pagination={{ current, total, base, count: props.count,
      previous: current > 1 ? pagePath(base, current - 1) : null,
      next: current < total ? pagePath(base, current + 1) : null }} />;
}

export function PostLayout({ children, post, relatedPosts = [], ...props }) {
  const Card = ({ post, ...rest }) => <PostCard post={post} site={props.site} pathname={props.pathname} {...rest} />;
  return <CustomPostLayout {...props} post={customPost(post)} relatedPosts={relatedPosts.map(customPost)}
    basePath={basePath} PostCard={Card}>{children}</CustomPostLayout>;
}
