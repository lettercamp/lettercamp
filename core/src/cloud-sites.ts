import { createHash, randomUUID } from 'node:crypto';
import { credentials, readConfig, removeConfig, saveConfig, type ApiSite } from './account.js';
import { checkCheckoutDestination, checkoutRoot, checkoutWorkspace, type WorkspaceConnection } from './cloud-workspace.js';
import { ApiError, delay, request } from './hosting.js';
import { terminal } from './terminal.js';

type CreateOptions = { name: string; slug: string; directory?: string; allowPublish?: boolean; json?: boolean };
type Creation = { id: string; origin: string; userId: string; name: string; slug: string };
type HostedSite = ApiSite & { url: string };
type ConnectionResult = Omit<WorkspaceConnection, 'origin'> | { pending: true; stage: string | null };

export async function createCloudSite({ name, slug, directory, allowPublish, json }: CreateOptions) {
  if (!/^[a-z0-9][a-z0-9-]{3,61}[a-z0-9]$/.test(slug)) {
    throw new Error('Use 5–63 lowercase letters, numbers, or hyphens for --slug. Start and end with a letter or number.');
  }
  const { token, origin, user } = await credentials();
  const root = await checkoutRoot(directory ?? slug);
  const receipt = `create-site-${createHash('sha256').update(root).digest('hex')}.json`;
  let creation = await readConfig<Creation>(receipt);
  if (!creation) {
    await checkCheckoutDestination(root);
    await saveConfig(receipt, { id: randomUUID(), origin, userId: user.id, name, slug }, { ifAbsent: true });
    creation = await readConfig<Creation>(receipt);
    if (!creation) throw new Error('The creation request changed. Run the command again to check the destination.');
  }
  if (creation.origin !== origin || creation.userId !== user.id || creation.name !== name || creation.slug !== slug) {
    throw new Error(`This folder has an unfinished creation request for ${creation.slug}. Resume it with the original site name, slug, and login, or choose a different directory.`);
  }
  await checkCheckoutDestination(root, creation.id);

  let site: HostedSite;
  try {
    ({ site } = await request<{ site: HostedSite }>(token, 'sites', { id: creation.id, name, slug }));
  } catch (error) {
    if (error instanceof ApiError && [400, 402].includes(error.status)) await removeConfig(receipt);
    throw error;
  }

  terminal.step(`Waiting for ${site.slug}.lettercamp.site to finish its first build…`);
  const deadline = Date.now() + 46 * 60_000;
  let previousStage: string | null = null;
  while (Date.now() < deadline) {
    const connection = await request<ConnectionResult>(token, 'connect', { siteId: site.id, canPublish: allowPublish ?? false });
    if (!('pending' in connection)) {
      const workspace = await checkoutWorkspace(root, { ...connection, origin });
      await removeConfig(receipt);
      const preview = workspace.editorPreviewUrl ? `\nPreview in Lettercamp: ${workspace.editorPreviewUrl}` : '';
      console.log(json ? JSON.stringify({ ...workspace, url: site.url }, null, 2) :
        `Live at ${site.url}\nWorkspace: ${workspace.directory}${preview}\nRead ${workspace.instructions} before editing. Run lettercamp push from the workspace to preview edits.`);
      return;
    }
    if (connection.stage && connection.stage !== previousStage) {
      terminal.step(`${connection.stage.replaceAll('_', ' ')}…`);
      previousStage = connection.stage;
    }
    await delay(3000);
  }
  throw new Error('The first build is still running. Rerun the same command to resume the checkout.');
}
