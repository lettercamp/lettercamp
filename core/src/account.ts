import { chmod, mkdir, readFile, realpath, rename, rm, writeFile, access } from 'node:fs/promises';
import { homedir, hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';

type User = { id: string; name: string; email: string };
type Credentials = { origin: string; token: string; expiresAt: string; user: User };
export type ApiSite = { id: string; slug: string; name: string };
export type SiteBinding = { origin: string; siteId: string; revision?: string; pending?: string; fresh?: boolean;
  creation?: { id: string; name: string; slug: string; previous?: SiteBinding }; provider?: 'vercel' | 'cloudflare' | 'nginx' };
type SiteBindings = Record<string, SiteBinding>;
const configRoot = () => process.env.LETTERCAMP_CONFIG_DIR || path.join(
  process.platform === 'win32' ? process.env.APPDATA || path.join(homedir(), 'AppData', 'Roaming') : process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'), 'lettercamp');

export function apiOrigin() {
  const url = new URL(process.env.LETTERCAMP_API_URL || 'https://www.lettercamp.com');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('LETTERCAMP_API_URL must be an HTTPS origin (HTTP is allowed for localhost development).');
  }
  return url.origin;
}

export async function readConfig<T>(name: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path.join(configRoot(), name), 'utf8')) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error(`Unable to read Lettercamp ${name}. Check ${configRoot()}.`);
  }
}

export async function saveConfig(name: string, value: unknown) {
  await mkdir(configRoot(), { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') await chmod(configRoot(), 0o700);
  const temporary = path.join(configRoot(), `.${name}-${randomUUID()}`);
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temporary, path.join(configRoot(), name));
  } finally { await rm(temporary, { force: true }); }
}

export async function credentials(): Promise<Credentials> {
  const saved = await readConfig<Credentials>('credentials.json');
  if (!saved || saved.origin !== apiOrigin() || typeof saved.token !== 'string' || !/^lc_[a-f0-9]{64}$/.test(saved.token)) {
    throw new Error('Run lettercamp login to sign in to this server.');
  }
  return saved;
}

export async function apiRequest(route: string, options: RequestInit = {}, token?: string, timeout = 30_000) {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    return await fetch(new URL(route, apiOrigin()), { ...options, headers, redirect: 'error', signal: AbortSignal.timeout(timeout) });
  } catch { throw new Error('Unable to reach Lettercamp. Check your connection and try again.'); }
}

export async function responseJson<T>(response: Response): Promise<T> {
  let result: unknown;
  try { result = await response.json(); }
  catch { throw new Error(`Lettercamp returned an unexpected response (HTTP ${response.status}).`); }
  if (!response.ok) {
    if (response.status === 401) throw new Error('Your CLI session expired or was revoked. Run lettercamp login again.');
    const problem = result as { message?: unknown; error?: unknown } | null;
    throw new Error(typeof problem?.message === 'string' ? problem.message : typeof problem?.error === 'string' ? problem.error : `Request failed (HTTP ${response.status}).`);
  }
  return result as T;
}

async function openBrowser(url: string) {
  const [command, args] = process.platform === 'darwin' ? ['open', [url]] as const
    : process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] as const : ['xdg-open', [url]] as const;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [...args], { stdio: 'ignore', shell: false });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error('Browser could not open.')));
  });
}

export async function login(options: { browser: boolean; name?: string }) {
  const previous = await readConfig<Credentials>('credentials.json');
  const name = options.name || `Lettercamp CLI on ${hostname()}`.slice(0, 80);
  const login = await responseJson<{ device_code: string; user_code: string; verification_uri_complete: string; interval: number; expires_in: number }>(
    await apiRequest('/api/cli/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, publishing: true }) }));
  const verification = new URL(login.verification_uri_complete);
  if (verification.origin !== apiOrigin() || verification.pathname !== '/cli/login') throw new Error('Lettercamp returned an unexpected login address.');
  console.error(`Your code: ${login.user_code}\nOpen ${verification.href}\nConfirm the matching code in your browser. Waiting for approval…`);
  if (options.browser) await openBrowser(verification.href).catch(() => console.error('Open the link above in a browser to continue.'));
  const deadline = Date.now() + Math.min(login.expires_in, 600) * 1000;
  let interval = Math.max(5, login.interval) * 1000;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, interval));
    if (Date.now() >= deadline) break;
    const response = await apiRequest('/api/cli/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_code: login.device_code }) });
    const body = await response.json() as { error?: string; message?: string; access_token?: string; expires_at?: string; user?: User };
    if (body.error === 'authorization_pending') continue;
    if (body.error === 'slow_down') { interval = Math.min(interval + 5000, 30000); continue; }
    if (body.error === 'access_denied') throw new Error('Login was denied in the browser.');
    if (body.error === 'expired_token') throw new Error('Login expired or was already completed. Run lettercamp login again.');
    if (!response.ok || !body.access_token || !/^lc_[a-f0-9]{64}$/.test(body.access_token) || !body.expires_at || !body.user) throw new Error(body.message || 'Unable to finish login. Run lettercamp login again.');
    try {
      await saveConfig('credentials.json', { origin: apiOrigin(), token: body.access_token, expiresAt: body.expires_at, user: body.user });
    } catch {
      await apiRequest('/api/cli/session', { method: 'DELETE' }, body.access_token).catch(() => undefined);
      throw new Error('Unable to save the CLI credential. Check your configuration directory permissions and run lettercamp login again.');
    }
    if (previous?.origin === apiOrigin() && /^lc_[a-f0-9]{64}$/.test(previous.token)) {
      try {
        const revoked = await apiRequest('/api/cli/session', { method: 'DELETE' }, previous.token);
        if (!revoked.ok && revoked.status !== 401) throw new Error();
      } catch { console.error('Previous session could not be revoked. You can revoke it from your account page.'); }
    }
    console.log(`Signed in as ${body.user.email}.`);
    return;
  }
  throw new Error('Login timed out. Run lettercamp login again.');
}

