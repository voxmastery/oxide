// The Terminal's shell: parsing, built-ins over src/fs, and real cargo/rustc runs through the toolchain.
// Built-ins (ls, cd, cat, cargo new, rustc --explain, rustlings hint…) work offline and on web;
// compiling and running go to `getToolchain().spawn` and stream their output verbatim.
import * as fs from '../../fs';
import { errors, rustlings } from '../../content';
import { getToolchain } from '../../toolchain';
import type { Proc, ProcEvent, ToolchainInfo } from '../../toolchain/types';
import { navActions } from '../../nav/store';
import { useApp } from '../../state/app';
import { rustlingsProgress } from '../../state/selectors';
import { plain } from '../../rust/ansi';
import { errorCode, explainLines } from './explain';
import { fmtDur, lineText, term, useTerm, type Block, type Line } from './store';

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

type Tok = { t: 'w'; v: string } | { t: 'op'; v: '&&' | '||' | ';' | '|' | '>' | '>>' };
type Seg = { argv: string[]; raw: string; op: '&&' | '||' | ';' | null; out?: { path: string; append: boolean } };

function userName() {
  const n = useApp.getState().user.name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '');
  return n || 'oxide';
}

function vars(name: string): string {
  const s = useTerm.getState();
  switch (name) {
    case 'HOME': return fs.HOME_ABS;
    case 'PWD': return fs.native(s.cwd);
    case 'OLDPWD': return s.prevCwd ? fs.native(s.prevCwd) : '';
    case 'USER': case 'LOGNAME': return userName();
    case 'SHELL': return '/bin/bash';
    default: return '';
  }
}

/** Split a command line into segments joined by && / || / ;. Returns an error string for bad syntax. */
export function parse(line: string): Seg[] | string {
  const segs: Seg[] = [];
  let toks: Tok[] = [];
  let start = 0;
  let op: Seg['op'] = null;
  let i = 0;
  const n = line.length;
  const flush = (end: number, nextOp: Seg['op']): string | null => {
    const raw = line.slice(start, end).trim();
    const argv: string[] = [];
    let out: Seg['out'];
    for (let k = 0; k < toks.length; k++) {
      const tk = toks[k];
      if (tk.t === 'w') argv.push(tk.v);
      else if (tk.v === '|') return 'pipes';
      else if (tk.v === '>' || tk.v === '>>') {
        const f = toks[k + 1];
        if (!f || f.t !== 'w') return "bash: syntax error near unexpected token `newline'";
        out = { path: f.v, append: tk.v === '>>' };
        k++;
      }
    }
    if (!argv.length) {
      if (nextOp || op) return `bash: syntax error near unexpected token \`${nextOp ?? op}'`;
      return null;
    }
    segs.push({ argv, raw, op, out });
    op = nextOp;
    toks = [];
    return null;
  };
  while (i < n) {
    const c = line[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '&' && line[i + 1] === '&') { const e = flush(i, '&&'); if (e) return e; i += 2; start = i; continue; }
    if (c === '|' && line[i + 1] === '|') { const e = flush(i, '||'); if (e) return e; i += 2; start = i; continue; }
    if (c === ';') { const e = flush(i, ';'); if (e) return e; i++; start = i; continue; }
    if (c === '|') { toks.push({ t: 'op', v: '|' }); i++; continue; }
    if (c === '>') { if (line[i + 1] === '>') { toks.push({ t: 'op', v: '>>' }); i += 2; } else { toks.push({ t: 'op', v: '>' }); i++; } continue; }
    // a word
    let w = '';
    let quotedStart = false;
    let first = true;
    while (i < n && !' \t;|>'.includes(line[i]) && !(line[i] === '&' && line[i + 1] === '&')) {
      const ch = line[i];
      if (ch === "'") {
        const j = line.indexOf("'", i + 1);
        if (j < 0) return "bash: unexpected EOF while looking for matching `''";
        w += line.slice(i + 1, j); i = j + 1; if (first) quotedStart = true;
      } else if (ch === '"') {
        let j = i + 1;
        let s = '';
        while (j < n && line[j] !== '"') {
          if (line[j] === '\\' && j + 1 < n && '"\\$'.includes(line[j + 1])) { s += line[j + 1]; j += 2; continue; }
          if (line[j] === '$') {
            const m = /^\$(\w+|\{\w+\})/.exec(line.slice(j));
            if (m) { s += vars(m[1].replace(/[{}]/g, '')); j += m[0].length; continue; }
          }
          s += line[j]; j++;
        }
        if (j >= n) return 'bash: unexpected EOF while looking for matching `"\'';
        w += s; i = j + 1; if (first) quotedStart = true;
      } else if (ch === '\\' && i + 1 < n) {
        w += line[i + 1]; i += 2;
      } else if (ch === '$') {
        const m = /^\$(\w+|\{\w+\})/.exec(line.slice(i));
        if (m) { w += vars(m[1].replace(/[{}]/g, '')); i += m[0].length; } else { w += ch; i++; }
      } else { w += ch; i++; }
      first = false;
    }
    // tilde expansion, like bash: only an unquoted leading ~
    if (!quotedStart && (w === '~' || w.startsWith('~/'))) w = fs.HOME_ABS + w.slice(1);
    toks.push({ t: 'w', v: w });
  }
  const e = flush(n, null);
  if (e) return e;
  if (op) return `bash: syntax error near unexpected token \`${op}'`;
  return segs;
}

