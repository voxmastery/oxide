// The Rustlings workspace at ~/rustlings, laid out like `rustlings init` makes it:
//   Cargo.toml (bin list for every exercise and solution), exercises/<dir>/<name>.rs,
//   solutions/<dir>/<name>.rs (filled in once the exercise is done) and the crate's helper files.
// Exercise files hold the user's code from app state when they edited it, else the original.
import { rustlings } from '../content';
import { useApp } from '../state/app';
import { RUSTLINGS, read, stat, write } from './core';

const SOLUTION_PLACEHOLDER =
  "fn main() {\n    // DON'T EDIT THIS SOLUTION FILE!\n    // It will be automatically filled after you finish the exercise.\n}\n";

/** Shell path of an exercise file, e.g. `~/rustlings/exercises/06_move_semantics/move_semantics2.rs`. */
export function exerciseFile(name: string): string | null {
  const e = rustlings.exercises[name];
  return e ? `${RUSTLINGS}/${e.path}` : null;
}

const written = new Map<string, string>();

async function put(path: string, text: string) {
  if (written.get(path) === text) return;
  if (!written.has(path)) {
    // First time this run: skip the write when the file already holds this text.
    try {
      if ((await stat(path)) && (await read(path)) === text) { written.set(path, text); return; }
    } catch { /* write below */ }
  }
  await write(path, text);
  written.set(path, text);
}

let running: Promise<void> | null = null;
let again = false;

/**
 * Make sure ~/rustlings exists and matches app state: Cargo.toml, helper files, every exercise
 * (user code from `useApp().ex[name].code` wins over the original) and solutions for done exercises.
 * Cheap to call repeatedly: only changed files are written.
 */
export function ensureRustlingsWorkspace(): Promise<void> {
  if (running) { again = true; return running; }
  running = (async () => {
    do {
      again = false;
      const s = useApp.getState();
      await put(`${RUSTLINGS}/Cargo.toml`, rustlings.crate.cargoToml);
      for (const [rel, text] of Object.entries(rustlings.crate.files)) await put(`${RUSTLINGS}/${rel}`, text);
      for (const name of rustlings.order) {
        const e = rustlings.exercises[name];
        const st = s.ex[name];
        await put(`${RUSTLINGS}/${e.path}`, st?.code ?? e.code);
        const sol = `${RUSTLINGS}/${e.path.replace(/^exercises\//, 'solutions/')}`;
        await put(sol, st?.status === 'done' && e.solution ? e.solution : SOLUTION_PLACEHOLDER);
      }
    } while (again);
  })().finally(() => { running = null; });
  return running;
}

/** Write one exercise file (e.g. right before checking it). `code` defaults to app state / original. */
export async function syncExercise(name: string, code?: string): Promise<void> {
  const e = rustlings.exercises[name];
  if (!e) return;
  await put(`${RUSTLINGS}/${e.path}`, code ?? useApp.getState().ex[name]?.code ?? e.code);
}
