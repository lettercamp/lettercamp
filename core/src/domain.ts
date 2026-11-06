import { saveBinding } from './account.js';
import { choose, ask, confirm } from './prompts.js';
import { delay, publishingToken, request, selectHostingSite, status, waitForDeployment } from './hosting.js';

type Connection = { id: string; hostname: string; status: string; error: string | null };
type DomainDocument = {
  domain: (Connection & { records: { type: string; name: string; value: string; purpose: string; verified: boolean }[]; cnameVerified: boolean }) | null;
  subfolder?: (Connection & { basePath: string }) | null;
  cnameTarget: string; available: boolean; unavailableReason?: string;
  proxy?: Record<'vercel' | 'cloudflare' | 'nginx', string>;
};
export function domainAddress(address: string) {
  let url: URL;
  try { url = new URL(address.includes('://') ? address : `https://${address}`); } catch { throw new Error('Enter an address such as blog.example.com or example.com/blog.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash
    || /[?#@\\\s]/.test(address) || /:\d/.test(address.replace(/^https:\/\//, '')) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(address)) throw new Error('Use an HTTPS hostname or subfolder without credentials, ports, a query, or fragment.');
  const basePath = url.pathname.replace(/\/+$/, '');
  return { kind: basePath ? 'subfolder' : 'hostname', hostname: url.hostname, basePath };
}
export async function domain(address?: string) {
  const parsed = address && address !== 'remove' ? domainAddress(address) : undefined;
  const token = await publishingToken();
  let { site, binding } = await selectHostingSite(token, false);
  const route = `sites/${site.id}/domain`;
  let document = await request<DomainDocument>(token, route);
  const connection = () => document.subfolder || document.domain;
  const label = () => document.subfolder ? `${document.subfolder.hostname}${document.subfolder.basePath}` : document.domain?.hostname;
  const mutate = async (action: string) => {
    document = await request<DomainDocument>(token, route, { action, kind: document.subfolder ? 'subfolder' : 'hostname', connectionId: connection()?.id });
  };
  let removingSubfolder = false;
  if (address === 'remove') {
    if (!connection()) { console.log('No custom address is connected.'); return; }
    if (!await confirm(`Disconnect ${label()}?`)) return;
    removingSubfolder = !!document.subfolder;
    await mutate('remove');
    await finishRemoval();
    return;
  }
  if (parsed) {
    if (connection()) {
      const same = parsed.kind === 'subfolder' ? document.subfolder?.hostname === parsed.hostname && document.subfolder.basePath === parsed.basePath
        : !document.subfolder && document.domain?.hostname === parsed.hostname;
      if (!same) throw new Error(`This site already uses ${label()}. Run lettercamp domain remove before connecting another address.`);
    } else {
      document = await request<DomainDocument>(token, route, { action: 'add', ...parsed });
      binding = { ...binding, provider: undefined };
      await saveBinding(binding);
    }
  }
  if (!connection()) {
    const current = await status(token, site.id);
    console.log(`Site address: ${current.site.url}\nConnect an address with lettercamp domain blog.example.com or lettercamp domain example.com/blog.`);
    return;
  }
  if (connection()?.status === 'removing') { removingSubfolder = !!document.subfolder; await finishRemoval(); return; }
  if (connection()?.status === 'active') {
    await mutate('refresh');
    if (connection()?.error) throw new Error(connection()!.error!);
  }
  if (connection()?.status === 'active') {
    await finishAddress();
    console.log(`Connected: https://${label()}/`);
    return;
  }
  if (document.subfolder?.status === 'verifying') {
    const providers = ['vercel', 'cloudflare', 'nginx'] as const;
    const provider = binding.provider ?? providers[await choose(`Where is ${document.subfolder.hostname} hosted?`, ['Vercel', 'Cloudflare', 'nginx'])];
    binding = { ...binding, provider };
    await saveBinding(binding);
    if (!document.proxy) throw new Error('Proxy configuration is unavailable. Run lettercamp domain again.');
    console.log(document.proxy[provider]);
    console.error(provider === 'vercel' ? 'Merge these rewrites into your existing website’s vercel.json, before catch-all rules, and deploy that website.'
      : provider === 'nginx' ? 'Add these locations to the existing HTTPS server block, then reload nginx. Keep proxy_pass URLs without a trailing slash.'
      : `Deploy this Worker and add a Worker route for ${document.subfolder.hostname}${document.subfolder.basePath}* on your existing proxied domain.`);
    console.error('Keep your website’s DNS and HTTPS settings. The proxy must preserve the subfolder path.');
    await ask('Press Enter after applying the proxy configuration');
  } else if (document.domain) {
    printDns();
    console.error('Add these records at your DNS provider. Keep the CNAME unproxied (DNS only).');
    await ask('Press Enter after adding the DNS records');
  }
  if (connection()?.error && document.subfolder?.status === 'building') {
    console.error(connection()!.error);
    if (!await confirm('Retry publishing this address?')) return;
  }
  let records = JSON.stringify(document.domain?.records.map(record => [record.name, record.value]));
  const deadline = Date.now() + 10 * 60_000;
  let previous = '';
  while (Date.now() < deadline) {
    await mutate('refresh');
    const nextRecords = JSON.stringify(document.domain?.records.map(record => [record.name, record.value]));
    if (nextRecords !== records) { printDns(); records = nextRecords; }
    const current = connection();
    if (!current) throw new Error('The address was removed. Run lettercamp domain again to check your site.');
    const message = `${current.status}${current.error ? `: ${current.error}` : ''}`;
    if (message !== previous) { console.error(message); previous = message; }
    if (current.status === 'active') {
      await finishAddress();
      console.log(`Live at https://${label()}/`);
      return;
    }
    if (document.subfolder?.status === 'building') {
      const publishing = await status(token, site.id);
      if (publishing.pending) {
        await waitForDeployment(token, site.id, publishing.pending);
        document = await request<DomainDocument>(token, route);
        if (connection()?.status === 'active') { console.log(`Live at https://${label()}/`); return; }
      }
      else if (current.error) throw new Error(`${current.error} Run lettercamp domain to retry.`);
    }
    await delay(15_000);
  }
  throw new Error('Setup is still pending. Run lettercamp domain to check again; your setup has been saved.');

  async function finishAddress() {
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      const publishing = await status(token, site.id);
      if (publishing.pending) { await waitForDeployment(token, site.id, publishing.pending); continue; }
      if (!publishing.addressPending) {
        if (publishing.activity?.status === 'failed' && publishing.activity.summary === 'Updated site domain') {
          console.error(publishing.activity.error || 'The address rebuild failed.');
          if (!await confirm('Retry publishing this address?')) throw new Error('The address is connected, but its rebuild did not finish. Run lettercamp domain to retry.');
          await request(token, `sites/${site.id}/status`, { action: 'retry' });
          continue;
        }
        return;
      }
      await delay(3000);
    }
    throw new Error('The address is connected and waiting to rebuild. Run lettercamp domain to check again.');
  }
  function printDns() {
    if (!document.domain) return;
    console.log(`DNS records for ${document.domain.hostname}:\n\nTYPE\tNAME\tVALUE`);
    console.log(`CNAME\t${document.domain.hostname}\t${document.cnameTarget}`);
    for (const record of document.domain.records) console.log(`${record.type}\t${record.name}\t${record.value}`);
  }
  async function finishRemoval() {
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      const publishing = await status(token, site.id);
      if (publishing.pending) await waitForDeployment(token, site.id, publishing.pending);
      document = await request<DomainDocument>(token, route);
      if (!connection()) {
        await finishAddress();
        console.log(`Site address: ${publishing.site.defaultUrl}`);
        binding = { ...binding, provider: undefined };
        await saveBinding(binding);
        if (removingSubfolder) console.log('You can now remove the proxy rules from your existing website.');
        return;
      }
      if (connection()?.error) throw new Error(`${connection()!.error} Run lettercamp domain remove to retry.`);
      await delay(5000);
    }
    throw new Error('Disconnection is still pending. Run lettercamp domain to check again.');
  }
}
