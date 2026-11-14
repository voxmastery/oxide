#!/usr/bin/env node
// Offline content pipeline for Oxide.
//
// Reads the cloned upstream repos (see scripts/fetch-content-sources.sh) and writes typed,
// minified JSON into src/content/data/ that conforms to src/content/types.ts, plus
// src/content/data/book/index.ts (lazy per-page requires for Metro).
//
//   OXIDE_SRC=/path/to/sources node scripts/build-content.mjs     (or: npm run content)
//
// Expected layout of $OXIDE_SRC:
//   book/        rust-lang/book
//   rustlings/   rust-lang/rustlings
//   brown/       cognitive-engineering-lab/rust-book
//   rustc-src/   rust-lang/rust (only compiler/rustc_error_codes is read)
//
// No network access is needed at runtime.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { parse as parseToml } from 'smol-toml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC =
  process.env.OXIDE_SRC ||
  '/tmp/claude-0/-home-claude-repo/927550cd-6382-5e68-a154-81b1216eee79/scratchpad/src';
const BOOK = path.join(SRC, 'book');
const RUSTLINGS = path.join(SRC, 'rustlings');
const BROWN = path.join(SRC, 'brown');
const RUSTC = path.join(SRC, 'rustc-src');
const ERROR_DIR = path.join(RUSTC, 'compiler/rustc_error_codes/src/error_codes');

const OUT = path.join(ROOT, 'src/content/data');
const OUT_BOOK = path.join(OUT, 'book');
const OUT_LIC = path.join(OUT, 'licenses');
const OUT_IMG = path.join(ROOT, 'assets/book');