// ---------------------------------------------------------------------------
// Toolchain access
// ---------------------------------------------------------------------------

let infoCache: { at: number; info: ToolchainInfo } | null = null;

export async function toolchainInfo(fresh = false): Promise<ToolchainInfo> {
  if (!fresh && infoCache && Date.now() - infoCache.at < 15000) return infoCache.info;
  try {
    const info = await getToolchain().info();
    infoCache = { at: Date.now(), info };
    return info;
  } catch (e) {
    return { installed: false, rustVersion: null, rustcVersionLine: null, cargoVersionLine: null, sizeBytes: 0, unavailableReason: e instanceof Error ? e.message : String(e) };
  }
}

const usable = (i: ToolchainInfo) => i.installed && !i.unavailableReason;
const unavailable = (i: ToolchainInfo) => i.unavailableReason || 'The Rust toolchain is not installed yet.';
/** stderr-style message from the app itself (not from cargo or rustc). */
const errLine = (s: string): Line => ({ w: '§r' + s.replace(/§/g, '') });

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

let current: { proc: Proc; blockId: number } | null = null;
let queue: Promise<unknown> = Promise.resolve();
const extraListeners = new Set<() => void>();
/** Called after each command so the screen can refresh derived state (root, chips). */
export function onCommandDone(fn: () => void) { extraListeners.add(fn); return () => { extraListeners.delete(fn); }; }

/** Submit a line from the input field: stdin for a running program, else a command line. */
export function submit(raw: string): Promise<void> {
  const line = raw.replace(/§/g, '');
  if (useTerm.getState().proc) { stdin(line); return Promise.resolve(); }
  const t = line.trim();
  if (!t) return Promise.resolve();
  term.pushHistory(t);
  const p = queue.then(() => runLine(t));
  queue = p.catch(() => {});
  return p;
}

async function runLine(t: string) {
  const segs = parse(t);
  if (typeof segs === 'string') {
    const id = term.addBlock(t);
    term.finish(id, [segs === 'pipes' ? errLine('Pipes (|) aren’t supported in this terminal yet.') : segs], segs === 'pipes' ? 1 : 2);
    return;
  }
  let last = 0;
  for (const s of segs) {
    if (s.op === '&&' && last !== 0) continue;
    if (s.op === '||' && last === 0) continue;
    last = await runSeg(s);
  }
}

function stdin(line: string) {
  const c = current;
  if (!c) return;
  term.append(c.blockId, ['§W' + line]);
  try { c.proc.writeLine(line); } catch { /* process gone */ }
}

/** ⌃C: stop the running program. Returns false when nothing runs. */
export function interrupt(): boolean {
  const c = current;
  if (!c) return false;
  term.append(c.blockId, ['^C']);
  try { c.proc.kill(); } catch { /* already gone */ }
  return true;
}

async function runSeg(s: Seg): Promise<number> {
  const [c] = s.argv;
  if (c === 'clear') { term.clear(); return 0; }
  const id = term.addBlock(s.raw);
  const t0 = Date.now();
  let code = 0;
  try {
    code = await dispatch(id, s, t0);
  } catch (e) {
    term.finish(id, [errLine(e instanceof Error ? e.message : String(e))], 1);
    code = 1;
  }
  extraListeners.forEach((l) => l());
  return code;
}

type Res = { lines: Line[]; code?: number; o?: Partial<Block> };

