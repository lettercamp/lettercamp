import { lstat, readdir, realpath, open, mkdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { ApiError } from './hosting.js';
import { terminal } from './terminal.js';
import { apiRequest, responseJson, type ApiSite } from './account.js';

export const publicFilesPath = 'lib/public-files.json';
export type PublicFile = { path: string; size: number; hash: string };
export type PublicFiles = { version: 1; deploymentId: string; files: PublicFile[] };
export type PublishingLimits = { fileBytes: number; deploymentBytes: number; files: number; storageBytes: number };
// Deploys cap the public folder; the server enforces the same limits.
export function checkPublicLimits(files: PublicFile[]) {
  if (files.length > 1000 || files.reduce((sum, file) => sum + file.size, 0) > 500 * 1048576) throw new Error('The public folder supports up to 1,000 files and 500 MB per deployment. Host larger assets elsewhere or use lettercamp upload.');
}
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export async function readPublicFile(root: string, file: string) {
  const base = path.join(await realpath(root), 'public');
  const filename = path.join(base, file);
  let current = base;
  for (const part of ['', ...file.split('/')]) {
    current = path.join(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw new Error(`Public uploads do not follow symlinks: ${file}`);
  }
  if (!(await realpath(filename)).startsWith(base + path.sep)) throw new Error('Public files must stay inside public/.');
  const handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 100 * 1048576) throw new Error(`public/${file} must be a regular file no larger than 100 MB.`);
    return await handle.readFile();
  } finally { await handle.close(); }
}
export async function collectPublicFiles(root: string): Promise<PublicFile[]> {
  const files: PublicFile[] = [];
  const base = path.join(root, 'public');
  if (!await lstat(base).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; })) return files;
  async function visit(relative: string) {
    const info = await lstat(path.join(base, relative));
    if (info.isSymbolicLink()) throw new Error(`Public uploads do not follow symlinks: ${relative || 'public/'}`);
    if (info.isDirectory()) {
      for (const name of (await readdir(path.join(base, relative))).sort()) {
        if (name.startsWith('.') && name !== '.well-known') continue;
        await visit(relative ? relative + '/' + name : name);
      }
    } else {
      if (/[\\\x00-\x1f\x7f?#%]/.test(relative) || relative.length > 500 || /^(?:_deployments|_astro|_lettercamp)(?:\/|$)/.test(relative)
        || relative === '.well-known/lettercamp' || /\.(?:pem|key|p12|pfx)$/i.test(relative)) throw new Error(`Unsupported or reserved public path: ${relative}`);
      const bytes = await readPublicFile(root, relative);
      files.push({ path: relative, size: bytes.length, hash: digest(bytes) });
      if (files.length > 10000 || files.reduce((sum, file) => sum + file.size, 0) > 500 * 1048576) throw new Error('Public uploads support up to 10,000 files and 500 MB, subject to your plan.');
    }
  }
  await visit('');
  return files;
}
export async function copyPublicFiles(root: string, destination: string, files: PublicFile[]) {
  for (const file of files) {
    const bytes = await readPublicFile(root, file.path);
    if (digest(bytes) !== file.hash) throw new ApiError(`public/${file.path} changed. Run deploy again to upload the new version.`, 409);
    const target = path.join(destination, file.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: 'wx' });
  }
}
async function uploadResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new ApiError(body.message || `Upload failed (HTTP ${response.status}).`, response.status);
  }
  return responseJson<T>(response);
}
export const publicPlanLimits = async (siteId: string, token: string) =>
  (await uploadResponse<{ limits: PublishingLimits }>(await apiRequest(`/api/cli/sites/${siteId}/public`, {}, token))).limits;
export function checkPlanLimits(files: PublicFile[], limits: PublishingLimits) {
  if (files.length > limits.files || files.some(file => file.size > limits.fileBytes) || files.reduce((sum, file) => sum + file.size, 0) > limits.deploymentBytes) {
    const large = files.find(file => file.size > limits.fileBytes);
    // Definitive: clears a saved deployment so the next deploy picks up local changes.
    throw new ApiError(`Your plan supports ${limits.files} public files, ${limits.fileBytes / 1048576} MB per file, and ${limits.deploymentBytes / 1048576} MB per deployment.${large ? ` public/${large.path} is too large.` : ''}`, 413);
  }
}
export async function uploadPublicFiles(root: string, site: ApiSite, token: string, manifest: PublicFiles) {
  const route = `/api/cli/sites/${site.id}/public`;
  checkPlanLimits(manifest.files, await publicPlanLimits(site.id, token));
  // The server keeps files already uploaded for this deployment and copies unchanged
  // files from the previous one in bounded batches; repeat while it makes progress.
  const start = async () => uploadResponse<{ missing?: string[]; reusable?: number }>(await apiRequest(route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(manifest) }, token, 120_000));
  let started = await start();
  for (let attempt = 0; started.reusable && attempt < 20; attempt++) {
    const next = await start();
    const progressed = (next.missing?.length ?? 0) < (started.missing?.length ?? 0);
    started = next;
    if (!progressed) break;
  }
  const missing = started.missing ? new Set(started.missing) : null;
  if (missing && missing.size < manifest.files.length) terminal.note(`Reusing ${manifest.files.length - missing.size} unchanged public files.`);
  for (const file of manifest.files) {
    if (missing && !missing.has(file.path)) continue;
    const bytes = await readPublicFile(root, file.path);
    if (digest(bytes) !== file.hash) throw new ApiError(`public/${file.path} changed. Run deploy again to upload the new version.`, 409);
    terminal.step(`Uploading public/${file.path}…`);
    await uploadResponse(await apiRequest(`${route}?deployment=${manifest.deploymentId}&path=${encodeURIComponent(file.path)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(bytes),
    }, token, 120_000));
  }
}
