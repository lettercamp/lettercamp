// Shared by the editor preview and published posts. Native disclosures work
// without hydration and let readers keep several answers open at once.
export const faqStyles = `
[data-lettercamp-faq] { margin-block: 24px; color: inherit; overflow-wrap: anywhere; }
[data-lettercamp-faq] > details { border-bottom: 1px solid var(--site-border, #e5e5e5); }
[data-lettercamp-faq] > details:first-child { border-top: 1px solid var(--site-border, #e5e5e5); }
[data-lettercamp-faq] > details > summary {
  display: flex; align-items: center; justify-content: space-between; gap: 24px;
  padding: 18px 0; cursor: pointer; list-style: none; font-weight: 600; line-height: 1.5;
}
[data-lettercamp-faq] > details > summary::-webkit-details-marker { display: none; }
[data-lettercamp-faq] > details > summary::after {
  content: ''; width: 7px; height: 7px; flex: 0 0 7px; margin: 0 4px 4px;
  border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg); transition: transform 150ms;
}
[data-lettercamp-faq] > details[open] > summary::after { transform: translateY(4px) rotate(225deg); }
[data-lettercamp-faq] > details > summary:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; border-radius: 2px; }
[data-lettercamp-faq] > details > [data-faq-answer] { padding: 0 28px 20px 0; }
[data-lettercamp-faq] > details > [data-faq-answer] > :first-child { margin-top: 0; }
[data-lettercamp-faq] > details > [data-faq-answer] > :last-child { margin-bottom: 0; }
@media (prefers-reduced-motion: reduce) { [data-lettercamp-faq] > details > summary::after { transition: none; } }
@media print { [data-lettercamp-faq] > details::details-content { content-visibility: visible; } }
`;