async function dispatch(id: number, s: Seg, t0: number): Promise<number> {
  const a = s.argv;
  const c = a[0];
  let r: Res | null = null;
  switch (c) {
    case 'help': r = help(); break;
    case 'pwd': r = { lines: [fs.native(useTerm.getState().cwd)] }; break;
    case 'whoami': r = { lines: [userName()] }; break;
    case 'echo': {
      const args = a.slice(1);
      const noNl = args[0] === '-n';
      r = { lines: [{ w: (noNl ? args.slice(1) : args).join(' ') }] };
      break;
    }
    case 'history': {
      const h = useTerm.getState().history;
      r = { lines: h.map((x, i) => String(i + 1).padStart(5) + '  ' + x) };
      break;
    }
    case 'ls': r = await ls(a.slice(1)); break;
    case 'cd': r = await cd(a.slice(1)); break;
    case 'cat': r = await cat(a.slice(1)); break;
    case 'mkdir': r = await mkdir(a.slice(1)); break;
    case 'rm': r = await rm(a.slice(1)); break;
    case 'edit': case 'nano': case 'vim': case 'vi': case 'code': r = await edit(a.slice(1)); break;
    case 'exit': case 'logout': r = { lines: [{ w: '§dThis terminal stays open. Use the tabs below to go elsewhere.' }] }; break;
    case 'cargo': {
      const sub = a[1];
      if (sub === '--version' || sub === '-V' || sub === 'version') r = await versionLine('cargo');
      else if (sub === 'new') r = await cargoNew(a.slice(2), t0);
      else return spawnCmd(id, a, t0);
      break;
    }
    case 'rustc': {
      const sub = a[1];
      if (sub === '--version' || sub === '-V') r = await versionLine('rustc');
      else if (sub === '--explain' || sub?.startsWith('--explain=')) r = explain(sub === '--explain' ? a[2] : sub.slice(10));
      else return spawnCmd(id, a, t0);
      break;
    }
    case 'rustlings': r = await rustlingsCmd(a.slice(1), t0); break;
    default:
      if (c.startsWith('./') || c.startsWith('/') || c.startsWith('../')) return spawnCmd(id, a, t0);
      r = { lines: [`bash: ${c}: command not found`], code: 127 };
  }
  if (s.out && r) {
    const p = fs.expand(s.out.path, useTerm.getState().cwd);
    const text = r.lines.map(lineText).join('\n') + (r.lines.length ? '\n' : '');
    try {
      const prev = s.out.append && (await fs.exists(p)) ? await fs.read(p) : '';
      await fs.write(p, prev + text);
      r = { ...r, lines: [] };
    } catch (e) {
      r = { lines: [`bash: ${s.out.path}: ${fs.errText(e)}`], code: 1 };
    }
  }
  term.finish(id, r.lines, r.code ?? 0, r.o);
  return r.code ?? 0;
}

// ---------------------------------------------------------------------------
// Built-ins
// ---------------------------------------------------------------------------

function help(): Res {
  return {
    lines: [
      '§WCommands that work here',
      '  §ocargo§n new, build, run, check, test, clippy, fmt',
      '  §orustc§n --version, --explain E0382',
      '  §orustlings§n run, hint [exercise]',
      '  §oedit§n src/main.rs, opens it in the editor',
      '  §ols  cd  pwd  cat  echo  mkdir  rm  history  clear',
      '',
      { w: '§dTab completes names. ↑ brings back earlier commands.' },
    ],
  };
}

