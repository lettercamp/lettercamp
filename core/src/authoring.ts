import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';

async function call(action: string, input: Record<string, unknown>) {
  const { connectedAuthoringClient } = await import('./cloud-workspace.js');
  const client = await connectedAuthoringClient();
  if (!client) throw new Error('Run this command in a publication downloaded with lettercamp connect.');
  console.log(JSON.stringify(await client.call(action, input), null, 2));
}

type PostOptions = {
  file?: string; slug?: string; title?: string; description?: string; category?: string; date?: string;
  coverImage?: string; coverImageAlt?: string; authors?: string; clear?: string[]; revision?: string; status?: string; json?: boolean;
};
async function postFields(options: PostOptions) {
  const { file, authors, clear, json: _json, ...fields } = options;
  const input: Record<string, unknown> = { ...fields };
  if (file !== undefined) {
    if (file === '-') {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
      input.content = Buffer.concat(chunks).toString('utf8');
    } else input.content = await readFile(file, 'utf8');
  }
  if (authors !== undefined) {
    try { input.authors = JSON.parse(authors); } catch { throw new Error('--authors expects a JSON array of authors.'); }
  }
  const optional = ['description', 'category', 'date', 'coverImage', 'coverImageAlt', 'authors'];
  for (const name of clear ?? []) {
    if (!optional.includes(name)) throw new Error(`--clear accepts ${optional.join(', ')}.`);
    if (input[name] !== undefined) throw new Error(`Choose either a value or --clear for ${name}.`);
    input[name] = null;
  }
  return input;
}

function metadata(command: Command) {
  return command.option('--file <path>', 'Markdown or MDX body without frontmatter, or - for stdin')
    .option('--description <text>').option('--category <name>').option('--date <date>')
    .option('--cover-image <url>').option('--cover-image-alt <text>')
    .option('--authors <json>', 'Array of authors with name and optional image')
    .option('--json', 'Print JSON (default)');
}
export function registerAuthoringCommands(program: Command) {
  const posts = program.command('posts').description('Read and edit shared posts in the connected cloud editor');
  posts.command('list').description('Find posts, including pending edits')
    .option('--query <text>').option('--status <draft|live>').option('--offset <number>', 'First result', Number)
    .option('--limit <number>', 'Page size (1–100)', Number).option('--json', 'Print JSON (default)')
    .action(async ({ json: _json, ...filters }) => call('list_posts', filters));
  posts.command('get <id>').description('Read the post body, metadata, revision, and publication status')
    .option('--json', 'Print JSON (default)').action(async id => call('get_post', { id }));
  metadata(posts.command('create').description('Save a new shared draft').requiredOption('--slug <slug>').requiredOption('--title <title>'))
    .action(async options => call('create_post', await postFields(options)));
  metadata(posts.command('update <id>').description('Save changes against the revision returned by posts get')
    .requiredOption('--revision <revision>').option('--title <title>').option('--status <draft|live>')
    .option('--clear <fields...>', 'Clear named optional metadata fields'))
    .action(async (id, options) => call('update_post', { ...await postFields(options), id }));
  program.command('assets').description('Browse the connected site media library')
    .command('list').description('Find assets or recover an upload result')
    .option('--query <text>').option('--type <image|font|video>').option('--source <cli>')
    .option('--cursor <cursor>').option('--limit <number>', 'Page size (1–100)', Number)
    .option('--upload-id <id>').option('--json', 'Print JSON (default)')
    .action(async ({ json: _json, ...filters }) => call('list_assets', filters));
  program.command('publish').description('Queue all shared saved page changes and current production settings (requires publish permission)')
    .option('--json', 'Print the queued deployment as JSON (default)').action(async () => call('publish_site', {}));
}
