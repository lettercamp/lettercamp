import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fromHtml } from 'hast-util-from-html';
import { glob } from 'tinyglobby';
import { findCustomLayouts } from './custom-layout.js';
import type { SourceFile } from './deployment-images.js';
import type { CheckIssue } from './import-check.js';

export type RouteWarning = { code: 'ignored-page-route'; file: string; message: string };

const articlePath = /^pages\/(?!index\.mdx?$)([^/]+)\.mdx?$/;

export async function ignoredPageWarnings(root: string): Promise<RouteWarning[]> {
  const files = await glob(['pages/**/*.{md,mdx,astro}', 'src/pages/**/*.{astro,md,mdx,js,jsx,ts,tsx}'], {
    cwd: root,
    caseSensitiveMatch: false,
    followSymbolicLinks: false,
    ignore: ['**/{node_modules,dist,build,coverage}/**', '**/*.d.ts'],
  });
  return files.sort().filter(file => !articlePath.test(file)).map(file => ({
    code: 'ignored-page-route',
    file,
    message: /^pages\/index\.mdx?$/i.test(file)
      ? 'Lettercamp generates the homepage. Use settings.json or a PostList layout to customize it.'
      : 'Lettercamp renders articles from .md or .mdx files directly inside pages/. Use pages/my-post.mdx for the /my-post route.',
  }));
}

export async function checkPostBodies(root: string, outDir: string, files: SourceFile[]): Promise<CheckIssue[]> {
  const { PostLayout } = await findCustomLayouts(root);
  if (!PostLayout) return [];
  const issues: CheckIssue[] = [];
  for (const file of files) {
    const match = articlePath.exec(file.path);
    if (!match) continue;
    // Astro normalizes dynamic route params and keeps escaped URL delimiters in
    // the output directory. Its status pages use a flat HTML filename.
    const slug = match[1].normalize().replace(/[?#]/g, encodeURIComponent);
    const output = slug === '404' || slug === '500' ? `${slug}.html` : path.join(slug, 'index.html');
    const html = await readFile(path.join(outDir, output), 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
      throw error;
    });
    if (html === null) {
      issues.push({ code: 'missing-post-output', file: file.path, message: 'The build did not generate an HTML page for this post.',
        fix: 'Check for a route conflict. Try renaming the file to an unused post slug.' });
      continue;
    }
    const tree = fromHtml(html);
    function hasBody(node: typeof tree | (typeof tree.children)[number]): boolean {
      if (node.type === 'element') {
        if (node.tagName === 'template' || node.tagName === 'noscript') return false;
        if (Object.hasOwn(node.properties, 'dataLettercampBody')) return true;
      }
      return 'children' in node && node.children.some(hasBody);
    }
    if (!hasBody(tree)) issues.push({
      code: 'missing-post-body',
      file: file.path,
      message: `The article body is missing from the page rendered by ${PostLayout}.`,
      fix: `Accept children in ${PostLayout} and render {children} once inside the article.`,
    });
  }
  return issues;
}
