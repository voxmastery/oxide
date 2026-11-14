// App state: user, plan, preferences and progress. Persisted to AsyncStorage.
// Everything the screens show is derived from this (see ./selectors.ts); there is no sample data
// in production. `seedDemo()` reproduces the prototype's "Sam, week 3 day 4" state for comparison.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type GoalMin = 10 | 20 | 30 | 45;
export type SolutionPolicy = 'after3' | 'afterPass' | 'never';
export type ThemePref = 'dark' | 'paper' | 'system';

export type ExerciseState = {
  status: 'todo' | 'done';
  attempts: number;          // failed Checks
  hints: number;             // hints revealed 0..3
  solutionViewed: boolean;   // opened before passing → 0 XP
  solutionApplied: boolean;  // passing with solution applied → 10 XP
  code?: string;             // user's current code, if edited
  xp?: number;               // XP earned when passed
  passedAt?: number;
};

export type DayLog = { minutes: number; exercises: number; sections: number; goalMet: boolean; missionDone?: boolean };

export type MissionStep =
  | { kind: 'read'; id: string }
  | { kind: 'ex'; id: string }
  | { kind: 'term'; cmd: string; project: string };

export type Mission = { date: string; title: string; mins: number; steps: MissionStep[]; day1?: boolean };

export type AppData = {
  version: 1;
  onboarded: boolean;
  /** ISO date (YYYY-MM-DD) the plan started; drives "Week 3, day 4". */
  startDate: string | null;
  user: {
    name: string;
    email: string | null;
    providers: { github: string | null; google: boolean; email: boolean };
    signedIn: boolean;
    lastSync: number | null;
  };
  plan: { level: 0 | 1 | 2; goal: GoalMin; reminder: boolean; reminderTime: string; notifAllowed: boolean | null; startSection: string };
  prefs: {
    solution: SolutionPolicy; quizzes: boolean; codeSize: number; theme: ThemePref; symbolRow: boolean; autoClose: boolean;
    readerSize: number; readerLine: number; wrapOutput: boolean;
  };
  book: { read: Record<string, number>; scroll: Record<string, number>; current: string };
  ex: Record<string, ExerciseState>;
  quickChecks: Record<string, boolean>;
  tourSeen: boolean;
  xp: number;
  days: Record<string, DayLog>;
  bestStreak: number;
  fixed: Record<string, number>;
  missions: Record<string, Mission>;
  /** Day-1 terminal step: hello_world printed "Hello, world!". */
  helloRan: boolean;
  /** Last level the user has been congratulated for (Level up moment). */
  levelSeen: number;
  setup: { rust: 'waiting' | 'downloading' | 'paused' | 'done'; book: 'waiting' | 'done'; rustlings: 'waiting' | 'done' };
};

export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const INITIAL: AppData = {
  version: 1,
  onboarded: false,
  startDate: null,
  user: { name: '', email: null, providers: { github: null, google: false, email: false }, signedIn: false, lastSync: null },
  plan: { level: 1, goal: 30, reminder: true, reminderTime: '20:30', notifAllowed: null, startSection: '1.1' },
  prefs: { solution: 'after3', quizzes: true, codeSize: 14, theme: 'dark', symbolRow: true, autoClose: true, readerSize: 16.5, readerLine: 1.7, wrapOutput: false },
  book: { read: {}, scroll: {}, current: '1.2' },
  ex: {},
  quickChecks: {},
  tourSeen: false,
  xp: 0,
  days: {},
  bestStreak: 0,
  fixed: {},
  missions: {},
  helloRan: false,
  levelSeen: 1,
  setup: { rust: 'waiting', book: 'waiting', rustlings: 'waiting' },
};

export const XP = { easy: 40, medium: 50, quiz: 100, quickCheck: 10, mission: 60, withSolution: 10 } as const;

