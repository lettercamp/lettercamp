import { open } from 'node:fs/promises';
import path from 'node:path';
import { apiRequest, credentials, responseJson, selectUploadSite } from './account.js';

type UploadedAsset = { url: string; width: number; height: number } | { url: string; name: string; weight?: string };
type UploadResult = { file: string } & (UploadedAsset | { error: string });

async function uploadFile(file: string, slug: string, token: string) {
  const handle = await open(file, 'r');
  let bytes: Buffer;
  try {
    const info = await handle.stat();
    if (!info.isFile() || !info.size) throw new Error('Choose a nonempty image or font file.');
    if (info.size > 100 * 1024 * 1024) throw new Error('Files must be 100 MB or smaller.');
    bytes = await handle.readFile();
    if (bytes.byteLength > 100 * 1024 * 1024) throw new Error('Files must be 100 MB or smaller.');
  } finally { await handle.close(); }
  const font = /\.(ttf|otf|woff2?)$/i.test(file);
  return responseJson<UploadedAsset>(await apiRequest(`/api/sites/${encodeURIComponent(slug)}/assets${font ? "?type=font" : ""}`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(path.basename(file)) }, body: new Uint8Array(bytes),
  }, token));
}

export async function upload(files: string[], options: { site?: string; json?: boolean }) {
  const saved = await credentials();
  const { site, remember } = await selectUploadSite(saved.token, options.site);
  const multiple = files.length > 1;
  const results: UploadResult[] = [];
  let remembered = false;
  for (const file of files) {
    let result: UploadedAsset;
    try { result = await uploadFile(file, site.slug, saved.token); }
    catch (error) {
      if (!multiple) throw error;
      const message = error instanceof Error ? error.message : String(error);
      results.push({ file, error: message });
      console.error(`${file}: ${message}`);
      process.exitCode = 1;
      continue;
    }
    results.push({ file, ...result });
    if (!remembered) {
      remembered = true;
      await remember().catch(() => console.error('Uploaded successfully, but the site selection could not be saved. Use --site on your next upload.'));
    }
    if (!options.json) console.log(multiple ? `${file}\t${result.url}` : result.url);
    else if (!multiple) console.log(JSON.stringify(result));
  }
  if (options.json && multiple) console.log(JSON.stringify(results));
}