async function versionLine(which: 'cargo' | 'rustc'): Promise<Res> {
  const i = await toolchainInfo();
  const line = which === 'cargo' ? i.cargoVersionLine : i.rustcVersionLine;
  if (line && i.installed) return { lines: [line] };
  return { lines: [errLine(unavailable(i))], code: 1 };
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function lsDate(ms: number) {
  const d = new Date(ms || Date.now());
  const now = new Date();
  const recent = Math.abs(now.getTime() - d.getTime()) < 182 * 864e5;
  const day = String(d.getDate()).padStart(2, ' ');
  return `${MON[d.getMonth()]} ${day} ${recent ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : ' ' + d.getFullYear()}`;
}
const colorName = (e: fs.Entry) => (e.dir ? '§B' + e.name + '§n' : e.name);

async function ls(args: string[]): Promise<Res> {
  let all = false;
  let long = false;
  const paths: string[] = [];
  for (const x of args) {
    if (x.startsWith('-') && x.length > 1) {
      for (const ch of x.slice(1)) {
        if (ch === 'a' || ch === 'A') all = true;
        else if (ch === 'l') long = true;
        else if (ch === '1' || ch === 'h' || ch === 'F' || ch === 'G') { /* accepted */ }
        else return { lines: [`ls: invalid option -- '${ch}'`, "Try 'ls --help' for more information."], code: 2 };
      }
    } else paths.push(x);
  }
  const cwd = useTerm.getState().cwd;
  const targets = paths.length ? paths : ['.'];
  const out: Line[] = [];
  let code = 0;
  const files: { arg: string; e: fs.Entry }[] = [];
  const dirs: { arg: string; p: string }[] = [];
  for (const arg of targets) {
    const p = fs.expand(arg, cwd);
    const st = await fs.stat(p);
    if (!fs.inHome(p)) { out.push(`ls: cannot open directory '${arg}': Permission denied`); code = 2; continue; }
    if (!st) { out.push(`ls: cannot access '${arg}': No such file or directory`); code = 2; continue; }
    if (st.dir) dirs.push({ arg, p });
    else files.push({ arg, e: { ...st, name: arg } });
  }
  const user = userName();
  const fmtLong = (es: fs.Entry[]) => {
    const w = Math.max(1, ...es.map((e) => String(e.size).length));
    return es.map((e) => `${e.dir ? 'drwxr-xr-x' : '-rw-r--r--'} ${e.dir ? 2 : 1} ${user} ${user} ${String(e.size).padStart(w)} ${lsDate(e.mtime)} ${colorName(e)}`);
  };
  const emit = (es: fs.Entry[]) => {
    if (!es.length) return;
    if (long) out.push(...fmtLong(es));
    else out.push({ w: es.map(colorName).join('  ') });
  };
  emit(files.map((f) => f.e));
  for (const [k, d] of dirs.entries()) {
    let es = await fs.list(d.p);
    if (!all) es = es.filter((e) => !e.name.startsWith('.'));
    else {
      const self = await fs.stat(d.p);
      const up = await fs.stat(fs.dirname(d.p));
      es = [{ name: '.', dir: true, size: 4096, mtime: self?.mtime ?? 0 }, { name: '..', dir: true, size: 4096, mtime: up?.mtime ?? 0 }, ...es];
    }
    if (dirs.length + files.length > 1) {
      if (k > 0 || files.length) out.push('');
      out.push(`${d.arg}:`);
    }
    if (long) out.push(`total ${es.reduce((n, e) => n + Math.ceil(e.size / 4096) * 4, 0)}`);
    emit(es);
  }
  return { lines: out, code };
}

async function setCwd(p: string) {
  const s = useTerm.getState();
  useTerm.setState({ cwd: p, prevCwd: s.cwd });
  await refreshRoot();
  const m = useTerm.getState().mission;
  if (!m.cd && p === fs.projectPath(m.name)) useTerm.setState({ mission: { ...m, cd: true } });
}

export async function refreshRoot() {
  const cwd = useTerm.getState().cwd;
  const root = await fs.findCargoRoot(cwd);
  const kind = root ? (root === fs.RUSTLINGS || root.startsWith(fs.RUSTLINGS + '/') ? 'rustlings' : 'project') : null;
  useTerm.setState({ root: { path: root, kind } });
}

async function cd(args: string[]): Promise<Res> {
  const s = useTerm.getState();
  const a = args.filter((x) => x !== '--');
  if (a.length > 1) return { lines: ['bash: cd: too many arguments'], code: 1 };
  if (a[0] === '-') {
    if (!s.prevCwd) return { lines: ['bash: cd: OLDPWD not set'], code: 1 };
    const to = s.prevCwd;
    if (!(await fs.isDir(to))) return { lines: [`bash: cd: ${fs.native(to)}: No such file or directory`], code: 1 };
    await setCwd(to);
    return { lines: [fs.native(to)] };
  }
  const arg = a[0] ?? '~';
  const p = fs.expand(arg, s.cwd);
  if (!fs.inHome(p)) return { lines: [`bash: cd: ${arg}: Permission denied`], code: 1 };
  const st = await fs.stat(p);
  if (!st) return { lines: [`bash: cd: ${arg}: No such file or directory`], code: 1 };
  if (!st.dir) return { lines: [`bash: cd: ${arg}: Not a directory`], code: 1 };
  await setCwd(p);
  return { lines: [] };
}

async function cat(args: string[]): Promise<Res> {
  const cwd = useTerm.getState().cwd;
  const out: Line[] = [];
  let code = 0;
  for (const arg of args.filter((x) => !x.startsWith('-') || x === '-')) {
    const p = fs.expand(arg, cwd);
    if (!fs.inHome(p)) { out.push(`cat: ${arg}: Permission denied`); code = 1; continue; }
    const st = await fs.stat(p);
    if (!st) { out.push(`cat: ${arg}: No such file or directory`); code = 1; continue; }
    if (st.dir) { out.push(`cat: ${arg}: Is a directory`); code = 1; continue; }
    const text = await fs.read(p);
    const ls_ = text.replace(/\n$/, '').split('\n');
    const lang = /\.rs$/.test(p) ? 'rust' : /\.toml$/.test(p) ? 'toml' : null;
    if (text === '') continue;
    out.push(...ls_.map((l): Line => (lang ? { code: l, lang } : l.replace(/§/g, ''))));
  }
  return { lines: out, code };
}

async function mkdir(args: string[]): Promise<Res> {
  const parents = args.some((x) => x === '-p' || x === '--parents');
  const names = args.filter((x) => !x.startsWith('-'));
  if (!names.length) return { lines: ['mkdir: missing operand', "Try 'mkdir --help' for more information."], code: 1 };
  const cwd = useTerm.getState().cwd;
  const out: Line[] = [];
  let code = 0;
  for (const n of names) {
    const p = fs.expand(n, cwd);
    try {
      if (!fs.inHome(p)) throw new fs.FsError('EACCES', p);
      if (parents) await fs.mkdirp(p);
      else await fs.mkdir(p);
    } catch (e) {
      out.push(`mkdir: cannot create directory ‘${n}’: ${fs.errText(e)}`);
      code = 1;
    }
  }
  return { lines: out, code };
}

/** `rm` only touches files inside your Cargo projects (~/projects/<name>…). */
async function rm(args: string[]): Promise<Res> {
  let rec = false;
  let force = false;
  const names: string[] = [];
  for (const x of args) {
    if (x.startsWith('-') && x.length > 1 && x !== '--') {
      for (const ch of x.slice(1)) { if (ch === 'r' || ch === 'R') rec = true; else if (ch === 'f') force = true; }
    } else if (x !== '--') names.push(x);
  }
  if (!names.length) return force ? { lines: [] } : { lines: ['rm: missing operand', "Try 'rm --help' for more information."], code: 1 };
  const cwd = useTerm.getState().cwd;
  const out: Line[] = [];
  let code = 0;
  for (const n of names) {
    const p = fs.expand(n, cwd);
    if (/(^|\/)\.\.?$/.test(n)) { out.push(`rm: refusing to remove '.' or '..' directory: skipping '${n}'`); code = 1; continue; }
    const inProject = p.startsWith(fs.PROJECTS + '/');
    const st = await fs.stat(p);
    if (!st) { if (!force) { out.push(`rm: cannot remove '${n}': No such file or directory`); code = 1; } continue; }
    if (!inProject) { out.push(`rm: cannot remove '${n}': Permission denied`); code = 1; continue; }
    if (st.dir && !rec) { out.push(`rm: cannot remove '${n}': Is a directory`); code = 1; continue; }
    await fs.remove(p);
  }
  // A removed folder can't stay the working directory.
  let c = useTerm.getState().cwd;
  while (c !== fs.HOME && !(await fs.isDir(c))) c = fs.dirname(c);
  if (c !== useTerm.getState().cwd) useTerm.setState({ cwd: c });
  await refreshRoot();
  return { lines: out, code };
}

async function edit(args: string[]): Promise<Res> {
  const arg = args.find((x) => !x.startsWith('-'));
  if (!arg) return { lines: ['usage: edit <file>'], code: 1 };
  const cwd = useTerm.getState().cwd;
  const p = fs.expand(arg, cwd);
  const st = await fs.stat(p);
  if (!st) return { lines: [`edit: ${arg}: No such file or directory`], code: 1 };
  if (st.dir) return { lines: [`edit: ${arg}: Is a directory`], code: 1 };
  const proj = /^~\/projects\/([^/]+)\/(.+)$/.exec(p);
  if (proj) {
    const [, project, file] = proj;
    setTimeout(() => navActions().nav('editor', { arg: project, params: { file } }), 220);
    return { lines: [`§dOpened ${file} in the editor`] };
  }
  const ex = rustlings.order.find((n) => `${fs.RUSTLINGS}/${rustlings.exercises[n].path}` === p);
  if (ex) {
    setTimeout(() => navActions().nav('workspace', { arg: ex }), 220);
    return { lines: [`§dOpened ${ex} in Practice`], o: { ex } };
  }
  return { lines: [{ w: '§dThe editor opens files in your projects in ~/projects.' }], code: 1 };
}

function explain(arg: string | undefined): Res {
  if (!arg) return { lines: ["error: Argument to option 'explain' missing"], code: 1 };
  const c = errorCode(arg);
  if (!c) return { lines: [`error: ${arg} is not a valid error code`], code: 1 };
  return { lines: explainLines(c), o: { explain: c } };
}

// ----- cargo new -----

const KEYWORDS = new Set('abstract as async await become box break const continue crate do dyn else enum extern false final fn for gen if impl in let loop macro match mod move mut override priv pub ref return self Self static struct super trait true try type typeof unsafe unsized use virtual where while yield'.split(' '));

function packageNameError(name: string): string | null {
  if (!name) return 'error: package name cannot be empty';
  const bad = [...name].find((ch) => !/[A-Za-z0-9_-]/.test(ch));
  if (bad) return `error: invalid character \`${bad}\` in package name: \`${name}\`, characters must be Unicode XID characters (numbers, \`-\`, \`_\`, or most letters)`;
  if (/^[0-9]/.test(name)) return `error: invalid character \`${name[0]}\` in package name: \`${name}\`, the name cannot start with a digit`;
  if (KEYWORDS.has(name)) return `error: the name \`${name}\` cannot be used as a package name, it is a Rust keyword`;
  return null;
}

const LIB_RS = 'pub fn add(left: u64, right: u64) -> u64 {\n    left + right\n}\n\n#[cfg(test)]\nmod tests {\n    use super::*;\n\n    #[test]\n    fn it_works() {\n        let result = add(2, 2);\n        assert_eq!(result, 4);\n    }\n}\n';

async function cargoNew(args: string[], t0: number): Promise<Res> {
  let lib = false;
  let name: string | null = null;
  const pos: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (x === '--lib') lib = true;
    else if (x === '--bin') lib = false;
    else if (x === '--name') name = args[++i] ?? null;
    else if (x.startsWith('--name=')) name = x.slice(7);
    else if (x === '--vcs' || x === '--edition' || x === '--registry') i++;
    else if (x.startsWith('-')) continue;
    else pos.push(x);
  }
  if (!pos.length) {
    return { lines: ['§Rerror§W:§n the following required arguments were not provided:', '  §G<PATH>§n', '', '§WUsage:§n §Ccargo new§n §c<PATH>§n', '', "For more information, try '§C--help§n'."], code: 1 };
  }
  const cwd = useTerm.getState().cwd;
  const p = fs.expand(pos[0], cwd);
  const shown = fs.native(p);
  if (!fs.inHome(p)) return { lines: [{ w: `§Rerror§W:§n failed to create directory \`${shown}\`` }, '', 'Caused by:', '  Permission denied (os error 13)'], code: 101 };
  if (await fs.exists(p)) return { lines: [{ w: `§Rerror§W:§n destination \`${shown}\` already exists` }, '', { w: 'Use `cargo init` to initialize the directory' }], code: 101 };
  const pkg = name ?? fs.basename(p);
  const bad = packageNameError(pkg);
  if (bad) return { lines: [{ w: '§Rerror§W:§n' + bad.slice(6) }, '', { w: 'If you need a package name to not match the directory name, consider using --name flag.' }], code: 101 };
  const files = fs.newProjectFiles(pkg);
  if (lib) { delete files['src/main.rs']; files['src/lib.rs'] = LIB_RS; }
  for (const [rel, text] of Object.entries(files)) await fs.write(`${p}/${rel}`, text);
  const m = useTerm.getState().mission;
  if (!m.new && !lib && p.startsWith(fs.PROJECTS + '/') && fs.dirname(p) === fs.PROJECTS) useTerm.setState({ mission: { ...m, new: true, name: pkg } });
  await refreshRoot();
  return {
    lines: [
      `§G    Creating§n ${lib ? 'library' : 'binary (application)'} \`${pkg}\` package`,
      { w: '§Cnote§n: see more `Cargo.toml` keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html' },
    ],
    o: { dur: fmtDur(Date.now() - t0) },
  };
}

