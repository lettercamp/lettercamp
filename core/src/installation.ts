import { readFile, realpath, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import semver from 'semver';

export type PackageName = 'lettercamp' | '@lettercamp/cli';
type Manifest = {
  name?: string;
  version?: string;
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
export type Installation = {
  directory: string;
  name: PackageName;
  version: string;
  global: boolean;
  development: boolean;
  manager: string;
};

export const coreDirectory = fileURLToPath(new URL('../', import.meta.url));

async function manifest(directory: string): Promise<Manifest | undefined> {
  try { return JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

const lockfiles: Record<string, string[]> = {
  npm: ['package-lock.json', 'npm-shrinkwrap.json'],
  pnpm: ['pnpm-lock.yaml'],
  yarn: ['yarn.lock'],
  bun: ['bun.lock', 'bun.lockb'],
};

async function packageManager(directory: string): Promise<string> {
  for (let current = directory; ; current = path.dirname(current)) {
    const pkg = await manifest(current);
    if (pkg?.packageManager) {
      const manager = pkg.packageManager.split('@')[0];
      if (!Object.hasOwn(lockfiles, manager)) throw new Error(`Unsupported package manager: ${manager}. Update Lettercamp with your package manager.`);
      return manager;
    }
    const managers = [];
    for (const [manager, files] of Object.entries(lockfiles)) {
      if ((await Promise.all(files.map(file => access(path.join(current, file)).then(() => true, () => false)))).some(Boolean)) managers.push(manager);
    }
    if (managers.length > 1) throw new Error('Multiple package-manager lockfiles found. Set packageManager in package.json before updating.');
    if (managers.length === 1) return managers[0];
    if (path.dirname(current) === current) return 'npm';
  }
}

export async function projectInstallation(cwd = process.cwd()): Promise<Installation | undefined> {
  for (let directory = path.resolve(cwd); ; directory = path.dirname(directory)) {
    const pkg = await manifest(directory);
    if (pkg) {
      const names = (['lettercamp', '@lettercamp/cli'] as const).filter(name => pkg.devDependencies?.[name] || pkg.dependencies?.[name]);
      if (!names.length) return undefined;
      if (names.length > 1) throw new Error('This project declares both lettercamp and @lettercamp/cli. Keep one CLI dependency before updating.');
      const name = names[0];
      const spec = pkg.devDependencies?.[name] ?? pkg.dependencies?.[name];
      if (!semver.validRange(spec)) throw new Error(`The ${name} dependency uses a custom source. Update it with your package manager.`);
      const require = createRequire(path.join(directory, 'package.json'));
      let installed: Manifest | undefined;
      try {
        const filename = name === 'lettercamp'
          ? require.resolve('lettercamp/package.json')
          : path.resolve(path.dirname(require.resolve('@lettercamp/cli/cli')), '../package.json');
        installed = JSON.parse(await readFile(filename, 'utf8'));
      } catch { throw new Error('Cannot find the project’s installed Lettercamp. Install its dependencies with your package manager first.'); }
      if (!installed?.version || !semver.valid(installed.version)) throw new Error('The installed Lettercamp version is invalid.');
      return { directory, name, version: installed.version, global: false, development: !!pkg.devDependencies?.[name], manager: await packageManager(directory) };
    }
    if (path.dirname(directory) === directory) return undefined;
  }
}

// Passive notices recognize npm's global layouts without starting npm.
// Explicit updates always verify npm's actual global root before installing.
export async function likelyGlobalInstallation(corePath = coreDirectory): Promise<Installation | undefined> {
  let directory = path.resolve(corePath);
  let name: PackageName = '@lettercamp/cli';
  const wrapper = path.resolve(directory, '../../..');
  if ((await manifest(wrapper))?.name === 'lettercamp') { directory = wrapper; name = 'lettercamp'; }
  const root = path.resolve(directory, name === 'lettercamp' ? '..' : '../..');
  const globalLayout = process.platform === 'win32'
    ? [path.dirname(process.execPath), process.env.APPDATA && path.join(process.env.APPDATA, 'npm'), process.env.npm_config_prefix]
      .some(prefix => prefix && root === path.resolve(prefix, 'node_modules'))
    : root.endsWith(`${path.sep}lib${path.sep}node_modules`);
  if (!globalLayout) return undefined;
  const pkg = await manifest(directory);
  if (!pkg?.version || !semver.valid(pkg.version)) return undefined;
  return { directory, name, version: pkg.version, global: true, development: false, manager: 'npm' };
}

export async function globalInstallation(explicit: boolean): Promise<Installation> {
  const root = await new Promise<string>((resolve, reject) => {
    const child = spawn('npm', ['root', '--global'], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', timeout: 10_000 });
    let output = '';
    child.stdout!.on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(output.trim()) : reject(new Error('Could not locate the global npm installation.')));
  });
  if (!path.isAbsolute(root)) throw new Error('npm returned an invalid global installation directory.');
  for (const name of ['lettercamp', '@lettercamp/cli'] as const) {
    const directory = path.join(root, name);
    const pkg = await manifest(directory);
    if (!pkg?.version || !semver.valid(pkg.version)) continue;
    if (!explicit) {
      const entry = name === 'lettercamp'
        ? createRequire(path.join(directory, 'package.json')).resolve('@lettercamp/cli/cli')
        : path.join(directory, 'dist', 'lettercamp.js');
      if (await realpath(path.resolve(path.dirname(entry), '..')) !== await realpath(coreDirectory)) continue;
    }
    return { directory, name, version: pkg.version, global: true, development: false, manager: 'npm' };
  }
  throw new Error(explicit
    ? 'No global npm installation found. To install one, run npm install --global lettercamp@latest.'
    : 'No project or matching global installation found. Run this command inside your Lettercamp project, or use --global for an existing global npm installation.');
}

export function updateCommand(target: Installation): string {
  if (target.global) return 'lettercamp update --global';
  return `${({ npm: 'npx', pnpm: 'pnpm exec', yarn: 'yarn', bun: 'bun run' } as Record<string, string>)[target.manager]} lettercamp update`;
}

export function installArguments(target: Installation, version: string): string[] {
  const dependency = `${target.name}@${version}`;
  if (target.global) return ['install', '--global', dependency];
  const save = target.development ? '--save-dev' : '--save-prod';
  if (target.manager === 'npm') return ['install', save, '--save-exact', dependency];
  if (target.manager === 'pnpm') return ['add', save, '--save-exact', dependency];
  return ['add', ...(target.development ? ['--dev'] : []), '--exact', dependency];
}
