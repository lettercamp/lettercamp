export { readImageRadius } from "./image-radius";

export const siteImageSelector = ".post-card-cover, .cover img, .prose img, .article-hero-image img";
// Observe published and preview content, including live editor replacements.
export const imageRoundingScript = `(
function observeImageSizes(root, selector) {
  const observed = new Set();
  const resize = new ResizeObserver(entries => {
    for (const entry of entries) {
      const box = entry.borderBoxSize[0];
      const size = box ? Math.min(box.inlineSize, box.blockSize) : Math.min(entry.contentRect.width, entry.contentRect.height);
      entry.target.style.setProperty("--image-short-side", size + "px");
    }
  });
  const sync = () => {
    for (const target of observed) {
      if (!root.contains(target)) { resize.unobserve(target); observed.delete(target); }
    }
    for (const target of root.querySelectorAll(selector)) {
      if (!observed.has(target)) { observed.add(target); resize.observe(target); }
    }
  };
  sync();
  const mutations = new MutationObserver(sync);
  mutations.observe(root, { childList: true, subtree: true });
  return () => { resize.disconnect(); mutations.disconnect(); };
}
)(document, ${JSON.stringify(siteImageSelector)});`;
