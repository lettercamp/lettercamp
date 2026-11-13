// Shared by the editor, preview, and CLI. Store data, never executable embed HTML.
export type Embed = { src: string; title?: string; pixelWidth?: number; pixelHeight?: number; width?: 'regular' | 'wide' | 'full'; caption?: string; fallback?: string };
export type EmbedProvider = 'youtube' | 'vimeo' | 'x';
export function publicEmbedUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Use a public HTTPS embed URL.'); }
  const host = url.hostname;
  if (value.length > 4096 || url.protocol !== 'https:' || url.username || url.password || url.port || !host.includes('.') ||
      host.includes(':') || /^[\d.]+$/.test(host) || /(?:^|\.)(?:localhost|local|internal|test|invalid|lan|home|arpa)$/.test(host)) {
    throw new Error('Use a public HTTPS embed URL without credentials or a custom port.');
  }
  return url;
}
export function embedProvider(value: string): { provider: EmbedProvider; url: string; src: string } | null {
  let url: URL;
  try { url = publicEmbedUrl(value); } catch { return null; }
  const host = url.hostname.replace(/^(?:www|m|mobile)\./, '');
  if (['youtube.com', 'youtube-nocookie.com', 'youtu.be'].includes(host)) {
    const id = host === 'youtu.be' ? url.pathname.slice(1) : url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    const src = new URL(`https://www.youtube.com/embed/${id}`);
    const time = url.searchParams.get('start') ?? url.searchParams.get('t');
    if (time) {
      const parts = time.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
      const seconds = /^\d+$/.test(time) ? Number(time) : parts ? Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0) : 0;
      if (seconds > 0 && seconds < 86400) src.searchParams.set('start', String(seconds));
    }
    if (host === 'youtube-nocookie.com') src.hostname = 'www.youtube-nocookie.com';
    return { provider: 'youtube', url: `https://www.youtube.com/watch?v=${id}`, src: src.href };
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const match = url.pathname.match(/^\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)(?:\/([a-f\d]+))?\/?$/);
    if (!match) return null;
    const hash = url.searchParams.get('h') ?? match[2];
    const src = new URL(`https://player.vimeo.com/video/${match[1]}`);
    if (hash && /^[a-f\d]+$/i.test(hash)) src.searchParams.set('h', hash);
    return { provider: 'vimeo', url: `https://vimeo.com/${match[1]}${hash && /^[a-f\d]+$/i.test(hash) ? '/' + hash : ''}`, src: src.href };
  }
  if (host === 'x.com' || host === 'twitter.com') {
    const id = url.pathname.match(/^\/(?:[\w]+|i\/web)\/status\/(\d+)(?:\/.*)?$/)?.[1];
    if (id) return { provider: 'x', url: `https://twitter.com/i/status/${id}`, src: `https://twitter.com/i/status/${id}` };
  }
  return null;
}
export function normalizeEmbed(embed: Embed): Embed {
  if (!embed.src) return { src: '', width: embed.width ?? 'regular' };
  const url = publicEmbedUrl(embed.src);
  const provider = embedProvider(url.href);
  const dimension = (value: number | undefined, fallback: number) => Number.isFinite(value) && value! >= 100 && value! <= 4096 ? Math.round(value!) : fallback;
  return { src: provider?.src ?? url.href, title: String(embed.title || (provider?.provider === 'x' ? 'Post on X' : 'Embedded content')).slice(0, 300),
    pixelWidth: dimension(embed.pixelWidth, provider?.provider === 'x' ? 550 : 640), pixelHeight: dimension(embed.pixelHeight, provider?.provider === 'x' ? 650 : 360),
    width: ['regular', 'wide', 'full'].includes(embed.width ?? '') ? embed.width : 'regular', caption: String(embed.caption ?? '').slice(0, 2000), fallback: String(embed.fallback ?? '').slice(0, 6000) };
}
export function embedFrame(input: Embed) {
  const embed = normalizeEmbed(input);
  if (!embed.src) return null;
  const provider = embedProvider(embed.src);
  const common = { title: embed.title!, width: embed.pixelWidth!, height: embed.pixelHeight!, loading: 'lazy' as const, referrerPolicy: 'strict-origin-when-cross-origin' as const,
    'data-embed-src': embed.src, 'data-embed-kind': provider?.provider === 'x' ? 'social' : 'frame' };
  if (provider?.provider === 'x') {
    // Use X's hosted widget document. Provider scripts run on X's origin,
    // never inside the editor or a same-origin srcdoc document.
    const id = provider.url.split('/').at(-1)!;
    return { ...common, src: `https://platform.twitter.com/embed/Tweet.html?id=${id}&dnt=true`,
      sandbox: 'allow-scripts allow-same-origin allow-popups' };
  }
  // Unknown iframe hosts get an opaque origin. Only the exact, recognized
  // video player routes receive the permissions their players require.
  return { ...common, src: embed.src, sandbox: `allow-scripts allow-presentation${provider ? ' allow-same-origin' : ''}`,
    allow: 'fullscreen; picture-in-picture; encrypted-media', allowFullScreen: true };
}
export const embedStyles = `
[data-lettercamp-embed="true"] { position:relative; display:block; margin-block:1.5em; min-width:0; }
[data-lettercamp-embed="true"] iframe { display:block; border:0; width:100%; max-width:100%; aspect-ratio:var(--embed-ratio,16/9); height:auto; background:#f5f5f5; }
[data-lettercamp-embed="true"] iframe[data-embed-kind="social"] { position:absolute; top:0; left:0; opacity:0; pointer-events:none; height:var(--embed-height,650px); aspect-ratio:auto; max-width:550px; margin-inline:auto; }
[data-lettercamp-embed="true"][data-embed-ready="true"] iframe[data-embed-kind="social"] { position:static; opacity:1; pointer-events:auto; }
[data-lettercamp-embed="true"] [data-embed-text] { box-sizing:border-box; margin:0 auto; max-width:550px; padding:24px; border:1px solid #e5e5e5; border-radius:12px; font:16px/1.6 system-ui; white-space:pre-wrap; color:inherit; background:transparent; }
[data-lettercamp-embed="true"][data-embed-ready="true"] [data-embed-text] { display:none; }
[data-lettercamp-embed="true"] figcaption { text-align:center; font-size:.85em; opacity:.75; margin-top:8px; }
`;
