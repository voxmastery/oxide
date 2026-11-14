// Sandbox file system with shell paths.
//
// Paths are written the way the Terminal shows them: `~` is the home folder, `~/projects/<name>` holds
// Cargo projects and `~/rustlings` the Rustlings workspace. On Android/iOS `~` is
// `<documentDirectory>/home` (real files, so the toolchain can build them). On web there is no real
// file system: an in-memory tree persisted to AsyncStorage stands in.
//
// Every function takes a shell path (`~/projects/hello_world/src/main.rs`); relative paths are
// resolved with `expand(path, cwd)` first.
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

export const HOME = '~';
export const PROJECTS = '~/projects';
export const RUSTLINGS = '~/rustlings';

const WEB = Platform.OS === 'web';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function homeUri(): string {
  const base = Paths.document.uri;
  return (base.endsWith('/') ? base : base + '/') + 'home/';
}

/**
 * Absolute path of `~` as programs see it. Native: `/data/user/0/<app>/files/home`;
 * web (no real file system): `/data/oxide`.
 */
export const HOME_ABS: string = (() => {
  if (WEB) return '/data/oxide';
  try {
    return decodeURIComponent(homeUri().replace(/^file:\/\//, '')).replace(/\/$/, '');
  } catch {
    return '/data/oxide';
  }
})();

/**
 * Resolve a path typed in the shell to a normalized shell path (`~` or `~/a/b`).
 * Accepts `~`, `~/…`, the absolute home path, absolute paths (returned normalized; they are outside
 * the sandbox and fail with EACCES) and paths relative to `cwd`. `..` stops at `~`.
 */
export function expand(path: string, cwd: string = HOME): string {
  const p = (path ?? '').trim();
  let parts: string[];
  let abs = false;
  if (p === '' ) parts = cwd.slice(1).split('/');
  else if (p === '~' || p.startsWith('~/')) parts = p.slice(1).split('/');
  else if (p === HOME_ABS || p.startsWith(HOME_ABS + '/')) parts = p.slice(HOME_ABS.length).split('/');
  else if (p.startsWith('/')) { parts = p.split('/'); abs = true; }
  else parts = (cwd.slice(1) + '/' + p).split('/');
  const out: string[] = [];
  for (const x of parts) {
    if (!x || x === '.') continue;
    if (x === '..') out.pop();
    else out.push(x);
  }
  if (abs) return '/' + out.join('/');
  return out.length ? '~/' + out.join('/') : '~';
}

/** True for paths inside the sandbox (`~…`). */
export const inHome = (p: string) => p === HOME || p.startsWith('~/');

/** Absolute path for programs (pwd, the toolchain's `cwd`). */
export function native(path: string): string {
  const p = inHome(path) ? path : expand(path);
  if (!inHome(p)) return p;
  return HOME_ABS + p.slice(1);
}

/** file:// URI of a shell path (native only). */
export function uri(path: string): string {
  const p = expand(path);
  const rel = p === HOME ? '' : p.slice(2).split('/').map(encodeURIComponent).join('/');
  return homeUri() + rel;
}

export const basename = (p: string) => (p === HOME ? '~' : p.slice(p.lastIndexOf('/') + 1));
export const dirname = (p: string) => (p === HOME || p.lastIndexOf('/') <= 0 ? HOME : p.slice(0, p.lastIndexOf('/')));

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type FsErrorCode = 'ENOENT' | 'ENOTDIR' | 'EISDIR' | 'EEXIST' | 'EACCES' | 'EINVAL' | 'EIO';
const MESSAGES: Record<FsErrorCode, string> = {
  ENOENT: 'No such file or directory',
  ENOTDIR: 'Not a directory',
  EISDIR: 'Is a directory',
  EEXIST: 'File exists',
  EACCES: 'Permission denied',
  EINVAL: 'Invalid argument',
  EIO: 'Input/output error',
};

export class FsError extends Error {
  code: FsErrorCode;
  path: string;
  constructor(code: FsErrorCode, path: string, detail?: string) {
    super(detail ?? MESSAGES[code]);
    this.code = code;
    this.path = path;
  }
}
/** Shell wording for an error code ("No such file or directory"). */
export const errText = (e: unknown) => (e instanceof FsError ? MESSAGES[e.code] : e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------------------
// Backends
// ---------------------------------------------------------------------------

export type Entry = { name: string; dir: boolean; size: number; mtime: number };
type Stat = { dir: boolean; size: number; mtime: number };

interface Backend {
  ready(): Promise<void>;
  stat(p: string): Promise<Stat | null>;
  readdir(p: string): Promise<Entry[]>;
  readFile(p: string): Promise<string>;
  writeFile(p: string, text: string): Promise<void>;
  mkdir(p: string): Promise<void>;
  rm(p: string): Promise<void>;
}

// ----- web: in-memory tree persisted to AsyncStorage -----
type WNode = { d: 1; m: number } | { t: string; m: number };
const WEB_KEY = 'oxide-fs-v1';

function webBackend(): Backend {
  const nodes = new Map<string, WNode>();
  let loaded: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      AsyncStorage.setItem(WEB_KEY, JSON.stringify([...nodes.entries()])).catch(() => {});
    }, 250);
  };
  const ensureRoot = () => { if (!nodes.has(HOME)) nodes.set(HOME, { d: 1, m: Date.now() }); };
  const children = (p: string) => {
    const pre = p + '/';
    const out: string[] = [];
    for (const k of nodes.keys()) if (k.startsWith(pre) && k.indexOf('/', pre.length) < 0) out.push(k);
    return out;
  };
  const statOf = (n: WNode): Stat => ('d' in n ? { dir: true, size: 4096, mtime: n.m } : { dir: false, size: utf8Len(n.t), mtime: n.m });
  return {
    ready() {
      if (!loaded) {
        loaded = AsyncStorage.getItem(WEB_KEY)
          .then((raw) => {
            if (raw) for (const [k, v] of JSON.parse(raw) as [string, WNode][]) nodes.set(k, v);
          })
          .catch(() => {})
          .then(ensureRoot);
      }
      return loaded;
    },
    async stat(p) { const n = nodes.get(p); return n ? statOf(n) : null; },
    async readdir(p) {
      const n = nodes.get(p);
      if (!n) throw new FsError('ENOENT', p);
      if (!('d' in n)) throw new FsError('ENOTDIR', p);
      return children(p).map((k) => ({ name: basename(k), ...statOf(nodes.get(k)!) }));
    },
    async readFile(p) {
      const n = nodes.get(p);
      if (!n) throw new FsError('ENOENT', p);
      if ('d' in n) throw new FsError('EISDIR', p);
      return n.t;
    },
    async writeFile(p, text) {
      const n = nodes.get(p);
      if (n && 'd' in n) throw new FsError('EISDIR', p);
      const parent = nodes.get(dirname(p));
      if (!parent) throw new FsError('ENOENT', p);
      if (!('d' in parent)) throw new FsError('ENOTDIR', p);
      nodes.set(p, { t: text, m: Date.now() });
      save();
    },
    async mkdir(p) {
      const n = nodes.get(p);
      if (n) { if ('d' in n) return; throw new FsError('EEXIST', p); }
      const parent = nodes.get(dirname(p));
      if (!parent) throw new FsError('ENOENT', p);
      nodes.set(p, { d: 1, m: Date.now() });
      save();
    },
    async rm(p) {
      if (!nodes.has(p)) throw new FsError('ENOENT', p);
      const pre = p + '/';
      for (const k of [...nodes.keys()]) if (k === p || k.startsWith(pre)) nodes.delete(k);
      save();
    },
  };
}

