import { open } from 'node:fs/promises';
import path from 'node:path';
import { connectedAuthoringClient } from './cloud-workspace.js';
import { apiRequest, credentials, responseJson, selectUploadSite } from './account.js';

type UploadedAsset = { url: string; width: number; height: number } | { url: string; name: string; weight?: string };
type PairedClient = NonNullable<Awaited<ReturnType<typeof connectedAuthoringClient>>>;
type LibraryAsset = { id: string; url: string; filename: string; contentType: string; size: number };
type Ticket = { uploadId: string; uploadUrl: string; headers: Record<string, string> };
const mediaTypes: Record<string, string> = {
  '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
};
type UploadResult = { file: string } & (UploadedAsset | LibraryAsset | { error: string });

export async function uploadBytes(bytes: Uint8Array, filename: string, slug: string, token: string) {
  const font = /\.(ttf|otf|woff2?)$/i.test(filename);
  return responseJson<UploadedAsset>(await apiRequest(`/api/sites/${encodeURIComponent(slug)}/assets${font ? "?type=font" : ""}`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(path.basename(filename)) }, body: new Uint8Array(bytes),
  }, token, 120_000));
}

async function readUploadFile(file: string) {
  const handle = await open(file, 'r');
  let bytes: Buffer;
  try {
    const info = await handle.stat();
    if (!info.isFile() || !info.size) throw new Error('Choose a nonempty media file.');
    if (info.size > 100 * 1024 * 1024) throw new Error('Files must be 100 MB or smaller.');
    bytes = await handle.readFile();
    if (bytes.byteLength > 100 * 1024 * 1024) throw new Error('Files must be 100 MB or smaller.');
  } finally { await handle.close(); }
  return bytes;
}

async function uploadConnected(client: PairedClient, file: string, bytes: Buffer) {
  const contentType = mediaTypes[path.extname(file).toLowerCase()];
  if (!contentType) throw new Error('Choose a supported image, font, MP4, or WebM file.');
  const ticket = await client.call<Ticket>('upload_asset', { filename: path.basename(file), contentType, size: bytes.length });
  const url = new URL(ticket.uploadUrl);
  if (url.origin !== client.origin) throw new Error('Lettercamp returned an unexpected upload address.');
  try {
    const response = await fetch(url, {
      method: 'PUT', redirect: 'error', headers: ticket.headers, body: new Uint8Array(bytes), signal: AbortSignal.timeout(120_000),
    });
    const { asset } = await responseJson<{ asset: LibraryAsset }>(response);
    return { ...asset, uploadId: ticket.uploadId };
  } catch (error) {
    // The upload may have succeeded before the response was lost.
    const recovered = await client.call<{ assets: LibraryAsset[] }>('list_assets', { uploadId: ticket.uploadId }).catch(() => null);
    if (recovered?.assets[0]) return { ...recovered.assets[0], uploadId: ticket.uploadId };
    throw new Error(`${error instanceof Error ? error.message : 'Upload failed.'} Check assets list --upload-id ${ticket.uploadId} before retrying.`);
  }
}

async function uploadDestination(site?: string) {
  const paired = await connectedAuthoringClient();
  if (paired) {
    if (site && site !== paired.site.slug) throw new Error(`This workspace is paired with ${paired.site.slug}. Run from the destination site's workspace to upload there.`);
    return { send: (file: string, bytes: Buffer) => uploadConnected(paired, file, bytes) };
  }
  const saved = await credentials();
  const selection = await selectUploadSite(saved.token, site);
  return { send: (file: string, bytes: Buffer) => uploadBytes(bytes, file, selection.site.slug, saved.token), remember: selection.remember };
}

export async function upload(files: string[], options: { site?: string; json?: boolean }) {
  const destination = await uploadDestination(options.site);
  const multiple = files.length > 1;
  const results: UploadResult[] = [];
  let remembered = false;
  for (const file of files) {
    let result: UploadedAsset | LibraryAsset;
    try {
      const bytes = await readUploadFile(file);
      result = await destination.send(file, bytes);
    }
    catch (error) {
      if (!multiple) throw error;
      const message = error instanceof Error ? error.message : String(error);
      results.push({ file, error: message });
      console.error(`${file}: ${message}`);
      process.exitCode = 1;
      continue;
    }
    results.push({ file, ...result });
    if (destination.remember && !remembered) {
      remembered = true;
      await destination.remember().catch(() => console.error('Uploaded successfully, but the site selection could not be saved. Use --site on your next upload.'));
    }
    if (!options.json) console.log(multiple ? `${file}\t${result.url}` : result.url);
    else if (!multiple) console.log(JSON.stringify(result));
  }
  if (options.json && multiple) console.log(JSON.stringify(results));
}
