// Compact publication actions share the create-site modal's button shape.
// Keep the height aligned with its 32px input.
export const compactButtonStyles = `
.post-share-button, [data-subscribe-card] [data-subscribe-button] { display: inline-flex; justify-content: center; align-items: center; gap: 6px; box-sizing: border-box; height: 32px; min-height: 32px; padding: 0 16px; border: 0; border-radius: 10px; font-family: inherit; font-size: 12px; font-weight: 400; line-height: 16px; text-decoration: none; white-space: nowrap; cursor: pointer; }
.post-share-button:focus-visible, [data-subscribe-card] [data-subscribe-button]:focus-visible { outline: 2px solid var(--site-foreground, #111); outline-offset: 2px; }
`;
