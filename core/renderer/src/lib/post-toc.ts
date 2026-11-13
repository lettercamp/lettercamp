import { mountTableOfContents } from './toc.js';

export const postTocScript = `
(() => {
  const mountTableOfContents = ${mountTableOfContents.toString()};
  let cleanup = () => {};
  const mount = () => {
    cleanup();
    // Public React components own their lifecycle through an effect.
    const sidebar = document.querySelector('[data-lettercamp-static-toc] .lettercamp-toc, .article-sidebar:not([data-lettercamp-toc])');
    if (sidebar?.hasAttribute('data-lettercamp-toc')) {
      const split = sidebar.closest('.publication-post')?.dataset.postHero === 'split';
      sidebar.dataset.tocVariant = split ? 'sidebar' : 'floating';
      sidebar.classList.toggle('article-sidebar', split);
    }
    const heading = sidebar?.querySelector('.article-toc h2');
    if (heading) heading.textContent = 'Contents';
    cleanup = sidebar ? mountTableOfContents(sidebar) : () => {};
  };
  document.addEventListener('lettercamp:post-updated', mount);
  mount();
})();
`;
