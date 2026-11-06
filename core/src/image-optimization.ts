import path from 'node:path';
import type { AstroIntegration } from 'astro';

// Run after every page has rendered: includes Markdown, MDX, custom components,
// and standard templates, without changing authored image URLs.
export function imageOptimization(workspace: string): AstroIntegration {
  return {
    name: 'lettercamp-image-variants',
    hooks: { 'astro:config:setup': ({ addMiddleware }) => {
      addMiddleware({ entrypoint: path.join(workspace, 'src/lib/image-middleware.ts'), order: 'post' });
    } },
  };
}