// ----- native: expo-file-system (real files under <documentDirectory>/home) -----
function nativeBackend(): Backend {
  let loaded: Promise<void> | null = null;
  const info = (p: string) => Paths.info(uri(p));
  return {
    ready() {
      if (!loaded) {
        loaded = (async () => {
          const d = new Directory(homeUri());
          if (!d.exists) d.create({ intermediates: true, idempotent: true });
        })();
      }
      return loaded;
    },
    async stat(p) {
      const i = info(p);
      if (!i.exists) return null;
      if (i.isDirectory) {
        const d = new Directory(uri(p));
        return { dir: true, size: 4096, mtime: d.info().modificationTime ?? Date.now() };
      }
      const f = new File(uri(p));
      return { dir: false, size: f.size ?? 0, mtime: f.modificationTime ?? Date.now() };
    },
    async readdir(p) {
      const i = info(p);
      if (!i.exists) throw new FsError('ENOENT', p);
      if (!i.isDirectory) throw new FsError('ENOTDIR', p);
      return new Directory(uri(p)).list().map((x) =>
        x instanceof Directory
          ? { name: decodeName(x.name), dir: true, size: 4096, mtime: x.info().modificationTime ?? 0 }
          : { name: decodeName(x.name), dir: false, size: x.size ?? 0, mtime: x.modificationTime ?? 0 },
      );
    },
    async readFile(p) {
      const i = info(p);
      if (!i.exists) throw new FsError('ENOENT', p);
      if (i.isDirectory) throw new FsError('EISDIR', p);
      return new File(uri(p)).text();
    },
    async writeFile(p, text) {
      const i = info(p);
      if (i.exists && i.isDirectory) throw new FsError('EISDIR', p);
      const pi = info(dirname(p));
      if (!pi.exists) throw new FsError('ENOENT', p);
      if (!pi.isDirectory) throw new FsError('ENOTDIR', p);
      const f = new File(uri(p));
      if (!f.exists) f.create();
      f.write(text);
    },
    async mkdir(p) {
      const i = info(p);
      if (i.exists) { if (i.isDirectory) return; throw new FsError('EEXIST', p); }
      if (!info(dirname(p)).exists) throw new FsError('ENOENT', p);
      new Directory(uri(p)).create({ idempotent: true });
    },
    async rm(p) {
      const i = info(p);
      if (!i.exists) throw new FsError('ENOENT', p);
      if (i.isDirectory) new Directory(uri(p)).delete();
      else new File(uri(p)).delete();
    },
  };
}

