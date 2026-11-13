import defaultSite from '../../site.js';
import { useEffect, useRef, useState } from 'react';
import { subscribeDefaults, subscribeTitle, subscribeStyles } from '../../lib/subscribe';
import { subscribeEmail } from '../../lib/subscribe-client';

export { subscribeEmail };

export function useSubscribe() {
  const pending = useRef(false);
  const [state, setState] = useState({ status: 'idle', message: '' });
  async function subscribe(email, website = '') {
    if (pending.current) return;
    pending.current = true;
    setState({ status: 'loading', message: '' });
    try {
      const result = await subscribeEmail(email, website);
      setState({ status: result.preview ? 'idle' : 'success', message: result.message });
      return result;
    } catch (error) {
      setState({ status: 'error', message: error.name === 'TimeoutError' ? 'Unable to subscribe. Please try again.' : error.message });
    } finally { pending.current = false; }
  }
  return { ...state, subscribe };
}

export function Subscribe({ site = defaultSite, title = subscribeTitle(site.name), description = subscribeDefaults.description, buttonLabel = subscribeDefaults.buttonLabel, className, style }) {
  const { status, message, subscribe } = useSubscribe();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return <div data-subscribe-card="" className={className} style={style}>
    <style>{subscribeStyles}</style>
    {title && <h2 data-subscribe-title="">{title}</h2>}
    {description && <p data-subscribe-description="">{description}</p>}
    <form method="post" data-subscribe-form="" onSubmit={async event => {
      event.preventDefault();
      const form = event.currentTarget, data = new FormData(form);
      const result = await subscribe(String(data.get('email') ?? ''), String(data.get('website') ?? ''));
      if (result && !result.preview) form.reset();
    }}>
      <label data-subscribe-label=""><input aria-label="Email address" name="email" type="email" autoComplete="email" placeholder="Type your email..." required maxLength={254} /></label>
      <label data-subscribe-trap="" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <button data-subscribe-button="" type="submit" disabled={!ready || status === 'loading'}>{status === 'loading' ? 'Subscribing…' : buttonLabel}</button>
    </form>
    <p data-subscribe-message="" role="status" aria-live="polite">{message}</p>
  </div>;
}
