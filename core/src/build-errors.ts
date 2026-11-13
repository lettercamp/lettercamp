import { classifySpecifier, packageFix, supportedImportsUrl } from './import-check.js';

// 'cloud' explains what Lettercamp Cloud provides; 'local' covers builds that
// use the packages installed beside the publication.
export type BuildTarget = 'cloud' | 'local';
export type BuildFailure = { file?: string; message: string; fix?: string; docs?: string };

export function formatBuildFailure({ file, message, fix, docs }: BuildFailure) {
  return `The build failed${file ? ` in ${file}` : ''}.\n\n${message}${fix ? `\n\nFix: ${fix}` : ''}${docs ? `\nDocs: ${docs}` : ''}`;
}

export class BuildError extends Error {
  constructor(public failure: BuildFailure, cause: unknown) {
    super(formatBuildFailure(failure), { cause });
    this.name = 'BuildError';
  }
}

const componentsUrl = 'https://www.lettercamp.com/docs/react-components#troubleshooting';

// Bundler errors name temporary build folders and end in internal stack frames.
// Show publication-relative paths and the part of the message a writer can act on.
function clean(text: string, roots: string[]) {
  text = text.replace(/\x1b\[[0-9;]*m/g, '').replaceAll('file://', '');
  const prefixes = new Set<string>();
  for (const root of roots) {
    const normal = root.replaceAll('\\', '/').replace(/\/+$/, '');
    // macOS reports /var/folders paths with and without their /private prefix.
    for (const variant of [root.replace(/[\\/]+$/, ''), normal, `/private${normal}`, normal.replace(/^\/private(?=\/)/, '')]) prefixes.add(variant);
  }
  for (const prefix of [...prefixes].sort((a, b) => b.length - a.length)) {
    text = text.replaceAll(`${prefix}/`, '').replaceAll(`${prefix}\\`, '');
  }
  return text;
}

function unresolved(specifier: string, file: string | undefined, target: BuildTarget): BuildFailure {
  const { kind, name } = classifySpecifier(specifier.split('?', 1)[0]);
  const cloud = target === 'cloud';
  if (kind === 'package' && cloud && ['react', 'react-dom'].includes(name!)) return {
    file, docs: supportedImportsUrl,
    message: `The React import "${specifier}" could not be resolved.`,
    fix: 'Check the package subpath and use an entry point provided by the React version bundled with Lettercamp.',
  };
  if (kind === 'package') return cloud ? {
    file, docs: supportedImportsUrl, fix: packageFix(name!),
    message: `"${specifier}" is an npm package. Lettercamp Cloud builds provide only react and react-dom, so this import cannot be resolved.`,
  } : {
    file, docs: supportedImportsUrl,
    message: `The package import "${specifier}" could not be resolved for this publication.`,
    fix: `Check the package name and exported subpath. If it is missing, run npm install ${name} in the publication folder. Installed packages work in builds you host yourself, not on Lettercamp Cloud.`,
  };
  if (kind === 'subpath') return {
    file, docs: supportedImportsUrl,
    message: cloud
      ? `"${specifier}" uses a package.json "imports" alias. package.json is not part of a deployment, so Lettercamp Cloud cannot resolve the alias.`
      : `"${specifier}" has no matching "imports" entry in this publication's package.json.`,
    fix: 'Import the file with a relative path, such as "./Name" or "../lib/name".',
  };
  if (kind === 'alias') return {
    file, docs: supportedImportsUrl,
    message: `"${specifier}" uses a path alias. Lettercamp does not read aliases from tsconfig.json or a bundler configuration.`,
    fix: 'Import the file with a relative path, such as "./Name" or "../lib/name".',
  };
  return {
    file, docs: componentsUrl,
    message: `The import "${specifier}" does not match a file.`,
    fix: `Check the path, filename casing, and extension${cloud ? ', and keep imported files inside pages/, components/, lib/, styles/, or assets/' : ''}.`,
  };
}

export function describeBuildError(error: unknown, options: { roots: string[]; target: BuildTarget }): BuildFailure {
  const text = clean(error instanceof Error ? error.message : String(error), options.roots);
  const cloud = options.target === 'cloud';
  let match = /failed to resolve import "([^"]+)" from "([^"]+)"/i.exec(text)
    ?? /Could not resolve "([^"]+)" from "([^"]+)"/i.exec(text)
    ?? /Cannot find (?:module|package) '([^']+)' imported from '?([^'\n]+?)'?(?:\n|$)/i.exec(text);
  if (match) return unresolved(match[1], match[2], options.target);
  if (match = /Preprocessor dependency "([^"]+)" not found/i.exec(text)) return {
    docs: supportedImportsUrl,
    message: `A stylesheet needs the "${match[1]}" preprocessor, which is not available${cloud ? ' in Lettercamp Cloud builds' : ''}.`,
    fix: cloud ? 'Use CSS or Sass (.css, .scss, .sass, or their .module variants). Update the CLI if Sass is missing.'
      : `Run npm install ${match[1]} in the publication folder, or convert the stylesheet to plain CSS. Lettercamp Cloud supports CSS and Sass.`,
  };
  if (match = /\b(window|document|navigator|localStorage|sessionStorage) is not defined/.exec(text)) return {
    docs: componentsUrl,
    message: `A component used ${match[1]} while rendering. Components render during the build, where browser APIs do not exist.`,
    fix: `Move code that uses ${match[1]} into a useEffect callback or an event handler.`,
  };
  if (match = /"([^"]+)" is not exported by "([^"]+)"/.exec(text) ?? /does not provide an export named '([^']+)'/.exec(text)) return {
    file: match[2], docs: componentsUrl,
    message: `An import asks for "${match[1]}", which ${match[2] ?? 'the imported file'} does not export.`,
    fix: match[1] === 'default' ? 'Add a default export to that file, or import the named export in braces.' : 'Match the import to a default or named export of that file.',
  };
  // Unknown failures keep their own wording, without stack frames or log prefixes.
  const lines = text.split(/\r?\n/).filter(line => line.trim() && !/^\s*at\s/.test(line));
  const message = lines.join('\n').replace(/^Build failed with \d+ errors?:\s*/i, '').replace(/^(?:Error: )?(?:\[[\w:.-]+\]:?\s*)*/, '').trim();
  return { message: message.split('\n').slice(0, 15).join('\n') || 'The renderer stopped without an error message.' };
}
