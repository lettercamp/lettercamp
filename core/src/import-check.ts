import { readFile, readdir } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { parse } from '@babel/parser';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { mdxjs } from 'micromark-extension-mdxjs';
import { findCustomLayouts, findSubscribeOverride } from './custom-layout.js';

export const supportedImportsUrl = 'https://www.lettercamp.com/docs/react-components#supported-imports';
export type CheckIssue = {
  code: 'unsupported-package' | 'subpath-import' | 'path-alias' | 'absolute-path' | 'outside-publication' | 'missing-file'
    | 'case-mismatch' | 'unsupported-stylesheet' | 'missing-default-export' | 'mdx-syntax' | 'invalid-publication' | 'build-failed';
  file?: string; line?: number; column?: number; import?: string; message: string; fix?: string;
  // The import path to write instead, when it can be derived.
  replacement?: string;
};
export type SpecifierKind = 'relative' | 'absolute' | 'subpath' | 'alias' | 'runtime' | 'package';

// Cloud builds run the released CLI beside the uploaded source. They have the
// CLI's own React, no package.json, and no node_modules for the publication.
const hostedPackages = new Set(['react', 'react-dom']);
const sourceRoots = ['pages', 'components', 'lib', 'styles', 'assets'];
const excluded = new Set(['node_modules', 'dist', 'build', 'coverage']);
const builtins = new Set(builtinModules);
const codeFile = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
const preprocessor = /\.(?:less|styl|stylus)$/i;
const extensions = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'];
const posix = path.posix;

export function classifySpecifier(specifier: string): { kind: SpecifierKind; name?: string } {
  if (/^\.\.?(?:\/|$)/.test(specifier)) return { kind: 'relative' };
  if (specifier.startsWith('#')) return { kind: 'subpath' };
  if (/^[@~]\//.test(specifier)) return { kind: 'alias' };
  if (specifier.startsWith('/')) return { kind: 'absolute' };
  // node:, astro:, virtual:, https:, and data: are resolved by the runtime or bundler.
  if (/^[a-z][a-z0-9+.-]*:/i.test(specifier)) return { kind: 'runtime' };
  const parts = specifier.split('/');
  const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  return builtins.has(specifier) || builtins.has(name) ? { kind: 'runtime' } : { kind: 'package', name };
}

export function packageFix(name: string) {
  if (/^(?:react-icons|lucide-react|@heroicons\/|@phosphor-icons\/|@tabler\/icons|@fortawesome\/|@radix-ui\/react-icons|react-feather)/.test(name)) {
    return 'Replace each icon with an inline <svg> element, or a small local component in components/ that returns one.';
  }
  if (/^(?:next|@next)(?:\/|$)/.test(name)) return 'Use standard <a> and <img> elements instead of Next.js components and hooks.';
  return 'Remove the import and write the code locally in components/ or lib/. Installed packages only work in builds you host yourself with lettercamp build.';
}

type Found = { specifier: string; line?: number; column?: number };
type Node = Record<string, unknown>;

function walk(value: unknown, visit: (node: Node) => void) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { for (const child of value) walk(child, visit); return; }
  const node = value as Node;
  if (typeof node.type === 'string') visit(node);
  for (const key in node) if (!['loc', 'leadingComments', 'trailingComments', 'innerComments', 'extra'].includes(key)) walk(node[key], visit);
}

// Type-only imports are erased before bundling and never reach the resolver.
function typeOnly(node: Node) {
  if (node.importKind === 'type' || node.exportKind === 'type') return true;
  const specifiers = node.specifiers as Node[] | undefined;
  return !!specifiers?.length && specifiers.every(item => item.importKind === 'type' || item.exportKind === 'type');
}