// ----- rustlings -----

async function rustlingsCmd(args: string[], t0: number): Promise<Res> {
  const sub = args[0];
  if (sub !== 'run' && sub !== 'hint') {
    return {
      lines: [
        { w: 'The Practice tab runs Rustlings for you, with hints and the official solutions.' },
        { w: 'Here you can use §orustlings run§n and §orustlings hint§n, with or without an exercise name.' },
      ],
      o: { practice: true },
    };
  }
  const st = useApp.getState();
  const name = args[1] ?? rustlingsProgress(st).next ?? rustlings.order[rustlings.order.length - 1];
  const ex = rustlings.exercises[name];
  if (!ex) return { lines: [`Error: No exercise found for '${name}'!`], code: 1 };
  if (sub === 'hint') {
    return { lines: reflow(ex.hint).map((l): Line => ({ w: l.replace(/§/g, '').replace(/`([^`]+)`/g, '§c$1§n') })), o: { ex: name } };
  }
  const info = await toolchainInfo();
  if (!usable(info)) return { lines: [errLine(unavailable(info))], code: 1, o: { ex: name } };
  const code = st.ex[name]?.code ?? ex.code;
  await fs.syncExercise(name, code);
  const r = await getToolchain().checkExercise(name, code);
  const lines: Line[] = [...r.lines];
  const errCode = r.diagnostics.find((d) => d.code)?.code ?? findCode(r.lines);
  const dur = fmtDur(r.durationMs || Date.now() - t0);
  if (r.outcome === 'pass') {
    lines.push(`\x1b[32m✓ Successfully ran ${ex.path}\x1b[0m`);
    useApp.getState().passExercise(name, ex.xp, []);
    fs.ensureRustlingsWorkspace().catch(() => {});
    return { lines, o: { ex: name, dur } };
  }
  lines.push({ w: `Ran ${ex.path} with errors` });
  return { lines, code: 1, o: { ex: name, dur, err: errCode ?? undefined } };
}

/** Join hard-wrapped prose lines so they wrap to the screen; keeps lists, indented code and blank lines. */
function reflow(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    const l = raw.trimEnd();
    const prev = out[out.length - 1];
    const joinable = prev !== undefined && prev !== '' && l !== '' && !/^(\s|[-*+] |\d+\. |```)/.test(l) && !/^(\s|```)/.test(prev) && !prev.endsWith(':');
    if (joinable) out[out.length - 1] = prev + ' ' + l;
    else out.push(l);
  }
  return out;
}

const CODE_RE = /error\[(E\d{4})\]/;
function findCode(lines: string[]): string | null {
  for (const l of lines) { const m = CODE_RE.exec(plain(l)); if (m && errors[m[1]]) return m[1]; }
  return null;
}

// ---------------------------------------------------------------------------
// Spawned commands (cargo build/run/…, rustc <file>, ./binary)
// ---------------------------------------------------------------------------

async function packageName(root: string | null): Promise<string | null> {
  if (!root) return null;
  try {
    const t = await fs.read(`${root}/Cargo.toml`);
    const m = /^\s*name\s*=\s*"([^"]+)"/m.exec(t);
    return m ? m[1] : null;
  } catch { return null; }
}

async function spawnCmd(id: number, argv: string[], t0: number): Promise<number> {
  const info = await toolchainInfo();
  if (!usable(info)) {
    term.finish(id, [errLine(unavailable(info))], 1);
    return 1;
  }
  const s = useTerm.getState();
  const cwd = s.cwd;
  const isCargoRun = argv[0] === 'cargo' && (argv[1] === 'run' || argv[1] === 'r');
  const direct = argv[0].startsWith('./') || argv[0].startsWith('/') || argv[0].startsWith('../');
  const name = direct ? fs.basename(argv[0]) : isCargoRun ? (await packageName(s.root.path)) ?? 'cargo' : argv.slice(0, 2).join(' ');

  let buf: Line[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let errCode: string | null = null;
  let sawHello = false;
  let program = direct;
  let numeric = false;
  const flush = () => { timer = null; const b = buf; buf = []; term.append(id, b); };
  const setProc = () => useTerm.setState({ proc: { blockId: id, name, program, numeric } });

  return new Promise<number>((resolve) => {
    let proc: Proc;
    const onEvent = (e: ProcEvent) => {
      if (e.type === 'exit') {
        if (timer) clearTimeout(timer);
        flush();
        current = null;
        useTerm.setState({ proc: null });
        term.finish(id, [], e.code, { dur: fmtDur(e.durationMs || Date.now() - t0), err: e.code ? errCode ?? undefined : undefined });
        if (isCargoRun && e.code === 0 && sawHello) helloRan();
        resolve(e.code);
        return;
      }
      buf.push(e.line);
      const pl = plain(e.line);
      if (!errCode) { const m = CODE_RE.exec(pl); if (m && errors[m[1]]) errCode = m[1]; }
      if (program && pl.trim() === 'Hello, world!') sawHello = true;
      if (!program && isCargoRun && /^\s*Running `/.test(pl)) { program = true; setProc(); }
      if (program && !numeric && /Please input your guess/i.test(pl)) { numeric = true; setProc(); }
      if (!timer) timer = setTimeout(flush, 40);
    };
    try {
      proc = getToolchain().spawn(argv, { cwd: fs.native(cwd), env: { CARGO_TERM_COLOR: 'always' }, onEvent });
    } catch (e) {
      term.finish(id, [errLine(e instanceof Error ? e.message : String(e))], 1);
      resolve(1);
      return;
    }
    current = { proc, blockId: id };
    setProc();
  });
}

function helloRan() {
  const m = useTerm.getState().mission;
  const app = useApp.getState();
  const first = !app.helloRan;
  if (first) app.setHelloRan();
  if (!m.run) useTerm.setState({ mission: { ...m, new: true, cd: true, run: true, doneHere: first || m.doneHere } });
}

// ---------------------------------------------------------------------------
// Tab completion
// ---------------------------------------------------------------------------

const COMMANDS = ['cargo', 'cat', 'cd', 'clear', 'echo', 'edit', 'help', 'history', 'ls', 'mkdir', 'pwd', 'rm', 'rustc', 'rustlings', 'whoami'];
const CARGO_SUBS = ['build', 'check', 'clippy', 'fmt', 'new', 'run', 'test'];

/** Complete the last word of `input`. Returns the new input (unchanged when nothing matches). */
export async function complete(input: string): Promise<string> {
  const segStart = Math.max(input.lastIndexOf('&&') + 2, input.lastIndexOf(';') + 1, input.lastIndexOf('||') + 2, 0);
  const head = input.slice(0, segStart);
  const seg = input.slice(segStart);
  const lead = /^\s*/.exec(seg)![0];
  const words = seg.slice(lead.length).split(' ');
  const last = words[words.length - 1];
  let cands: string[];
  if (words.length === 1) cands = COMMANDS;
  else if (words.length === 2 && words[0] === 'cargo') cands = CARGO_SUBS;
  else if (words.length === 2 && words[0] === 'rustlings') cands = ['hint', 'run'];
  else if (words.length === 3 && words[0] === 'rustlings') cands = rustlings.order;
  else if (words.length === 2 && words[0] === 'rustc' && last.startsWith('-')) cands = ['--explain', '--version'];
  else {
    const j = last.lastIndexOf('/');
    const pre = last.slice(0, j + 1);
    const cwd = useTerm.getState().cwd;
    const dir = fs.expand(pre || '.', cwd);
    try {
      const es = await fs.list(dir);
      const showHidden = last.slice(j + 1).startsWith('.');
      const dirsOnly = words[0] === 'cd';
      cands = es.filter((e) => (showHidden || !e.name.startsWith('.')) && (!dirsOnly || e.dir)).map((e) => pre + e.name + (e.dir ? '/' : ''));
    } catch { cands = []; }
  }
  const m = cands.filter((x) => x.startsWith(last));
  if (!m.length) return input;
  let s = m[0];
  for (const x of m) while (!x.startsWith(s)) s = s.slice(0, -1);
  if (s.length < last.length) return input;
  words[words.length - 1] = s + (m.length === 1 && !s.endsWith('/') ? ' ' : '');
  return head + lead + words.join(' ');
}

// ---------------------------------------------------------------------------
// Session start
// ---------------------------------------------------------------------------

/** First open in this app run: welcome block, initial folder, mission ticks from the real files. */
export async function startSession() {
  if (useTerm.getState().started) return;
  useTerm.setState({ started: true });
  await fs.ready();
  await fs.mkdirp(fs.PROJECTS).catch(() => {});
  fs.ensureRustlingsWorkspace().catch(() => {});
  const info = await toolchainInfo(true);
  const rv = info.rustVersion ?? /rustc (\S+)/.exec(info.rustcVersionLine ?? '')?.[1];
  const cv = /cargo (\S+)/.exec(info.cargoVersionLine ?? '')?.[1];
  const lines: Line[] = [
    '§dOxide terminal' + (usable(info) && rv ? ` · rustc ${rv}` + (cv ? ` · cargo ${cv}` : '') : ''),
    { w: '§dYour projects live in §n~/projects§d. Type §nhelp§d to see what works here.' },
  ];
  if (!usable(info)) lines.push({ w: '§d' + unavailable(info) });
  const id = term.addBlock('', { st: 'ok' });
  term.finish(id, lines, 0);
  const cwd = useTerm.getState().cwd === '~' ? fs.PROJECTS : useTerm.getState().cwd;
  useTerm.setState({ cwd });
  const m = useTerm.getState().mission;
  const hello = fs.projectPath(m.name);
  useTerm.setState({ mission: { ...m, new: await fs.exists(hello), cd: cwd === hello, run: useApp.getState().helloRan } });
  await refreshRoot();
}

/** `entry.params`: start in a folder and/or run a command once per navigation entry. */
export async function applyParams(key: string, params: { cwd?: string; run?: string } | undefined) {
  if (!params || (!params.cwd && !params.run)) return;
  const s = useTerm.getState();
  if (s.handled.includes(key)) return;
  useTerm.setState({ handled: s.handled.concat([key]).slice(-50) });
  if (s.proc) interrupt();
  await queue;
  if (params.cwd) {
    const p = fs.expand(params.cwd, useTerm.getState().cwd);
    if (await fs.isDir(p)) await setCwd(p);
  }
  if (params.run) await submit(params.run);
}
