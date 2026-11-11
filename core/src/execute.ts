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
    terminal.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