type Actions = {
  set: (patch: Partial<AppData> | ((s: AppData) => Partial<AppData>)) => void;
  setPlan: (p: Partial<AppData['plan']>) => void;
  setPrefs: (p: Partial<AppData['prefs']>) => void;
  setUser: (p: Partial<AppData['user']>) => void;
  finishOnboarding: () => void;
  signOut: () => void;
  deleteAccount: () => void;
  /** Reader scroll position 0..1. Marks the section read past 90%. */
  setScroll: (section: string, frac: number) => void;
  markRead: (section: string) => void;
  /** Exercise bookkeeping. */
  exPatch: (name: string, p: Partial<ExerciseState>) => void;
  failedCheck: (name: string, errorCodes: string[]) => void;
  /** Returns XP earned. */
  passExercise: (name: string, baseXp: number, fixedCodes: string[]) => number;
  answerQuickCheck: (id: string, correct: boolean) => void;
  addMinutes: (min: number) => void;
  addXp: (n: number) => void;
  setHelloRan: () => void;
  completeMission: (date: string) => void;
  setMission: (m: Mission) => void;
  seedDemo: () => void;
  resetAll: () => void;
};

export type AppState = AppData & Actions & { hydrated: boolean };

const bumpDay = (s: AppData, patch: Partial<DayLog>) => {
  const d = today();
  const cur = s.days[d] ?? { minutes: 0, exercises: 0, sections: 0, goalMet: false };
  const next = { ...cur, ...patch };
  next.goalMet = next.minutes >= s.plan.goal;
  return { ...s.days, [d]: next };
};

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      hydrated: false,
      set: (patch) => set((s) => (typeof patch === 'function' ? patch(s) : patch)),
      setPlan: (p) => set((s) => ({ plan: { ...s.plan, ...p } })),
      setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),
      setUser: (p) => set((s) => ({ user: { ...s.user, ...p } })),
      finishOnboarding: () => set((s) => ({
        onboarded: true,
        startDate: s.startDate ?? today(),
        // 1.1 Installation is done for you during setup.
        book: { ...s.book, read: { ...s.book.read, '1.1': Date.now() }, current: s.plan.startSection === '1.1' ? '1.2' : s.plan.startSection },
      })),
      signOut: () => set((s) => ({ user: { ...s.user, signedIn: false, providers: { github: null, google: false, email: false }, lastSync: null } })),
      deleteAccount: () => set({ ...INITIAL, hydrated: true }),
      setScroll: (section, frac) => {
        const s = get();
        const prev = s.book.scroll[section] ?? 0;
        if (frac <= prev + 0.005 && !(frac >= 0.9 && !s.book.read[section])) return;
        const scroll = { ...s.book.scroll, [section]: Math.max(prev, frac) };
        if (frac >= 0.9 && !s.book.read[section]) {
          set({ book: { ...s.book, scroll, read: { ...s.book.read, [section]: Date.now() } }, days: bumpDay(s, { sections: (s.days[today()]?.sections ?? 0) + 1 }) });
        } else set({ book: { ...s.book, scroll, current: section } });
      },
      markRead: (section) => set((s) => (s.book.read[section] ? {} : { book: { ...s.book, read: { ...s.book.read, [section]: Date.now() } }, days: bumpDay(s, { sections: (s.days[today()]?.sections ?? 0) + 1 }) })),
      exPatch: (name, p) => set((s) => ({ ex: { ...s.ex, [name]: { ...(s.ex[name] ?? { status: 'todo', attempts: 0, hints: 0, solutionViewed: false, solutionApplied: false }), ...p } } })),
      failedCheck: (name) => {
        const cur = get().ex[name];
        get().exPatch(name, { attempts: (cur?.attempts ?? 0) + 1 });
      },
      passExercise: (name, baseXp, fixedCodes) => {
        const s = get();
        const cur = s.ex[name];
        if (cur?.status === 'done') return 0;
        const xp = cur?.solutionViewed && !cur.solutionApplied ? 0 : cur?.solutionApplied ? XP.withSolution : baseXp;
        const fixed = { ...s.fixed };
        fixedCodes.forEach((c) => { fixed[c] = (fixed[c] ?? 0) + 1; });
        set({
          ex: { ...s.ex, [name]: { ...(cur ?? { attempts: 0, hints: 0, solutionViewed: false, solutionApplied: false }), status: 'done', xp, passedAt: Date.now() } },
          xp: s.xp + xp,
          fixed,
          days: bumpDay(s, { exercises: (s.days[today()]?.exercises ?? 0) + 1 }),
        });
        return xp;
      },
      answerQuickCheck: (id, correct) => set((s) => (id in s.quickChecks ? {} : { quickChecks: { ...s.quickChecks, [id]: correct }, xp: s.xp + (correct ? XP.quickCheck : 0) })),
      addMinutes: (min) => set((s) => ({ days: bumpDay(s, { minutes: (s.days[today()]?.minutes ?? 0) + min }) })),
      addXp: (n) => set((s) => ({ xp: s.xp + n })),
      setHelloRan: () => set({ helloRan: true }),
      completeMission: (date) => set((s) => {
        const d = s.days[date] ?? { minutes: 0, exercises: 0, sections: 0, goalMet: false };
        if (d.missionDone) return {};
        return { days: { ...s.days, [date]: { ...d, missionDone: true } }, xp: s.xp + XP.mission };
      }),
      setMission: (m) => set((s) => ({ missions: { ...s.missions, [m.date]: m } })),
      seedDemo: () => set(() => demoState()),
      resetAll: () => set({ ...INITIAL }),
    }),
    {
      name: 'oxide-app-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        const { hydrated, ...rest } = s;
        void hydrated;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as AppData;
      },
      onRehydrateStorage: () => () => { useApp.setState({ hydrated: true }); },
    },
  ),
);

