import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isMap, isSeq, parseDocument } from 'yaml';
import { spawn } from 'node:child_process';
import { ask, choose } from './prompts.js';
import { version } from './version.js';
import { copyStarter, type StarterOptions } from './starter.js';

export type CreateOptions = StarterOptions & { preset?: string; yes?: boolean; install?: boolean };

async function ensureEmpty(directory: string) {
  let entries;
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }
  if (entries.length) throw new Error(`Directory is not empty: ${directory}. Choose a new or empty directory.`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Merge nested settings while replacing arrays and scalar values in full.
function mergeSettings(base: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries([...new Set([...Object.keys(base), ...Object.keys(overrides)])].map(key => {
    if (!Object.hasOwn(overrides, key)) return [key, base[key]];
    const value = overrides[key];
    return [key, isObject(base[key]) && isObject(value) ? mergeSettings(base[key], value) : value];
  }));
}

async function availablePresets(directory: string) {
  const presets = path.join(directory, 'presets');
  return (await readdir(presets).catch(error => {
    if (error.code === 'ENOENT') return [] as string[];
    throw error;
  })).filter(file => /^[a-z0-9][a-z0-9-]*\.json$/.test(file)).map(file => file.slice(0, -5)).sort();
}

export async function applyPreset(directory: string, name: string) {
  const presets = path.join(directory, 'presets');
  const available = await availablePresets(directory);
  if (!available.includes(name)) {
    throw new Error(`Unknown preset "${name}". Available presets: ${available.join(', ') || 'none'}. Omit --preset to use the default starter.`);
  }
  const preset = JSON.parse(await readFile(path.join(presets, `${name}.json`), 'utf8'));
  if (!isObject(preset) || !isObject(preset.settings)) throw new Error(`Preset "${name}" must contain a settings object.`);
  const setup = preset.setup ?? {};
  if (!isObject(setup)) throw new Error(`Preset "${name}" setup must be an object.`);
  const removeImages = setup.removeImages ?? {};
  if (!isObject(removeImages) || ['covers', 'authors'].some(key => removeImages[key] !== undefined && typeof removeImages[key] !== 'boolean')) {
    throw new Error(`Preset "${name}" setup.removeImages must contain boolean covers and authors options.`);
  }
  const pages = preset.pages ?? {};
  if (!isObject(pages)) throw new Error(`Preset "${name}" pages must be an object.`);
  for (const [filename, overrides] of Object.entries(pages)) {
    if (!/^[a-z0-9][a-z0-9-]*\.mdx?$/.test(filename) || !isObject(overrides)) {
      throw new Error(`Invalid page override in preset "${name}": ${filename}`);
    }
  }
  const settingsPath = path.join(directory, 'settings.json');
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  await writeFile(settingsPath, JSON.stringify(mergeSettings(settings, preset.settings), null, 2) + '\n');
  const filenames = new Set(Object.keys(pages));
  if (removeImages.covers || removeImages.authors) {
    for (const entry of await readdir(path.join(directory, 'pages'), { withFileTypes: true })) {
      if (entry.isFile() && /\.mdx?$/.test(entry.name)) filenames.add(entry.name);
    }
  }
  for (const filename of filenames) {
    const pagePath = path.join(directory, 'pages', filename);
    const source = await readFile(pagePath, 'utf8');
    const frontmatter = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/.exec(source);
    if (!frontmatter) throw new Error(`Preset page ${filename} must have YAML frontmatter.`);
    const document = parseDocument(frontmatter[2]);
    if (document.errors.length) throw new Error(`Invalid frontmatter in ${filename}: ${document.errors[0].message}`);
    for (const [key, value] of Object.entries(pages[filename] ?? {})) document.set(key, value);
    // Setup transforms run after page overrides and only affect generated content.
    if (removeImages.covers) {
      for (const key of ['image', 'imageAlt', 'imageWidth', 'imageHeight', 'coverWidth', 'coverWidthMode', 'ogImage', 'ogImageAlt']) document.delete(key);
    }
    if (removeImages.authors) {
      const authors = document.get('authors');
      if (isSeq(authors)) for (const author of authors.items) if (isMap(author)) author.delete('image');
    }
    await writeFile(pagePath, frontmatter[1] + document.toString({ lineWidth: 0 }).trimEnd()
      + frontmatter[3] + source.slice(frontmatter[0].length));
  }
}

async function configureProject(directory: string, destination: string) {
  const name = path.basename(destination).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 214) || 'lettercamp-site';
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({
    name,
    version: '0.0.0',
    private: true,
    type: 'module',
    engines: { node: '>=22.23.4' },
    scripts: { dev: 'lettercamp dev', build: 'lettercamp build', deploy: 'lettercamp deploy' },
    devDependencies: { lettercamp: version },
  }, null, 2) + '\n', { flag: 'wx' });
  await writeFile(path.join(directory, '.nvmrc'), '22.23.4\n');
  const ignorePath = path.join(directory, '.gitignore');
  const ignored = await readFile(ignorePath, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  const required = ['node_modules/', 'dist/', '.astro/', '.env', '.env.*', '!.env.example'];
  const missing = required.filter(line => !ignored.split(/\r?\n/).includes(line));
  if (missing.length) await writeFile(ignorePath, ignored + (ignored.endsWith('\n') || !ignored ? '' : '\n') + missing.join('\n') + '\n');
}