function decodeName(n: string) {
  try { return decodeURIComponent(n.replace(/\/$/, '')); } catch { return n; }
}
function utf8Len(s: string) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c >= 0xd800 && c < 0xdc00 ? (i++, 4) : 3;
  }
  return n;
}

const B: Backend = WEB ? webBackend() : nativeBackend();

// ---------------------------------------------------------------------------
// Change notifications (screens re-read when files change)
// ---------------------------------------------------------------------------

let version = 0;
const listeners = new Set<() => void>();
function changed() {
  version++;
  listeners.forEach((l) => l());
}
/** Subscribe to any write/remove. Returns an unsubscribe function. */
export function onChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
/** A number that increases whenever the file system changes; use it as an effect dependency. */
export function useFsVersion(): number {
  return useSyncExternalStore(onChange, () => version, () => version);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function guard(p: string): string {
  const x = expand(p);
  if (!inHome(x)) throw new FsError('EACCES', x);
  return x;
}

/** Wait until the file system is usable (web: loaded from storage). Every call below awaits it. */
export const ready = () => B.ready();

export async function stat(path: string): Promise<Entry | null> {
  await B.ready();
  const p = expand(path);
  if (!inHome(p)) return null;
  const s = await B.stat(p);
  return s ? { name: basename(p), ...s } : null;
}

export async function exists(path: string): Promise<boolean> {
  return (await stat(path)) !== null;
}

export async function isDir(path: string): Promise<boolean> {
  return (await stat(path))?.dir === true;
}

/** Directory entries sorted by name (case-insensitive, like `ls`). Throws ENOENT / ENOTDIR. */
export async function list(path: string): Promise<Entry[]> {
  await B.ready();
  const p = guard(path);
  const out = await B.readdir(p);
  return out.sort((a, b) => a.name.replace(/^\./, '').toLowerCase().localeCompare(b.name.replace(/^\./, '').toLowerCase()));
}

/** File contents as UTF-8 text. Throws ENOENT / EISDIR. */
export async function read(path: string): Promise<string> {
  await B.ready();
  return B.readFile(guard(path));
}

/** Write a text file, creating missing parent folders. */
export async function write(path: string, text: string): Promise<void> {
  await B.ready();
  const p = guard(path);
  if (p === HOME) throw new FsError('EISDIR', p);
  await mkdirpRaw(dirname(p));
  await B.writeFile(p, text);
  changed();
}

async function mkdirpRaw(p: string) {
  if (p === HOME) return;
  const s = await B.stat(p);
  if (s) { if (s.dir) return; throw new FsError('ENOTDIR', p); }
  await mkdirpRaw(dirname(p));
  await B.mkdir(p);
}

/** `mkdir -p`. */
export async function mkdirp(path: string): Promise<void> {
  await B.ready();
  await mkdirpRaw(guard(path));
  changed();
}

/** Create one folder; fails with EEXIST / ENOENT like `mkdir`. */
export async function mkdir(path: string): Promise<void> {
  await B.ready();
  const p = guard(path);
  if (await B.stat(p)) throw new FsError('EEXIST', p);
  await B.mkdir(p);
  changed();
}

/** Remove a file or a folder with everything in it. Refuses `~` itself. */
export async function remove(path: string): Promise<void> {
  await B.ready();
  const p = guard(path);
  if (p === HOME) throw new FsError('EACCES', p);
  await B.rm(p);
  changed();
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/** The files `cargo new <name>` writes (binary package, edition 2024). Paths relative to the project. */
export function newProjectFiles(name: string): Record<string, string> {
  return {
    'Cargo.toml': `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2024"\n\n[dependencies]\n`,
    'src/main.rs': 'fn main() {\n    println!("Hello, world!");\n}\n',
    '.gitignore': '/target\n',
  };
}

export const projectPath = (name: string) => `${PROJECTS}/${name}`;

/** Files of a folder, recursively, relative to it. Skips `target/` and dot folders such as `.git/`. */
async function walk(root: string, rel = ''): Promise<{ path: string; size: number }[]> {
  const out: { path: string; size: number }[] = [];
  const here = rel ? `${root}/${rel}` : root;
  for (const e of await B.readdir(here)) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.dir) {
      if (!rel && e.name === 'target') continue;
      if (e.name.startsWith('.')) continue;
      out.push(...(await walk(root, r)));
    } else out.push({ path: r, size: e.size });
  }
  return out;
}

