import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run the real CLI entry point from the publication, directly from TypeScript.
// With no directory argument, use the starter bundled with the CLI.
const args = process.argv.slice(2);
const directory = args[0] && !args[0].startsWith('-') ? args.shift()! : fileURLToPath(new URL('../core/starter/', import.meta.url));

try {
  process.chdir(path.resolve(directory));
  process.argv = [process.argv[0], fileURLToPath(new URL('../core/src/lettercamp.ts', import.meta.url)), 'dev', ...args];
  await import('../core/src/lettercamp.js');
} catch (error) {
  console.error(`\nLettercamp: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
