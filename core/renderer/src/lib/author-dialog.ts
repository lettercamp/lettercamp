// Delegation also supports bylines replaced by the editor preview bridge.
export const authorDialogScript = `
(() => {
  let panel;
  let trigger;
  let tracking;
  let frame;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const close = (restoreFocus = false) => {
    if (!panel?.matches(':popover-open')) return;
    panel.hidePopover();
    trigger?.setAttribute('aria-expanded', 'false');
    tracking?.abort();
    cancelAnimationFrame(frame);
    if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
  };
  const position = () => {
    if (!panel?.matches(':popover-open')) return;
    if (!trigger?.isConnected) { close(); return; }
    const anchor = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const width = viewport?.width || innerWidth;
    const height = viewport?.height || innerHeight;
    if (anchor.bottom < top || anchor.top > top + height) { close(); return; }
    const below = top + height - anchor.bottom - 14;
    const above = anchor.top - top - 14;
    const upwards = below < Math.min(panel.scrollHeight, 320) && above > below;
    panel.style.maxHeight = Math.max(40, Math.min(320, upwards ? above : below)) + 'px';
    panel.style.left = Math.max(left + 8, Math.min(anchor.left, left + width - panel.offsetWidth - 8)) + 'px';
    panel.style.top = (upwards ? anchor.top - panel.offsetHeight - 6 : anchor.bottom + 6) + 'px';
  };
  const schedulePosition = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(position); };
  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button.author-more') : null;
    if (!button) return;
    event.preventDefault();
    if (trigger === button && panel?.matches(':popover-open')) { close(true); return; }
    close();
    const authors = JSON.parse(button.dataset.authors);
    if (!panel) {
      panel = element('div', 'authors-popover');
      panel.id = 'authors-popover';
      panel.popover = 'auto';
      panel.tabIndex = -1;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Authors');
      panel.append(element('ul', 'authors-popover-list'));
      panel.addEventListener('toggle', event => {
        if (event.newState === 'closed') {
          trigger?.setAttribute('aria-expanded', 'false');
          tracking?.abort();
          cancelAnimationFrame(frame);
        }
      });
      document.body.append(panel);
    }
    const list = panel.querySelector('ul');
    list.replaceChildren();
    for (const author of authors) {
      const row = element('li', 'authors-popover-author');
      if (typeof author.image === 'string' && author.image.trim()) {
        const portrait = element('span', 'author-portrait');
        portrait.setAttribute('aria-hidden', 'true');
        const image = element('img', 'author-avatar');
        if (author.imageAttributes) Object.assign(image, author.imageAttributes);
        else image.src = author.image;
        image.alt = ''; image.width = 28; image.height = 28;
        portrait.append(image);
        row.append(portrait);
      }
      row.append(element('span', '', author.name));
      list.append(row);
    }
    trigger = button;
    trigger.setAttribute('aria-controls', panel.id);
    trigger.setAttribute('popovertarget', panel.id);
    trigger.setAttribute('aria-expanded', 'true');
    panel.showPopover();
    position();
    panel.focus({ preventScroll: true });
    tracking = new AbortController();
    const signal = tracking.signal;
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); close(true);
    }, { signal, capture: true });
    document.addEventListener('focusin', event => {
      if (!panel.contains(event.target) && event.target !== trigger) close();
    }, { signal });
    document.addEventListener('scroll', schedulePosition, { signal, capture: true, passive: true });
    window.addEventListener('resize', schedulePosition, { signal, passive: true });
    window.visualViewport?.addEventListener('resize', schedulePosition, { signal, passive: true });
    window.visualViewport?.addEventListener('scroll', schedulePosition, { signal, passive: true });
  });
})();
`;
