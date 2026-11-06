// Shared by the page editor, draft preview, and published renderer.
export const keyTakeawaysStyles = `
[data-lettercamp-key-takeaways] {
  box-sizing: border-box; margin-block: 24px; padding: 20px 24px;
  border-radius: 8px; background: var(--site-surface, #fafafa); color: inherit;
  font: inherit; overflow-wrap: anywhere;
}
[data-lettercamp-key-takeaways][data-lettercamp-key-takeaways] > :is(h1, h2, h3, h4, h5, h6) {
  margin: 0 0 10px; padding: 0;
}
[data-lettercamp-key-takeaways][data-lettercamp-key-takeaways] :is(ul, ol) {
  margin: 0; padding: 0 0 0 1.4em;
}
[data-lettercamp-key-takeaways][data-lettercamp-key-takeaways] li {
  margin: 6px 0; padding: 0 0 0 .2em;
}
[data-lettercamp-key-takeaways][data-lettercamp-key-takeaways] p { margin: 0; padding: 0; min-height: 0; }
[data-lettercamp-key-takeaways][data-lettercamp-key-takeaways] > p:first-child { margin-bottom: 10px; }
[data-lettercamp-key-takeaways][data-lettercamp-key-takeaways] > :last-child,
[data-lettercamp-key-takeaways][data-lettercamp-key-takeaways] > :last-child > li:last-child { margin-bottom: 0; }
@media (max-width: 600px) {
  [data-lettercamp-key-takeaways] { padding: 16px 18px; }
}
`;
