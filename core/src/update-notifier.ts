import { mkdir, readFile, rename, rm, stat, writeFile, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import semver from 'semver';
import { likelyGlobalInstallation, projectInstallation, updateCommand, type PackageName } from './installation.js';
import { isBreakingUpdate, latestRelease } from './version.js';

const day = 24 * 60 * 60 * 1000;
type Cache = { checkedAt?: number; notifiedAt?: number; latest?: string };

function cachePath(name: PackageName) {
  const base = process.platform === 'win32'
    ? process.env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local')
    : process.env.XDG_CACHE_HOME || path.join(homedir(), '.cache');
  return path.join(base, 'lettercamp', `updates-${name === 'lettercamp' ? 'wrapper' : 'core'}.json`);
}

async function readCache(file: string): Promise<Cache> {
  try {
    const value = JSON.parse(await readFile(file, 'utf8'));
    return {
      checkedAt: Number.isFinite(value.checkedAt) ? value.checkedAt : undefined,
      notifiedAt: Number.isFinite(value.notifiedAt) ? value.notifiedAt : undefined,
      latest: typeof value.latest === 'string' && semver.valid(value.latest) && !semver.prerelease(value.latest) ? value.latest : undefined,
    };
  } catch { return {}; }
}

async function writeCache(file: string, cache: Cache) {
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(cache), { mode: 0o600 });
    await rename(temporary, file);
  } finally { await rm(temporary, { force: true }); }
}

async function withCache(name: PackageName, action: (cache: Cache) => Promise<void>) {
  const file = cachePath(name);
  const lock = `${file}.lock`;
  await mkdir(path.dirname(file), { recursive: true });
  try { await mkdir(lock); }
  catch {
    // Recover a lock abandoned by a terminated process without waiting on an
    // active command. A skipped check is preferable to delaying the CLI.
    if (Date.now() - (await stat(lock)).mtimeMs > 60_000) await rm(lock, { recursive: true, force: true });
    return;
  }
  try {
    const cache = await readCache(file);
    await action(cache);
    await writeCache(file, cache);
  } finally { await rm(lock, { recursive: true, force: true }); }
}

function recent(time: number | undefined, now: number) {
  return time !== undefined && time <= now && now - time < day;
}

export function shouldNotify(argv: string[], env = process.env, terminal = !!(process.stdin.isTTY && process.stdout.isTTY && process.stderr.isTTY)) {
  return terminal && env.TERM !== 'dumb'
    && env.LETTERCAMP_CLOUD_BUILD !== '1'
    && !['CI', 'CONTINUOUS_INTEGRATION', 'BUILD_NUMBER', 'RUN_ID', 'GITHUB_ACTIONS', 'TF_BUILD', 'JENKINS_URL', 'TEAMCITY_VERSION'].some(key => env[key] && env[key] !== 'false' && env[key] !== '0')
    && env.LETTERCAMP_NO_UPDATE_NOTIFIER === undefined && env.NO_UPDATE_NOTIFIER === undefined
    && !argv.some(arg => ['--json', '--help', '-h', '--version', '-v', '--yes', '-y'].includes(arg));
}

export async function notifyUpdate(argv: string[]) {
  if (!shouldNotify(argv)) return;
  try {
    const target = await projectInstallation() ?? await likelyGlobalInstallation();
    if (!target) return;
    let worker: string | undefined;
    await withCache(target.name, async cache => {
      const now = Date.now();
      if (cache.latest && semver.gt(cache.latest, target.version) && !recent(cache.notifiedAt, now)) {
        console.error(`\nUpdate available: ${target.version} → ${cache.latest}`);
        console.error(`Run ${updateCommand(target)} to update ${target.global ? 'the global CLI' : 'this project'}.`);
        if (isBreakingUpdate(target.version, cache.latest)) console.error('This release may include breaking changes; the update command will provide guidance.');
        console.error('');
        cache.notifiedAt = now;
      }
      if (recent(cache.checkedAt, now)) return;
      worker = fileURLToPath(new URL('./update-notifier.js', import.meta.url));
      await access(worker);
      cache.checkedAt = now;
    });
    // Release the cache lock before the worker can write its result.
    if (worker) {
      const child = spawn(process.execPath, [worker, target.name], {
        detached: true, stdio: 'ignore', windowsHide: true,
      });
      child.on('error', () => {});
      child.unref();
    }
  } catch { /* Update notices must never prevent a command from running. */ }
}

export async function refreshUpdateCache(name: PackageName) {
  const release = await latestRelease(name);
  // A failed/offline request retains the old result and the parent's daily
  // backoff. This worker only fetches metadata; it never installs anything.
  await withCache(name, async cache => { cache.latest = release?.version; });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const name = process.argv[2];
  if (name === 'lettercamp' || name === '@lettercamp/cli') await refreshUpdateCache(name).catch(() => {});
}
