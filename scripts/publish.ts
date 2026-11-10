import { appendFileSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import semver from 'semver';

type Package = { name: string; version: string; dependencies: Record<string, string> };
type Metadata = { versions: Record<string, unknown>; 'dist-tags': { latest?: string } };

// Publish all packages concurrently, then gate the release on registry availability.
const packages = ['core', 'wrapper', 'create'].map(folder => JSON.parse(readFileSync(`${folder}/package.json`, 'utf8')) as Package);
const version = packages[0].version;
const registryWaitMinutes = 10;
if (!semver.valid(version) || semver.prerelease(version) || packages.slice(1).some(pkg =>
    pkg.version !== version || pkg.dependencies['@lettercamp/cli'] !== version)) {
  throw new Error('All packages and their core dependencies must use the same stable version.');
}
const report = (message: string) => {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
};
const plans: { pkg: Package; publish: boolean }[] = [];
for (const pkg of packages) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}?publish-check=${Date.now()}`, {
    signal: AbortSignal.timeout(30_000),
    headers: { Accept: 'application/vnd.npm.install-v1+json', 'Cache-Control': 'no-cache' },
  });
  if (response.status === 404) {
    throw new Error(`Register ${pkg.name} with npm stage publish, then configure its GitHub Actions trusted publisher for lettercamp/lettercamp, workflow publish.yml, with direct publishing allowed.`);
  }
  if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}.`);
  const metadata = await response.json() as Metadata;
  const publish = !Object.hasOwn(metadata.versions, version);
  const latest = metadata['dist-tags'].latest;
  if (publish && latest && semver.gt(latest, version)) throw new Error(`${pkg.name}: a newer release is already live; do not publish an older snapshot.`);
  plans.push({ pkg, publish });
}
async function publishPackage({ pkg, publish }: (typeof plans)[number]) {
  if (!publish) { report(`${pkg.name}@${version} already published; skipping.`); return; }
  if (process.argv.includes('--check')) { report(`Would publish ${pkg.name}@${version}.`); return; }
  await new Promise<void>((resolve, reject) => {
    const child = spawn('npm', ['publish', '--workspace', pkg.name, '--access', 'public'], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${pkg.name}@${version}: npm publish failed (${signal ? `signal ${signal}` : `exit ${code}`}).`));
    });
  });
  // npm can accept a publish before installs can resolve the version. Verify
  // availability before completing the workflow; retries skip published versions.
  report(`Waiting up to ${registryWaitMinutes} minutes for npm to process ${pkg.name}@${version}…`);
  let available = false;
  let lastStatus = 'not yet available';
  const deadline = Date.now() + registryWaitMinutes * 60_000;
  while (Date.now() < deadline) {
    let response: Response | undefined;
    try {
      response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/${version}?publish-check=${Date.now()}`, {
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      });
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
    }
    if (response) {
      await response.body?.cancel();
      if (response.ok) { available = true; break; }
      lastStatus = `HTTP ${response.status}`;
      if (![404, 408, 429].includes(response.status) && response.status < 500) {
        throw new Error(`Cannot verify ${pkg.name}@${version} (${lastStatus}).`);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 5_000));
  }
  if (!available) throw new Error(`npm accepted ${pkg.name}@${version}, but availability could not be confirmed after ${registryWaitMinutes} minutes (${lastStatus}). Wait for registry processing or approve any staged release, then rerun pnpm release. Already published versions will be skipped.`);
  report(`${pkg.name}@${version} is available on npm.`);
}

// Drain every publication and availability check even if another package fails,
// so a retry never races a publish still running in this process.
const publications = await Promise.allSettled(plans.map(publishPackage));
const failures = publications.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
if (failures.length) throw new AggregateError(failures, 'Package publication failed. Rerun to resume already published versions.');
