import { clearLine, cursorTo } from 'node:readline';
import type { DevOptions } from './dev.js';

export async function preview(directory: string, options: DevOptions) {
  console.log('\nWelcome to the Lettercamp CLI!\n');

  const output = process.stdout;
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frame = 0;
  const render = () => {
    cursorTo(output, 0);
    output.write(`${frames[frame++ % frames.length]} Starting your preview…`);
  };
  let timer: ReturnType<typeof setInterval> | undefined;
  if (output.isTTY && process.env.TERM !== 'dumb') {
    render();
    timer = setInterval(render, 80);
    timer.unref();
  } else {
    console.log('Starting your preview…');
  }
  const finishLoading = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = undefined;
    cursorTo(output, 0);
    clearLine(output, 0);
  };

  try {
    // Keep the welcome and animation ahead of the renderer's slower imports.
    const { startDev } = await import('./dev.js');
    const { server, contentRoot } = await startDev(directory, options);
    finishLoading();
    if (server.address.port !== options.port) {
      console.log(`Port ${options.port} is in use. Using port ${server.address.port} instead.\n`);
    }
    console.log('Your publication is ready.\n');
    for (const url of server.resolvedUrls.local) console.log(`  Local:   ${url}`);
    for (const url of server.resolvedUrls.network) console.log(`  Network: ${url}`);
    console.log(`\nPreviewing ${contentRoot}`);
    console.log('Changes to pages, components, styles, and settings.json reload automatically.');
    console.log('Press Ctrl+C to stop.\n');
  } finally {
    finishLoading();
  }
}
