// Shared by the default article and the public React component.
// Keep self-contained: the default shell embeds this function as a script.
export function mountTableOfContents(sidebar) {
  const nav = sidebar.querySelector('.article-toc');
  if (!nav) return () => {};
  sidebar.querySelector('.toc-trigger')?.remove();
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  if (!links.length) return () => {};
  const controller = new AbortController();
  const signal = controller.signal;
  const floating = sidebar.dataset.tocVariant
    ? sidebar.dataset.tocVariant === 'floating'
    : sidebar.closest('.publication-post')?.dataset.postHero !== 'split';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'toc-trigger';
  trigger.setAttribute('aria-label', 'Table of contents');
  const id = nav.id || 'post-contents';
  trigger.setAttribute('aria-controls', id);
  trigger.setAttribute('aria-expanded', 'false');
  nav.id = id;

  const markers = links.map(() => {
    const marker = document.createElement('span');
    marker.setAttribute('aria-hidden', 'true');
    trigger.append(marker);
    return marker;
  });
  if (floating) {
    sidebar.prepend(trigger);
    sidebar.setAttribute('data-floating-toc', '');
  }
  const setOpen = open => {
    if (!floating) return;
    sidebar.toggleAttribute('data-toc-open', open);
    trigger.setAttribute('aria-expanded', String(open));
  };
  sidebar.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') setOpen(true); }, { signal });
  sidebar.addEventListener('pointerleave', () => { if (!sidebar.contains(document.activeElement)) setOpen(false); }, { signal });
  sidebar.addEventListener('focusin', () => setOpen(true), { signal });
  sidebar.addEventListener('focusout', event => { if (!sidebar.contains(event.relatedTarget)) setOpen(false); }, { signal });
  trigger.addEventListener('click', () => setOpen(true), { signal });
  document.addEventListener('pointerdown', event => { if (!sidebar.contains(event.target)) setOpen(false); }, { signal });
  sidebar.addEventListener('keydown', event => {
    if (!floating || event.key !== 'Escape') return;
    event.preventDefault(); trigger.focus(); setOpen(false);
  }, { signal });
  nav.addEventListener('click', event => {
    if (floating && event.target.closest('a')) { trigger.focus(); setOpen(false); }
  }, { signal });
  const headings = links.map(link => document.getElementById(decodeURIComponent(link.hash.slice(1))));
  let frame = 0;
  const update = () => {
    frame = 0;
    let active = -1;
    headings.forEach((heading, index) => { if (heading && heading.getBoundingClientRect().top <= 120) active = index; });
    links.forEach((link, index) => {
      if (index === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
      markers[index].toggleAttribute('data-active', index === active);
    });
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll', schedule, { passive: true, signal });
  window.addEventListener('resize', schedule, { passive: true, signal });
  update();
  return () => { controller.abort(); cancelAnimationFrame(frame); setOpen(false); trigger.remove(); sidebar.removeAttribute('data-floating-toc'); };
}
