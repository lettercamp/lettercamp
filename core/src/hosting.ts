import { randomUUID } from 'node:crypto';
import { apiOrigin, apiRequest, credentials, responseJson, login, projectPath, getDeploymentBinding, saveBinding, type ApiSite, type SiteBinding } from './account.js';
import { ask, choose } from './prompts.js';
import { terminal } from './terminal.js';

export type Activity = { id: string; status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'; stage: string; summary?: string; error: string | null; sourceCommit: string | null; baseRevision: string | null };
export type HostingStatus = { site: ApiSite & { url: string; defaultUrl: string }; managed: boolean; addressPending?: boolean; revision: string | null; pending: string | null; activity: Activity | null };
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function request<T>(token: string, route: string, body?: unknown): Promise<T> {
  const response = await apiRequest(`/api/cli/${route}`, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }, token, 120_000);
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { message?: string; error?: string };
    throw new ApiError(result.message || result.error || `Lettercamp returned HTTP ${response.status}.`, response.status);
  }
  return responseJson<T>(response);
}
export async function publishingToken(options: { confirmAccount?: boolean } = {}) {
  for (;;) {
    let saved;
    try { saved = await credentials(); } catch { /* First use starts browser login below. */ }
    if (saved) {
      const response = await apiRequest('/api/cli/session', {}, saved.token);
      if (response.ok) {
        const session = await responseJson<{ canPublish?: boolean; name: string; email: string }>(response);
        if (session.canPublish) {
          if (!options.confirmAccount) return saved.token;
          terminal.detail('Signed in as', `${session.name} <${session.email}>`);
          if (!process.stdin.isTTY || !process.stderr.isTTY) return saved.token;
          const choice = await choose('Continue with this account?', ['Continue', 'Sign in with a different account', 'Cancel']);
          if (choice === 0) return saved.token;
          if (choice === 2) throw new Error('Cancelled.');
        } else terminal.note('Sign in once more to authorize publishing and domain management.');
      } else if (response.status !== 401) await responseJson(response);
    }
    if (!process.stdin.isTTY || !process.stderr.isTTY) throw new Error('Run lettercamp login interactively, then retry this command.');
    await login({ browser: true });
  }
}

export async function selectHostingSite(token: string, allowCreate: boolean, createNew = false): Promise<{ site: ApiSite; binding: SiteBinding }> {
  let binding = await getDeploymentBinding();
  if (createNew && binding?.pending) throw new Error('This folder has an unfinished deployment. Run lettercamp deploy to finish it before using --new.');
  if (binding?.creation) {
    if (!allowCreate) throw new Error('Site creation is unfinished. Run lettercamp deploy to resume it first.');
    terminal.step('Resuming site creation…');
    return finishCreation(token, binding);
  }
  const { sites } = await request<{ sites: ApiSite[] }>(token, 'sites');
  if (binding && !createNew) {
    const siteId = binding.siteId;
    const site = sites.find(site => site.id === siteId);
    if (!site) throw new Error('This folder’s deployment site is unavailable to this account. Check your login, or run lettercamp deploy --new to create a new site.');
    terminal.detail('Deployment site', `${site.name} (${site.slug}.lettercamp.site)`);
    return { site, binding };
  }
  if (!allowCreate) throw new Error('This folder has no deployment site. Run lettercamp deploy first to create one.');
  terminal.note(createNew ? 'Creating a new site for this folder. Its previous site will stay unchanged.' : 'First deployment: creating a new site for this folder.');
  const previous = binding ?? undefined;
  let name = 'My Blog';
  const rejectedSlugs = new Set<string>();
  for (;;) {
    name = await ask('Site name', name);
    if (!/^[a-z0-9 ]{1,80}$/i.test(name)) { terminal.warning('Use 1–80 letters, numbers, or spaces for the site name.'); continue; }
    const base = name.toLowerCase().replace(/\s+/g, '-').slice(0, 48).replace(/-+$/, '') || 'my-blog';
    const candidates = [base.length >= 5 ? base : `${base}-blog`, `${base}-${randomUUID().slice(0, 4)}`, `${base}-notes-${randomUUID().slice(0, 4)}`];
    const suggestions = candidates.filter(slug => !rejectedSlugs.has(slug) && !sites.some(site => site.slug === slug));
    const selected = await choose('Choose a site address (availability checked when created)', [...suggestions.map(slug => `${slug}.lettercamp.site`), 'Enter a different address']);
    const slug = selected < suggestions.length ? suggestions[selected] : await ask('Site address (the part before .lettercamp.site)');
    if (!/^[a-z0-9](?:[a-z0-9-]{3,61}[a-z0-9])$/.test(slug)) {
      terminal.warning('Use 5–63 lowercase letters, numbers, or hyphens. Start and end with a letter or number.');
      continue;
    }
    const id = randomUUID();
    binding = { origin: apiOrigin(), siteId: id, fresh: true, creation: { id, name, slug, previous } };
    await saveBinding(binding);
    try { return await finishCreation(token, binding); }
    catch (error) {
      // The server definitively rejected these details; let the user edit them.
      // Network/server failures keep the creation ID for an idempotent retry.
      if (!(error instanceof ApiError) || error.status !== 400) throw error;
      rejectedSlugs.add(slug);
      terminal.warning(`${error.message} Choose a different name or address.`);
    }
  }
}

