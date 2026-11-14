import { mkdir, readdir, realpath, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { apiOrigin, projectPath, readConfig, saveConfig, removeConfig } from './account.js';
import { request, ApiError, delay, type Activity } from './hosting.js';
import { version } from './version.js';
import { readSourceFiles, writeSourceFiles, validateFiles, changedPaths, mergeSource, type SourceFile } from './workspace-files.js';

type Site = { id: string; slug: string; name: string };
type Source = { site: Site; revision: string; productionRevision: string; productionFiles?: SourceFile[]; files: SourceFile[]; pendingPages: string[] };
type Snapshot = { id: string; revision: string; files: SourceFile[] };
type Workspace = { origin: string; token: string; site: Site; revision?: string; files: SourceFile[]; productionRevision?: string; productionFiles?: SourceFile[]; pending?: Snapshot };
type Status = { site: Site; revision: string | null; pendingPages: string[]; pending: string | null; activity: (Activity & { isPreview: boolean; publicUrl?: string }) | null;
  preview: { id: string; url: string; published: boolean } | null };
const configName = (root: string) => `workspace-${createHash('sha256').update(root).digest('hex')}.json`;
const report = (value: unknown, json?: boolean, message?: string) => console.log(json ? JSON.stringify(value, null, 2) : message);

async function findWorkspace() {
  const root = await realpath(await projectPath());
  const state = await readConfig<Workspace>(configName(root));
  if (state && !process.env.LETTERCAMP_API_URL) process.env.LETTERCAMP_API_URL = state.origin;
  if (!state) return null;
  if (state.origin !== apiOrigin()) throw new Error('This workspace belongs to a different Lettercamp server.');
  return { root, state, save: () => saveConfig(configName(root), state) };
}
async function workspace() {
  const connected = await findWorkspace();
  if (!connected) throw new Error('Run lettercamp connect with a code from Settings → Agent connections first.');
  return connected;
}
export async function connectedAuthoringClient() {
  const connected = await findWorkspace();
  if (!connected) return null;
  const { state } = connected;
  return { site: state.site, origin: state.origin,
    call: <T>(action: string, input: Record<string, unknown>) => siteRequest<T>(state, `authoring/${action}`, input) };
}
const siteRequest = <T>(state: Workspace, operation: string, body?: unknown) => request<T>(state.token, `sites/${state.site.id}/${operation}`, body);
function rememberSource(state: Workspace, source: Source) {
  state.revision = source.revision; state.files = source.files;
  state.productionRevision = source.productionRevision; state.productionFiles = source.productionFiles ?? source.files;
}
const instructions = `# Lettercamp development\n\nWork in this publication folder. Run commands with npx --yes lettercamp@${version}.\n\n- Start with status --json; use pull to fetch remote changes while preserving local edits.\n- Edit settings.json, pages/, components/, lib/, styles/, assets/, or public/. Other files are local-only.\n- Custom layouts belong in components/layouts/Header.jsx, Footer.jsx, PostList.jsx, PostCard.jsx, or PostLayout.jsx (or .tsx). Each needs a default export.\n- Cloud supports react, react-dom, lettercamp/components, relative local imports, CSS and Sass. Do not add npm dependencies or bundler aliases.\n- Use dev for local visual iteration and check --json before pushing.\n- After editing source files, run push and wait for the cloud preview to succeed. Inspect status --json for build errors. Fix and push again if necessary.\n- push saves a source checkpoint and builds an unlisted cloud preview; it does not publish. Local edits are not synced automatically.\n- Write a shared draft with posts create --slug <slug> --title <title> --file <body.md> --json. The file contains Markdown/MDX without frontmatter. Use posts list/get, then posts update with the exact revision.\n- Upload images, fonts, and videos with upload <file> --json. Find reusable assets with assets list --json. Use the returned hosted URL.\n- publish queues all shared saved page edits with the current production settings. Use it only on explicit request with a publishing-enabled connection.\n- The user publishes the reviewed preview from Settings → Agent connections. Do not use deploy unless explicitly asked to publish directly.\n- Never overwrite a pull conflict. Inspect both versions and resolve the named paths.\n\nDocs: https://www.lettercamp.com/docs/cli/connect and https://www.lettercamp.com/docs/custom-layout\n`;

export async function connect(code: string, options: { directory?: string; json?: boolean }) {
  // Retain redemption locally before checkout, so a lost source-download response
  // can resume with the same one-use code without exposing the credential.
  const receipt = `connect-${createHash('sha256').update(code).digest('hex')}.json`;
  let connection = await readConfig<{ token: string; site: Site; origin: string }>(receipt);
  if (connection && connection.origin !== apiOrigin()) throw new Error('This code was used on another Lettercamp server.');
  if (!connection) {
    connection = { ...await request<{ token: string; site: Site }>('', 'connect', { code }), origin: apiOrigin() };
    await saveConfig(receipt, connection);
  }
  const destination = path.resolve(options.directory ?? connection.site.slug);
  await mkdir(destination, { recursive: true });
  const root = await realpath(destination);
  let state = await readConfig<Workspace>(configName(root));
  if (!state) {
    if ((await readdir(root)).length) throw new Error(`Directory is not empty: ${root}. Choose --directory with a new folder.`);
    state = { origin: connection.origin, token: connection.token, site: connection.site, files: [] };
    await saveConfig(configName(root), state);
  } else {
    if (state.site.id !== connection.site.id || state.origin !== connection.origin) throw new Error('This folder is connected to another site. Choose a different directory.');
    state.token = connection.token;
    await saveConfig(configName(root), state);
  }
  if (!state.revision) {
    const source = await siteRequest<Source>(state, 'source');
    validateFiles(source.files);
    const existing = await readSourceFiles(root);
    if (existing.some(file => !source.files.some(remote => remote.path === file.path && remote.content === file.content))) throw new Error('Checkout was interrupted and local files changed. Choose a new directory.');
    await writeSourceFiles(root, existing, source.files);
    rememberSource(state, source);
    await saveConfig(configName(root), state);
  }
  await writeFile(path.join(root, 'AGENTS.md'), instructions, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ private: true, type: 'module', scripts: {
    dev: `npx --yes lettercamp@${version} dev`, check: `npx --yes lettercamp@${version} check`,
  } }, null, 2) + '\n', { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  await removeConfig(receipt);
  report({ connected: true, directory: root, site: state.site, instructions: path.join(root, 'AGENTS.md') }, options.json,
    `Connected to ${state.site.name}.\nWorkspace: ${root}\nRead ${path.join(root, 'AGENTS.md')} before editing.\nUse posts to edit shared drafts and upload for media. For site code, run dev locally, check --json, then push to update the cloud preview.`);
}

export async function pull(options: { json?: boolean; keepLocal?: string[]; takeRemote?: string[] }) {
  const { root, state, save } = await workspace();
  if (state.pending) throw new Error('Run lettercamp push to finish the pending checkpoint before pulling.');
  const remote = await siteRequest<Source>(state, 'source');
  const local = await readSourceFiles(root);
  // A web publish starts a new preview branch. Reapply previously pushed local
  // design changes on their original production base instead of discarding them.
  const base = remote.productionRevision !== state.productionRevision && remote.productionRevision !== state.revision
    ? state.productionFiles ?? state.files : state.files;
  const merged = mergeSource(base, local, remote.files, options.keepLocal, options.takeRemote);
  if (merged.conflicts.length) {
    // No source files or base revision change on a conflict.
    const result = { ok: false, conflicts: merged.conflicts, remoteFiles: remote.files.filter(file => merged.conflicts.includes(file.path)),
      message: 'Inspect remoteFiles (base64) with --json. Resolve each path with --keep-local <paths...> or --take-remote <paths...>, then pull again.' };
    report(result, options.json, `Pull conflicts: ${merged.conflicts.join(', ')}\n${result.message}`);
    process.exitCode = 1; return;
  }
  await writeSourceFiles(root, local, merged.files);
  rememberSource(state, remote); await save();
  report({ ok: true, revision: state.revision, updated: changedPaths(local, merged.files), localChanges: changedPaths(state.files, merged.files), pendingPages: remote.pendingPages }, options.json,
    `Pulled ${changedPaths(local, merged.files).length} changed files. Local edits preserved.${remote.pendingPages.length ? '\nShared page edits in the web editor are not included in this preview.' : ''}`);
}

export async function workspaceStatus(options: { json?: boolean }) {
  const { root, state } = await workspace();
  const [remote, local] = await Promise.all([siteRequest<Status>(state, 'status'), readSourceFiles(root)]);
  const source = remote.revision !== state.revision ? await siteRequest<Source>(state, 'source') : null;
  const result = { ...remote, directory: root, baseRevision: state.revision, pendingPush: state.pending?.id ?? null,
    localChanges: changedPaths(state.files, local), remoteChanges: source ? changedPaths(state.files, source.files) : [], pendingPages: source?.pendingPages ?? remote.pendingPages };
  report(result, options.json, `${state.site.name}\nLocal changes: ${result.localChanges.length}\nRemote changes: ${result.remoteChanges.length}\n`
    + `${remote.activity ? `Build: ${remote.activity.status} (${remote.activity.stage})\n${remote.activity.error ?? ''}` : 'No builds.'}`
    + `${remote.preview ? `\nPreview: ${remote.preview.url}` : ''}`);
}

export async function push(options: { json?: boolean; wait?: boolean }) {
  const { root, state, save } = await workspace();
  if (!state.revision) throw new Error('Finish lettercamp connect before pushing.');
  if (!state.pending) {
    const files = await readSourceFiles(root);
    if (files.some(file => file.path === 'lib/public-files.json')) throw new Error('lib/public-files.json is reserved for CLI deployments. Remove it from this connected workspace.');
    const { assertSupportedImports } = await import('./check.js');
    await assertSupportedImports(root);
    state.pending = { id: randomUUID(), revision: state.revision, files };
    await save();
  }
  const snapshot = state.pending;
  try {
    const queued = await siteRequest<{ productionCommit: string }>(state, 'push', snapshot);
    if (snapshot.revision.split(':')[1] === queued.productionCommit && state.productionRevision !== snapshot.revision) {
      state.productionRevision = snapshot.revision; state.productionFiles = state.files; await save();
    }
  }
  catch (error) {
    if (error instanceof ApiError && [400, 401, 403, 409, 413].includes(error.status)) { state.pending = undefined; await save(); }
    throw error;
  }
  if (options.wait === false) {
    report({ id: snapshot.id, status: 'queued' }, options.json, `Preview queued: ${snapshot.id}. Run push to wait for completion, or status --json for progress.`); return;
  }
  let lastStage = '';
  const deadline = Date.now() + 45 * 60_000;
  while (Date.now() < deadline) {
    const result = await siteRequest<Status>(state, `status?deployment=${snapshot.id}`);
    const activity = result.activity;
    if (activity && activity.id === snapshot.id) {
      if (activity.stage !== lastStage && !options.json) console.error(`Preview: ${activity.stage}`);
      lastStage = activity.stage;
      if (['succeeded', 'failed', 'cancelled'].includes(activity.status)) {
        const savedRevision = activity.sourceCommit && `${snapshot.revision.split(':')[0]}:${activity.sourceCommit}`;
        // A failed ref update can leave an unattached Git commit in the activity.
        if (savedRevision && (activity.status === 'succeeded' || (await siteRequest<Source>(state, 'source')).revision === savedRevision)) {
          state.revision = savedRevision; state.files = snapshot.files;
        }
        state.pending = undefined; await save();
        const ok = activity.status === 'succeeded';
        if (!ok) process.exitCode = 1;
        const preview = ok && activity.publicUrl ? { id: snapshot.id, url: `https://preview-${snapshot.id}.lettercamp.site${new URL(activity.publicUrl).pathname}` } : result.preview;
        report({ ok, id: snapshot.id, revision: state.revision, preview, error: activity.error }, options.json,
          ok ? `Preview ready: ${preview?.url}\nProduction is unchanged. Publish the reviewed preview in Lettercamp.` : `Preview ${activity.status}: ${activity.error ?? 'Run status --json for details.'}`);
        return;
      }
    }
    await delay(3000);
  }
  throw new Error('Preview is still building. Run push again to resume waiting; status --json shows progress.');
}
