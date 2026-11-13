import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { Subscribe } from '../components/elements/Subscribe.jsx';
import { subscriptionEndpoint } from './subscribe-client';
import site from '../site.js';
import { subscribeTitle } from './subscribe';

class SubscribeBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <Subscribe {...this.props.blockProps} /> : this.props.children; }
}

export function install(CustomSubscribe) {
  const roots = new Map();
  const update = () => {
    for (const [element, root] of roots) if (!element.isConnected) { root.unmount(); roots.delete(element); }
    for (const element of document.querySelectorAll('[data-lettercamp-subscribe]')) {
      if (roots.has(element)) continue;
      const props = JSON.parse(element.dataset.subscribeProps || '{}');
      props.title ??= subscribeTitle(site.name);
      const root = createRoot(element);
      roots.set(element, root);
      element.removeAttribute('data-subscribe-card');
      root.render(<SubscribeBoundary blockProps={props}><CustomSubscribe {...props} site={site} preview={!subscriptionEndpoint()} /></SubscribeBoundary>);
    }
  };
  update();
  new MutationObserver(update).observe(document.body, { childList: true, subtree: true });
}
