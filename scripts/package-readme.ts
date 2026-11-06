import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// npm runs workspace lifecycle scripts from the package directory. Keep one
// maintained README while still including it in each published npm package.
const source = fileURLToPath(new URL('../README.md', import.meta.url));
copyFileSync(source, path.join(process.cwd(), 'README.md'));
