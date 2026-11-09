import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// npm runs workspace lifecycle scripts from the package directory. Keep one
// maintained README while still including it in each published npm package.
const source = fileURLToPath(new URL('../README.md', import.meta.url));
const { name } = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const notice = name === '@lettercamp/cli'
  ? '> This package contains the engine powering [`lettercamp`](https://www.npmjs.com/package/lettercamp) and [`create-lettercamp`](https://www.npmjs.com/package/create-lettercamp). To get started, run `npm create lettercamp@latest`. For CLI usage, use `npx lettercamp`.\n\n'
  : '';
writeFileSync(path.join(process.cwd(), 'README.md'), notice + readFileSync(source, 'utf8'));