export type ProjectInfo = { name: string; files: string[]; bytes: number };

/**
 * Cargo projects in `~/projects` (folders with a Cargo.toml), sorted by name.
 * `files` are relative paths without `target/` and dot files (`Cargo.toml`, `src/main.rs`…).
 */
export async function listProjects(): Promise<ProjectInfo[]> {
  await B.ready();
  if (!(await B.stat(PROJECTS))) return [];
  const out: ProjectInfo[] = [];
  for (const e of await B.readdir(PROJECTS)) {
    if (!e.dir) continue;
    const root = projectPath(e.name);
    if (!(await B.stat(`${root}/Cargo.toml`))) continue;
    const files = (await walk(root)).filter((f) => !f.path.split('/').some((s) => s.startsWith('.')));
    files.sort((a, b) => fileOrder(a.path) - fileOrder(b.path) || a.path.localeCompare(b.path));
    out.push({ name: e.name, files: files.map((f) => f.path), bytes: files.reduce((n, f) => n + f.size, 0) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
const fileOrder = (p: string) => (p === 'src/main.rs' ? 0 : p.startsWith('src/') ? 1 : p === 'Cargo.toml' ? 2 : p === 'Cargo.lock' ? 3 : 4);

/** Create `~/projects/<name>` with the same files as `cargo new`. Throws EEXIST if it exists. */
export async function createProject(name: string): Promise<void> {
  await B.ready();
  const root = projectPath(name);
  if (await B.stat(root)) throw new FsError('EEXIST', root);
  await mkdirpRaw(root);
  for (const [rel, text] of Object.entries(newProjectFiles(name))) {
    await mkdirpRaw(dirname(`${root}/${rel}`));
    await B.writeFile(`${root}/${rel}`, text);
  }
  trash.delete(name);
  changed();
}

// Deleted projects are kept in memory for this app run so the "Undo" snackbar can restore them.
const trash = new Map<string, Record<string, string>>();

/** Delete `~/projects/<name>`. Its source files (not `target/`) are kept until `restoreProject`. */
export async function deleteProject(name: string): Promise<void> {
  await B.ready();
  const root = projectPath(name);
  if (!name || name.includes('/') || !(await B.stat(root))) throw new FsError('ENOENT', root);
  const files: Record<string, string> = {};
  const all = async (rel: string) => {
    const here = rel ? `${root}/${rel}` : root;
    for (const e of await B.readdir(here)) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.dir) { if (!(rel === '' && e.name === 'target')) await all(r); }
      else { try { files[r] = await B.readFile(`${root}/${r}`); } catch { /* unreadable: skip */ } }
    }
  };
  await all('');
  trash.set(name, files);
  await B.rm(root);
  changed();
}

/** Undo `deleteProject`. Returns false when there is nothing to restore. */
export async function restoreProject(name: string): Promise<boolean> {
  await B.ready();
  const files = trash.get(name);
  if (!files) return false;
  const root = projectPath(name);
  await mkdirpRaw(root);
  for (const [rel, text] of Object.entries(files)) {
    await mkdirpRaw(dirname(`${root}/${rel}`));
    await B.writeFile(`${root}/${rel}`, text);
  }
  trash.delete(name);
  changed();
  return true;
}

/** Nearest folder at or above `path` that has a Cargo.toml (stops at `~`), or null. */
export async function findCargoRoot(path: string): Promise<string | null> {
  await B.ready();
  let p = expand(path);
  if (!inHome(p)) return null;
  for (;;) {
    if (await B.stat(`${p === HOME ? HOME : p}/Cargo.toml`)) return p;
    if (p === HOME) return null;
    p = dirname(p);
  }
}

export { ensureRustlingsWorkspace, syncExercise, exerciseFile } from './rustlings';
