// Delegated events also handle header controls rebuilt by the design preview.
export const mobileNavigationScript = `
(() => {
  const mobile = matchMedia('(max-width: 600px)');
  let active;
  let restore;
  const close = (focus = false) => {
    if (!active) return;
    const menu = active;
    active = null;
    menu.open = false;
    const toggle = menu.querySelector('summary');
    toggle.setAttribute('aria-label', 'Open menu');
    toggle.setAttribute('aria-expanded', 'false');
    restore?.();
    restore = null;
    if (focus && toggle.isConnected) toggle.focus({ preventScroll: true });
  };
  const position = () => {
    if (!active) return;
    const header = active.closest('.site-header');
    header.style.setProperty('--mobile-menu-top', Math.max(0, header.getBoundingClientRect().bottom) + 'px');
  };
  document.addEventListener('toggle', event => {
    const menu = event.target;
    if (!(menu instanceof HTMLDetailsElement) || !menu.matches('.mobile-navigation')) return;
    if (!menu.open) { if (active === menu) close(); return; }
    if (!mobile.matches) { menu.open = false; return; }
    if (active === menu) return;
    close();
    active = menu;
    const header = menu.closest('.site-header');
    const toggle = menu.querySelector('summary');
    toggle.setAttribute('aria-label', 'Close menu');
    toggle.setAttribute('aria-expanded', 'true');
    const body = document.body;
    const root = document.documentElement;
    const overflow = body.style.overflow;
    const rootOverflow = root.style.overflow;
    const padding = body.style.paddingRight;
    const scrollbar = innerWidth - root.clientWidth;
    if (scrollbar > 0) body.style.paddingRight = (parseFloat(getComputedStyle(body).paddingRight) + scrollbar) + 'px';
    body.style.overflow = root.style.overflow = 'hidden';
    const background = [...body.children].filter(node => node instanceof HTMLElement && !node.contains(header) && !['SCRIPT', 'STYLE'].includes(node.tagName));
    const inert = background.map(node => node.inert);
    background.forEach(node => { node.inert = true; });
    restore = () => {
      body.style.overflow = overflow;
      root.style.overflow = rootOverflow;
      body.style.paddingRight = padding;
      background.forEach((node, index) => { node.inert = inert[index]; });
      header.style.removeProperty('--mobile-menu-top');
    };
    position();
  }, true);
  document.addEventListener('keydown', event => {
    if (!active) return;
    if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
    if (event.key !== 'Tab') return;
    const header = active.closest('.site-header');
    const items = [...header.querySelectorAll('a[href], summary, button:not(:disabled)')].filter(node => node.getClientRects().length);
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !header.contains(document.activeElement))) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !header.contains(document.activeElement))) {
      event.preventDefault(); first?.focus();
    }
  });
  document.addEventListener('click', event => {
    if (active && event.target instanceof Element && event.target.closest('.site-header a[href]')) close();
  }, true);
  document.addEventListener('lettercamp:header-update', () => close());
  window.addEventListener('pagehide', () => close());
  window.addEventListener('resize', () => { if (!mobile.matches) close(); else position(); });
})();
`;
