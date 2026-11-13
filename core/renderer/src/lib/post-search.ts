export const postSearchScript = String.raw`(() => {
  const dialog = document.querySelector('#post-search-dialog');
  if (!dialog || !dialog.dataset.searchIndex || typeof dialog.showModal !== 'function') return;
  let opener;
  const input = dialog.querySelector('input');
  const results = dialog.querySelector('.post-search-results');
  const status = dialog.querySelector('.post-search-status');
  const empty = dialog.querySelector('.post-search-empty');
  const limit = 20;
  let posts;
  let loading;
  function loadPosts() {
    return loading ??= fetch(dialog.dataset.searchIndex)
      .then(response => {
        if (!response.ok) throw new Error('Search unavailable');
        return response.json();
      })
      .then(data => { posts = data; })
      .catch(error => { loading = undefined; throw error; });
  }
  const normalized = [];
  let generation = 0;
  let timer;
  const normalize = text => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };
  function highlighted(className, text, terms) {
    const node = element('span', className, '');
    if (!terms.length) { node.textContent = text; return node; }
    // Map folded characters back to authored text, including accents and
    // ligatures. Only the displayed titles/excerpts need this small offset map.
    let folded = '';
    let offset = 0;
    const starts = [], ends = [];
    for (const character of text) {
      const end = offset + character.length;
      const value = character.normalize('NFKD').replace(/\p{M}/gu, '').replace(/\s/g, ' ');
      if (!value && ends.length) ends[ends.length - 1] = end;
      for (const unit of value) {
        if (unit === ' ' && folded.endsWith(' ')) { ends[ends.length - 1] = end; continue; }
        folded += unit;
        for (let i = 0; i < unit.length; i++) { starts.push(offset); ends.push(end); }
      }
      offset = end;
    }
    folded = folded.toLowerCase();
    const ranges = [];
    for (const term of new Set([normalize(input.value), ...terms])) {
      let start = folded.indexOf(term);
      while (start >= 0) {
        ranges.push([starts[start], ends[start + term.length - 1]]);
        start = folded.indexOf(term, start + term.length);
      }
    }
    ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    const merged = [];
    for (const range of ranges) {
      const previous = merged.at(-1);
      if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
      else merged.push(range);
    }
    let cursor = 0;
    for (const [start, end] of merged) {
      node.append(document.createTextNode(text.slice(cursor, start)), element('mark', 'post-search-match', text.slice(start, end)));
      cursor = end;
    }
    node.append(document.createTextNode(text.slice(cursor)));
    return node;
  }
  const snippet = (post, terms, entry) => {
    const text = post.text || post.summary;
    const folded = post.text ? entry.text : entry.summary;
    const match = terms.map(term => folded.indexOf(term)).filter(index => index >= 0);
    const start = match.length ? Math.max(0, Math.min(...match) - 55) : 0;
    // Normalization can change character offsets slightly; excerpts are just
    // context, so keep the original authored text rather than folded text.
    return (start ? '…' : '') + text.slice(start, start + 180) + (text.length > start + 180 ? '…' : '');
  };
  function render(matches, count, terms) {
    const fragment = document.createDocumentFragment();
    for (const { index } of matches) {
      const post = posts[index];
      const row = document.createElement('li');
      const link = element('a', 'post-search-result', '');
      link.href = post.href;
      if (post.image) {
        const image = element('img', 'post-search-image', '');
        if (post.imageAttributes) Object.assign(image, post.imageAttributes);
        else image.src = post.image;
        image.alt = '';
        image.width = 1200;
        image.height = 630;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => image.remove(), { once: true });
        link.append(image);
      }
      const content = element('span', 'post-search-content', '');
      content.append(highlighted('post-search-title', post.title, terms));
      const meta = [post.category, post.date].filter(Boolean).join(' · ');
      if (meta) content.append(element('span', 'post-search-meta', meta));
      const excerpt = terms.length ? snippet(post, terms, normalized[index]) : post.summary;
      if (excerpt) content.append(highlighted('post-search-excerpt', excerpt, terms));
      link.append(content);
      row.append(link);
      fragment.append(row);
    }
    results.replaceChildren(fragment);
    results.scrollTop = 0;
    results.removeAttribute('aria-busy');
    empty.hidden = count > 0;
    empty.textContent = posts.length ? 'No articles found. Try a different word or title.' : 'No articles here yet.';
    status.textContent = !terms.length ? '' : count > limit
      ? 'Showing ' + limit + ' of ' + count + ' matching articles. Keep typing to narrow your search.'
      : count + (count === 1 ? ' article found' : ' articles found');
  }
  function search() {
    clearTimeout(timer);
    const current = ++generation;
    if (!posts) {
      status.textContent = 'Loading search…';
      results.setAttribute('aria-busy', 'true');
      empty.hidden = true;
      loadPosts().then(() => { if (current === generation && dialog.open) search(); }).catch(() => {
        if (current !== generation || !dialog.open) return;
        results.removeAttribute('aria-busy');
        status.textContent = 'Search could not load. Type to retry or reopen search.';
      });
      return;
    }
    const query = normalize(input.value);
    const terms = [...new Set(query.split(' ').filter(Boolean))];
    if (!terms.length) {
      render(posts.slice(0, 8).map((_, index) => ({ index })), posts.length, terms);
      return;
    }
    // Clear stale links immediately so Enter never opens an old query's result.
    results.replaceChildren();
    results.setAttribute('aria-busy', 'true');
    empty.hidden = true;
    status.textContent = 'Searching…';
    let cursor = 0;
    let count = 0;
    const best = [];
    function step() {
      if (current !== generation || !dialog.open) return;
      const deadline = performance.now() + 6;
      while (cursor < posts.length) {
        const index = cursor++;
        const post = posts[index];
        const entry = normalized[index] ??= {
          title: normalize(post.title),
          summary: normalize(post.summary), text: normalize(post.text),
        };
        if (terms.every(term => entry.title.includes(term) || entry.summary.includes(term) || entry.text.includes(term))) {
          count++;
          const score = (entry.title === query ? 1000 : entry.title.startsWith(query) ? 500 : entry.title.includes(query) ? 250 : 0)
            + terms.reduce((sum, term) => sum + (entry.title.includes(term) ? 10 : 0), 0);
          const position = best.findIndex(item => score > item.score);
          if (position >= 0) best.splice(position, 0, { index, score });
          else if (best.length < limit) best.push({ index, score });
          if (best.length > limit) best.pop();
        }
        // Yield between chunks for large publications. A newer query cancels
        // this work; only the best 20 matches ever become DOM nodes.
        if (performance.now() >= deadline) break;
      }
      if (cursor < posts.length) timer = setTimeout(step, 0);
      else render(best, count, terms);
    }
    timer = setTimeout(step, 0);
  }
  function open() {
    if (dialog.open) return;
    dialog.showModal();
    input.focus({ preventScroll: true });
    search();
  }
  function close() {
    ++generation;
    clearTimeout(timer);
    dialog.close();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('[data-lettercamp-search]') : null;
    if (!button || button.disabled) return;
    opener = button;
    open();
  });
  input.addEventListener('input', event => { if (!event.isComposing) search(); });
  input.addEventListener('compositionend', search);
  dialog.querySelector('.post-search-close').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  let backdropDown = false;
  dialog.addEventListener('pointerdown', event => { backdropDown = event.target === dialog; });
  dialog.addEventListener('click', event => {
    if (event.target === dialog && backdropDown) close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.isComposing) return;
    const links = [...results.querySelectorAll('a')];
    const index = links.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' && (event.target === input || index >= 0)) {
      event.preventDefault();
      (links[Math.min(index + 1, links.length - 1)] || input).focus();
    } else if (event.key === 'ArrowUp' && (event.target === input || index >= 0)) {
      event.preventDefault();
      (index === -1 ? links.at(-1) || input : links[index - 1] || input).focus();
    } else if (event.key === 'Enter' && event.target === input) {
      event.preventDefault();
      links[0]?.click();
    }
  });
  document.addEventListener('lettercamp:post-updated', () => { if (dialog.open) close(); });
})();`;