async function finishCreation(token: string, binding: SiteBinding) {
  const { previous: _previous, ...creation } = binding.creation!;
  let site: ApiSite;
  try { ({ site } = await request<{ site: ApiSite }>(token, 'sites', creation)); }
  catch (error) {
    if (error instanceof ApiError && [400, 402, 403].includes(error.status)) await clearCreation(binding);
    throw error;
  }
  // A failed local save must retain the creation ID, so retrying cannot create
  // a duplicate. Never clear it after the server has confirmed creation.
  binding = { ...binding, siteId: site.id, creation: undefined };
  await saveBinding(binding);
  terminal.success(`Created ${site.slug}.lettercamp.site.`);
  terminal.note('Future deploys from this folder will update this site.');
  return { site, binding };
}

async function clearCreation(binding: SiteBinding) {
  const { readConfig, saveConfig } = await import('./account.js');
  const bindings = await readConfig<Record<string, SiteBinding>>('sites.json') ?? {};
  const key = await projectPath();
  if (bindings[key]?.siteId === binding.siteId) {
    if (binding.creation?.previous) bindings[key] = binding.creation.previous;
    else delete bindings[key];
  }
  await saveConfig('sites.json', bindings);
}
export const status = (token: string, siteId: string, deployment?: string) => request<HostingStatus>(token,
  `sites/${siteId}/status${deployment ? `?deployment=${encodeURIComponent(deployment)}` : ''}`);

export async function waitForDeployment(token: string, siteId: string, id: string, onProgress?: (activity: Activity) => Promise<void>) {
  const deadline = Date.now() + 46 * 60_000;
  let previous = '';
  while (Date.now() < deadline) {
    const result = await status(token, siteId, id);
    const activity = result.activity;
    if (!activity) throw new Error('Deployment not found. Run lettercamp deploy again to resume your upload.');
    if (onProgress) await onProgress(activity);
    const progress = `${activity.status}:${activity.stage}`;
    if (progress !== previous) { terminal.step(`${activity.stage.replaceAll('_', ' ')}…`); previous = progress; }
    if (activity.status === 'succeeded') return result;
    if (activity.status === 'failed' || activity.status === 'cancelled') throw new Error(activity.error || `Deployment ${activity.status}. Run lettercamp deploy to retry.`);
    await delay(3000);
  }
  throw new Error('Publishing is still in progress. Run lettercamp deploy again to check it.');
}
