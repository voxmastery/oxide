// Code journal: a timeline of the user's code. Persisted under oxide-journal-v1.
//  - pass:    a snapshot of an exercise's code when it passes (recordPass, called from passExercise)
//  - project: a Cargo project that appeared under ~/projects (found by scanning listProjects())
//  - hello:   the first "Hello, world!" (useApp().helloRan)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useApp } from '../../state/app';
import { listProjects, onChange, projectPath, read, stat } from '../../fs';

export type JournalEntry =
  | { id: string; kind: 'pass'; at: number; exercise: string; code: string; /** Taken when the journal started, not at the pass. */ late?: boolean }
  | { id: string; kind: 'project'; at: number; name: string; /** Snapshot of src/main.rs when first seen. */ code?: string; before?: boolean }
  | { id: string; kind: 'hello'; at: number; code?: string; before?: boolean };

type JournalState = {
  version: 1;
  entries: JournalEntry[];
  initialized: boolean;
  hydrated: boolean;
};

const MAX = 500;
let seq = 0;
const newId = () => `${Date.now().toString(36)}-${(++seq).toString(36)}`;

export const useJournal = create<JournalState>()(
  persist(
    (): JournalState => ({ version: 1, entries: [], initialized: false, hydrated: false }),
    {
      name: 'oxide-journal-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ version, entries, initialized }) => ({ version, entries, initialized }),
      onRehydrateStorage: () => () => {
        useJournal.setState({ hydrated: true });
        pending.splice(0).forEach((e) => add(e));
      },
    },
  ),
);

const pending: JournalEntry[] = [];

function add(e: JournalEntry) {
  const s = useJournal.getState();
  if (!s.hydrated) { pending.push(e); return; }
  const entries = [...s.entries, e].sort((a, b) => a.at - b.at);
  useJournal.setState({ entries: entries.length > MAX ? entries.slice(entries.length - MAX) : entries });
}

/**
 * Snapshot an exercise's code when it passes. Call from passExercise (also fine for re-passes, e.g. speed
 * runs): an identical snapshot of the same exercise right after the last one is skipped.
 */
export function recordPass(exercise: string, code: string) {
  const s = useJournal.getState();
  const last = [...s.entries].reverse().find((e) => e.kind === 'pass' && e.exercise === exercise);
  if (last && last.kind === 'pass' && last.code === code) return;
  add({ id: newId(), kind: 'pass', at: Date.now(), exercise, code });
}

async function mainRs(name: string): Promise<string | undefined> {
  try { return await read(`${projectPath(name)}/src/main.rs`); } catch { return undefined; }
}

let scanning = false;
async function scanProjects() {
  if (scanning) return;
  scanning = true;
  try {
    const known = new Set(useJournal.getState().entries.flatMap((e) => (e.kind === 'project' ? [e.name] : [])));
    const first = !useJournal.getState().initialized;
    const now = Date.now();
    for (const p of await listProjects()) {
      if (known.has(p.name)) continue;
      const st = await stat(`${projectPath(p.name)}/Cargo.toml`).catch(() => null);
      const at = st?.mtime && st.mtime > 1e11 && st.mtime < now ? st.mtime : now;
      add({ id: newId(), kind: 'project', at: first ? at : now, name: p.name, code: await mainRs(p.name), before: first || undefined });
    }
  } catch { /* fs unavailable: try again on the next change */ } finally { scanning = false; }
}

async function syncHello() {
  const s = useJournal.getState();
  if (!useApp.getState().helloRan || s.entries.some((e) => e.kind === 'hello')) return;
  const code = (await mainRs('hello_world')) ?? (await mainRs('hello_cargo'));
  if (useJournal.getState().entries.some((e) => e.kind === 'hello')) return;
  add({ id: newId(), kind: 'hello', at: Date.now(), code, before: !s.initialized || undefined });
}

/** Passed exercises with edited code from before the journal existed get one (late) snapshot each. */
function backfill() {
  const ex = useApp.getState().ex;
  const have = new Set(useJournal.getState().entries.flatMap((e) => (e.kind === 'pass' ? [e.exercise] : [])));
  for (const [name, st] of Object.entries(ex)) {
    if (st.status === 'done' && st.code && !have.has(name)) add({ id: newId(), kind: 'pass', at: st.passedAt ?? Date.now(), exercise: name, code: st.code, late: true });
  }
}

/** Keeps the journal's project and hello-world entries up to date. Mounted by <BadgeWatcher/>. */
export function useJournalWatcher() {
  const a = useApp((s) => s.hydrated);
  const b = useJournal((s) => s.hydrated);
  useEffect(() => {
    if (!a || !b) return;
    let live = true;
    (async () => {
      if (!useJournal.getState().initialized) backfill();
      await syncHello();
      await scanProjects();
      if (live) useJournal.setState({ initialized: true });
    })();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const offFs = onChange(() => { clearTimeout(timer); timer = setTimeout(scanProjects, 800); });
    let hello = useApp.getState().helloRan;
    const offApp = useApp.subscribe((s) => { if (s.helloRan !== hello) { hello = s.helloRan; syncHello(); } });
    return () => { live = false; clearTimeout(timer); offFs(); offApp(); };
  }, [a, b]);
}

/** Forget the journal (call alongside useApp's deleteAccount / resetAll). */
export function resetJournal() {
  useJournal.setState({ entries: [], initialized: false });
}
