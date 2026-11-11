import { createInterface } from 'node:readline/promises';
import { emitKeypressEvents } from 'node:readline';
import { style, terminalLabel } from './terminal.js';

export async function ask(label: string, fallback?: string) {
  if (!process.stdin.isTTY || !process.stderr.isTTY) throw new Error('This step needs a terminal. Run this command interactively once to finish setup.');
  const readline = createInterface({ input: process.stdin, output: process.stderr });
  const abort = new AbortController();
  readline.on('SIGINT', () => abort.abort());
  try {
    const value = (await readline.question(`${style.accent('?')} ${style.bold(label)}${fallback ? ` ${style.muted(`(${fallback})`)}` : ''} ${style.accent('›')} `, { signal: abort.signal })).trim();
    return value || fallback || '';
  } catch { throw new Error('Cancelled.'); }
  finally { readline.close(); }
}
export async function confirm(label: string) {
  return /^(y|yes)$/i.test(await ask(`${label} [y/N]`));
}
export async function choose(label: string, choices: string[]) {
  if (!choices.length) throw new Error('No choices are available.');
  if (!process.stdin.isTTY || !process.stderr.isTTY) throw new Error('This step needs a terminal. Run this command interactively once to finish setup.');
  if (process.env.TERM !== 'dumb') return chooseWithKeys(label, choices);
  console.error(`\n${label}`);
  choices.forEach((choice, i) => console.error(`  ${i + 1}. ${choice}`));
  for (;;) {
    const value = await ask('Choose a number', '1');
    if (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= choices.length) return Number(value) - 1;
    console.error(`Choose a number from 1 to ${choices.length}.`);
  }
}

async function chooseWithKeys(label: string, choices: string[]): Promise<number> {
  const input = process.stdin, output = process.stderr;
  const wasRaw = input.isRaw, wasFlowing = input.readableFlowing === true;
  emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  console.error(`\n${style.accent('?')} ${style.bold(label)}`);
  console.error(style.muted('  ↑/↓ to move · type a number · Enter to select · Esc to cancel'));
  let selected = 0, digits = '';
  let renderedLines = 0;
  const clear = () => {
    if (renderedLines) output.write(`\x1b[${renderedLines}A`);
    output.write('\r\x1b[J');
  };
  const draw = (invalid = false) => {
    const number = digits ? Number(digits) : selected + 1;
    const focus = number >= 1 && number <= choices.length ? number - 1 : selected;
    const count = Math.max(1, Math.min(7, (output.rows || 24) - 6));
    const start = Math.max(0, Math.min(focus - Math.floor(count / 2), choices.length - count));
    const width = Math.max(1, (output.columns || 80) - 12);
    const rows = choices.slice(start, start + count).map((choice, index) => {
      const position = start + index;
      const text = `${position + 1}. ${terminalLabel(choice, width)}`;
      return position === focus ? style.accent(`  ❯ ${text}`) : `    ${style.muted(text)}`;
    });
    if (choices.length > count) rows.push(style.muted(`    ${start + 1}–${Math.min(start + count, choices.length)} of ${choices.length}`));
    clear();
    output.write(rows.join('\n') + '\n');
    output.write(invalid ? style.warning(`  Enter 1–${choices.length}.`) : style.muted(`  Selection: ${digits || number}`));
    renderedLines = rows.length;
  };
  draw();
  try {
    return await new Promise<number>((resolve, reject) => {
      const finish = (error?: Error) => {
        input.off('keypress', onKey);
        clear();
        if (error) { output.write(style.muted('  Cancelled.\n')); reject(error); }
        else { output.write(`  ${style.success('✓')} ${terminalLabel(choices[selected], Math.max(1, (output.columns || 80) - 8))}\n`); resolve(selected); }
      };
      const onKey = (text: string | undefined, key: { name?: string; ctrl?: boolean }) => {
        if (key.name === 'escape' || key.ctrl && (key.name === 'c' || key.name === 'd')) { finish(new Error('Cancelled.')); return; }
        if (key.name === 'up' || key.name === 'down') {
          selected = (selected + (key.name === 'up' ? -1 : 1) + choices.length) % choices.length;
          digits = '';
        } else if (key.name === 'return' || key.name === 'enter') {
          if (digits && (Number(digits) < 1 || Number(digits) > choices.length)) { digits = ''; draw(true); return; }
          if (digits) selected = Number(digits) - 1;
          finish(); return;
        } else if (key.name === 'backspace') digits = digits.slice(0, -1);
        else if (text && /^\d+$/.test(text)) digits = (digits + text).slice(0, String(choices.length).length + 1);
        else return;
        if (digits && Number(digits) >= 1 && Number(digits) <= choices.length) selected = Number(digits) - 1;
        draw();
      };
      input.on('keypress', onKey);
    });
  } finally {
    input.setRawMode(wasRaw);
    if (!wasFlowing) input.pause();
  }
}
