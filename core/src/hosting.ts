import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { apiOrigin, apiRequest, credentials, responseJson, login, projectPath, getBinding, saveBinding, type ApiSite, type SiteBinding } from './account.js';
import { ask, choose } from './prompts.js';

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
export async function publishingToken() {
  let saved;
  try { saved = await credentials(); } catch { /* First use starts browser login below. */ }
  if (saved) {
    const response = await apiRequest('/api/cli/session', {}, saved.token);
    if (response.ok) {
      const session = await responseJson<{ canPublish?: boolean }>(response);
      if (session.canPublish) return saved.token;
      console.error('Sign in once more to authorize publishing and domain management.');
    } else if (response.status !== 401) await responseJson(response);
  }
  await login({ browser: true });
  return (await credentials()).token;
}

export async function selectHostingSite(token: string, allowCreate: boolean): Promise<{ site: ApiSite; binding: SiteBinding }> {
  let binding = await getBinding();
  if (binding?.creation) {
    try {
      const { site } = await request<{ site: ApiSite }>(token, 'sites', binding.creation);
      binding = { ...binding, siteId: site.id, creation: undefined };
      await saveBinding(binding);
      return { site, binding };
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) await clearCreation(binding);
      throw error;
    }
  }
  const { sites } = await request<{ sites: ApiSite[] }>(token, 'sites');
  const existing = binding && sites.find(site => site.id === binding?.siteId);
  if (existing && binding) return { site: existing, binding };
  if (binding) console.error('The saved site is unavailable. Choose another site for this folder.');
  if (!allowCreate && !sites.length) throw new Error('Run lettercamp deploy first to create a site.');
  const choices = [...(allowCreate ? ['Create a new site'] : []), ...sites.map(site => `${site.name} (${site.slug}.lettercamp.site)`)];
  const selected = choices.length === 1 && !allowCreate && !binding ? 0 : await choose('Choose a site for this folder', choices);
  if (allowCreate && selected === 0) {
    const { workspaces } = await request<{ workspaces: { id: string; name: string }[] }>(token, 'workspaces');
    if (!workspaces.length) throw new Error('No accessible workspace was found for this account.');
    const workspace = workspaces[workspaces.length === 1 ? 0 : await choose('Choose a workspace', workspaces.map(workspace => workspace.name))];
    const folder = path.basename(await projectPath());
    const suggested = folder.replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'My Blog';
    const name = await ask('Site name', suggested);
    const slug = await ask('Site address (the part before .lettercamp.site)', folder.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'my-blog');
    const id = randomUUID();
    binding = { origin: apiOrigin(), siteId: id, fresh: true, creation: { id, workspaceId: workspace.id, name, slug } };
    await saveBinding(binding);
    try {
      const { site } = await request<{ site: ApiSite }>(token, 'sites', binding.creation);
      binding = { ...binding, creation: undefined };
      await saveBinding(binding);
      console.error(`Created ${site.slug}.lettercamp.site.`);
      return { site, binding };
    } catch (error) {
      // Definitive validation failures created nothing. Preserve uncertain requests for retry.
      if (error instanceof ApiError && error.status === 400) await clearCreation(binding);
      throw error;
    }
  }
  const site = sites[selected - (allowCreate ? 1 : 0)];
  binding = { origin: apiOrigin(), siteId: site.id };
  await saveBinding(binding);
  return { site, binding };
}
async function clearCreation(binding: SiteBinding) {
  // Keep other projects' bindings, but remove this unsuccessful selection.
  const { readConfig, saveConfig } = await import('./account.js');
  const bindings = await readConfig<Record<string, SiteBinding>>('sites.json') ?? {};
  const key = await projectPath();
  if (bindings[key]?.siteId === binding.siteId) delete bindings[key];
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
    if (progress !== previous) { console.error(`${activity.stage}…`); previous = progress; }
    if (activity.status === 'succeeded') return result;
    if (activity.status === 'failed' || activity.status === 'cancelled') throw new Error(activity.error || `Deployment ${activity.status}. Run lettercamp deploy to retry.`);
    await delay(3000);
  }
  throw new Error('Publishing is still in progress. Run lettercamp deploy again to check it.');
}