for (const d of [BOOK, RUSTLINGS, BROWN, ERROR_DIR]) {
  if (!fs.existsSync(d)) {
    console.error(`Missing source directory: ${d}\nRun scripts/fetch-content-sources.sh <dir> and set OXIDE_SRC.`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);
const gitHead = (dir) => {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};
const gitRemote = (dir) => {
  try {
    return execFileSync('git', ['-C', dir, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};
const writeJson = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data));
};
const b64 = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
const unb64 = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', vert: '|', mdash: '—',
  ndash: '–', hellip: '…', rarr: '→', larr: '←', times: '×', copy: '©', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', minus: '−',
};
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

/** mdBook's heading id normalisation. */
function slug(text) {
  return text
    .trim()
    .toLowerCase()
    .split('')
    .map((c) => (/\s/.test(c) ? '-' : /[\p{L}\p{N}_-]/u.test(c) ? c : ''))
    .join('');
}

const inlineText = (inl) =>
  inl.map((n) => (n.k === 't' || n.k === 'code' ? n.v : inlineText(n.c))).join('');

/** Map a fence info string to our Block code fields. */
function fenceInfo(info, defaultLang = 'rust') {
  const parts = (info || '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const meta = {};
  const attrs = new Set();
  for (const p of parts) {
    if (p.startsWith('@')) {
      const [k, v] = p.slice(1).split('=');
      meta[k] = v;
    } else attrs.add(p);
  }
  const LANG_ALIASES = { cmd: 'console', powershell: 'console', sh: 'console', shell: 'console', bash: 'console', plain: 'text', txt: 'text', ide: 'rust' };
  const KNOWN = ['rust', 'console', 'text', 'toml', 'html', 'json', 'c', 'js', 'javascript', 'python', 'markdown'];
  let lang = defaultLang;
  for (const a of attrs) {
    const l = LANG_ALIASES[a] ?? a;
    if (KNOWN.includes(l)) {
      lang = l;
      break;
    }
  }
  const fails = attrs.has('does_not_compile') || attrs.has('compile_fail') || [...attrs].some((a) => a.startsWith('compile_fail'));
  const panics = attrs.has('panics') || attrs.has('should_panic');
  const ignore = attrs.has('ignore') || [...attrs].some((a) => a.startsWith('ignore'));
  return { lang, fails, panics, ignore, meta };
}

/** mdBook/rustdoc hidden line: trimmed line is `#` or starts with `# `. `##` escapes a literal `#`. */
const isHidden = (line) => {
  const t = line.trimStart();
  return t === '#' || t.startsWith('# ');
};
function splitHidden(code) {
  const lines = code.split('\n');
  const visible = [];
  const full = [];
  let anyHidden = false;
  for (const line of lines) {
    if (isHidden(line)) {
      anyHidden = true;
      const t = line.trimStart();
      const indent = line.slice(0, line.length - t.length);
      full.push(indent + t.slice(t === '#' ? 1 : 2));
    } else {
      const unescaped = line.replace(/^(\s*)##/, '$1#');
      visible.push(unescaped);
      full.push(unescaped);
    }
  }
  return { code: dedent(trimBlankEdges(visible.join('\n'))), full: full.join('\n'), anyHidden };
}
/** Remove the common leading indentation (mdBook does this for anchored includes). */
function dedent(s) {
  const lines = s.split('\n');
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return Number.isFinite(ind) && ind > 0 ? lines.map((l) => l.slice(ind)).join('\n') : s;
}
const trimBlankEdges = (s) => s.replace(/^(\s*\n)+/, '').replace(/\s+$/, '');

/** rustdoc wraps snippets without `fn main` in one. */
function toRunnable(full) {
  if (/\bfn\s+main\s*\(/.test(full)) return full;
  const lines = full.split('\n');
  const head = [];
  let i = 0;
  while (i < lines.length && /^\s*(#!\[|extern crate|$)/.test(lines[i])) head.push(lines[i++]);
  const body = lines.slice(i).map((l) => (l ? '    ' + l : l));
  return [...head, 'fn main() {', ...body, '}'].join('\n');
}

const wordCount = (s) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) || []).length;

// ---------------------------------------------------------------------------
// Markdown -> Block[]
// ---------------------------------------------------------------------------

/**
 * Convert marked inline tokens to our Inline AST. Inline HTML (<code>, <em>, <kbd>, <sup>,
 * <strong>, <a id>) is interpreted with a small tag stack; other tags are dropped.
 */
function makeInlineConverter(linkMapper) {
  function convert(tokens) {
    const root = { k: 'root', c: [] };
    const stack = [root];
    const top = () => stack[stack.length - 1];
    const pushNode = (n) => {
      const t = top();
      if (t.k === 'codeacc') {
        t.v += n.k === 't' || n.k === 'code' ? n.v : inlineText(n.c ?? []);
        return;
      }
      const arr = t.c;
      const last = arr[arr.length - 1];
      if (n.k === 't' && last && last.k === 't') last.v += n.v;
      else arr.push(n);
    };
    const pushText = (v) => v && pushNode({ k: 't', v });
    const close = (kind) => {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === kind) {
          while (stack.length > i) {
            const n = stack.pop();
            emit(n);
          }
          return;
        }
      }
    };
    const emit = (n) => {
      if (n.k === 'codeacc') pushNode({ k: 'code', v: n.v });
      else if (n.k === 'sup') {
        const v = inlineText(n.c);
        pushText(/\s/.test(v) ? `^(${v})` : `^${v}`);
      } else if (n.c.length) pushNode({ k: n.k, c: n.c, ...(n.href ? { href: n.href } : {}) });
    };
    const walk = (toks) => {
      for (const t of toks) {
        switch (t.type) {
          case 'text':
            if (t.tokens && t.tokens.length && !(t.tokens.length === 1 && t.tokens[0] === t)) walk(t.tokens);
            else pushText(decodeEntities(t.text));
            break;
          case 'escape':
            pushText(decodeEntities(t.text));
            break;
          case 'codespan':
            pushNode({ k: 'code', v: decodeEntities(t.text) });
            break;
          case 'br':
            pushText('\n');
            break;
          case 'em':
          case 'strong':
          case 'del': {
            const n = { k: t.type === 'del' ? 'em' : t.type, c: [] };
            stack.push(n);
            walk(t.tokens || []);
            stack.pop();
            emit(n);
            break;
          }
          case 'link': {
            const n = { k: 'link', href: linkMapper(t.href), c: [] };
            stack.push(n);
            walk(t.tokens || []);
            stack.pop();
            emit(n);
            break;
          }
          case 'image':
            pushText(t.text || '');
            break;
          case 'html': {
            const raw = t.raw ?? t.text;
            const re = /<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*>|([^<]+)|(<)/g;
            let m;
            while ((m = re.exec(raw))) {
              if (m[2] || m[3]) {
                pushText(decodeEntities(m[2] || m[3]));
                continue;
              }
              const tag = m[1].toLowerCase();
              const closing = m[0].startsWith('</');
              if (['code', 'kbd', 'samp'].includes(tag)) {
                if (closing) close(tag);
                else stack.push({ k: 'codeacc', tag, v: '' });
              } else if (['em', 'i', 'strong', 'b', 'sup'].includes(tag)) {
                const k = tag === 'em' || tag === 'i' ? 'em' : tag === 'sup' ? 'sup' : 'strong';
                if (closing) close(tag);
                else if (!m[0].endsWith('/>')) stack.push({ k, tag, c: [] });
              }
              // other tags (a id=, span, br-less markup) are dropped
            }
            break;
          }
          default:
            if (t.tokens) walk(t.tokens);
            else if (t.text) pushText(decodeEntities(t.text));
        }
      }
    };
    walk(tokens);
    while (stack.length > 1) emit(stack.pop());
    // tidy whitespace
    const out = root.c;
    for (const n of out) if (n.k === 't') n.v = n.v.replace(/[ \t]*\n[ \t]*/g, ' ');
    if (out.length && out[0].k === 't') out[0].v = out[0].v.replace(/^\s+/, '');
    if (out.length && out[out.length - 1].k === 't') out[out.length - 1].v = out[out.length - 1].v.replace(/\s+$/, '');
    return out.filter((n) => !(n.k === 't' && n.v === ''));
  }
  return convert;
}

/**
 * Generic markdown -> Block[] conversion shared by the Book and the error index.
 * opts.linkMapper(href), opts.headingBase (depth that maps to h2; null = absolute),
 * opts.bookCode(blockFields) hook to attach listing data.
 */
function markdownToBlocks(md, opts = {}) {
  const linkMapper = opts.linkMapper ?? ((h) => h);
  const inl = makeInlineConverter(linkMapper);
  const tokens = marked.lexer(md, { gfm: true });
  let pendingListing = null;
  let pendingFile = null;
  let headingBase = opts.headingBase ?? null;

  const codeBlock = (token) => {
    const fi = fenceInfo(token.lang, opts.defaultLang ?? 'rust');
    const raw = token.text.replace(/\s+$/, '');
    const b = { type: 'code', lang: fi.lang };
    if (fi.lang === 'rust') {
      const { code, full, anyHidden } = splitHidden(raw);
      b.code = code;
      // rustdoc wraps snippets in `fn main`; skip that for `ignore` fragments that aren't meant to run
      const runnable = fi.ignore && !fi.fails ? full : toRunnable(full);
      if (runnable !== code) b.runnable = runnable;
    } else {
      b.code = trimBlankEdges(raw);
    }
    if (pendingListing) {
      if (pendingListing.fileName) b.file = pendingListing.fileName;
      if (pendingListing.number) b.listing = pendingListing.number;
      if (pendingListing.caption) b.caption = pendingListing.caption;
      pendingListing = { ...pendingListing, used: true, fileName: null, number: null, caption: null };
    }
    if (pendingFile) {
      b.file ??= pendingFile;
      pendingFile = null;
    }
    if (fi.fails) b.fails = true;
    if (fi.panics) b.panics = true;
    if (fi.ignore) b.ignore = true;
    if (opts.onCode) opts.onCode(b, fi.meta);
    return b;
  };

  const convertTokens = (toks) => {
    const out = [];
    for (const t of toks) {
      switch (t.type) {
        case 'space':
          break;
        case 'heading': {
          const text = inl(t.tokens);
          if (headingBase == null && opts.headingBase === undefined) headingBase = null;
          let level;
          if (opts.relativeHeadings) {
            if (headingBase == null) headingBase = t.depth;
            level = t.depth - headingBase + 1;
          } else level = t.depth - 1;
          level = Math.min(4, Math.max(2, level));
          out.push({ type: `h${level}`, text, anchor: slug(inlineText(text)), _depth: t.depth });
          break;
        }
        case 'paragraph': {
          const raw = t.text.trim();
          let m;
          if ((m = raw.match(/^%%LISTING ([A-Za-z0-9_-]+)%%$/))) {
            pendingListing = unb64(m[1]);
            break;
          }
          if (raw === '%%ENDLISTING%%') {
            pendingListing = null;
            break;
          }
          if ((m = raw.match(/^%%FILE ([A-Za-z0-9_-]+)%%$/))) {
            pendingFile = unb64(m[1]);
            break;
          }
          if ((m = raw.match(/^%%IMG ([A-Za-z0-9_-]+)%%$/))) {
            const img = unb64(m[1]);
            out.push({ type: 'img', alt: img.alt, src: img.src });
            if (opts.onImage) opts.onImage(img.src);
            break;
          }
          if (raw === '%%NOTE%%') {
            out.push({ type: '_noteopen' });
            break;
          }
          if (raw === '%%ENDNOTE%%') {
            out.push({ type: '_noteclose' });
            break;
          }
          const text = inl(t.tokens);
          if (text.length) out.push({ type: 'p', text });
          break;
        }
        case 'text': {
          const text = inl(t.tokens ?? [{ type: 'text', text: t.text }]);
          if (text.length) out.push({ type: 'p', text });
          break;
        }
        case 'code':
          out.push(codeBlock(t));
          break;
        case 'hr':
          out.push({ type: 'hr' });
          break;
        case 'blockquote': {
          const inner = convertTokens(t.tokens);
          const first = inner[0];
          let kind = null;
          if (first && first.type === 'p' && first.text[0]?.k === 't') {
            const mm = first.text[0].v.match(/^(Note|Warning)\s*:\s*/i);
            if (mm) {
              kind = mm[1].toLowerCase() === 'warning' ? 'warning' : 'note';
              first.text[0].v = first.text[0].v.slice(mm[0].length);
              if (!first.text[0].v) first.text.shift();
              if (first.text[0]?.k === 't') first.text[0].v = first.text[0].v.replace(/^./, (c) => c.toUpperCase());
            }
          } else if (first && first.type === 'p' && first.text[0]?.k === 'strong') {
            const label = inlineText(first.text[0].c).replace(/:$/, '').trim().toLowerCase();
            if (label === 'note' || label === 'warning') {
              kind = label;
              first.text.shift();
              if (first.text[0]?.k === 't') first.text[0].v = first.text[0].v.replace(/^[:\s]+/, '');
            }
          }
          if (kind) out.push({ type: 'note', kind, blocks: inner });
          else out.push({ type: 'quote', blocks: inner });
          break;
        }
        case 'list': {
          const type = t.ordered ? 'ol' : 'ul';
          let items = [];
          let start = typeof t.start === 'number' ? t.start : 1;
          const flush = () => {
            if (!items.length) return;
            const b = { type, items };
            if (type === 'ol' && start !== 1) b.start = start;
            out.push(b);
            start += items.length;
            items = [];
          };
          for (const item of t.items) {
            const parts = [];
            const extra = [];
            for (const it of item.tokens) {
              if (it.type === 'text' || it.type === 'paragraph') {
                if (extra.length) extra.push(...convertTokens([it]));
                else {
                  const x = inl(it.tokens ?? [{ type: 'text', text: it.text }]);
                  if (parts.length && x.length) parts.push({ k: 't', v: ' ' });
                  parts.push(...x);
                }
              } else if (it.type !== 'space') extra.push(...convertTokens([it]));
            }
            if (item.task) parts.unshift({ k: 't', v: item.checked ? '☑ ' : '☐ ' });
            items.push(parts);
            if (extra.length) {
              flush();
              out.push(...extra);
            }
          }
          flush();
          break;
        }
        case 'table': {
          const head = t.header.map((c) => inl(c.tokens));
          const rows = t.rows.map((r) => r.map((c) => inl(c.tokens)));
          out.push({ type: 'table', head, rows });
          break;
        }
        case 'html': {
          const raw = t.raw.trim();
          if (/^<pre[\s>]/i.test(raw)) {
            const code = decodeEntities(raw.replace(/<[^>]+>/g, '')).replace(/^\n+|\s+$/g, '');
            out.push({ type: 'code', lang: 'text', code });
            break;
          }
          // Any other block HTML: keep the text, if any, as a paragraph.
          const inner = marked.lexer(raw.replace(/<\/?(div|section|figure|span|a|p)[^>]*>/gi, ''), { gfm: true });
          const textOnly = inner.filter((x) => x.type !== 'html' && x.type !== 'space');
          if (textOnly.length) out.push(...convertTokens(textOnly));
          else {
            const txt = decodeEntities(raw.replace(/<[^>]+>/g, '')).trim();
            if (txt) out.push({ type: 'p', text: [{ k: 't', v: txt.replace(/\s+/g, ' ') }] });
          }
          break;
        }
        default:
          if (t.tokens) out.push(...convertTokens(t.tokens));
      }
    }
    return out;
  };

  let blocks = convertTokens(tokens);
  // fold <section class="note"> markers into note blocks
  const fold = (list) => {
    const res = [];
    const stack = [res];
    for (const b of list) {
      if (b.type === '_noteopen') {
        const n = { type: 'note', kind: 'note', blocks: [] };
        stack[stack.length - 1].push(n);
        stack.push(n.blocks);
      } else if (b.type === '_noteclose') {
        if (stack.length > 1) stack.pop();
      } else stack[stack.length - 1].push(b);
    }
    return res;
  };
  blocks = fold(blocks);
  return blocks;
}

const stripPrivate = (blocks) =>
  blocks.map((b) => {
    const { _depth, ...rest } = b;
    if (rest.blocks) rest.blocks = stripPrivate(rest.blocks);
    return rest;
  });

/** Apply `fn` to text outside fenced code blocks. */
function mapOutsideFences(md, fn) {
  const lines = md.split('\n');
  const out = [];
  let buf = [];
  let fence = null;
  const flush = () => {
    if (buf.length) out.push(fn(buf.join('\n')));
    buf = [];
  };
  for (const line of lines) {
    const m = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      out.push(line);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && line.trim() === m[1]) fence = null;
    } else if (m) {
      flush();
      fence = m[1];
      out.push(line);
    } else buf.push(line);
  }
  flush();
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Book
// ---------------------------------------------------------------------------

const BOOK_SRC = path.join(BOOK, 'src');
const bookCommit = gitHead(BOOK);

function parseSummary() {
  const lines = read(path.join(BOOK_SRC, 'SUMMARY.md')).split('\n');
  const chapters = [];
  for (const line of lines) {
    const m = line.match(/^(\s*)- \[(.+)\]\((.+\.md)\)\s*$/);
    if (!m) continue;
    const [, indent, title, file] = m;
    if (indent.length === 0) chapters.push({ title, file, sections: [] });
    else chapters[chapters.length - 1].sections.push({ title, file });
  }
  return chapters.map((c) => {
    const isApp = c.file.startsWith('appendix');
    const n = isApp ? 'A' : parseInt(c.file.match(/^ch(\d+)/)[1], 10);
    return {
      n,
      title: c.title,
      file: c.file,
      sections: c.sections.map((s, i) => ({ id: `${n}.${i + 1}`, title: s.title, file: s.file })),
    };
  });
}

const summary = parseSummary();
const fileToId = new Map();
for (const c of summary) {
  fileToId.set(c.file, String(c.n));
  for (const s of c.sections) fileToId.set(s.file, s.id);
}

// Old chapter file names (pre-renumbering) -> current ones, from book.toml's redirect table.
const BOOK_REDIRECTS = (() => {
  const t = parseToml(read(path.join(BOOK, 'book.toml')));
  return t.output?.html?.redirect ?? {};
})();

/** "https://doc.rust-lang.org/book/ch04-02-x.html#y" (or a bare file name) -> "book:4.2#y". */
function bookUrlToId(href) {
  const m = href.match(/^(?:https?:\/\/doc\.rust-lang\.org\/(?:stable\/|beta\/|nightly\/)?book\/)?((?:ch\d\d|appendix)-[\w-]+)\.html(#.*)?$/);
  if (!m) return null;
  let html = `${m[1]}.html`;
  html = BOOK_REDIRECTS[html] ?? html;
  const md = html.replace(/\.html$/, '.md');
  return fileToId.has(md) ? `book:${fileToId.get(md)}${m[2] ?? ''}` : null;
}

function bookLinkMapper(href) {
  if (!href) return href;
  const asBook = bookUrlToId(href);
  if (asBook) return asBook;
  if (/^[a-z]+:/i.test(href) || href.startsWith('#')) return href;
  const [p, hash] = href.split('#');
  const base = path.basename(p);
  const md = base.replace(/\.html$/, '.md');
  if (fileToId.has(md)) return `book:${fileToId.get(md)}${hash ? '#' + hash : ''}`;
  // relative links to the std docs etc. shipped with rustup
  if (p.startsWith('../')) return 'https://doc.rust-lang.org/' + p.replace(/^(\.\.\/)+/, '') + (hash ? '#' + hash : '');
  return 'https://doc.rust-lang.org/book/' + href;
}

/** Read an mdBook include target with an optional `:anchor` or `:a:b` line range. */
function readIncludeLines(spec, baseDir) {
  const m = spec.match(/^([^:]+)(?::(.*))?$/);
  const file = path.resolve(baseDir, m[1].trim());
  const sel = m[2]?.trim();
  const lines = read(file).replace(/\n$/, '').split('\n');
  const isMarker = (l) => /ANCHOR(_END)?:\s*[\w-]+/.test(l);
  let inRange = lines.map(() => true);
  if (sel !== undefined && sel !== '') {
    const range = sel.match(/^(\d*)(?::(\d*))?$/);
    if (range) {
      const a = range[1] ? parseInt(range[1], 10) : 1;
      let b;
      if (range[2] === undefined) b = range[1] ? a : lines.length; // ":N" = single line
      else b = range[2] ? parseInt(range[2], 10) : lines.length;
      inRange = lines.map((_, i) => i + 1 >= a && i + 1 <= b);
    } else {
      let on = false;
      inRange = lines.map((l) => {
        const s = l.match(/ANCHOR:\s*([\w-]+)/);
        const e = l.match(/ANCHOR_END:\s*([\w-]+)/);
        if (s && s[1] === sel) {
          on = true;
          return false;
        }
        if (e && e[1] === sel) {
          on = false;
          return false;
        }
        return on;
      });
    }
  }
  return { file, lines, inRange, isMarker };
}

/**
 * Resolve {{#include}} / {{#rustdoc_include}} and tag fences with @dir=<listing dir> so the
 * code-block hook can find output.txt.
 */
function resolveIncludes(md, baseDir) {
  const lines = md.split('\n');
  const out = [];
  let fenceStart = -1;
  let fenceDir = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fm = line.match(/^(\s*)(`{3,})(.*)$/);
    if (fm) {
      if (fenceStart < 0) {
        fenceStart = out.length;
        fenceDir = null;
        out.push(line);
      } else {
        if (fenceDir) out[fenceStart] = out[fenceStart] + `,@dir=${fenceDir}`;
        fenceStart = -1;
        out.push(line);
      }
      continue;
    }
    const im = line.match(/\{\{#(rustdoc_include|include)\s+([^}]+?)\s*\}\}/);
    if (!im) {
      out.push(line);
      continue;
    }
    const [whole, kind, spec] = im;
    const { file, lines: flines, inRange, isMarker } = readIncludeLines(spec, baseDir);
    let included;
    if (kind === 'rustdoc_include') {
      included = flines
        .map((l, j) => (isMarker(l) ? null : inRange[j] ? l : l === '' ? '#' : '# ' + l))
        .filter((l) => l !== null);
    } else {
      included = flines.filter((l, j) => inRange[j] && !isMarker(l));
    }
    // listing dir = directory containing Cargo.toml above the included file
    if (fenceStart >= 0) {
      let d = path.dirname(file);
      while (d.startsWith(BOOK) && d !== BOOK && !exists(path.join(d, 'Cargo.toml')) && !exists(path.join(d, 'output.txt'))) d = path.dirname(d);
      if (d.startsWith(path.join(BOOK, 'listings')) && !file.endsWith('output.txt')) fenceDir = path.relative(BOOK, d);
    }
    const prefix = line.slice(0, line.indexOf(whole));
    const suffix = line.slice(line.indexOf(whole) + whole.length);
    const joined = included.join('\n');
    out.push(prefix + joined + suffix);
  }
  return out.join('\n');
}

function parseAttrs(s) {
  const attrs = {};
  const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(s))) attrs[m[1]] = m[2] ?? m[3];
  return attrs;
}

/** Replace mdBook/HTML-only markup with placeholders the block converter understands. */
function preprocessBookMarkdown(md) {
  return mapOutsideFences(md, (text) => {
    let t = text.replace(/<!--[\s\S]*?-->/g, '');
    t = t.replace(/<Listing((?:\s+[\w-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*>/g, (_, a) => {
      const at = parseAttrs(a);
      return `\n\n%%LISTING ${b64({ number: at.number ?? null, fileName: at['file-name'] ?? null, caption: at.caption ?? null })}%%\n\n`;
    });
    t = t.replace(/<\/Listing>/g, '\n\n%%ENDLISTING%%\n\n');
    t = t.replace(/<span class="filename">\s*(?:Filename:\s*)?([\s\S]*?)<\/span>/g, (_, f) => `\n\n%%FILE ${b64(f.trim())}%%\n\n`);
    t = t.replace(/<span class="caption">([\s\S]*?)<\/span>/g, (_, c) => `*${c.trim().replace(/\s*\n\s*/g, ' ')}*`);
    t = t.replace(/<figcaption>([\s\S]*?)<\/figcaption>/g, (_, c) => `\n\n*${c.trim().replace(/\s*\n\s*/g, ' ')}*\n\n`);
    t = t.replace(/<\/?figure>/g, '\n');
    t = t.replace(/<img\b([\s\S]*?)\/?>/g, (_, a) => {
      const at = parseAttrs(a);
      return `\n\n%%IMG ${b64({ alt: (at.alt ?? '').replace(/\s*\n\s*/g, ' '), src: path.basename(at.src ?? '') })}%%\n\n`;
    });
    t = t.replace(/<section class="note"[^>]*>/g, '\n\n%%NOTE%%\n\n');
    t = t.replace(/<\/section>/g, '\n\n%%ENDNOTE%%\n\n');
    t = t.replace(/<a id="[^"]*"><\/a>/g, '');
    t = t.replace(/<span id="[^"]*"><\/span>/g, '');
    return t;
  });
}

const usedImages = new Set();

function computeReading(blocks) {
  let words = 0;
  let listings = 0;
  const walk = (bs) => {
    for (const b of bs) {
      switch (b.type) {
        case 'p':
        case 'h2':
        case 'h3':
        case 'h4':
          words += wordCount(inlineText(b.text));
          break;
        case 'ul':
        case 'ol':
          for (const it of b.items) words += wordCount(inlineText(it));
          break;
        case 'table':
          for (const c of b.head) words += wordCount(inlineText(c));
          for (const r of b.rows) for (const c of r) words += wordCount(inlineText(c));
          break;
        case 'note':
        case 'quote':
          walk(b.blocks);
          break;
        case 'code':
          if (b.lang === 'rust') listings++;
          break;
      }
    }
  };
  walk(blocks);
  const secs = (words / 230) * 60 + listings * 40;
  return { words, mins: Math.max(1, Math.ceil(secs / 60)) };
}

function buildBookPage(file) {
  const raw = read(path.join(BOOK_SRC, file));
  const withIncludes = resolveIncludes(raw, BOOK_SRC);
  const pre = preprocessBookMarkdown(withIncludes);
  const blocks = markdownToBlocks(pre, {
    linkMapper: bookLinkMapper,
    relativeHeadings: true,
    defaultLang: 'text',
    onImage: (src) => usedImages.add(src),
    onCode: (b, meta) => {
      if (b.lang === 'rust' && meta.dir) {
        const out = path.join(BOOK, meta.dir, 'output.txt');
        if (exists(out)) b.output = read(out).replace(/\s+$/, '');
      }
    },
  });
  // The page title is carried by the TOC; drop the leading heading.
  if (blocks.length && /^h[234]$/.test(blocks[0].type)) blocks.shift();
  return blocks;
}

// ---------------------------------------------------------------------------
// Rustlings README map  (topic -> Book sections)
// ---------------------------------------------------------------------------

const chapterSections = (n) => summary.find((c) => String(c.n) === String(n))?.sections.map((s) => s.id) ?? [];

function parseBookRef(ref) {
  const secs = [];
  const wholeChapters = [];
  for (const partRaw of ref.split(',')) {
    const part = partRaw.trim();
    let m;
    if ((m = part.match(/^§(\d+)\.(\d+)\s*[-–]\s*(\d+)$/))) {
      for (let i = +m[2]; i <= +m[3]; i++) secs.push(`${m[1]}.${i}`);
    } else if ((m = part.match(/^§(\d+)\.(\d+)$/))) secs.push(`${m[1]}.${m[2]}`);
    else if ((m = part.match(/^§(\d+)$/))) {
      secs.push(...chapterSections(m[1]));
      wholeChapters.push(m[1]);
    } else if ((m = part.match(/^Appendix ([A-G])$/i))) secs.push(`A.${m[1].toUpperCase().charCodeAt(0) - 64}`);
  }
  const label = ref === 'n/a' ? '' : ref.replace(/(\d)-(\d)/g, '$1–$2');
  return { secs, wholeChapters, label };
}

const rustlingsMap = {};
for (const line of read(path.join(RUSTLINGS, 'exercises/README.md')).split('\n')) {
  const m = line.match(/^\|\s*([a-z_]+)\s*\|\s*([^|]+?)\s*\|$/);
  if (!m || m[1] === 'Exercise') continue;
  rustlingsMap[m[1]] = parseBookRef(m[2]);
}

// ---------------------------------------------------------------------------
// Brown quizzes
// ---------------------------------------------------------------------------
//
// Mapping rule (documented for SOURCES.md):
//  1. Each Brown chapter page embeds its quizzes with {{#quiz ../quizzes/<id>.toml}}; the quiz
//     belongs to that Brown page.
//  2. The Brown page is matched to an official page by identical file name (e.g.
//     ch18-01-what-is-oo.md, which Brown also uses for its renumbered chapters 17–20), and,
//     failing that, by identical SUMMARY title (Brown "ch04-04-slices.md" = official
//     "ch04-03-slices.md", "The Slice Type").
//  3. Brown-only pages (ch04-03 Fixing Ownership Errors, ch04-05 Ownership Recap, the
//     "Ownership Inventory" pages, ch18-05 Design Trade-offs, experiment-intro) have no
//     official counterpart and their quizzes are left out.
//  4. Inside the page, the quiz is placed at the end of the official subsection whose heading
//     text equals the nearest Brown heading above the {{#quiz}} line; otherwise at page end.

function parseBrownSummary() {
  const map = new Map();
  for (const line of read(path.join(BROWN, 'src/SUMMARY.md')).split('\n')) {
    const m = line.match(/^\s*- \[(.+)\]\((.+\.md)\)/);
    if (m) map.set(m[2], m[1]);
  }
  return map;
}

function cleanQuizMarkdown(s) {
  if (typeof s !== 'string') return s;
  // aquascope/ide fences -> rust; drop aquascope annotations and hidden `#` lines
  return s.replace(/```(aquascope[^\n]*|ide)\n([\s\S]*?)```/g, (_, info, body) => {
    const lines = body
      .split('\n')
      .filter((l) => !/^\s*#(?!\[|!\[)/.test(l))
      .map((l) => l.replace(/`\[[^`]*\]`|`\([^`]*\)`/g, '').replace(/\s+$/, ''));
    return '```rust\n' + lines.join('\n') + '```';
  });
}

function convertQuestion(q) {
  const ctx = q.context ? { context: cleanQuizMarkdown(q.context.trim()) } : {};
  if (q.type === 'MultipleChoice') {
    const ans = Array.isArray(q.answer.answer) ? q.answer.answer : [q.answer.answer];
    return {
      type: 'MultipleChoice',
      prompt: cleanQuizMarkdown(q.prompt.prompt.trim()),
      answer: ans.map((a) => cleanQuizMarkdown(String(a).trim())),
      distractors: (q.prompt.distractors ?? []).map((d) => cleanQuizMarkdown(String(d).trim())),
      ...ctx,
      ...(ans.length > 1 || q.prompt.sortAnswers === false ? (ans.length > 1 ? { multi: true } : {}) : {}),
    };
  }
  if (q.type === 'ShortAnswer') {
    return { type: 'ShortAnswer', prompt: cleanQuizMarkdown(q.prompt.prompt.trim()), answer: String(q.answer.answer).trim(), ...ctx };
  }
  if (q.type === 'Tracing') {
    const program = q.prompt.program
      .split('\n')
      .map((l) => l.replace(/`\[[^`]*\]`/g, ''))
      .join('\n')
      .replace(/^\n+|\s+$/g, '');
    const r = { type: 'Tracing', program, doesCompile: !!q.answer.doesCompile };
    if (q.answer.stdout != null) r.stdout = String(q.answer.stdout).replace(/\s+$/, '');
    if (q.answer.lineNumber != null) r.lineNumber = q.answer.lineNumber;
    return { ...r, ...ctx };
  }
  return null;
}

function buildQuizzes() {
  const brownTitles = parseBrownSummary();
  const officialByTitle = new Map();
  const officialTitleById = new Map();
  for (const c of summary) {
    officialByTitle.set(c.title, String(c.n));
    for (const s of c.sections) officialByTitle.set(s.title, s.id);
  }
  const quizzes = {};
  const placements = []; // { quizId, sectionId, heading }
  const mapping = [];
  const dropped = [];
  for (const f of fs.readdirSync(path.join(BROWN, 'src')).filter((f) => f.endsWith('.md')).sort()) {
    const lines = read(path.join(BROWN, 'src', f)).split('\n');
    let heading = null;
    for (const line of lines) {
      const h = line.match(/^#{2,4}\s+(.+?)\s*$/);
      if (h) heading = h[1];
      const q = line.match(/\{\{#quiz\s+\.\.\/quizzes\/([\w-]+)\.toml\s*\}\}/);
      if (!q) continue;
      const quizId = q[1];
      let sectionId = fileToId.get(f);
      let via = 'file name';
      if (sectionId && brownTitles.get(f) && officialByTitle.get(brownTitles.get(f)) !== sectionId) {
        // same file name but different page title -> treat as a different page
        sectionId = undefined;
      }
      if (!sectionId && brownTitles.has(f)) {
        sectionId = officialByTitle.get(brownTitles.get(f));
        via = 'title';
      }
      if (!sectionId) {
        dropped.push({ quizId, brownPage: f, title: brownTitles.get(f) ?? '' });
        continue;
      }
      const data = parseToml(read(path.join(BROWN, 'quizzes', `${quizId}.toml`)));
      const questions = (data.questions ?? []).map(convertQuestion).filter(Boolean);
      quizzes[quizId] = { id: quizId, section: sectionId, questions };
      placements.push({ quizId, sectionId, heading, brownTitle: brownTitles.get(f) ?? '' });
      mapping.push({ quizId, brownPage: f, section: sectionId, via });
    }
  }
  return { quizzes, placements, mapping, dropped };
}

function insertQuizzes(blocks, placements, pageTitle) {
  for (const p of placements) {
    const blk = { type: 'quiz', id: p.quizId };
    let idx = -1;
    if (p.heading) {
      const want = p.heading.replace(/`/g, '').trim();
      const hi = blocks.findIndex((b) => /^h[234]$/.test(b.type) && inlineText(b.text).trim() === want);
      if (hi >= 0) {
        const lvl = +blocks[hi].type[1];
        idx = blocks.length;
        for (let j = hi + 1; j < blocks.length; j++) {
          if (/^h[234]$/.test(blocks[j].type) && +blocks[j].type[1] <= lvl) {
            idx = j;
            break;
          }
        }
      } else if (want === pageTitle || want === p.brownTitle) {
        // quiz follows the page's own title heading: place it before the first subsection
        idx = blocks.findIndex((b) => /^h[234]$/.test(b.type));
        if (idx < 0) idx = blocks.length;
      }
    }
    if (idx < 0) idx = blocks.length; // heading not found: end of page
    // place after quizzes already inserted at this position
    while (idx < blocks.length && blocks[idx].type === 'quiz') idx++;
    blocks.splice(idx, 0, blk);
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Build the Book
// ---------------------------------------------------------------------------

const { quizzes, placements, mapping: quizMapping, dropped: quizDropped } = buildQuizzes();
const placementsBySection = new Map();
for (const p of placements) {
  if (!placementsBySection.has(p.sectionId)) placementsBySection.set(p.sectionId, []);
  placementsBySection.get(p.sectionId).push(p);
}

const PROJECT_OF_CHAPTER = {
  2: { name: 'guessing_game', label: 'Guessing game' },
  12: { name: 'minigrep', label: 'minigrep' },
  21: { name: 'hello', label: 'Web server' },
};

fs.rmSync(OUT_BOOK, { recursive: true, force: true });
fs.mkdirSync(OUT_BOOK, { recursive: true });

const pages = new Map(); // id -> BookSection
const tocChapters = [];
for (const c of summary) {
  const metaFor = (id, title, file) => {
    let blocks = buildBookPage(file);
    blocks = insertQuizzes(blocks, placementsBySection.get(id) ?? [], title);
    blocks = stripPrivate(blocks);
    const { words, mins } = computeReading(blocks);
    pages.set(id, { id, title, blocks });
    const rustlings = Object.entries(rustlingsMap)
      .filter(([, r]) => r.secs.includes(id) || (!id.includes('.') && r.wholeChapters.includes(id)))
      .map(([t]) => t);
    return {
      id,
      title,
      file,
      mins,
      words,
      rustlings,
      quizzes: (placementsBySection.get(id) ?? []).map((p) => p.quizId),
    };
  };
  const intro = metaFor(String(c.n), c.title, c.file);
  const sections = c.sections.map((s) => metaFor(s.id, s.title, s.file));
  const ch = { n: c.n, title: c.title, intro, sections };
  if (PROJECT_OF_CHAPTER[c.n]) ch.project = PROJECT_OF_CHAPTER[c.n];
  tocChapters.push(ch);
}

const bookToml = read(path.join(BOOK, 'book.toml'));
const edition = (bookToml.match(/\[rust\][^[]*edition\s*=\s*"(\d+)"/) || [, '2024'])[1];
const toc = {
  edition: `Rust ${edition}`,
  rustVersion: read(path.join(BOOK, 'rust-toolchain')).trim().replace(/^channel\s*=\s*"?|"$/g, ''),
  sourceCommit: bookCommit,
  chapters: tocChapters,
  sectionCount: tocChapters.filter((c) => c.n !== 'A').reduce((n, c) => n + c.sections.length, 0),
};

for (const [id, page] of pages) writeJson(path.join(OUT_BOOK, `${id}.json`), page);
writeJson(path.join(OUT, 'book-toc.json'), toc);

// lazy loader map for Metro
{
  const ids = [...pages.keys()];
  const lines = [
    '// GENERATED by scripts/build-content.mjs — do not edit.',
    "import type { BookSection } from '../../types';",
    '',
    '/** Static requires so Metro can bundle every page while loading each lazily. */',
    'export const bookPages: Record<string, () => BookSection> = {',
    ...ids.map((id) => `  '${id}': () => require('./${id}.json'),`),
    '};',
    '',
  ];
  fs.writeFileSync(path.join(OUT_BOOK, 'index.ts'), lines.join('\n'));
}

// images
fs.rmSync(OUT_IMG, { recursive: true, force: true });
fs.mkdirSync(OUT_IMG, { recursive: true });
for (const img of usedImages) {
  const p = path.join(BOOK_SRC, 'img', img);
  if (exists(p)) fs.copyFileSync(p, path.join(OUT_IMG, img));
  else console.warn(`warning: missing image ${img}`);
}
// every SVG diagram, even if no page references it (spec: copy src/img/*.svg)
for (const f of fs.readdirSync(path.join(BOOK_SRC, 'img'))) {
  if (f.endsWith('.svg')) fs.copyFileSync(path.join(BOOK_SRC, 'img', f), path.join(OUT_IMG, f));
}
writeJson(path.join(OUT, 'quizzes.json'), quizzes);

// ---------------------------------------------------------------------------
// Rustlings
// ---------------------------------------------------------------------------

function buildRustlings() {
  const info = parseToml(read(path.join(RUSTLINGS, 'rustlings-macros/info.toml')));
  const cargo = read(path.join(RUSTLINGS, 'Cargo.toml'));
  const version = (cargo.match(/^\s*version\s*=\s*"([^"]+)"/m) || [, ''])[1];
  const list = info.exercises;
  const topicOfDir = (dir) => (dir === 'quizzes' ? 'quizzes' : dir.replace(/^\d+_/, ''));

  // topic sizes
  const byDir = new Map();
  for (const e of list) {
    if (!byDir.has(e.dir)) byDir.set(e.dir, []);
    byDir.get(e.dir).push(e.name);
  }

  const summaryOf = (code) => {
    const lines = code.split('\n');
    let i = lines.findIndex((l) => /^\s*\/\/\s*TODO:?/.test(l));
    if (i < 0) i = lines.findIndex((l) => /^\s*\/\/\s*\S/.test(l) && !/^\s*\/\/\s*(This is a quiz|-)/.test(l));
    if (i < 0) return '';
    const parts = [];
    for (let j = i; j < lines.length && /^\s*\/\//.test(lines[j]); j++) {
      const t = lines[j].replace(/^\s*\/\/\s?/, '').trim();
      if (!t) break;
      parts.push(t);
    }
    let s = parts.join(' ').replace(/^TODO:?\s*/, '');
    const m = s.match(/^(.+?[.!?])(\s|$)/);
    if (m) s = m[1];
    return s.length > 160 ? s.slice(0, 157).replace(/\s+\S*$/, '') + '…' : s;
  };

  const exercises = {};
  const order = [];
  const path_ = [];
  let topicsSinceQuiz = [];
  let pos = 0;
  let lastDir = null;
  for (const e of list) {
    pos++;
    const dir = e.dir;
    const topic = topicOfDir(dir);
    const names = byDir.get(dir);
    const index = names.indexOf(e.name) + 1;
    const of = names.length;
    const rel = `exercises/${dir}/${e.name}.rs`;
    const code = read(path.join(RUSTLINGS, rel));
    const solPath = path.join(RUSTLINGS, 'solutions', dir, `${e.name}.rs`);
    const solution = exists(solPath) ? read(solPath) : '';
    // XP rule: intro exercises 10; quizzes 100; otherwise 40 ("Easy"), raised to 50
    // ("Medium") for the last exercise of a topic or any exercise whose index in its topic is >= 4.
    let xp;
    let difficulty;
    if (dir === 'quizzes') {
      xp = 100;
      difficulty = 'Quiz';
    } else if (topic === 'intro') {
      xp = 10;
      difficulty = 'Easy';
    } else if (index === of || index >= 4) {
      xp = 50;
      difficulty = 'Medium';
    } else {
      xp = 40;
      difficulty = 'Easy';
    }
    exercises[e.name] = {
      name: e.name,
      dir,
      path: rel,
      topic,
      index,
      of,
      pos,
      test: e.test ?? true,
      strictClippy: e.strict_clippy ?? false,
      skipCheckUnsolved: e.skip_check_unsolved ?? false,
      hint: e.hint ?? '',
      code,
      solution,
      summary: summaryOf(code),
      xp,
      difficulty,
    };
    order.push(e.name);

    if (dir === 'quizzes') {
      path_.push({ t: 'quiz', name: e.name, covers: topicsSinceQuiz.join(', '), exercise: e.name });
      topicsSinceQuiz = [];
      lastDir = dir;
      continue;
    }
    if (dir !== lastDir) {
      const readmeP = path.join(RUSTLINGS, 'exercises', dir, 'README.md');
      const map = rustlingsMap[topic];
      path_.push({
        t: 'topic',
        dir,
        name: topic,
        num: dir.split('_')[0],
        book: map ? map.label : '',
        secs: map ? map.secs : [],
        exercises: names,
        description: exists(readmeP) ? topicDescription(read(readmeP)) : '',
      });
      if (topic !== 'intro') topicsSinceQuiz.push(topic);
    }
    lastDir = dir;
  }

  // Cargo.toml exactly as `rustlings init` writes it: dev-Cargo.toml minus its first comment
  // line, with the `bin` list regenerated with paths relative to the crate root (prefix "").
  const dev = read(path.join(RUSTLINGS, 'dev-Cargo.toml'));
  const devBody = dev.slice(dev.indexOf('\n') + 1);
  const start = devBody.indexOf('bin = [') + 7;
  const end = start + devBody.slice(start).indexOf(']');
  let bins = '\n';
  for (const e of list) {
    bins += `  { name = "${e.name}", path = "exercises/${e.dir}/${e.name}.rs" },\n`;
    if (exists(path.join(RUSTLINGS, 'solutions', e.dir, `${e.name}.rs`)))
      bins += `  { name = "${e.name}_sol", path = "solutions/${e.dir}/${e.name}.rs" },\n`;
  }
  const cargoToml = devBody.slice(0, start) + bins + devBody.slice(end);
  const files = {};
  for (const e of list) {
    for (const f of e.input_files ?? []) {
      const p = path.join(RUSTLINGS, 'exercises', e.dir, f);
      if (exists(p)) files[`exercises/${e.dir}/${f}`] = read(p);
    }
  }
  // Rustlings also writes these at init; harmless and keeps rust-analyzer/clippy config identical.
  const clippy = path.join(RUSTLINGS, 'clippy.toml');
  if (exists(clippy)) files['clippy.toml'] = read(clippy);

  return {
    version,
    sourceCommit: gitHead(RUSTLINGS),
    total: order.length,
    exercises,
    order,
    path: path_,
    crate: { cargoToml, files },
  };
}

function topicDescription(readme) {
  const blocks = marked.lexer(readme);
  const p = blocks.find((b) => b.type === 'paragraph');
  if (!p) return '';
  const inl = makeInlineConverter((h) => h)(p.tokens);
  const text = inl
    .map((n) => (n.k === 'code' ? '`' + n.v + '`' : n.k === 't' ? n.v : inlineText(n.c)))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  const m = text.match(/^(.+?[.!?])(\s|$)/);
  return m ? m[1] : text;
}

const rustlings = buildRustlings();
writeJson(path.join(OUT, 'rustlings.json'), rustlings);

// ---------------------------------------------------------------------------
// rustc error index
// ---------------------------------------------------------------------------

// Hand-mapped Book sections for the errors learners hit most. E0597 ("does not live long
// enough") appears in both 4.2 and 10.3; it is mapped to 10.3, where the Book explains it with
// lifetimes (Listing 10-16). E0382 (use of moved value) goes to 4.1, where moves are taught.
const ERROR_SECTIONS = {
  E0382: '4.1',
  E0499: '4.2',
  E0502: '4.2',
  E0505: '4.2',
  E0506: '4.2',
  E0596: '4.2',
  E0716: '4.2',
  E0106: '10.3',
  E0597: '10.3',
  E0308: '3.2',
  E0425: '7.4',
  E0433: '7.4',
  E0277: '10.2',
  E0599: '5.3',
  E0384: '3.1',
  E0004: '6.2',
  E0063: '5.1',
  E0614: '15.2',
};
// rustc's primary message for those codes (the error docs don't carry compiler output).
const RUSTC_MESSAGES = {
  E0004: 'non-exhaustive patterns',
  E0063: 'missing field in initializer',
  E0106: 'missing lifetime specifier',
  E0277: 'the trait bound is not satisfied',
  E0308: 'mismatched types',
  E0382: 'use of moved value',
  E0384: 'cannot assign twice to immutable variable',
  E0425: 'cannot find value in this scope',
  E0433: 'failed to resolve: use of undeclared crate, module or type',
  E0499: 'cannot borrow as mutable more than once at a time',
  E0502: 'cannot borrow as mutable because it is also borrowed as immutable',
  E0505: 'cannot move out of value because it is borrowed',
  E0506: 'cannot assign to value because it is borrowed',
  E0596: 'cannot borrow as mutable, as it is not declared as mutable',
  E0597: 'borrowed value does not live long enough',
  E0599: 'no method found for this type',
  E0614: 'type cannot be dereferenced',
  E0716: 'temporary value dropped while borrowed',
};

function errorLinkMapper(href) {
  if (!href) return href;
  const asBook = bookUrlToId(href);
  if (asBook) return asBook;
  if (/^[a-z]+:/i.test(href) || href.startsWith('#')) return href;
  const m = href.match(/^(?:\.\.\/)*(?:error_codes\/|error-index\.html#)?(E\d{4})(?:\.md|\.html)?$/);
  if (m) return `error:${m[1]}`;
  return 'https://doc.rust-lang.org/' + href.replace(/^(\.\.\/)+/, '');
}

/** Keep titles short: cut long first sentences at a clause boundary. */
function shortTitle(t) {
  if (t.length <= 90) return t;
  const cut = t.slice(40).search(/,\s|;\s|\s(?:as|because|since|when|which|but)\s|\s\(/);
  if (cut >= 0 && cut + 40 <= 100) return t.slice(0, cut + 40).trim();
  return t.slice(0, 90).replace(/\s+\S*$/, '') + '…';
}

function buildErrors() {
  const errors = {};
  const files = fs.readdirSync(ERROR_DIR).filter((f) => /^E\d{4}\.md$/.test(f)).sort();
  for (const f of files) {
    const code = f.slice(0, 5);
    let md = read(path.join(ERROR_DIR, f));
    const removed = /no longer emitted|is no longer (an error|used)|has been removed/i.test(md.split('\n').slice(0, 3).join('\n'));
    md = md.replace(/^#### Note: this error code is no longer emitted by the compiler\.?[ \t]*(\n|$)/m, '');
    const internal = /^#### This error code is internal to the compiler/m.test(md);
    md = md.replace(/^#### This error code is internal to the compiler.*(\n|$)/m, '');
    md = md.replace(/<!--[\s\S]*?-->/g, '');
    // reference-style links to other codes, e.g. [E0123]: ./E0123.md
    const blocks = stripPrivate(markdownToBlocks(md, { linkMapper: errorLinkMapper, defaultLang: 'rust' }));
    const firstP = blocks.find((b) => b.type === 'p');
    let title = '';
    if (firstP) {
      const text = inlineText(firstP.text).replace(/\s+/g, ' ').trim();
      const m = text.match(/^(.+?[.!?])(\s|$)/);
      title = shortTitle((m ? m[1] : text).replace(/[.:]$/, ''));
      if (/^[A-Z]([a-z]|\s)/.test(title)) title = title[0].toLowerCase() + title.slice(1);
    }
    if (!title) title = internal ? 'internal compiler error code' : removed ? 'no longer emitted by the compiler' : code;
    if (RUSTC_MESSAGES[code]) title = RUSTC_MESSAGES[code];
    const doc = { code, title, blocks };
    if (ERROR_SECTIONS[code]) doc.section = ERROR_SECTIONS[code];
    if (removed) doc.removed = true;
    errors[code] = doc;
  }
  return errors;
}

const errors = buildErrors();
writeJson(path.join(OUT, 'errors.json'), errors);

// ---------------------------------------------------------------------------
// Book projects
// ---------------------------------------------------------------------------

const TEACHES = {
  // guessing_game (chapter 2 H2s)
  'Setting Up a New Project': 'cargo new guessing_game',
  'Processing a Guess': 'Read input with io::stdin',
  'Generating a Secret Number': 'Add the rand crate',
  'Comparing the Guess to the Secret Number': 'match on Ordering',
  'Allowing Multiple Guesses with Looping': 'loop, continue and break',
  // minigrep (chapter 12 sections)
  'Accepting Command Line Arguments': 'Read arguments with env::args',
  'Reading a File': 'Load a file with fs::read_to_string',
  'Refactoring to Improve Modularity and Error Handling': 'Split into lib.rs and return Result',
  'Adding Functionality with Test Driven Development': 'Write a failing test, then search',
  'Adding Functionality with Test-Driven Development': 'Write a failing test, then search',
  'Working with Environment Variables': 'Case-insensitive search via env::var',
  'Redirecting Errors to Standard Error': 'Print errors with eprintln!',
  // hello (chapter 21 sections)
  'Building a Single-Threaded Web Server': 'TcpListener, requests and responses',
  'From Single-Threaded to Multithreaded Server': 'Build a ThreadPool with channels',
  'From a Single-Threaded to a Multithreaded Server': 'Build a ThreadPool with channels',
  'Graceful Shutdown and Cleanup': 'Implement Drop and join the workers',
};

function lastListingDir(chapterN) {
  const ch = summary.find((c) => c.n === chapterN);
  const files = [ch.file, ...ch.sections.map((s) => s.file)];
  let last = null;
  for (const f of files) {
    const re = /\{\{#(?:rustdoc_include|include)\s+\.\.\/(listings\/[^/]+\/[^/:}]+)\//g;
    let m;
    const src = read(path.join(BOOK_SRC, f));
    while ((m = re.exec(src))) if (exists(path.join(BOOK, m[1], 'Cargo.toml'))) last = m[1];
  }
  return last;
}

function projectFiles(dir) {
  const files = {};
  const abs = path.join(BOOK, dir);
  files['Cargo.toml'] = read(path.join(abs, 'Cargo.toml'));
  const walk = (d, rel) => {
    for (const f of fs.readdirSync(d).sort()) {
      const p = path.join(d, f);
      const r = rel ? `${rel}/${f}` : f;
      if (fs.statSync(p).isDirectory()) {
        if (f !== 'target') walk(p, r);
      } else if (r.startsWith('src/') && f.endsWith('.rs')) files[r] = read(p);
      else if (!rel && /\.(txt|html)$/.test(f) && f !== 'output.txt') files[r] = read(p); // poem.txt, hello.html, 404.html
    }
  };
  walk(abs, '');
  return files;
}

function buildProjects() {
  const defs = [
    {
      name: 'guessing_game',
      chapter: 2,
      description: 'A command-line game. The program picks a number from 1 to 100 and you guess until you get it.',
    },
    {
      name: 'minigrep',
      chapter: 12,
      description:
        'A small version of the grep tool. You give it a word and a file, and it prints every line of the file that contains the word.',
      prerequisite: 'Uses modules, collections, error handling, traits and tests from chapters 7 to 11.',
    },
    {
      name: 'hello',
      chapter: 21,
      description:
        'A small web server. It answers browser requests with an HTML page and uses a pool of threads so it can handle several requests at once.',
      prerequisite: 'Uses closures, smart pointers, threads, channels and trait objects from chapters 13 to 18.',
    },
  ];
  return defs.map((d) => {
    const ch = summary.find((c) => c.n === d.chapter);
    let steps;
    if (ch.sections.length === 0) {
      const blocks = pages.get(String(d.chapter)).blocks;
      steps = blocks
        .filter((b) => b.type === 'h2' && inlineText(b.text) !== 'Summary')
        .map((b) => ({ title: inlineText(b.text), teaches: TEACHES[inlineText(b.text)] ?? '', section: String(d.chapter), anchor: b.anchor }));
    } else {
      steps = ch.sections.map((s) => ({ title: s.title, teaches: TEACHES[s.title] ?? '', section: s.id }));
    }
    for (const s of steps) if (!s.teaches) console.warn(`warning: no "teaches" line for project step "${s.title}"`);
    const dir = lastListingDir(d.chapter);
    const files = projectFiles(dir);
    const deps = (files['Cargo.toml'].split('[dependencies]')[1] || '')
      .split('\n')
      .map((l) => l.match(/^([A-Za-z0-9_-]+)\s*=/)?.[1])
      .filter(Boolean);
    return {
      name: d.name,
      chapter: d.chapter,
      title: ch.title,
      description: d.description,
      ...(d.prerequisite ? { prerequisite: d.prerequisite } : {}),
      steps,
      files,
      crates: deps,
      sourceDir: dir,
    };
  });
}

const projects = buildProjects();
writeJson(path.join(OUT, 'projects.json'), projects);

// ---------------------------------------------------------------------------
// Search index
// ---------------------------------------------------------------------------

function buildSearch() {
  const entries = [];
  for (const c of tocChapters) {
    const chLabel = c.n === 'A' ? 'Appendix' : `Chapter ${c.n}`;
    const headingsOf = (id) =>
      pages
        .get(id)
        .blocks.filter((b) => b.type === 'h2' || b.type === 'h3')
        .map((b) => inlineText(b.text))
        .join(' · ');
    entries.push({ kind: 'book', id: c.intro.id, title: c.title, subtitle: chLabel, terms: headingsOf(c.intro.id) || undefined });
    for (const s of c.sections) {
      entries.push({ kind: 'book', id: s.id, title: s.title, subtitle: `§${s.id} · ${c.title}`, terms: headingsOf(s.id) || undefined });
    }
  }
  for (const name of rustlings.order) {
    const e = rustlings.exercises[name];
    const subtitle = e.topic === 'quizzes' ? `Rustlings · quiz ${e.index} of ${e.of}` : `Rustlings · ${e.topic} ${e.index} of ${e.of}`;
    entries.push({ kind: 'rustlings', id: name, title: name, subtitle, terms: e.summary || undefined });
  }
  for (const code of Object.keys(errors)) {
    entries.push({ kind: 'error', id: code, title: code, subtitle: errors[code].title });
  }
  return entries.map((e) => (e.terms === undefined ? (({ terms, ...r }) => r)(e) : e));
}

const searchIndex = buildSearch();
writeJson(path.join(OUT, 'search.json'), searchIndex);

// ---------------------------------------------------------------------------
// Licenses + SOURCES.md
// ---------------------------------------------------------------------------

fs.rmSync(OUT_LIC, { recursive: true, force: true });
fs.mkdirSync(OUT_LIC, { recursive: true });
const SOURCES = [
  { key: 'book', name: 'The Rust Programming Language', dir: BOOK, license: 'MIT OR Apache-2.0', files: ['LICENSE-MIT', 'LICENSE-APACHE', 'COPYRIGHT'] },
  { key: 'rustlings', name: 'Rustlings', dir: RUSTLINGS, license: 'MIT', files: ['LICENSE'] },
  { key: 'brown', name: 'Rust Book, Brown University interactive edition (quizzes)', dir: BROWN, license: 'MIT OR Apache-2.0', files: ['LICENSE-MIT', 'LICENSE-APACHE', 'COPYRIGHT'] },
  { key: 'rustc', name: 'rustc error code index (rust-lang/rust)', dir: RUSTC, license: 'MIT OR Apache-2.0', files: ['LICENSE-MIT', 'LICENSE-APACHE', 'COPYRIGHT'] },
];
const licenseJson = [];
for (const s of SOURCES) {
  s.commit = gitHead(s.dir);
  s.remote = gitRemote(s.dir).replace(/\.git$/, '');
  s.copied = [];
  for (const f of s.files) {
    const p = path.join(s.dir, f);
    if (!exists(p)) continue;
    const outName = `${s.key}-${f}.txt`;
    fs.copyFileSync(p, path.join(OUT_LIC, outName));
    s.copied.push(outName);
    licenseJson.push({ source: s.key, name: s.name, license: s.license, file: f, text: read(p) });
  }
}
writeJson(path.join(OUT, 'licenses.json'), licenseJson);

const generated = new Date().toISOString().slice(0, 10);
const sourcesMd = [
  '# Content sources',
  '',
  `Generated ${generated} by \`scripts/build-content.mjs\` (\`npm run content\`). Re-fetch the`,
  'sources with `scripts/fetch-content-sources.sh <dir>` and run with `OXIDE_SRC=<dir>`.',
  '',
  '| Source | Repository | Commit | License | License files |',
  '| --- | --- | --- | --- | --- |',
  ...SOURCES.map((s) => `| ${s.name} | ${s.remote} | \`${s.commit}\` | ${s.license} | ${s.copied.map((f) => `licenses/${f}`).join(', ')} |`),
  '',
  'Only `compiler/rustc_error_codes/src/error_codes/E*.md` is used from rust-lang/rust.',
  '',
  '## What was generated',
  '',
  `- Book: ${tocChapters.length} chapters (21 + Appendix), ${toc.sectionCount} numbered sections in chapters 1–21` +
    ` (+${tocChapters.find((c) => c.n === 'A').sections.length} appendix sections), ${pages.size} pages (\`book/<id>.json\`).`,
  `- Rustlings ${rustlings.version}: ${rustlings.total} exercises including ${rustlings.order.filter((n) => rustlings.exercises[n].topic === 'quizzes').length} quizzes.`,
  `- Brown quizzes: ${Object.keys(quizzes).length} mapped onto official sections, ${quizDropped.length} left out.`,
  `- Error index: ${Object.keys(errors).length} codes (${Object.values(errors).filter((e) => e.removed).length} no longer emitted).`,
  '',
  '## Conventions',
  '',
  '- Internal Book links are rewritten to `book:<sectionId>[#anchor]`, error-index cross links to',
  '  `error:EXXXX`; relative links to the std docs become `https://doc.rust-lang.org/...`.',
  '- `code` blocks: `runnable` is only present when it differs from `code` (hidden `# ` lines, or',
  '  a snippet without `fn main` that rustdoc would wrap). Use `runnable ?? code` to run.',
  '- `ol` blocks may carry an optional `start` number when a list is split around a code block.',
  '- Book images are copied to `assets/book/` and referenced by file name in `img.src`.',
  '- Rustlings XP: intro 10; quizzes 100; otherwise 40 (Easy), or 50 (Medium) for the last',
  '  exercise of a topic or any exercise whose index within its topic is 4 or more.',
  '',
  '## Brown quiz → official section mapping',
  '',
  'Brown pages are matched to official pages by identical file name, else by identical SUMMARY',
  'title (Brown renumbered chapter 4 and kept old quiz file names such as `ch17-01-what-is-oo` for',
  'what is now chapter 18; the page that embeds the quiz decides). A quiz is placed at the end of',
  'the subsection whose heading matches the nearest heading above it on the Brown page, otherwise at',
  'the end of the page. Brown-only pages have no official counterpart and their quizzes are dropped.',
  '',
  '| Quiz | Brown page | Official section | Matched by |',
  '| --- | --- | --- | --- |',
  ...quizMapping.map((m) => `| ${m.quizId} | ${m.brownPage} | ${m.section} | ${m.via} |`),
  '',
  'Dropped:',
  '',
  ...quizDropped.map((d) => `- ${d.quizId} (${d.brownPage}${d.title ? `, “${d.title}”` : ''})`),
  '',
];
fs.writeFileSync(path.join(OUT, 'SOURCES.md'), sourcesMd.join('\n'));

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function dirSize(d) {
  let n = 0;
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    n += st.isDirectory() ? dirSize(p) : st.size;
  }
  return n;
}
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
console.log('Oxide content built');
console.log(`  chapters:        ${tocChapters.length} (${tocChapters.filter((c) => c.n !== 'A').length} + Appendix)`);
console.log(`  sections:        ${toc.sectionCount} numbered (+${tocChapters.find((c) => c.n === 'A').sections.length} appendix), ${pages.size} pages`);
console.log(`  rustlings:       ${rustlings.total} exercises (${rustlings.path.filter((p) => p.t === 'topic').length} topics, ${rustlings.path.filter((p) => p.t === 'quiz').length} quizzes)`);
console.log(`  brown quizzes:   ${Object.keys(quizzes).length} mapped, ${quizDropped.length} dropped, ${Object.values(quizzes).reduce((n, q) => n + q.questions.length, 0)} questions`);
console.log(`  error codes:     ${Object.keys(errors).length} (${Object.values(errors).filter((e) => e.removed).length} removed)`);
console.log(`  projects:        ${projects.map((p) => `${p.name} (${Object.keys(p.files).length} files from ${p.sourceDir})`).join(', ')}`);
console.log(`  search entries:  ${searchIndex.length}`);
console.log(`  images:          ${fs.readdirSync(OUT_IMG).length} in assets/book (${mb(dirSize(OUT_IMG))})`);
console.log(`  data size:       ${mb(dirSize(OUT))} (book pages ${mb(dirSize(OUT_BOOK))})`);
