// Navigation + overlay layer, mirroring design/project/OxidePhone.dc.html exactly:
// - one stack; nav() pushes, back() pops (from a stack of one → that tab's root), tab() resets to a root
// - opening a screen or switching tab closes any open popup
// - one popup at a time; one snackbar at a time (4 s, action dismisses immediately)
import { create } from 'zustand';

export type ScreenName =
  | 'home' | 'learn' | 'reader' | 'search' | 'practice' | 'workspace' | 'project'
  | 'terminal' | 'editor' | 'profile' | 'settings' | 'account' | 'onboarding';

export type TabId = 'home' | 'learn' | 'practice' | 'terminal' | 'profile';

export type Entry = {
  screen: ScreenName;
  /** Screen-specific variant, e.g. onboarding step, reader "resume". */
  variant?: string;
  /** Screen-specific argument: section id, exercise name, project name, search query… */
  arg?: string;
  /** Extra params (e.g. terminal `run` command, editor `from`). */
  params?: Record<string, unknown>;
  key: string;
};

export type PopupKind =
  // dialogs
  | 'notify' | 'goal' | 'reminder' | 'solution-setting' | 'solution-early' | 'dlfail' | 'delproj' | 'signout' | 'delacct'
  // sheets
  | 'exmenu' | 'cmd' | 'display' | 'streak' | 'xp' | 'report' | 'projects'
  // moments
  | 'mission' | 'levelup' | 'push';

export type Popup = { kind: PopupKind; opts: Record<string, any> };
export type Toast = { text: string; action?: string; onAction?: () => void; id: number };

export const TAB_OF: Record<ScreenName, TabId | null> = {
  home: 'home', learn: 'learn', reader: 'learn', search: 'learn',
  practice: 'practice', workspace: 'practice', project: 'practice',
  terminal: 'terminal', editor: 'terminal',
  profile: 'profile', settings: 'profile', account: 'profile',
  onboarding: null,
};
export const TAB_ROOTS: ScreenName[] = ['home', 'learn', 'practice', 'terminal', 'profile'];
/** Full-screen moments cover everything below the status bar. */
export const FULL_POPUPS: PopupKind[] = ['mission', 'levelup'];

let keySeq = 0;
const mk = (screen: ScreenName, o: Partial<Omit<Entry, 'screen' | 'key'>> = {}): Entry => ({ screen, ...o, key: `${screen}-${++keySeq}` });

type NavState = {
  stack: Entry[];
  popup: Popup | null;
  toast: Toast | null;
  nav: (screen: ScreenName, opts?: Partial<Omit<Entry, 'screen' | 'key'>>) => void;
  /** Replace the top entry (used for "Next exercise" so Back returns to the list). */
  replace: (screen: ScreenName, opts?: Partial<Omit<Entry, 'screen' | 'key'>>) => void;
  back: () => void;
  tab: (id: TabId) => void;
  reset: (screen: ScreenName, opts?: Partial<Omit<Entry, 'screen' | 'key'>>) => void;
  pop: (kind: PopupKind | null, opts?: Record<string, any>) => void;
  closePop: () => void;
  showToast: (text: string, action?: string, onAction?: () => void) => void;
  toastAction: () => void;
  hideToast: () => void;
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useNav = create<NavState>((set, get) => ({
  stack: [mk('home')],
  popup: null,
  toast: null,
  nav: (screen, opts) => set((s) => ({ popup: null, stack: [...s.stack, mk(screen, opts)] })),
  replace: (screen, opts) => set((s) => ({ popup: null, stack: [...s.stack.slice(0, -1), mk(screen, opts)] })),
  back: () => set((s) => {
    if (s.stack.length > 1) return { popup: null, stack: s.stack.slice(0, -1) };
    const root = TAB_OF[s.stack[0].screen] ?? 'home';
    return { popup: null, stack: [mk(root)] };
  }),
  tab: (id) => set({ popup: null, stack: [mk(id)] }),
  reset: (screen, opts) => set({ popup: null, stack: [mk(screen, opts)] }),
  pop: (kind, opts) => set({ popup: kind ? { kind, opts: opts ?? {} } : null }),
  closePop: () => set({ popup: null }),
  showToast: (text, action, onAction) => {
    clearTimeout(toastTimer);
    set({ toast: { text, action, onAction, id: Date.now() } });
    toastTimer = setTimeout(() => set({ toast: null }), 4000);
  },
  toastAction: () => {
    const t = get().toast;
    clearTimeout(toastTimer);
    set({ toast: null });
    t?.onAction?.();
  },
  hideToast: () => { clearTimeout(toastTimer); set({ toast: null }); },
}));

/** Convenience for screens: `const { nav, back, pop, showToast } = navActions();` (stable functions). */
export const navActions = () => {
  const s = useNav.getState();
  return { nav: s.nav, replace: s.replace, back: s.back, tab: s.tab, reset: s.reset, pop: s.pop, closePop: s.closePop, showToast: s.showToast };
};

export const useTop = () => useNav((s) => s.stack[s.stack.length - 1]);
