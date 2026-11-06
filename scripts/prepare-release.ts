import { appendFileSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import semver from 'semver';

type Package = { name: string; version: string; dependencies?: Record<string, string> };
type Metadata = { versions: Record<string, unknown>; 'dist-tags': { latest: string } };
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const files = ['package.json', 'core/package.json', 'wrapper/package.json', 'create/package.json'];
const packages = files.map(file => JSON.parse(readFileSync(file, 'utf8')) as Package);
const report = (version: string, message: string) => {
  console.log(message);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
};

// Version allocation and tag publication belong to the serialized Actions job.
if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REF !== 'refs/heads/main') {
  throw new Error('Release preparation runs in GitHub Actions on main. Commit your changes and push main to publish.');
}
const source = process.env.GITHUB_SHA;
if (!source || !/^[a-f0-9]{40}$/.test(source) || git('rev-parse', 'HEAD') !== source) {
  throw new Error('Check out the exact workflow source commit before preparing its release.');
}
if (git('status', '--porcelain')) throw new Error('Release preparation requires a clean checkout.');
git('fetch', '--tags', 'origin');
const tags = git('for-each-ref', '--format=%(refname:short) %(contents:subject)', 'refs/tags')
  .split('\n').map(line => ({ name: line.split(' ')[0], subject: line.slice(line.indexOf(' ') + 1) }));
const existing = tags.find(tag => /^v\d+\.\d+\.\d+$/.test(tag.name) &&
  tag.subject === `Release ${tag.name.slice(1)} from ${source}`);
if (existing) {
  if (git('rev-parse', `${existing.name}^{commit}^`) !== source) throw new Error('Release tag does not match its source commit.');
  git('checkout', '--detach', existing.name);
  report(existing.name.slice(1), `Resuming ${existing.name} for ${source}. Published packages will be skipped.`);
} else {
  const versions: string[] = [];
  for (const pkg of packages.slice(1)) {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}`, {
      signal: AbortSignal.timeout(30_000), headers: { Accept: 'application/vnd.npm.install-v1+json' },
    });
    if (!response.ok) throw new Error(`Cannot read ${pkg.name} (HTTP ${response.status}). Register new packages with npm stage publish, then configure their GitHub Actions trusted publisher for lettercamp/lettercamp, workflow publish.yml, with direct publishing allowed.`);
    const metadata = await response.json() as Metadata;
    const stable = Object.keys(metadata.versions).filter(version => semver.valid(version) && !semver.prerelease(version));
    // A newly staged initializer has only npm's 0.0.0-stage placeholder. Its
    // first real version is allocated alongside the existing CLI packages.
    if (!stable.length && pkg.name !== 'create-lettercamp') throw new Error(`${pkg.name} has no stable release. Publish its first stable version before enabling automatic publishing.`);
    versions.push(...stable);
  }
  // Include reserved versions so a failed earlier release cannot cause a collision.
  versions.push(...tags.map(tag => tag.name.slice(1)).filter((version, i) =>
    tags[i].name.startsWith('v') && semver.valid(version) && !semver.prerelease(version)));
  const next = semver.inc(semver.rsort(versions)[0], 'patch')!;
  const configured = packages[1].version;
  if (!semver.valid(configured) || semver.prerelease(configured)) throw new Error('The core manifest must have a stable version.');
  const version = semver.gt(configured, next) ? configured : next;
  for (let i = 0; i < files.length; i++) {
    packages[i].version = version;
    if (packages[i].dependencies?.['@lettercamp/cli']) packages[i].dependencies!['@lettercamp/cli'] = version;
    writeFileSync(files[i], JSON.stringify(packages[i], null, 2) + '\n');
  }
  execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { stdio: 'inherit' });
  // Publish the same committed dependency tree used by this release. Hosted
  // images install the public packages as workspaces with npm ci, without
  // needing a source checkout or repository credentials.
  mkdirSync('wrapper/build-image', { recursive: true });
  copyFileSync('package-lock.json', 'wrapper/build-image/package-lock.json');
  git('config', 'user.name', 'github-actions[bot]');
  git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
  git('add', ...files, 'package-lock.json', 'wrapper/build-image/package-lock.json');
  git('commit', '-m', `Release ${version} from ${source}`);
  git('tag', '-a', `v${version}`, '-m', `Release ${version} from ${source}`);
  // Only push the release snapshot tag. main stays untouched, avoiding CI loops
  // and keeping user pushes free of bot-generated version commits.
  git('push', 'origin', `refs/tags/v${version}`);
  report(version, `Prepared v${version} from ${source}. All packages use this version.`);
}
