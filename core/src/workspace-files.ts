import { lstat, readdir, readFile, mkdir, writeFile, unlink, rmdir, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export type SourceFile = { path: string; content: string };
const roots = ['pages', 'components', 'lib', 'styles', 'assets', 'public'];
export function sourcePath(value: string) {
  const parts = value.split('/');
  return value.length <= 500 && !/[\\\x00-\x1f\x7f:]/.test(value)
    && parts.every(part => part && !part.startsWith('.') && !['node_modules', 'dist', 'build', 'coverage'].includes(part))
    && (value === 'settings.json' || parts.length > 1 && roots.includes(parts[0]))
    && !/\.(pem|key|p12|pfx)$/i.test(value);
}

export function validateFiles(files: SourceFile[]) {
  if (!Array.isArray(files) || files.length > 2000) throw new Error('Invalid source snapshot.');
  const paths = new Set<string>();
  let bytes = 0;
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || !sourcePath(file.path) || paths.has(file.path.toLowerCase())
      || typeof file.content !== 'string' || file.content.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.content)) throw new Error('Invalid or colliding source path.');
    paths.add(file.path.toLowerCase());
    const size = Buffer.byteLength(file.content, 'base64'); bytes += size;
    if (size > 5 * 1024 * 1024 || bytes > 10 * 1024 * 1024) throw new Error('Source supports 5 MB per file and 10 MB total. Use hosted URLs for large assets.');
  }
  for (const file of files) {
    const parts = file.path.toLowerCase().split('/');
    while (parts.length > 1) { parts.pop(); if (paths.has(parts.join('/'))) throw new Error('A source path is both a file and a directory.'); }
  }
}

export async function assertRegularPath(root: string, relative: string) {
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    const info = await lstat(current).catch(error => { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null; throw error; });
    if (info?.isSymbolicLink() || info && !info.isFile() && !info.isDirectory()) throw new Error(`Refusing a symlink or special file: ${relative}`);
  }
}

export async function readSourceFiles(root: string): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  let total = 0;
  const visit = async (relative: string) => {
    await assertRegularPath(root, relative);
    const info = await lstat(path.join(root, relative)).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!info) return;
    if (info.isDirectory()) {
      for (const name of (await readdir(path.join(root, relative))).sort()) {
        const next = `${relative}/${name}`;
        if (sourcePath(next)) await visit(next);
      }
    } else {
      total += info.size;
      if (info.size > 5 * 1024 * 1024 || total > 10 * 1024 * 1024 || files.length >= 2000) throw new Error('Source supports 2,000 files, 5 MB per file and 10 MB total. Use hosted asset URLs for large files.');
      files.push({ path: relative, content: (await readFile(path.join(root, relative))).toString('base64') });
    }
  };
  await visit('settings.json');
  for (const directory of roots) await visit(directory);
  validateFiles(files);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function changedPaths(base: SourceFile[], next: SourceFile[]) {
  const a = new Map(base.map(file => [file.path, file.content]));
  const b = new Map(next.map(file => [file.path, file.content]));
  return [...new Set([...a.keys(), ...b.keys()])].filter(name => a.get(name) !== b.get(name)).sort();
}

export function mergeSource(base: SourceFile[], local: SourceFile[], remote: SourceFile[], keepLocal: string[] = [], takeRemote: string[] = []) {
  for (const files of [base, local, remote]) validateFiles(files);
  const a = new Map(base.map(file => [file.path, file.content]));
  const b = new Map(local.map(file => [file.path, file.content]));
  const c = new Map(remote.map(file => [file.path, file.content]));
  const conflicts: string[] = [], files: SourceFile[] = [];
  for (const name of new Set([...a.keys(), ...b.keys(), ...c.keys()])) {
    const localChanged = a.get(name) !== b.get(name), remoteChanged = a.get(name) !== c.get(name);
    const conflict = localChanged && remoteChanged && b.get(name) !== c.get(name);
    if (keepLocal.includes(name) && takeRemote.includes(name)) throw new Error(`Choose one resolution for ${name}.`);
    if (conflict && !keepLocal.includes(name) && !takeRemote.includes(name)) conflicts.push(name);
    const content = conflict && takeRemote.includes(name) ? c.get(name) : localChanged ? b.get(name) : c.get(name);
    if (content !== undefined) files.push({ path: name, content });
  }
  if (!conflicts.length) validateFiles(files);
  return { files, conflicts };
}

// Preflight every affected path before writing. A conflicted pull never gets here.
export async function writeSourceFiles(root: string, before: SourceFile[], after: SourceFile[]) {
  validateFiles(after);
  const changed = changedPaths(before, after);
  for (const name of changed) await assertRegularPath(root, name);
  const current = await readSourceFiles(root);
  if (changedPaths(before, current).length) throw new Error('Local files changed during this operation. Run the command again.');
  const next = new Map(after.map(file => [file.path, file.content]));
  for (const name of changed.filter(name => !next.has(name))) {
    await unlink(path.join(root, name));
    let directory = path.dirname(path.join(root, name));
    while (directory !== root) {
      try { await rmdir(directory); } catch { break; }
      directory = path.dirname(directory);
    }
  }
  for (const name of changed.filter(name => next.has(name))) {
    await assertRegularPath(root, name);
    const destination = path.join(root, name);
    await mkdir(path.dirname(destination), { recursive: true });
    const temporary = path.join(path.dirname(destination), `.lettercamp-${randomUUID()}`);
    try {
      await writeFile(temporary, Buffer.from(next.get(name)!, 'base64'), { flag: 'wx' });
      await rename(temporary, destination);
    } finally { await rm(temporary, { force: true }); }
  }
}
