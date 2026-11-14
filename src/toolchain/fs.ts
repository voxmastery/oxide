// Small synchronous file helpers over expo-file-system for the toolchain layer.
// Paths here are plain absolute POSIX paths ("/data/user/0/…/files/home"), as the shell and the
// native tools see them; expo-file-system wants file:// URIs.

import { Directory, File, Paths } from 'expo-file-system';

export function toUri(path: string): string {
  return path.startsWith('file://') ? path : 'file://' + encodeURI(path);
}

export function fromUri(uri: string): string {
  const p = uri.startsWith('file://') ? decodeURI(uri.slice('file://'.length)) : uri;
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

/** The app's document directory as a path (Android: context.filesDir), or null on web. */
export function documentDirPath(): string | null {
  try {
    const uri = Paths.document.uri;
    return uri ? fromUri(uri) : null;
  } catch {
    return null;
  }
}

export function dirname(path: string): string {
  const i = path.replace(/\/+$/, '').lastIndexOf('/');
  return i <= 0 ? '/' : path.slice(0, i);
}

export function basename(path: string): string {
  const p = path.replace(/\/+$/, '');
  return p.slice(p.lastIndexOf('/') + 1);
}

/** Joins and normalises ("a/./b/../c" → "a/c"). Absolute `rel` wins. */
export function resolvePath(base: string, rel: string): string {
  const joined = rel.startsWith('/') ? rel : base.replace(/\/+$/, '') + '/' + rel;
  const out: string[] = [];
  for (const part of joined.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return '/' + out.join('/');
}

export function exists(path: string): boolean {
  try {
    const info = Paths.info(toUri(path));
    return info.exists;
  } catch {
    return false;
  }
}

export function isDirectory(path: string): boolean {
  try {
    const info = Paths.info(toUri(path));
    return info.exists && info.isDirectory === true;
  } catch {
    return false;
  }
}

export function mkdirp(path: string): void {
  const d = new Directory(toUri(path));
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
}

export function readText(path: string): string | null {
  try {
    const f = new File(toUri(path));
    return f.exists ? f.textSync() : null;
  } catch {
    return null;
  }
}

export function writeText(path: string, text: string): void {
  mkdirp(dirname(path));
  const f = new File(toUri(path));
  if (!f.exists) f.create({ intermediates: true });
  f.writeSync(text);
}

/** Names in a directory (files and directories), or [] when it does not exist. */
export function listDir(path: string): { name: string; dir: boolean }[] {
  try {
    const d = new Directory(toUri(path));
    if (!d.exists) return [];
    return d.list().map((e) => ({ name: e.name, dir: e instanceof Directory }));
  } catch {
    return [];
  }
}