/** The prototype's established-user state (Sam, Sat 14 Nov 2026, week 3 day 4). */
export function demoState(): Partial<AppData> {
  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - 17); // week 3, day 4
  const read = ['1.1', '1.2', '1.3', '2', '3.1', '3.2', '3.3', '3.4', '3.5', '4.1'];
  const doneEx = ['intro1', 'intro2', 'variables1', 'variables2', 'variables3', 'variables4', 'variables5', 'variables6',
    'functions1', 'functions2', 'functions3', 'functions4', 'functions5', 'if1', 'if2', 'if3', 'quiz1',
    'primitive_types1', 'primitive_types2', 'primitive_types3', 'primitive_types4', 'primitive_types5', 'primitive_types6',
    'vecs1', 'vecs2', 'move_semantics1'];
  const ex: Record<string, ExerciseState> = {};
  doneEx.forEach((n, i) => { ex[n] = { status: 'done', attempts: i % 3, hints: 0, solutionViewed: false, solutionApplied: false, xp: 40, passedAt: Date.now() - (26 - i) * 36e5 * 14 }; });
  const days: Record<string, DayLog> = {};
  // 12-day streak, best 19; scattered activity before.
  for (let i = 0; i < 84; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const key = today(d);
    if (i === 0) { days[key] = { minutes: 28, exercises: 0, sections: 0, goalMet: false }; continue; }
    const inStreak = i <= 12;
    const n = inStreak ? 1 + ((i * 7) % 5) : (i % 4 === 0 ? 0 : (i * 3) % 4);
    if (i > 17) continue; // plan started 17 days ago
    days[key] = { minutes: inStreak ? 30 + (i % 3) * 5 : n * 8, exercises: n, sections: i % 3 === 0 ? 1 : 0, goalMet: inStreak };
  }
  return {
    onboarded: true,
    startDate: today(start),
    user: { name: 'Sam', email: 'sam@fastmail.com', providers: { github: 'samr', google: false, email: true }, signedIn: true, lastSync: Date.now() - 120000 },
    plan: { level: 1, goal: 30, reminder: true, reminderTime: '20:30', notifAllowed: true, startSection: '1.1' },
    book: { read: Object.fromEntries(read.map((r) => [r, Date.now()])), scroll: { '4.2': 0.62 }, current: '4.2' },
    ex,
    xp: 1840,
    days,
    bestStreak: 19,
    fixed: { E0308: 9, E0382: 7, E0425: 4, E0499: 3, E0596: 2 },
    helloRan: true,
    levelSeen: 7,
    tourSeen: false,
    setup: { rust: 'done', book: 'done', rustlings: 'done' },
  };
}
