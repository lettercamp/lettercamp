import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { projectPath } from './account.js';
import { BuildError } from './build-errors.js';
import { checkImports, supportedImportsUrl, type CheckIssue } from './import-check.js';
import { checkPublicLimits, collectPublicFiles, copyPublicFiles, type PublicFile } from './public-files.js';
import type { SourceFile } from './deployment-images.js';

export type CheckResult = { ok: boolean; issues: CheckIssue[]; build: 'passed' | 'failed' | 'skipped' };
export type CheckOptions = { json?: boolean; build?: boolean };

// Build the files a deployment would upload, in a folder of their own.
async function buildDeploymentFiles(root: string, files: SourceFile[], publicFiles: PublicFile[]) {
  const temporary = await mkdtemp(path.join(tmpdir(), 'lettercamp-deploy-check-'));
  const source = path.join(temporary, 'publication');
  try {
    for (const file of files) {
      const filename = path.join(source, file.path);
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, Buffer.from(file.content, 'base64'));
    }
    await copyPublicFiles(root, path.join(source, 'public'), publicFiles);
    // Do not link the publication's node_modules: Cloud only has the CLI's
    // dependencies, resolved by the renderer workspace and React integration.
    const { buildSite } = await import('./build.js');
    // Lettercamp Cloud generates image variants itself; skip that work in this check.
    await buildSite(source, { site: 'https://preview.lettercamp.site', outDir: path.join(temporary, 'output'), quiet: true, target: 'cloud' }, false);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

async function buildIssue(root: string, files: SourceFile[], publicFiles: PublicFile[]): Promise<CheckIssue | null> {
  try { await buildDeploymentFiles(root, files, publicFiles); return null; }
  catch (error) {
    const failure = error instanceof BuildError ? error.failure : { message: error instanceof Error ? error.message : String(error) };
    return { code: 'build-failed', file: failure.file, message: failure.message, fix: failure.fix };
  }
}

// Imports are checked first: every problem is reported at once with its line,
// and they explain most Cloud build failures. The build then proves the rest.
export async function checkDeployment(root: string, files: SourceFile[], publicFiles: PublicFile[]): Promise<CheckResult> {
  const issues = await checkImports(root);
  if (issues.length) return { ok: false, issues, build: 'skipped' };
  const failure = await buildIssue(root, files, publicFiles);
  return failure ? { ok: false, issues: [failure], build: 'failed' } : { ok: true, issues, build: 'passed' };
}

// One heading per kind of problem: the rule and its fix once, then each location.
const rules: Record<CheckIssue['code'], { title: string; why?: string; fix?: string }> = {
  'unsupported-package': { title: 'npm packages', why: 'Lettercamp Cloud builds provide only react and react-dom. Other packages cannot be resolved, even when they are installed on this computer.' },
  'subpath-import': { title: 'package.json import aliases', why: 'package.json is not part of a deployment, so Lettercamp Cloud cannot resolve "#" aliases.', fix: 'Use a relative path, shown beside each import where it is known.' },
  'path-alias': { title: 'Path aliases', why: 'Aliases from tsconfig.json or a bundler configuration are not available in Lettercamp Cloud builds.' },
  'absolute-path': { title: 'Absolute import paths', why: 'An absolute path does not point into your publication during a build.' },
  'outside-publication': { title: 'Files outside the publication', why: 'A deployment contains settings.json and the pages/, components/, lib/, styles/, and assets/ folders.' },
  'missing-file': { title: 'Missing files', why: 'These imports do not match a file in your publication.' },
  'case-mismatch': { title: 'Filename casing', why: 'Lettercamp Cloud builds on a case-sensitive file system.', fix: 'Use the spelling shown beside each import, or rename the file to match.' },
  'unsupported-stylesheet': { title: 'CSS preprocessors', why: 'Lettercamp Cloud builds support plain CSS and CSS Modules, not Sass, Less, or Stylus.',
    fix: 'Convert each stylesheet to plain CSS with a .css or .module.css name. Replace preprocessor variables with CSS custom properties and write out mixins and @use rules.' },
  'missing-default-export': { title: 'Header and footer exports' },
  'mdx-syntax': { title: 'MDX syntax' },
  'invalid-publication': { title: 'Publication files' },
  'build-failed': { title: 'Build' },
};

export function formatIssues(issues: CheckIssue[]) {
  const groups = new Map<CheckIssue['code'], CheckIssue[]>();
  for (const issue of issues) groups.set(issue.code, [...groups.get(issue.code) ?? [], issue]);
  return [...groups].map(([code, items]) => {
    const rule = rules[code];
    const location = (issue: CheckIssue) => issue.file ? `${issue.file}${issue.line ? `:${issue.line}` : ''}` : '';
    const width = Math.max(...items.map(issue => location(issue).length));
    const listed = items.every(issue => issue.import);
    // Imports share one explanation. Other problems carry their own message and fix.
    const fixes = listed ? [...new Set(rule.fix ? [rule.fix] : items.flatMap(issue => issue.fix ?? []))] : [];
    return [
      `${rule.title} (${items.length})`,
      ...(listed && rule.why ? [`  ${rule.why}`] : []),
      ...fixes.map(fix => `  Fix: ${fix}`),
      ...items.map(issue => listed
        ? `    ${location(issue).padEnd(width)}  ${issue.import}${issue.replacement ? `  →  ${issue.replacement}` : ''}`
        : `  ${location(issue) ? `${location(issue)}\n  ` : ''}${issue.message.split('\n').join('\n  ')}${issue.fix ? `\n  Fix: ${issue.fix}` : ''}`),
    ].join('\n');
  }).join('\n\n');
}

const summary = (issues: CheckIssue[]) => {
  const files = new Set(issues.map(issue => issue.file).filter(Boolean)).size;
  return `${issues.length} problem${issues.length === 1 ? '' : 's'}${files ? ` in ${files} file${files === 1 ? '' : 's'}` : ''}`;
};

// Used by deploy before anything is uploaded or a site is created.
export async function assertDeployable(root: string, files: SourceFile[], publicFiles: PublicFile[]) {
  const result = await checkDeployment(root, files, publicFiles);
  if (result.ok) return;
  throw deploymentError(result.issues);
}

function deploymentError(issues: CheckIssue[]) {
  return new Error(`This publication is not ready for Lettercamp Cloud (${summary(issues)}). Nothing was uploaded.\n\n${formatIssues(issues)}\n\n`
    + `${issues.some(issue => issue.import) ? `Docs: ${supportedImportsUrl}\n` : ''}Run lettercamp check to test your fixes without deploying.`);
}

// Run before image preparation, which also parses MDX and can otherwise hide
// the actionable source diagnostics behind a parser exception.
export async function assertSupportedImports(root: string) {
  const issues = await checkImports(root);
  if (issues.length) throw deploymentError(issues);
}

async function checkPublication(root: string, options: CheckOptions): Promise<CheckResult> {
  await readFile(path.join(root, 'settings.json'), 'utf8').catch(() => { throw new Error('Run lettercamp check inside your publication folder containing settings.json.'); });
  const issues = await checkImports(root);
  let build: CheckResult['build'] = 'skipped';
  // Preparing images parses the same pages, so a syntax error is reported once, with its line.
  if (!issues.some(issue => issue.code === 'mdx-syntax')) {
    try {
      const { publicationFiles } = await import('./deploy.js');
      const { prepareDeploymentImages } = await import('./deployment-images.js');
      const publicFiles = await collectPublicFiles(root);
      checkPublicLimits(publicFiles);
      const prepared = await prepareDeploymentImages(root, await publicationFiles(root));
      if (!issues.length && options.build !== false) {
        const failure = await buildIssue(root, prepared.files, publicFiles);
        if (failure) issues.push(failure);
        build = failure ? 'failed' : 'passed';
      }
    } catch (error) {
      // Source limits, unreadable files, and unsupported images stop a deployment too.
      issues.push({ code: 'invalid-publication', message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { ok: !issues.length, issues, build };
}

export async function check(options: CheckOptions = {}) {
  if (!options.json) console.error('Checking the publication for Lettercamp Cloud…');
  let result: CheckResult;
  // Components can log while rendering. Keep stdout exclusively for the JSON
  // result, including when a dependency bypasses Astro's quiet logger.
  const stdoutWrite = process.stdout.write;
  if (options.json) process.stdout.write = process.stderr.write.bind(process.stderr);
  try { result = await checkPublication(await projectPath(), options); }
  catch (error) {
    result = { ok: false, build: 'skipped', issues: [{ code: 'invalid-publication', message: error instanceof Error ? error.message : String(error) }] };
  } finally { process.stdout.write = stdoutWrite; }
  if (!result.ok) process.exitCode = 1;
  if (options.json) { console.log(JSON.stringify(result, null, 2)); return; }
  if (result.ok) {
    console.log(result.build === 'passed'
      ? '\n✓ Ready to deploy. Imports are supported and the publication builds.'
      : '\n✓ Imports are supported. The build was skipped; run lettercamp check without --no-build before deploying.');
    return;
  }
  console.log(`\n✗ Found ${summary(result.issues)}. Lettercamp Cloud cannot build this publication yet.\n\n${formatIssues(result.issues)}\n`);
  if (result.issues.some(issue => issue.import)) console.log(`Docs: ${supportedImportsUrl}`);
  console.log(`Fix the problems above, then run lettercamp check again.${result.build === 'skipped' && options.build !== false ? ' The build runs once they are fixed.' : ''}`);
}
