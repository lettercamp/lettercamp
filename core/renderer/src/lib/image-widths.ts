export const imageWidthStyles = `
.publication-post { container-type: inline-size; }
.publication-post .prose video[data-image-width] { width: 100%; height: auto; }
.publication-post .prose span:has(> img[data-image-width]),
.publication-post .prose span:has(> a > img[data-image-width]) { display: block; }
.publication-post .article-hero-image { width: min(100%, var(--post-content-width)); max-width: none; margin-inline: auto; }
.publication-post .article-hero-image:not([data-image-width="regular"]):not([data-image-width="full"]) { width: min(100%, calc(var(--post-content-width) + 128px)); max-width: none; }
.publication-post .article-hero-image[data-image-width="full"] { width: 100%; max-width: none; }
.publication-post .article-hero-image[data-image-width="regular"] { width: min(100%, var(--cover-image-width, var(--post-content-width)), var(--post-content-width)); max-width: none; }
`;
