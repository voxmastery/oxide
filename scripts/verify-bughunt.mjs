// Checks every Daily Bug Hunt puzzle with a local rustc (Rust 2024): the buggy program compiles and
// prints `actual` (or panics with `panic`), the fix prints `output`, and no wrong option does.
// Run: node --experimental-strip-types scripts/verify-bughunt.mjs
import { PUZZLES } from '../src/features/bughunt/puzzles.ts';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
const dir = `${tmpdir()}/oxide-bughunt-check/`; mkdirSync(dir, { recursive: true });
const toc = JSON.parse(readFileSync(new URL('../src/content/data/book-toc.json', import.meta.url), 'utf8'));
const sections = new Set(toc.chapters.flatMap((c) => [c.intro.id, ...c.sections.map((s) => s.id)]));
function run(name, code) {
  const src = `${dir}${name}.rs`, bin = `${dir}${name}`;
  writeFileSync(src, code + '\n');
  const c = spawnSync('rustc', ['--edition', '2024', '-A', 'warnings', src, '-o', bin], { encoding: 'utf8' });
  if (c.status !== 0) return { compiled: false, err: c.stderr.split('\n')[0] };
  const r = spawnSync(bin, [], { encoding: 'utf8', timeout: 5000 });
  return { compiled: true, status: r.status, out: r.stdout.replace(/\n$/, ''), err: r.stderr };
}
let bad = 0; const ids = new Set();
const fail = (p, m) => { bad++; console.log(`✗ ${p.id}: ${m}`); };
for (const p of PUZZLES) {
  if (ids.has(p.id)) fail(p, 'dup id'); ids.add(p.id);
  if (!sections.has(p.section)) fail(p, `no section ${p.section}`);
  if (p.section.split('.')[0] !== String(p.chapter)) fail(p, 'section/chapter mismatch');
  const lines = p.code.split('\n');
  const orig = lines[p.line - 1];
  const indent = orig.match(/^\s*/)[0];
  const variant = (opt) => lines.map((l, i) => (i === p.line - 1 ? indent + opt : l)).join('\n');
  if (p.options.includes(orig.trim())) fail(p, 'bug line is among options');
  const b = run(`${p.id}-bug`, p.code);
  if (!b.compiled) { fail(p, 'buggy does not compile: ' + b.err); continue; }
  if (p.panic) { if (b.status === 0 || !b.err.includes(p.panic)) fail(p, `expected panic "${p.panic}", got status ${b.status} ${b.err}`); if (b.out !== p.actual) fail(p, `buggy stdout ${JSON.stringify(b.out)}`); }
  else if (b.status !== 0) fail(p, 'buggy exited ' + b.status + b.err);
  else if (!p.varies && b.out !== p.actual) fail(p, `buggy prints ${JSON.stringify(b.out)} not ${JSON.stringify(p.actual)}`);
  if (b.out === p.output && !p.varies) fail(p, 'buggy already right');
  p.options.forEach((o, i) => {
    const r = run(`${p.id}-o${i}`, variant(o));
    const right = r.compiled && r.status === 0 && r.out === p.output;
    if (i === p.answer) { if (!right) fail(p, `fix wrong: ${JSON.stringify(r)}`); }
    else if (right) {
      if (p.varies) { // HashMap order: must be wrong on some run
        let ok = false; for (let k = 0; k < 20 && !ok; k++) { const x = spawnSync(`${dir}${p.id}-o${i}`, [], { encoding: 'utf8' }); if (x.stdout.replace(/\n$/, '') !== p.output) ok = true; }
        if (!ok) fail(p, `wrong option ${i} also right`);
      } else fail(p, `wrong option ${i} also right: ${o}`);
    }
  });

}
console.log(`${PUZZLES.length} puzzles, ${bad} problems`);
process.exit(bad ? 1 : 0);
