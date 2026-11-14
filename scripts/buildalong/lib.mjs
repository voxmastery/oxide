// Shared by build.mjs and verify.mjs: reads the build-along sources in scripts/buildalong/<project>/.
//
//   meta.json        title, summary, milestones [{ id: "m1", title, build, section, files }]
//   starter/…        files the project starts with (relative to the project root)
//   tests/…          milestone tests; test names start with the milestone id: `m3_…`
//
// Reference solutions live apart, in scripts/buildalong-solutions/<project>/, and never reach the app.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ORDER = ['todo', 'wordfreq', 'bank', 'mdhtml', 'life'];

export function projectNames() {
  const found = fs.readdirSync(__dirname).filter((d) => fs.existsSync(path.join(__dirname, d, 'meta.json')));
  return [...ORDER.filter((n) => found.includes(n)), ...found.filter((n) => !ORDER.includes(n))];
}

function readTree(dir, base = dir, out = {}) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) readTree(p, base, out);
    else out[path.relative(base, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8');
  }
  return out;
}

export function readProject(name) {
  const dir = path.join(__dirname, name);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const starter = readTree(path.join(dir, 'starter'));
  const tests = Object.fromEntries(Object.entries(readTree(path.join(dir, 'tests'))).map(([k, v]) => [`tests/${k}`, v]));
  return { name, meta, starter, tests };
}

/** The same manifest `cargo new` writes, plus nothing: no dependencies, so it builds offline. */
export function cargoToml(name) {
  return `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2024"\n\n[dependencies]\n`;
}
