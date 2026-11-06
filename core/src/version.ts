import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import semver from 'semver';
import { globalInstallation, installArguments, projectInstallation, updateCommand, type PackageName } from './installation.js';

const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
export const version = metadata.version;
export type Release = { version: string; engines?: { node?: string } };

export async function latestRelease(name: PackageName = 'lettercamp'): Promise<Release | null> {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, {
    signal: AbortSignal.timeout(5_000),
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Unable to check npm for updates (HTTP ${response.status}).`);
  const release = await response.json() as Release;
  if (!semver.valid(release.version) || semver.prerelease(release.version)) throw new Error('npm did not return a valid stable release version.');
  return release;
}

export function isBreakingUpdate(current: string, latest: string): boolean {
  return semver.gt(latest, current) && !semver.satisfies(latest, `^${current}`, { includePrerelease: true });
}

export async function showVersion() {
  console.log(`Installed: ${version}`);
  try {
    const target = await projectInstallation();
    const latest = await latestRelease(target?.name);
    if (target) console.log(`Project:   ${target.version} (${target.directory})`);
    console.log(latest ? `Latest:    ${latest.version}` : 'Latest:    not published to npm yet');
    if (latest && semver.gt(latest.version, target?.version ?? version)) {
      console.log(target ? `Run ${updateCommand(target)} to install it.` : 'Run lettercamp update --global for an existing global npm installation.');
    }
  } catch (error) {
    console.error(`Latest:    unavailable (${error instanceof Error ? error.message : String(error)})`);
    process.exitCode = 1;
  }
}

export async function update(options: { global?: boolean; allowBreaking?: boolean } = {}) {
  const target = options.global ? await globalInstallation(true) : await projectInstallation() ?? await globalInstallation(false);
  const release = await latestRelease(target.name);
  if (!release) {
    console.log('Lettercamp has not been published to npm yet. No update is available.');
    return;
  }
  const latest = release.version;
  if (!semver.gt(latest, target.version)) {
    console.log(`Lettercamp ${target.version} is up to date (latest: ${latest}).`);
    return;
  }
  if (release.engines?.node && !semver.satisfies(process.versions.node, release.engines.node)) {
    throw new Error(`Lettercamp ${latest} requires Node.js ${release.engines.node}; you have ${process.versions.node}. Update Node.js first.`);
  }
  if (isBreakingUpdate(target.version, latest) && !options.allowBreaking) {
    throw new Error(`Lettercamp ${target.version} → ${latest} may include breaking changes. Review https://github.com/lettercamp/lettercamp/releases before updating, then run ${updateCommand(target)} --allow-breaking.`);
  }

  console.log(`Updating ${target.global ? 'global Lettercamp' : `Lettercamp in ${target.directory}`}: ${target.version} → ${latest}`);
  console.log(`Using ${target.manager}…`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(target.manager, installArguments(target, latest), {
      cwd: target.global ? undefined : target.directory,
      stdio: 'inherit',
      // Executable and arguments are fixed or semver-validated.
      shell: process.platform === 'win32',
    });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${target.manager} update failed (${signal ?? code}). Check the package manager’s output before retrying.`));
    });
  });
  console.log(`Updated ${target.global ? 'global ' : ''}Lettercamp to ${latest}.`);
  console.log(target.global ? 'Project installations keep their existing versions.' : 'Updated the project dependency and lockfile. Restart your preview and review the changes before committing.');
}
