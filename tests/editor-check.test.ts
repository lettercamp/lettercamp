import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { editorWarnings } from '../core/src/editor-check.js';

const page = (name: string, body: string) => ({ path: 'pages/' + name, content: Buffer.from(body).toString('base64') });

test('warn once for an opaque article, and allow prose alongside a custom component', async () => {
  const files = await Promise.all(['opaque.md', 'mixed.mdx'].map(async name =>
    page(name, await readFile(new URL('./fixtures/editor-check/' + name, import.meta.url), 'utf8'))));
  const warnings = editorWarnings(files);
  assert.deepEqual(warnings.map(({ file, code }) => [file, code]), [['pages/opaque.md', 'editor-placeholders-only']]);
});

test('look at the body, including native blocks and imports that shadow their names', () => {
  const warnings = editorWarnings([
    page('draft.md', '---\ntitle: Draft\n---\n'),
    page('example.md', '```html\n<div>code sample</div>\n```'),
    page('video.md', '<Video src="https://example.com/video.mp4" />'),
    page('shadow.mdx', "import Video from './Video.jsx'\n\n<Video />"),
    page('broken.md', '<section>unclosed'),
  ]);
  assert.deepEqual(warnings.map(({ file, code }) => [file, code]), [
    ['pages/shadow.mdx', 'editor-placeholders-only'], ['pages/broken.md', 'editor-source-only'],
  ]);
});
