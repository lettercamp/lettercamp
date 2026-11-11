import { Command, InvalidArgumentError } from 'commander';
import { version, showVersion, update } from './version.js';
import type { BuildOptions } from './build.js';
import type { DevOptions } from './dev.js';
import { preview } from './preview.js';
import type { CreateOptions } from './new.js';

function creationCommand(command: Command) {
  return command
    .description('Create a site and install its local Lettercamp CLI')
    .argument('[directory]', 'Destination directory (default: my-lettercamp)')
    .option('--preset <name>', 'Starter preset, or default for no preset')
    .option('--remote-assets', 'Use hosted starter images and fonts instead of local files', false)
    .option('-y, --yes', 'Use defaults for unanswered setup questions', false)
    .option('--no-install', 'Create the site without running npm install')
    .action(async (directory: string | undefined, options: CreateOptions) => {
      const { createSite } = await import('./new.js');
      await createSite(directory, options);
    });
}

export async function run(argv = process.argv, name: 'lettercamp' | 'create-lettercamp' = 'lettercamp') {
  const program = new Command()
    .name(name)
    .description('Create, preview, and publish your Lettercamp publication.')
    .version(version, '-v, --version', 'Show the installed CLI version');

  if (name === 'create-lettercamp') {
    await creationCommand(program).parseAsync(argv);
    return;
  }

  program.hook('preAction', async (_program, command) => {
    if (['new', 'version', 'update'].includes(command.name())) return;
    const { notifyUpdate } = await import('./update-notifier.js');
    await notifyUpdate(argv.slice(2));
  });

  program.command('login')
    .description('Sign in through your browser to publish and manage your site')
    .option('--no-browser', 'Print the approval link without opening a browser')
    .option('--name <name>', 'Name for this CLI session')
    .action(async options => { const { login } = await import('./account.js'); await login(options); });

  program.command('whoami')
    .description('Show the signed-in account')
    .option('--json', 'Print account details as JSON')
    .action(async options => { const { whoami } = await import('./account.js'); await whoami(options); });

  program.command('logout')
    .description('Revoke this CLI session and remove its local credential')
    .action(async () => { const { logout } = await import('./account.js'); await logout(); });

  program.command('upload')
    .description('Upload images or fonts and print their permanent URLs')
    .argument('<files...>', 'JPEG, PNG, WebP, AVIF, GIF, TTF, OTF, WOFF, or WOFF2 files, subject to workspace limits (maximum 100 MB each)')
    .option('--site <slug>', 'Destination site (remembered for this local publication)')
    .option('--json', 'Print URL and image dimensions or font settings; multiple files return an array')
    .addHelpText('after', '\nExamples:\n  lettercamp upload cover.png portrait.jpg --site my-blog --json\n  lettercamp upload brand.woff2 --json\n\nUses your saved login and an existing site. Run lettercamp login if sign-in is required.\nUse --json for agents and scripts, then write the returned URLs into your source.\nImage optimization runs in the background; the original URL is usable immediately.\nUploads do not edit source files or publish the site.\n\nMultiple files print filename<TAB>URL. Failed files are reported and remaining uploads continue.\nThe command exits unsuccessfully if any upload fails. Single-file output is unchanged.')
    .action(async (files: string[], options) => { const { upload } = await import('./upload.js'); await upload(files, options); });

  creationCommand(program.command('new'));

  program.command('deploy')
    .description('Publish this folder; create or connect a site on first use')
    .addHelpText('after', '\nFiles in public/ are uploaded with their paths intact, subject to your plan limits.\nSupported images are optimized during the Cloud build.\nReferenced images outside public/ use the media library. Your local files stay unchanged.')
    .action(async () => { const { deploy } = await import('./deploy.js'); await deploy(); });

  program.command('check')
    .description('Check that this folder will build on Lettercamp Cloud, without deploying')
    .option('--json', 'Print the result and each problem as JSON')
    .option('--no-build', 'Check imports and source files, skipping the build')
    .addHelpText('after', '\nRuns the same checks as lettercamp deploy, without signing in or uploading.\nReports imports that Lettercamp Cloud cannot resolve, then builds a copy of the deployment.\nExits unsuccessfully if any problem is found.')
    .action(async options => { const { check } = await import('./check.js'); await check(options); });

  program.command('domain')
    .description('Connect an address, resume setup, or remove the current connection')
    .argument('[address]', 'A hostname, a URL with a subfolder, or remove')
    .addHelpText('after', '\nExamples:\n  lettercamp domain blog.example.com\n  lettercamp domain example.com/blog\n  lettercamp domain\n  lettercamp domain remove')
    .action(async (address?: string) => { const { domain } = await import('./domain.js'); await domain(address); });

  program.command('version')
    .description('Show the installed and latest published CLI versions')
    .action(showVersion);

  program.command('update')
    .description('Update this project’s CLI, or the global npm installation outside a project')
    .option('--global', 'Update only the global npm installation')
    .option('--allow-breaking', 'Allow an upgrade that may include breaking changes')
    .action(options => update(options));

  program.command('dev')
    .description('Preview the current publication with live reload')
    .option('-p, --port <number>', 'Preferred local port (tries the next available port if busy)', (value) => {
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
        throw new InvalidArgumentError('Use a port between 1 and 65535.');
      }
      return Number(value);
    }, 3000)
    .option('--host <address>', 'Host to listen on', 'localhost')
    .option('--open', 'Open the preview in your browser', false)
    .action(async (options: DevOptions, command: Command) => {
      await preview(process.cwd(), {
        ...options,
        useDefaultPorts: command.getOptionValueSource('port') === 'default',
      });
    });

  program.command('build')
    .description('Build a static publication for hosting')
    .requiredOption('--site <url>', 'Public site URL for metadata')
    .option('--out-dir <directory>', 'Output directory', 'dist')
    .option('--assets-prefix <url>', 'Base URL for versioned generated assets')
    .option('--remote-assets-only', 'Check Cloud asset requirements and exclude public files', false)
    .action(async (options: BuildOptions) => {
      const { buildSite } = await import('./build.js');
      await buildSite(process.cwd(), options);
    });

  await program.parseAsync(argv);
}
