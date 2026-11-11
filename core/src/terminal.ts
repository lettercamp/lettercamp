import { stripVTControlCharacters } from 'node:util';

// Human-facing output belongs on stderr; data (URLs and JSON) stays on stdout.
// Compute support at call time so redirected streams and NO_COLOR stay plain.
const enabled = () => !!process.stderr.isTTY && !!process.stdout.isTTY && process.env.TERM !== 'dumb' && process.env.NO_COLOR === undefined;
const paint = (open: number, close: number) => (value: string) => enabled() ? `\x1b[${open}m${value}\x1b[${close}m` : value;
export const style = {
  bold: paint(1, 22), muted: paint(2, 22), accent: paint(36, 39),
  success: paint(32, 39), warning: paint(33, 39), error: paint(31, 39),
};

export const terminal = {
  heading: (message: string) => console.error(`\n${style.accent('◆')} ${style.bold(message)}`),
  step: (message: string) => console.error(`${style.accent('›')} ${message}`),
  success: (message: string) => console.error(`${style.success('✓')} ${message}`),
  warning: (message: string) => console.error(`${style.warning('!')} ${message}`),
  note: (message: string) => console.error(`  ${style.muted(message)}`),
  detail: (label: string, value: string) => console.error(`  ${style.muted(`${label}:`)} ${value}`),
  error: (message: string) => console.error(`\n${style.error('✗')} ${style.bold('Lettercamp')}\n\n  ${message.replaceAll('\n', '\n  ')}\n`),
};

// A conservative UTF-8 budget keeps wide characters inside a terminal row too.
// Strip terminal controls from labels before drawing a selection menu.
export function terminalLabel(value: string, columns: number) {
  const plain = stripVTControlCharacters(value).replace(/[\r\n\t]/g, ' ');
  let result = '', width = 0;
  for (const character of plain) {
    width += Buffer.byteLength(character);
    if (width > columns) return result + '…';
    result += character;
  }
  return result;
}
