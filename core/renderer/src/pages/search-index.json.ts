import site from '../site.js';
import { sitePath } from '../lib/urls.js';
import { getPosts } from '../lib/posts.js';
import { imageAttributes } from '../lib/image-variants';
import { readImageManifest } from '../lib/image-manifest';

export async function GET() {
  const posts = getPosts(site.language, site.timeZone).map(post => ({
    title: String(post.title), href: post.href, image: sitePath(post.image ?? post.ogImage),
    summary: typeof post.description === 'string' ? post.description : '',
    text: typeof post.searchText === 'string' ? post.searchText : '',
    category: post.category, date: post.date.label,
    imageAttributes: undefined as ReturnType<typeof imageAttributes> | undefined,
  }));
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(8, posts.length) }, async () => {
    while (cursor < posts.length) {
      const post = posts[cursor++];
      if (!post.image) continue;
      try { post.imageAttributes = imageAttributes(await readImageManifest(post.image), '64px', 394); }
      catch { /* Keep the original image when variants are unavailable. */ }
    }
  }));
  return new Response(JSON.stringify(posts), { headers: { 'Content-Type': 'application/json' } });
}
