import site from '../site.js';
import { subscribeTitle } from './subscribe';

export function subscriptionEndpoint() {
  if (typeof document === 'undefined' || new URLSearchParams(location.search).get('__lettercamp_preview') === '1') return null;
  return document.querySelector<HTMLMetaElement>('meta[name="lettercamp-subscribe-endpoint"]')?.content || null;
}

export async function subscribeEmail(email: string, website = '') {
  const endpoint = subscriptionEndpoint();
  if (!endpoint) return { preview: true, message: '' };
  const response = await fetch(endpoint, {
    method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, website, sourcePath: location.pathname }), signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) throw new Error(result?.error || 'Unable to subscribe. Please try again.');
  return { preview: false, message: 'Thanks for subscribing!' };
}

export function installSubscribeForms() {
  const initialized = new WeakSet<HTMLFormElement>();
  const initialize = () => {
    for (const form of document.querySelectorAll<HTMLFormElement>('form[data-lettercamp-native-subscribe]')) {
      if (initialized.has(form)) continue;
      initialized.add(form);
      const title = form.parentElement!.querySelector<HTMLElement>('[data-subscribe-default-title]');
      if (title && new URLSearchParams(location.search).get('__lettercamp_preview') !== '1') title.textContent = subscribeTitle(site.name);
      const button = form.querySelector<HTMLButtonElement>('[data-subscribe-button]')!;
      for (const input of form.querySelectorAll<HTMLInputElement>('input')) input.disabled = false;
      button.disabled = false;
    }
  };
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-lettercamp-native-subscribe')) return;
    event.preventDefault();
    const button = form.querySelector<HTMLButtonElement>('[data-subscribe-button]')!;
    const message = form.parentElement!.querySelector<HTMLElement>('[data-subscribe-message]')!;
    if (button.disabled) return;
    const data = new FormData(form), label = button.textContent;
    button.disabled = true; button.textContent = 'Subscribing…'; message.textContent = '';
    try {
      const result = await subscribeEmail(String(data.get('email') ?? ''), String(data.get('website') ?? ''));
      message.textContent = result.message;
      if (!result.preview) form.reset();
    } catch (error) {
      message.textContent = error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'Unable to subscribe. Please try again.';
    } finally { button.disabled = false; button.textContent = label; }
  });
  initialize();
  // Editor previews replace article HTML without navigating.
  new MutationObserver(initialize).observe(document.body, { childList: true, subtree: true });
}