function scriptImports(file: string, source: string): { imports: Found[]; defaultExport: boolean } | null {
  const typescript = /\.[cm]?tsx?$/i.test(file);
  let program: Node;
  try {
    program = parse(source, {
      sourceType: 'module', errorRecovery: true,
      plugins: [...(typescript ? ['typescript' as const] : []), ...(/\.[cm]?ts$/i.test(file) ? [] : ['jsx' as const])],
    }).program as unknown as Node;
  } catch { return null; } // The build reports syntax errors with its own code frame.
  const imports: Found[] = [];
  let defaultExport = false;
  walk(program, node => {
    const start = (node.loc as { start?: { line: number; column: number } } | undefined)?.start;
    const add = (source: unknown) => {
      const value = (source as Node | null)?.value;
      if (typeof value === 'string') imports.push({ specifier: value, line: start?.line, column: start ? start.column + 1 : undefined });
    };
    if (node.type === 'ExportDefaultDeclaration') defaultExport = true;
    if (node.type === 'ExportSpecifier') {
      const exported = node.exported as Node;
      if ((exported.name ?? exported.value) === 'default') defaultExport = true;
    }
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type as string)) {
      if (node.source && !typeOnly(node)) add(node.source);
    } else if (node.type === 'ImportExpression') add(node.source);
    else if (node.type === 'CallExpression') {
      const callee = node.callee as Node;
      if (callee.type === 'Import' || callee.type === 'Identifier' && callee.name === 'require') add((node.arguments as Node[])[0]);
    } else if (node.type === 'TSImportEqualsDeclaration' && !typeOnly(node)) {
      add((node.moduleReference as Node).expression);
    }
  });
  return { imports, defaultExport };
}

function mdxImports(source: string): Found[] {
  // Frontmatter is YAML, not MDX. Blank it while keeping line numbers intact.
  const frontmatter = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(source);
  if (frontmatter) source = frontmatter[0].replace(/[^\n]/g, '') + source.slice(frontmatter[0].length);
  const tree = fromMarkdown(source, { extensions: [mdxjs()], mdastExtensions: [mdxFromMarkdown()] });
  const imports: Found[] = [];
  walk(tree, node => {
    let source: Node | undefined;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type as string)) source = node.source as Node;
    else if (node.type === 'CallExpression') {
      const callee = node.callee as Node;
      if (callee.type === 'Identifier' && callee.name === 'require') source = (node.arguments as Node[])[0];
    }
    const start = (node.loc as { start?: { line: number; column: number } } | undefined)?.start;
    if (typeof source?.value === 'string') imports.push({ specifier: source.value, line: start?.line, column: start ? start.column + 1 : undefined });
  });
  return imports;
}

// Resolve a package.json "imports" alias only to suggest its relative path.
function aliasResolver(manifest: unknown) {
  const imports = manifest && typeof manifest === 'object' ? (manifest as { imports?: unknown }).imports : null;
  const entries = imports && typeof imports === 'object' ? Object.entries(imports as Record<string, unknown>) : [];
  return (specifier: string) => {
    for (const [key, value] of entries) {
      const target = typeof value === 'string' ? value : value && typeof value === 'object'
        ? Object.values(value as Record<string, unknown>).find((item): item is string => typeof item === 'string') : undefined;
      if (!target?.startsWith('./')) continue;
      const [prefix, suffix] = key.split('*');
      if (suffix === undefined) { if (key === specifier) return posix.normalize(target); continue; }
      if (specifier.length >= key.length - 1 && specifier.startsWith(prefix) && specifier.endsWith(suffix)) {
        return posix.normalize(target.replace('*', specifier.slice(prefix.length, specifier.length - suffix.length)));
      }
    }
    return null;
  };
}

