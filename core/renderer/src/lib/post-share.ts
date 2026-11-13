const shareIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M5 13v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg>';
export const postShareButton = `<button type="button" class="post-share-button" aria-haspopup="dialog">${shareIcon}<span>Share</span></button>`;

// Read metadata when opening so the editor's live preview always shares the current post.
export const postShareScript = `
(() => {
  const triggerMarkup = ${JSON.stringify(postShareButton)};
  const icon = paths => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  const icons = {
    link: icon('<path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 1)"/>'),
    x: icon('<path d="m4 3 16 18h-5L4 3h5l11 18M20 3l-6.5 7.3M4 21l6.5-7.3"/>'),
    email: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>'),
    summarize: icon('<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>'),
    close: icon('<path d="m6 6 12 12M6 18 18 6"/>'),
    arrow: icon('<path d="M7 17 17 7M7 7h10v10"/>'),
    more: icon('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
  };
  let dialog;
  let trigger;
  let copyGeneration = 0;
  let sharedPost;
  let menuTracking;
  const meta = name => document.querySelector('meta[property="' + name + '"]')?.content || '';
  const httpUrl = value => {
    if (!value) return '';
    try {
      const url = new URL(value, location.href);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  };
  const ensureTrigger = () => {
    if (document.querySelector('.lettercamp-post-header')) return;
    const byline = document.querySelector('.publication-post .byline');
    if (byline && !byline.querySelector('.post-share-button')) byline.insertAdjacentHTML('beforeend', triggerMarkup);
    const intro = document.querySelector('.publication-post .article-intro');
    if (!intro) return;
    let row = intro.querySelector('.article-meta-row');
    if (!row) {
      row = document.createElement('div'); row.className = 'article-meta-row';
      const category = intro.querySelector('.article-category');
      if (category) row.append(category);
      intro.prepend(row);
    }
    if (!row.querySelector('.post-share-button')) row.insertAdjacentHTML('beforeend', triggerMarkup);
  };
  const action = (tag, name, label, graphic) => '<' + tag + ' class="post-share-action" data-share="' + name + '"' + (tag === 'button' ? ' type="button"' : '') + '><span class="post-share-action-icon">' + graphic + '</span><span data-label>' + label + '</span></' + tag + '>';
  const external = (link, href) => {
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  };
  const createDialog = () => {
    dialog = document.createElement('dialog');
    dialog.className = 'post-share-dialog';
    dialog.id = 'post-share-dialog';
    dialog.setAttribute('aria-labelledby', 'post-share-heading');
    dialog.innerHTML = '<div class="post-share-heading"><h2 id="post-share-heading">Share this post</h2><button type="button" class="post-share-close" aria-label="Close share dialog" autofocus>' + icons.close + '</button></div>' +
      '<div class="post-share-preview" role="group" aria-label="Link preview"><img class="post-share-image" alt="" hidden><div class="post-share-preview-copy"><p class="post-share-domain"></p><h3></h3><p class="post-share-description"></p></div></div>' +
      '<div class="post-share-actions">' + action('button', 'copy', 'Copy link', icons.link) + action('a', 'x', 'X', icons.x) + action('a', 'email', 'Email', icons.email) + action('button', 'summarize', 'Summarize', icons.summarize) + action('button', 'more', 'More', icons.more) + '</div>' +
      '<div id="post-share-menu" class="post-share-menu" popover="auto" role="menu" aria-label="More sharing options"></div>' +
      '<section id="post-share-summaries" class="post-share-summaries" aria-labelledby="post-share-summary-heading" hidden><h3 id="post-share-summary-heading">Summarize with AI</h3><p>Choose an app to open a ready-to-use prompt.</p><div class="post-share-providers"></div></section>' +
      '<p class="post-share-status" role="status" aria-live="polite"></p><div class="post-share-copy-fallback" hidden><label for="post-share-url">Post link</label><input id="post-share-url" readonly></div>';
    const moreButton = dialog.querySelector('[data-share="more"]');
    const menu = dialog.querySelector('.post-share-menu');
    moreButton.setAttribute('aria-haspopup', 'menu');
    moreButton.setAttribute('aria-expanded', 'false');
    moreButton.setAttribute('aria-controls', menu.id);
    moreButton.setAttribute('popovertarget', menu.id);
    const closeMenu = (restoreFocus = false) => {
      if (!menu.matches(':popover-open')) return;
      menu.hidePopover();
      moreButton.setAttribute('aria-expanded', 'false');
      menuTracking?.abort();
      if (restoreFocus) moreButton.focus({ preventScroll: true });
    };
    const positionMenu = () => {
      const anchor = moreButton.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0;
      const top = viewport?.offsetTop || 0;
      const width = viewport?.width || innerWidth;
      const height = viewport?.height || innerHeight;
      const above = anchor.top - top - 20;
      const below = top + height - anchor.bottom - 20;
      const upwards = above >= Math.min(menu.scrollHeight, 360) || above > below;
      menu.style.maxHeight = Math.max(44, upwards ? above : below) + 'px';
      menu.style.left = Math.max(left + 12, Math.min(anchor.right - menu.offsetWidth, left + width - menu.offsetWidth - 12)) + 'px';
      menu.style.top = Math.max(top + 12, upwards ? anchor.top - menu.offsetHeight - 8 : anchor.bottom + 8) + 'px';
    };
    const openMenu = (last = false) => {
      if (menu.matches(':popover-open')) return;
      menu.showPopover();
      moreButton.setAttribute('aria-expanded', 'true');
      positionMenu();
      const items = menu.querySelectorAll('[role="menuitem"]');
      (last ? items[items.length - 1] : items[0])?.focus({ preventScroll: true });
      menuTracking?.abort();
      menuTracking = new AbortController();
      const signal = menuTracking.signal;
      window.addEventListener('resize', positionMenu, { signal, passive: true });
      dialog.addEventListener('scroll', positionMenu, { signal, passive: true });
      window.visualViewport?.addEventListener('resize', positionMenu, { signal, passive: true });
      window.visualViewport?.addEventListener('scroll', positionMenu, { signal, passive: true });
    };
    moreButton.addEventListener('click', event => {
      event.preventDefault();
      menu.matches(':popover-open') ? closeMenu(true) : openMenu();
    });
    moreButton.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault(); openMenu(event.key === 'ArrowUp');
    });
    menu.addEventListener('toggle', event => {
      if (event.newState !== 'closed') return;
      moreButton.setAttribute('aria-expanded', 'false');
      menuTracking?.abort();
    });
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(true); return; }
      if (event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); closeMenu(true); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const items = [...menu.querySelectorAll('[role="menuitem"]')];
      const index = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    });
    menu.addEventListener('click', async event => {
      const item = event.target instanceof Element ? event.target.closest('[role="menuitem"]') : null;
      if (!item) return;
      closeMenu(true);
      if (item.dataset.share !== 'native') return;
      try { await navigator.share(sharedPost); }
      catch (error) {
        if (error.name !== 'AbortError' && dialog.open) dialog.querySelector('.post-share-status').textContent = 'Device sharing is unavailable. Try another option or copy the link.';
      }
    });
    const summaryButton = dialog.querySelector('[data-share="summarize"]');
    summaryButton.setAttribute('aria-expanded', 'false');
    summaryButton.setAttribute('aria-controls', 'post-share-summaries');
    summaryButton.addEventListener('click', () => {
      const section = dialog.querySelector('.post-share-summaries');
      section.hidden = !section.hidden;
      summaryButton.setAttribute('aria-expanded', String(!section.hidden));
      if (!section.hidden) section.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    });
    dialog.querySelector('.post-share-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button, a[href], input')].filter(node => !node.disabled && node.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    let backdropPress = false;
    dialog.addEventListener('pointerdown', event => { backdropPress = event.target === dialog; });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog || !backdropPress) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      closeMenu();
      copyGeneration++;
      trigger?.setAttribute('aria-expanded', 'false');
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    });
    dialog.querySelector('.post-share-image').addEventListener('error', event => { event.target.hidden = true; });
    dialog.querySelector('[data-share="copy"]').addEventListener('click', async () => {
      const generation = ++copyGeneration;
      const url = dialog.querySelector('#post-share-url').value;
      try {
        await navigator.clipboard.writeText(url);
        if (!dialog.open || generation !== copyGeneration) return;
        dialog.querySelector('[data-share="copy"] [data-label]').textContent = 'Copied!';
        dialog.querySelector('.post-share-status').textContent = 'Link copied to clipboard.';
        dialog.querySelector('.post-share-copy-fallback').hidden = true;
      } catch {
        if (!dialog.open || generation !== copyGeneration) return;
        dialog.querySelector('.post-share-status').textContent = 'Select and copy the link below.';
        dialog.querySelector('.post-share-copy-fallback').hidden = false;
        const field = dialog.querySelector('#post-share-url');
        field.focus(); field.select();
      }
    });
    document.body.append(dialog);
  };
  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('.post-share-button') : null;
    if (!button) return;
    if (!dialog) createDialog();
    if (dialog.open) return;
    trigger = button;
    copyGeneration++;
    const url = new URL(httpUrl(document.querySelector('link[rel="canonical"]')?.href || location.href));
    url.search = ''; url.hash = '';
    const title = meta('og:title') || document.title;
    const description = meta('og:description');
    const previewUrl = new URL(httpUrl(meta('og:url')) || url.href);
    dialog.querySelector('.post-share-domain').textContent = previewUrl.hostname;
    dialog.querySelector('.post-share-preview h3').textContent = title;
    dialog.querySelector('.post-share-description').textContent = description;
    const image = dialog.querySelector('.post-share-image');
    const imageUrl = httpUrl(meta('og:image'));
    image.alt = meta('og:image:alt');
    image.hidden = !imageUrl;
    if (imageUrl) image.src = imageUrl; else image.removeAttribute('src');
    const x = new URL('https://x.com/intent/post');
    x.searchParams.set('text', title); x.searchParams.set('url', url.href);
    external(dialog.querySelector('[data-share="x"]'), x.href);
    dialog.querySelector('[data-share="email"]').href = 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(title + '\\n\\n' + url.href);
    sharedPost = { title, url: url.href };
    const menu = dialog.querySelector('.post-share-menu');
    menu.replaceChildren();
    for (const [name, base, parameters] of [
      ['Facebook', 'https://www.facebook.com/sharer/sharer.php', { u: url.href }],
      ['LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/', { url: url.href }],
      ['WhatsApp', 'https://wa.me/', { text: title + '\\n' + url.href }],
      ['Telegram', 'https://t.me/share/url', { url: url.href, text: title }],
      ['Reddit', 'https://www.reddit.com/submit', { url: url.href, title }],
      ['Bluesky', 'https://bsky.app/intent/compose', { text: title + '\\n' + url.href }],
      ['Threads', 'https://www.threads.net/intent/post', { text: title + '\\n' + url.href }],
    ]) {
      const href = new URL(base);
      for (const [key, value] of Object.entries(parameters)) href.searchParams.set(key, value);
      const link = document.createElement('a');
      link.className = 'post-share-menu-item';
      link.setAttribute('role', 'menuitem');
      link.tabIndex = -1;
      link.textContent = name;
      link.insertAdjacentHTML('beforeend', icons.arrow);
      external(link, href.href);
      menu.append(link);
    }
    if (typeof navigator.share === 'function') {
      const native = document.createElement('button');
      native.type = 'button';
      native.className = 'post-share-menu-item';
      native.dataset.share = 'native';
      native.setAttribute('role', 'menuitem');
      native.tabIndex = -1;
      native.textContent = 'Share via…';
      native.insertAdjacentHTML('beforeend', icons.more);
      menu.append(native);
    }
    const prompt = 'Read and summarize this article: ' + url.href + '\\n\\nTitle: ' + title + '\\n\\nGive a concise overview, the key takeaways, and any important caveats. Link to the original article. If you cannot access the article, say so and ask me to paste the text; do not guess its contents.';
    const providers = dialog.querySelector('.post-share-providers');
    providers.replaceChildren();
    for (const [name, base, parameter] of [['ChatGPT', 'https://chatgpt.com/', 'q'], ['Claude', 'https://claude.ai/new', 'q'], ['Perplexity', 'https://www.perplexity.ai/search', 'q']]) {
      const href = new URL(base); href.searchParams.set(parameter, prompt);
      const link = document.createElement('a');
      link.className = 'post-share-provider';
      link.textContent = name;
      link.insertAdjacentHTML('beforeend', icons.arrow);
      link.setAttribute('aria-label', 'Summarize with ' + name + ' (opens in a new tab)');
      external(link, href.href); providers.append(link);
    }
    dialog.querySelector('#post-share-url').value = url.href;
    dialog.querySelector('.post-share-status').textContent = '';
    dialog.querySelector('.post-share-copy-fallback').hidden = true;
    dialog.querySelector('[data-share="copy"] [data-label]').textContent = 'Copy link';
    dialog.querySelector('.post-share-summaries').hidden = true;
    dialog.querySelector('[data-share="summarize"]').setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', dialog.id);
    trigger.setAttribute('aria-expanded', 'true');
    dialog.showModal();
  });
  ensureTrigger();
  document.addEventListener('lettercamp:post-updated', () => {
    if (dialog?.open) dialog.close();
    ensureTrigger();
  });
})();
`;
