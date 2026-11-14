import semver from 'semver';
import { terminal } from './terminal.js';

export async function execute(name: 'lettercamp' | 'create-lettercamp') {
  try {
    if (process.env.LETTERCAMP_CLOUD_BUILD === '1') process.env.ASTRO_TELEMETRY_DISABLED = '1';
    if (!semver.satisfies(process.versions.node, '>=22.23.4')) {
      throw new Error(`Node.js 22.23.4 or newer is required (you have ${process.versions.node}).`);
    }
    const { run } = await import('./cli.js');
    await run(process.argv, name);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (['connect', 'pull', 'push', 'status', 'posts', 'assets', 'publish', 'upload'].includes(process.argv[2]) && process.argv.includes('--json')) console.log(JSON.stringify({ ok: false, error: message }));
    else terminal.error(message);
    process.exitCode = 1;
  }
}