// Report every import that resolves on this computer but not in a Cloud build.
// Only files reachable from pages and reserved layout components are read.
export async function checkImports(root: string): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = [];
  const seen = new Set<string>();
  const add = (issue: CheckIssue) => {
    const key = [issue.code, issue.file, issue.line, issue.import].join('\n');
    if (!seen.has(key)) { seen.add(key); issues.push(issue); }
  };
  const alias = aliasResolver(await readFile(path.join(root, 'package.json'), 'utf8').then(JSON.parse).catch(() => null));

  const listings = new Map<string, Promise<Map<string, boolean>>>();
  const list = (directory: string) => {
    let listing = listings.get(directory);
    if (!listing) {
      listing = readdir(path.join(root, directory), { withFileTypes: true })
        .then(entries => new Map(entries.map(entry => [entry.name, entry.isDirectory()])), () => new Map<string, boolean>());
      listings.set(directory, listing);
    }
    return listing;
  };
  // Cloud's file system is case-sensitive. Find the stored spelling of each
  // segment so a path that only works on macOS or Windows can be reported.
  async function locate(relative: string) {
    let actual = '', directory = true;
    for (const part of relative.split('/')) {
      if (!directory) return null;
      const entries = await list(actual || '.');
      const name = entries.has(part) ? part : [...entries.keys()].find(entry => entry.toLowerCase() === part.toLowerCase());
      if (name === undefined) return null;
      directory = entries.get(name)!;
      actual = actual ? `${actual}/${name}` : name;
    }
    return { actual, directory };
  }
  async function resolveFile(target: string, importer: string) {
    const candidates = [target];
    // TypeScript sources may name the emitted .js file.
    if (/\.[cm]?tsx?$/i.test(importer) && /\.[cm]?jsx?$/i.test(target)) {
      candidates.push(target.replace(/\.([cm]?)j(sx?)$/i, '.$1t$2'));
      if (/\.js$/i.test(target)) candidates.push(target.replace(/\.js$/i, '.tsx'));
    }
    candidates.push(...extensions.map(extension => target + extension), ...extensions.map(extension => `${target}/index${extension}`));
    let inexact: { requested: string; actual: string } | null = null;
    for (const requested of candidates) {
      const found = await locate(requested);
      if (!found || found.directory) continue;
      if (found.actual === requested) return { requested, actual: found.actual };
      inexact ??= { requested, actual: found.actual };
    }
    return inexact;
  }

  const queue: string[] = [];
  const queued = new Set<string>();
  const enqueue = (file: string) => { if (!queued.has(file)) { queued.add(file); queue.push(file); } };
  const relativeTo = (importer: string, target: string) => {
    const relative = posix.relative(posix.dirname(importer), target);
    return relative.startsWith('.') ? relative : `./${relative}`;
  };

  async function inspect(file: string, found: Found) {
    const specifier = found.specifier.split('?', 1)[0];
    const query = found.specifier.slice(specifier.length);
    const issue = { file, line: found.line, column: found.column, import: found.specifier };
    const { kind, name } = classifySpecifier(specifier);
    let target: string;
    if (kind === 'runtime' || specifier === 'lettercamp/components') return;
    if (kind === 'package') {
      if (!hostedPackages.has(name!)) add({ ...issue, code: 'unsupported-package',
        message: `"${found.specifier}" is an npm package. Lettercamp Cloud builds provide react, react-dom, and lettercamp/components, so this import cannot be resolved when you deploy.`,
        fix: packageFix(name!) });
      return;
    }
    if (kind === 'alias') {
      add({ ...issue, code: 'path-alias',
        message: `"${found.specifier}" uses a path alias. Aliases from tsconfig.json or a bundler configuration are not available in Lettercamp Cloud builds.`,
        fix: 'Import the file with a relative path, such as "./Name" or "../lib/name".' });
      return;
    }
    if (kind === 'absolute') {
      add({ ...issue, code: 'absolute-path', message: `"${found.specifier}" is an absolute path, which does not point into your publication during a build.`,
        fix: 'Import the file with a relative path, such as "../components/Name.jsx".' });
      return;
    }
    if (kind === 'subpath') {
      const mapped = alias(specifier);
      const replacement = mapped ? relativeTo(file, mapped) + query : undefined;
      add({ ...issue, code: 'subpath-import',
        message: `"${found.specifier}" uses a package.json "imports" alias. package.json is not part of a deployment, so Lettercamp Cloud cannot resolve the alias.`,
        fix: replacement ? `Use the relative path "${replacement}".` : 'Import the file with a relative path, such as "./Name" or "../lib/name".',
        ...(replacement ? { replacement } : {}) });
      if (!mapped) return;
      target = mapped;
    } else target = posix.normalize(posix.join(posix.dirname(file), specifier));

    const parts = target.split('/');
    const deployed = target === 'settings.json' || parts.length > 1 && [...sourceRoots, 'public'].includes(parts[0])
      && parts.every(part => !part.startsWith('.') && !excluded.has(part));
    if (!deployed) {
      if (kind === 'relative') add({ ...issue, code: 'outside-publication',
        message: `"${found.specifier}" points outside the deployed publication. A deployment contains settings.json and the pages/, components/, lib/, styles/, and assets/ folders.`,
        fix: 'Copy the file into components/ or lib/ and import it from there.' });
      return;
    }
    const resolved = await resolveFile(target, file);
    if (!resolved) {
      if (kind === 'relative') add({ ...issue, code: 'missing-file', message: `"${found.specifier}" does not match a file in your publication.`,
        fix: 'Check the path, filename, and extension, or create the missing file.' });
      return;
    }
    if (resolved.actual !== resolved.requested) {
      const corrected = resolved.actual;
      add({ ...issue, code: 'case-mismatch',
        message: `"${found.specifier}" matches ${resolved.actual} only when letter case is ignored. Lettercamp Cloud builds on a case-sensitive file system.`,
        fix: `Change the import to "${relativeTo(file, corrected) + query}", or rename the file to match.`, replacement: relativeTo(file, corrected) + query });
    }
    // Vite imports with these queries are text or asset URLs, not executable
    // code or stylesheets. Their contents do not introduce dependencies.
    if (/[?&](?:raw|url)(?:[=&]|$)/.test(query)) return;
    if (preprocessor.test(resolved.actual)) {
      const css = posix.basename(resolved.actual).replace(preprocessor, '.css');
      add({ ...issue, code: 'unsupported-stylesheet',
        message: `"${found.specifier}" needs a CSS preprocessor. Lettercamp Cloud builds support CSS, Sass, and CSS Modules, not Less or Stylus.`,
        fix: `Convert the stylesheet to plain CSS and save it as ${css}. Replace preprocessor variables with CSS custom properties and write out mixins and @use rules.` });
    } else if (codeFile.test(resolved.actual) || /\.mdx$/i.test(resolved.actual)) enqueue(resolved.actual);
  }

  const layouts = new Set<string>();
  for (const name of (await list('pages')).keys()) if (/\.mdx$/i.test(name)) enqueue(`pages/${name}`);
  for (const file of [...Object.values(await findCustomLayouts(root)), await findSubscribeOverride(root)]) if (file) { layouts.add(file); enqueue(file); }

  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    const source = await readFile(path.join(root, file), 'utf8').catch(() => null);
    if (source === null) continue;
    let imports: Found[];
    if (/\.mdx$/i.test(file)) {
      try { imports = mdxImports(source); }
      catch (error) {
        const detail = error as { reason?: string; message?: string; line?: number; column?: number };
        add({ code: 'mdx-syntax', file, line: detail.line, column: detail.column, message: `MDX syntax error: ${detail.reason ?? detail.message ?? String(error)}`,
          fix: 'Correct the syntax at this position. Close every JSX tag, and write literal { and < characters as \\{ and \\<.' });
        continue;
      }
    } else {
      const script = scriptImports(file, source);
      if (!script) continue;
      imports = script.imports;
      if (layouts.has(file) && !script.defaultExport) add({ code: 'missing-default-export', file,
        message: `${file} has no default export, so Lettercamp cannot render it.`,
        fix: `Export the component as the default: export default function ${posix.basename(file).replace(/\.[jt]sx$/, '')}({ site, pathname }) { … }` });
    }
    for (const found of imports) await inspect(file, found);
  }
  return issues.sort((a, b) => (a.file ?? '').localeCompare(b.file ?? '') || (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0));
}
