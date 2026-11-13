// X widgets report their rendered height. Accept messages only from the actual
// provider frame, and leave the server-rendered text visible if X is blocked.
export function listenForEmbedFrames(root: ParentNode = document) {
  const receive = (event: MessageEvent) => {
    if (event.origin !== 'https://platform.twitter.com') return;
    const message = event.data?.['twttr.embed'];
    if (!message || !['twttr.private.resize', 'twttr.private.rendered', 'twttr.private.no_results'].includes(message.method)) return;
    for (const frame of root.querySelectorAll<HTMLIFrameElement>('iframe[data-embed-kind="social"]')) {
      if (frame.contentWindow !== event.source) continue;
      const container = frame.closest<HTMLElement>('[data-lettercamp-embed="true"]');
      if (!container) return;
      if (message.method === 'twttr.private.no_results') { delete container.dataset.embedReady; return; }
      const height = Number(message.params?.[0]?.height);
      if (Number.isFinite(height) && height >= 100 && height <= 4096) frame.style.setProperty('--embed-height', `${Math.ceil(height)}px`);
      if (message.method === 'twttr.private.rendered') container.dataset.embedReady = 'true';
    }
  };
  window.addEventListener('message', receive);
  return () => window.removeEventListener('message', receive);
}
