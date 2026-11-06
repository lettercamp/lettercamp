export function googleAnalyticsScript(value: unknown): string {
  const id = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^G-[A-Z0-9]+$/.test(id)) return '';
  return `(() => {
  const url = new URL(window.location.href);
  const host = url.hostname;
  if (!['http:', 'https:'].includes(url.protocol)
    || host === 'localhost' || host.endsWith('.localhost') || /^127\\./.test(host) || host === '[::1]'
    || url.searchParams.get('__lettercamp_preview') === '1' || url.pathname.startsWith('/_deployments/')) return;
  if (document.querySelector('script[data-lettercamp-google-tag]')) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', '${id}');
  const script = document.createElement('script');
  script.async = true;
  script.dataset.lettercampGoogleTag = '';
  script.src = 'https://www.googletagmanager.com/gtag/js?id=${id}';
  document.head.appendChild(script);
})();`;
}
