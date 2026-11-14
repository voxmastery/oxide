#!/usr/bin/env node
// Proves the build-along milestone tests with real cargo, for every project in scripts/buildalong/:
//
//   starter  = Cargo.toml + starter/ + tests/   → must compile (lib, main and tests, no warnings),
//                                                 and every milestone test must FAIL;
//   solution = starter, with the files from scripts/buildalong-solutions/<project>/ on top
//                                               → no warnings, every milestone test must PASS,
//                                                 and `cargo test <mN_>` passes for each milestone.
//
// Each test must belong to a milestone in meta.json (name prefix `mN_`), and every milestone must
// have tests. Needs cargo on PATH.
//
//   node scripts/buildalong/verify.mjs [project…]          (or: npm run buildalong:verify)
//   BUILDALONG_TMP=/some/dir keeps the generated crates there.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargoToml, projectNames, readProject } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOLUTIONS = path.resolve(__dirname, '../buildalong-solutions');
const TMP = process.env.BUILDALONG_TMP || fs.mkdtempSync(path.join(os.tmpdir(), 'buildalong-'));

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

function writeTree(root, files) {
  fs.rmSync(root, { recursive: true, force: true });
  for (const [rel, text] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
  }
}

function readTree(dir, base = dir, out = {}) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) readTree(p, base, out);
    else out[path.relative(base, p)] = fs.readFileSync(p, 'utf8');
  }
  return out;
}

function cargo(cwd, args, env = {}) {
  const r = spawnSync('cargo', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CARGO_TERM_COLOR: 'never', CARGO_TARGET_DIR: path.join(cwd, 'target'), ...env },
  });
  return { code: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? '') };
}

/** `test NAME ... ok|FAILED` lines from libtest's pretty output. */
function results(out) {
  const res = new Map();
  for (const m of out.matchAll(/^test (\S+) \.\.\. (ok|FAILED|ignored)$/gm)) res.set(m[1], m[2]);
  return res;
}

function warnings(out) {
  return out.split('\n').filter((l) => /^warning/.test(l) && !/generated \d+ warning/.test(l));
}

function verify(name) {
  console.log(`\n${name}`);
  const p = readProject(name);
  const ids = p.meta.milestones.map((m) => m.id);
  const base = { 'Cargo.toml': cargoToml(name), ...p.starter, ...p.tests };

  // --- starter -------------------------------------------------------------------------
  const sdir = path.join(TMP, name, 'starter');
  writeTree(sdir, base);
  const sb = cargo(sdir, ['build', '--all-targets']);
  if (sb.code !== 0) {
    fail(`starter does not compile:\n${sb.out}`);
    return;
  }
  const sw = warnings(sb.out);
  if (sw.length) fail(`starter has warnings:\n    ${sw.join('\n    ')}`);
  else ok('starter compiles (lib, main, tests) without warnings');

  const st = cargo(sdir, ['test', '--test', 'milestones', '--', '--test-threads=1']);
  const sres = results(st.out);
  if (sres.size === 0) fail(`no tests ran on the starter:\n${st.out}`);
  for (const [t, r] of sres) {
    const id = /^(m\d+)_/.exec(t)?.[1];
    if (!id || !ids.includes(id)) fail(`test ${t} belongs to no milestone`);
    if (r !== 'FAILED') fail(`test ${t} is ${r} on the starter (should fail)`);
  }
  const byMilestone = Object.fromEntries(ids.map((id) => [id, [...sres.keys()].filter((t) => t.startsWith(id + '_'))]));
  for (const id of ids) if (!byMilestone[id].length) fail(`milestone ${id} has no tests`);
  const sFailed = [...sres.values()].filter((r) => r === 'FAILED').length;
  ok(`starter: ${sFailed}/${sres.size} milestone tests fail, as they should`);
  for (const id of ids) {
    const r = cargo(sdir, ['test', '--test', 'milestones', id + '_']);
    if (r.code === 0) fail(`\`cargo test --test milestones ${id}_\` passes on the starter`);
  }
  ok(`starter: \`cargo test --test milestones mN_\` fails for all ${ids.length} milestones`);

  // --- solution ------------------------------------------------------------------------
  const solDir = path.join(SOLUTIONS, name);
  if (!fs.existsSync(solDir)) {
    fail(`no reference solution in ${path.relative(process.cwd(), solDir)}`);
    return;
  }
  const odir = path.join(TMP, name, 'solution');
  writeTree(odir, { ...base, ...readTree(solDir) });
  const ob = cargo(odir, ['build', '--all-targets']);
  if (ob.code !== 0) {
    fail(`solution does not compile:\n${ob.out}`);
    return;
  }
  const ow = warnings(ob.out);
  if (ow.length) fail(`solution has warnings:\n    ${ow.join('\n    ')}`);
  else ok('solution compiles without warnings');
  const ot = cargo(odir, ['test', '--test', 'milestones']);
  const ores = results(ot.out);
  const notOk = [...ores].filter(([, r]) => r !== 'ok');
  if (ores.size !== sres.size) fail(`solution ran ${ores.size} tests, starter ${sres.size}`);
  if (notOk.length) fail(`solution fails: ${notOk.map(([t]) => t).join(', ')}\n${ot.out}`);
  else ok(`solution: all ${ores.size} milestone tests pass`);
  for (const id of ids) {
    const r = cargo(odir, ['test', '--test', 'milestones', id + '_']);
    const n = results(r.out).size;
    if (r.code !== 0 || n !== byMilestone[id].length) fail(`\`cargo test --test milestones ${id}_\` on the solution: exit ${r.code}, ${n} tests`);
  }
  ok(`solution: each milestone filter passes (${ids.map((id) => `${id}:${byMilestone[id].length}`).join(' ')})`);

  // The program itself runs on the finished library.
  const run = p.meta.smoke;
  if (run) {
    const input = run.stdin ?? '';
    const r = spawnSync('cargo', ['run', '-q', '--', ...run.args], { cwd: odir, encoding: 'utf8', input, env: { ...process.env, CARGO_TERM_COLOR: 'never' } });
    if (r.status !== 0) fail(`cargo run ${run.args.join(' ')} exited ${r.status}:\n${r.stderr}`);
    else {
      const want = run.expect;
      if (want !== undefined && !r.stdout.includes(want)) fail(`cargo run output lacks ${JSON.stringify(want)}:\n${r.stdout}`);
      else ok(`cargo run -- ${run.args.join(' ')} works on the solution`);
    }
  }
}

const wanted = process.argv.slice(2);
for (const name of wanted.length ? wanted : projectNames()) verify(name);
console.log(failures ? `\n${failures} problem(s). Crates in ${TMP}` : `\nAll build-along projects verified. Crates in ${TMP}`);
process.exit(failures ? 1 : 0);