async function installDependencies(directory: string) {
  console.log('\nInstalling the Lettercamp CLI…');
  await new Promise<void>((resolve, reject) => {
    const child = spawn('npm', ['install', '--no-audit', '--no-fund'], {
      cwd: directory,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    const failed = () => reject(new Error(`Your site was created at ${directory}, but npm install failed. Open that directory and run npm install to retry, then npm run dev.`));
    child.once('error', failed);
    child.once('close', code => code === 0 ? resolve() : failed());
  });
}

export async function createSite(directory?: string, options: CreateOptions = {}) {
  if (options.preset !== undefined && !/^[a-z0-9][a-z0-9-]*$/.test(options.preset)) {
    throw new Error('Use a preset name containing lowercase letters, numbers, and hyphens, such as dark.');
  }
  const interactive = !options.yes && process.stdin.isTTY && process.stderr.isTTY;
  directory ??= interactive ? await ask('Where should we create your site?', 'my-lettercamp') : 'my-lettercamp';
  const destination = path.resolve(directory);
  await ensureEmpty(destination);
  const temporary = await mkdtemp(path.join(tmpdir(), 'lettercamp-new-'));
  try {
    console.log('Preparing the Lettercamp starter…');
    await copyStarter(temporary, options);
    let preset = options.preset;
    if (preset === undefined && interactive) {
      const presets = ['default', ...await availablePresets(temporary)];
      preset = presets[await choose('Choose a starter preset', presets)];
    }
    if (preset !== undefined && preset !== 'default') await applyPreset(temporary, preset);
    // Presets are creation inputs, not part of the user's publication.
    await rm(path.join(temporary, 'presets'), { recursive: true, force: true });
    await configureProject(temporary, destination);
    // Prepare first, so a failed preset or setup leaves the destination untouched.
    await ensureEmpty(destination);
    await mkdir(destination, { recursive: true });
    for (const entry of await readdir(temporary)) {
      await cp(path.join(temporary, entry), path.join(destination, entry), {
        recursive: true, force: false, errorOnExist: true,
      });
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  if (options.install !== false) await installDependencies(destination);
  console.log(`\nCreated your publication at ${destination}`);
  console.log('\nNext steps:');
  if (destination !== process.cwd()) {
    const relative = path.relative(process.cwd(), destination);
    const quoted = process.platform === 'win32' ? `"${relative}"` : `'${relative.replace(/'/g, "'\\''")}'`;
    console.log(`  cd ${quoted}`);
  }
  if (options.install === false) console.log('  npm install');
  console.log('  npm run dev');
  console.log('\nRun npm run deploy when you are ready to publish.');
}