export async function whoami(options: { json?: boolean }) {
  const saved = await credentials();
  const user = await responseJson<User & { expiresAt: string }>(await apiRequest('/api/cli/session', {}, saved.token));
  console.log(options.json ? JSON.stringify(user) : `${user.name} <${user.email}>`);
}

export async function logout() {
  const saved = await readConfig<Credentials>('credentials.json');
  if (!saved) { console.log('Already signed out.'); return; }
  if (saved.origin !== apiOrigin()) throw new Error(`This credential belongs to ${saved.origin}. Set LETTERCAMP_API_URL to that origin to sign out.`);
  const response = await apiRequest('/api/cli/session', { method: 'DELETE' }, saved.token);
  if (!response.ok && response.status !== 401) await responseJson(response);
  await rm(path.join(configRoot(), 'credentials.json'), { force: true });
  console.log('Signed out.');
}

export async function projectPath() {
  const cwd = await realpath(process.cwd());
  for (let directory = cwd; ; directory = path.dirname(directory)) {
    try { await access(path.join(directory, 'settings.json')); return directory; } catch { /* Walk up to the publication root. */ }
    if (path.dirname(directory) === directory) return cwd;
  }
}

export async function selectUploadSite(token: string, requested?: string) {
  const { sites } = await responseJson<{ sites: ApiSite[] }>(await apiRequest('/api/cli/sites', {}, token));
  const project = await projectPath();
  const bindings = await readConfig<SiteBindings>('sites.json') ?? {};
  const binding = bindings[project];
  const uploads = await readConfig<SiteBindings>('upload-sites.json') ?? {};
  const upload = uploads[project];
  const selected = requested || (upload?.origin === apiOrigin() ? upload.siteId : undefined)
    || (binding?.origin === apiOrigin() ? binding.siteId : undefined);
  const site = selected ? sites.find(item => item.id === selected || item.slug === selected) : sites.length === 1 ? sites[0] : undefined;
  if (!site) {
    if (!sites.length) throw new Error('No accessible sites. Run lettercamp deploy to create one.');
    throw new Error(`${selected ? 'That site is unavailable to this account.' : 'Choose a site for this publication.'} Use --site <slug>. Available sites: ${sites.map(item => item.slug).join(', ')}`);
  }
  return { site, remember: () => saveConfig('upload-sites.json', { ...uploads, [project]: { origin: apiOrigin(), siteId: site.id } }) };
}

// Older CLI versions also saved upload/domain selections here. Only a folder
// with creation or deployment history may publish to an existing site.
export async function getDeploymentBinding(): Promise<SiteBinding | null> {
  const binding = await getBinding();
  return binding && (binding.creation || binding.fresh || binding.revision || binding.pending) ? binding : null;
}

export async function getBinding(): Promise<SiteBinding | null> {
  const bindings = await readConfig<SiteBindings>('sites.json') ?? {};
  const binding = bindings[await projectPath()];
  return binding?.origin === apiOrigin() ? binding : null;
}
export async function saveBinding(binding: SiteBinding) {
  const bindings = await readConfig<SiteBindings>('sites.json') ?? {};
  await saveConfig('sites.json', { ...bindings, [await projectPath()]: binding });
}
export async function removeConfig(name: string) {
  await rm(path.join(configRoot(), name), { force: true });
}
