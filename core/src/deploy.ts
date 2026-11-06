import { lstat, readdir, readFile, mkdtemp, rm, mkdir, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { projectPath, getBinding, saveBinding, readConfig, saveConfig, removeConfig } from './account.js';
import { ApiError, publishingToken, request, selectHostingSite, status, waitForDeployment } from './hosting.js';
import { confirm } from './prompts.js';
import { prepareDeploymentImages, uploadDeploymentImages, type SourceFile } from './deployment-images.js';
import { imageFile } from './deployment-image-references.js';

type Snapshot = { id: string; revision: string; files: SourceFile[] };
const roots = ['pages', 'components', 'lib', 'styles', 'assets'];
export async function publicationFiles(root: string) {
  const files: Snapshot['files'] = [];
  let total = 0;
  async function visit(relative: string) {
    const filename = path.join(root, relative);
    const info = await lstat(filename);
    if (info.isSymbolicLink()) throw new Error(`Source uploads do not follow symlinks: ${relative}`);
    if (info.isDirectory()) {
      for (const entry of (await readdir(filename)).sort()) {
        if (entry.startsWith('.') || ['node_modules', 'dist', 'build', 'coverage'].includes(entry) || /\.(pem|key|p12|pfx)$/i.test(entry)) continue;
        await visit(`${relative}/${entry}`);
      }
      return;
    }
    if (!info.isFile()) throw new Error(`Source uploads require regular files: ${relative}`);
    // Referenced images use the asset API, never the source snapshot or its size budget.
    if (imageFile.test(relative)) return;
    if (info.size > 5 * 1024 * 1024) throw new Error(`${relative} exceeds 5 MB. Use lettercamp upload for large assets.`);
    const handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let bytes: Buffer;
    try { bytes = await handle.readFile(); } finally { await handle.close(); }
    total += bytes.length;
    if (bytes.length > 5 * 1024 * 1024 || total > 10 * 1024 * 1024 || files.length >= 2000) throw new Error('Source uploads support 2,000 files, 5 MB per file, and 10 MB total. Use lettercamp upload for large assets.');
    files.push({ path: relative, content: bytes.toString('base64') });
  }
  await visit('settings.json');
  for (const directory of roots) {
    try { await lstat(path.join(root, directory)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT' && directory !== 'pages') continue; throw error; }
    await visit(directory);
  }
  if (!files.some(file => /^pages\/.+\.mdx?$/.test(file.path))) throw new Error('Include at least one Markdown or MDX file in pages/.');
  JSON.parse(Buffer.from(files.find(file => file.path === 'settings.json')!.content, 'base64').toString('utf8'));
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

async function checkDeploymentFiles(root: string, files: SourceFile[]) {
  const temporary = await mkdtemp(path.join(tmpdir(), 'lettercamp-deploy-check-'));
  const source = path.join(temporary, 'publication');
  try {
    for (const file of files) {
      const filename = path.join(source, file.path);
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, Buffer.from(file.content, 'base64'));
    }
    // Resolve custom components' dependencies as they would in the original project.
    const modules = path.join(root, 'node_modules');
    if (await lstat(modules).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; })) {
      await symlink(modules, path.join(source, 'node_modules'), 'junction');
    }
    const { buildSite } = await import('./build.js');
    await buildSite(source, { site: 'https://preview.lettercamp.site', outDir: path.join(temporary, 'output'), remoteAssetsOnly: true });
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

export async function deploy() {
  const root = await projectPath();
  // Catch the wrong directory before opening a browser or creating a hosted site.
  await readFile(path.join(root, 'settings.json'), 'utf8').catch(() => { throw new Error('Run lettercamp deploy inside your publication folder containing settings.json.'); });
  const images = (await getBinding())?.pending ? null : await prepareDeploymentImages(root, await publicationFiles(root));
  if (images) {
    console.error('Checking the publication for Lettercamp Cloud…');
    await checkDeploymentFiles(root, images.files);
  }
  const token = await publishingToken();
  let { site, binding } = await selectHostingSite(token, true);
  let current = await status(token, site.id, binding.pending);
  if (!current.managed) throw new Error('This site uses a connected GitHub repository. Push your changes to that repository to publish.');
  let snapshot: Snapshot;
  if (binding.pending) {
    const pending = await readConfig<Snapshot>(`deployment-${binding.pending}.json`);
    if (!pending) throw new Error('The saved upload is missing. Restore your Lettercamp configuration before resuming this deployment.');
    snapshot = pending;
    console.error('Resuming the saved deployment. New local edits can be published with the next lettercamp deploy.');
  } else {
    if (current.pending) {
      console.error('Waiting for the current publication to finish…');
      await waitForDeployment(token, site.id, current.pending);
      current = await status(token, site.id);
    }
    if (!current.revision) {
      console.error('Finishing site provisioning…');
      await request(token, `sites/${site.id}/status`, { action: 'retry' });
      current = await status(token, site.id);
      if (current.pending) await waitForDeployment(token, site.id, current.pending);
      current = await status(token, site.id);
      if (!current.revision) throw new Error('The site repository is not ready. Run lettercamp deploy again shortly.');
    }
    if (binding.revision !== current.revision && !binding.fresh) {
      console.error(binding.revision ? 'The hosted source changed since your last deployment.' : `This folder will replace the publication source on ${site.slug}.lettercamp.site.`);
      console.error('Local settings, pages, components, lib, styles, and assets replace those remote files, including deletions.');
      if (!await confirm('Replace the hosted publication with this folder?')) return;
    }
    const prepared = images ?? await prepareDeploymentImages(root, await publicationFiles(root));
    if (!images) await checkDeploymentFiles(root, prepared.files);
    const files = await uploadDeploymentImages(prepared, site, token);
    snapshot = { id: randomUUID(), revision: current.revision, files };
    await saveConfig(`deployment-${snapshot.id}.json`, snapshot);
    binding = { ...binding, pending: snapshot.id, fresh: undefined };
    await saveBinding(binding);
    console.error(`Deploying ${snapshot.files.length} source files to ${site.slug}.lettercamp.site…`);
  }
  if (!current.activity || current.activity.id !== snapshot.id) {
    try { await request(token, `sites/${site.id}/deploy`, snapshot); }
    catch (error) {
      // Validation/conflict responses are definitive; network failures retain the upload.
      if (error instanceof ApiError && [400, 403, 409, 413].includes(error.status)) {
        binding = { ...binding, pending: undefined };
        await saveBinding(binding);
        await removeConfig(`deployment-${snapshot.id}.json`);
      }
      throw error;
    }
  }
  const result = await waitForDeployment(token, site.id, snapshot.id, async activity => {
    const revision = activity.sourceCommit && activity.baseRevision ? `${activity.baseRevision.split(':')[0]}:${activity.sourceCommit}` : binding.revision;
    const finished = ['succeeded', 'failed', 'cancelled'].includes(activity.status);
    if (revision !== binding.revision || finished) {
      binding = { ...binding, revision, pending: finished ? undefined : snapshot.id };
      await saveBinding(binding);
      if (finished) await removeConfig(`deployment-${snapshot.id}.json`);
    }
  });
  console.log(`Live at ${result.site.url}`);
}
