import { createInterface } from 'node:readline/promises';

export async function ask(label: string, fallback?: string) {
  if (!process.stdin.isTTY || !process.stderr.isTTY) throw new Error('This step needs a terminal. Run this command interactively once to finish setup.');
  const readline = createInterface({ input: process.stdin, output: process.stderr });
  const abort = new AbortController();
  readline.on('SIGINT', () => abort.abort());
  try {
    const value = (await readline.question(`${label}${fallback ? ` (${fallback})` : ''}: `, { signal: abort.signal })).trim();
    return value || fallback || '';
  } catch { throw new Error('Cancelled.'); }
  finally { readline.close(); }
}
export async function confirm(label: string) {
  return /^(y|yes)$/i.test(await ask(`${label} [y/N]`));
}
export async function choose(label: string, choices: string[]) {
  console.error(`\n${label}`);
  choices.forEach((choice, i) => console.error(`  ${i + 1}. ${choice}`));
  for (;;) {
    const value = await ask('Choose a number', '1');
    if (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= choices.length) return Number(value) - 1;
    console.error(`Choose a number from 1 to ${choices.length}.`);
  }
}
