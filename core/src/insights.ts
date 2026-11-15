import { credentials, getDeploymentBinding, type ApiSite } from './account.js';
import { findWorkspace } from './cloud-workspace.js';
import { request } from './hosting.js';

type Options = { site?: string; view?: string; query?: string; offset?: string; limit?: string };

export async function insights({ site, view, query, offset, limit }: Options) {
  const workspace = await findWorkspace();
  let token: string;
  let siteId: string;
  if (workspace) {
    const paired = workspace.state;
    if (site && site !== paired.site.slug) throw new Error(`This workspace is paired to ${paired.site.slug}. Run the command outside it to select another site.`);
    token = paired.token;
    siteId = paired.site.id;
  } else {
    token = (await credentials()).token;
    const binding = await getDeploymentBinding();
    if (!site && binding) siteId = binding.siteId;
    else {
      const { sites } = await request<{ sites: ApiSite[] }>(token, 'sites');
      const selected = site ? sites.find(item => item.slug === site) : sites.length === 1 ? sites[0] : undefined;
      if (!selected) throw new Error(site ? `No accessible site with slug "${site}".` : 'Choose an existing Lettercamp site with --site <slug>.');
      siteId = selected.id;
    }
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ view, query, offset, limit })) {
    if (value !== undefined) params.set(key, value);
  }
  const result = await request(token, `sites/${encodeURIComponent(siteId)}/insights?${params}`);
  console.log(JSON.stringify(result, null, 2));
}
