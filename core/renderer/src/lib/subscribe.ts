import { compactButtonStyles } from "./compact-controls";

export type SubscribeProps = { title?: string; description?: string; buttonLabel?: string; width?: "regular" | "wide" | "full" };
export const subscribeDefaults = { title: "Subscribe", description: "", buttonLabel: "Subscribe" };
export function subscribeTitle(name?: unknown) {
  return typeof name === "string" && name.trim() ? `Subscribe to ${name.trim()}` : subscribeDefaults.title;
}

// Shared by the editor, published HTML, and the public React element.
export const subscribeStyles = `${compactButtonStyles}
[data-lettercamp-subscribe] { margin-block: 1.5em; }
[data-subscribe-card] { box-sizing: border-box; min-width: 0; padding: 32px 20px; border: 0; border-radius: 12px; background: var(--site-surface, #fafafa); color: var(--site-body-color, #111); font-family: inherit; text-align: center; }
[data-subscribe-card] [data-subscribe-title] { margin: 0; font-family: var(--heading-font, inherit); color: var(--site-heading-color, #111); font-size: 1.1em; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
[data-subscribe-card] [data-subscribe-description] { margin: 8px 0 0; font-size: .9em; line-height: 1.6; overflow-wrap: anywhere; }
[data-subscribe-card] [data-subscribe-form] { display: flex; align-items: center; justify-content: center; width: 100%; max-width: 360px; gap: 8px; margin: 14px auto 0; }
[data-subscribe-card] [data-subscribe-label] { display: flex; flex: 1 1 0; min-width: 0; margin: 0; }
[data-subscribe-card] input[type=email] { box-sizing: border-box; width: 100%; min-width: 0; height: 32px; padding: 0 12px; border: 1px solid var(--site-border, #e5e5e8); border-radius: 8px; background: var(--site-background, #fff); color: var(--site-body-color, #111); font: inherit; font-size: 13px; line-height: normal; }
[data-subscribe-card] [data-subscribe-button] { flex: 0 0 auto; max-width: 100%; margin: 0; background: #000; color: #fff; transition: background 150ms; }
[data-subscribe-card] [data-subscribe-button]:hover:not(:disabled) { background: #222; }
@media (prefers-reduced-motion: reduce) { [data-subscribe-card] [data-subscribe-button] { transition: none; } }
[data-site-accent] [data-subscribe-card] [data-subscribe-button], [data-site-accent] [data-subscribe-card] [data-subscribe-button]:hover:not(:disabled) { background: var(--site-accent); color: var(--site-accent-text); }
[data-subscribe-card] input:focus-visible { outline: none; border-color: var(--site-border-strong, #b8b8c0); }
[data-subscribe-card] button:disabled { cursor: default; opacity: .6; }
[data-subscribe-card] [data-subscribe-message] { margin: 12px 0 0; font-size: .8em; line-height: 1.5; }
[data-subscribe-card] [data-subscribe-message]:empty { display: none; }
[data-subscribe-card] [data-subscribe-trap] { display: none !important; }
`;
