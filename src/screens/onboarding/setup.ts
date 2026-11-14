// First-run download controller. Drives the real Toolchain.install() and keeps the progress in a
// module-level store so it survives leaving the Setup step ("Continue while it downloads").
import { Platform } from 'react-native';
import { create } from 'zustand';
import { getToolchain } from '../../toolchain';
import type { InstallProgress, ToolchainPackage } from '../../toolchain/types';
import { useApp } from '../../state/app';
import { useNet } from '../../shell/net';
import { rustlings, toc } from '../../content';

export type PkgState = InstallProgress['state'];
export type PkgView = { state: PkgState; progress: number; bytesDone: number; bytesTotal: number | null; error?: string };

export type SetupState = {
  started: boolean;
  running: boolean;
  pkgs: Record<ToolchainPackage, PkgView>;
  /** rustup-style log lines (ANSI / § markup), oldest first. */
  log: string[];
  paused: boolean;
  /** Why the install stopped, when it was an error rather than a metered-network pause. */
  error: string | null;
  /** Set where the toolchain can't run at all (web, iOS): the toolchain's own message. */
  unavailable: string | null;
  rustVersion: string | null;
  /** Waiting for Wi-Fi to come back before resuming. */
  waitingForWifi: boolean;
};

const empty = (): PkgView => ({ state: 'waiting', progress: 0, bytesDone: 0, bytesTotal: null });

export const useSetup = create<SetupState>(() => ({
  started: false,
  running: false,
  pkgs: { rust: empty(), book: empty(), rustlings: empty() },
  log: [],
  paused: false,
  error: null,
  unavailable: null,
  rustVersion: null,
  waitingForWifi: false,
}));

const MAX_LOG = 200;
const log = (line: string) => useSetup.setState((s) => ({ log: [...s.log, line].slice(-MAX_LOG) }));
const setPkg = (pkg: ToolchainPackage, p: Partial<PkgView>) => useSetup.setState((s) => ({ pkgs: { ...s.pkgs, [pkg]: { ...s.pkgs[pkg], ...p } } }));

/** Mirror into the persisted app state (`useApp().setup`) that Home/Settings read. */
function syncApp() {
  const s = useSetup.getState();
  const r = s.pkgs.rust.state;
  useApp.getState().set((a) => ({
    setup: {
      rust: r === 'done' ? 'done' : s.paused || r === 'paused' || r === 'error' ? 'paused' : r === 'downloading' || r === 'installing' ? 'downloading' : a.setup.rust,
      book: s.pkgs.book.state === 'done' ? 'done' : a.setup.book,
      rustlings: s.pkgs.rustlings.state === 'done' ? 'done' : a.setup.rustlings,
    },
  }));
}

const VERSION_RE = /(?:rustc|rust version)\s+(\d+\.\d+\.\d+)/;

/** The Book and Rustlings ship inside the app; they're ready as soon as setup starts. */
function bundledDone(pkg: 'book' | 'rustlings') {
  if (useSetup.getState().pkgs[pkg].state === 'done') return;
  setPkg(pkg, { state: 'done', progress: 1 });
  log(pkg === 'book' ? '§Woxide:§n loaded The Rust Programming Language' : `§Woxide:§n loaded Rustlings, ${rustlings.total} exercises`);
}

function onProgress(p: InstallProgress) {
  const prev = useSetup.getState().pkgs[p.pkg];
  setPkg(p.pkg, {
    state: p.state,
    progress: p.state === 'done' ? 1 : Math.max(0, Math.min(1, p.progress)),
    bytesDone: p.bytesDone,
    bytesTotal: p.bytesTotal > 0 ? p.bytesTotal : prev.bytesTotal,
    error: p.error,
  });
  if (p.log) {
    log(p.log);
    const v = VERSION_RE.exec(p.log);
    if (v && p.pkg === 'rust') useSetup.setState({ rustVersion: v[1] });
  }
  if (p.state === 'paused' || p.state === 'error') useSetup.setState({ paused: true, running: false, error: p.state === 'error' ? p.error ?? 'Download failed' : null });
  syncApp();
}

/** Each install() call gets a generation; events and results from a superseded call are ignored. */
let gen = 0;

/** Start (or resume) the first-run setup. Safe to call repeatedly. */
export async function startSetup(opts: { allowMetered: boolean } = { allowMetered: false }): Promise<void> {
  const st = useSetup.getState();
  if (st.running) return;
  useSetup.setState({ started: true, running: true, paused: false, error: null, waitingForWifi: false });
  const tc = getToolchain();
  let info: Awaited<ReturnType<typeof tc.info>> | null = null;
  try {
    info = await tc.info();
  } catch {
    info = null;
  }
  if (info?.rustVersion) useSetup.setState({ rustVersion: info.rustVersion });

  // Web / iOS: there is no on-device toolchain. Say so; the bundled content is still ready.
  if (Platform.OS !== 'android') {
    useSetup.setState({ running: false, unavailable: info?.unavailableReason ?? 'Compiling and running Rust needs the Android app.' });
    if (!useSetup.getState().log.length) log(`§Ywarning:§n ${info?.unavailableReason ?? 'the Rust toolchain is only available in the Android app'}`);
    bundledDone('book');
    bundledDone('rustlings');
    syncApp();
    return;
  }

  if (info?.installed) {
    setPkg('rust', { state: 'done', progress: 1 });
    if (info.rustcVersionLine) log(`§g  stable installed§n - ${info.rustcVersionLine}`);
    bundledDone('book');
    bundledDone('rustlings');
    useSetup.setState({ running: false });
    syncApp();
    return;
  }

  setPkg('rust', { state: 'downloading' });
  syncApp();
  const g = ++gen;
  const live = () => g === gen;
  try {
    await tc.install({ allowMetered: opts.allowMetered, onProgress: (p) => { if (live()) onProgress(p); } });
    if (live() && !useSetup.getState().paused) {
      setPkg('rust', { state: 'done', progress: 1 });
      bundledDone('book');
      bundledDone('rustlings');
    }
  } catch (e) {
    if (live()) {
      const msg = e instanceof Error ? e.message : String(e);
      setPkg('rust', { state: 'error', error: msg });
      useSetup.setState({ paused: true, error: msg });
      log(`§Rerror:§n ${msg}`);
    }
  } finally {
    if (live()) {
      useSetup.setState({ running: false });
      syncApp();
    }
  }
}

/** Pause a running install (e.g. the user chose to wait for Wi-Fi). */
export function pauseSetup() {
  try {
    getToolchain().pauseInstall();
  } catch {
    /* not running */
  }
  if (useSetup.getState().pkgs.rust.state !== 'done') {
    setPkg('rust', { state: 'paused' });
    // The paused install may still settle later; a resume starts a new generation.
    gen++;
    useSetup.setState({ paused: true, running: false });
    syncApp();
  }
}

let wifiUnsub: (() => void) | null = null;
/** "Wait for Wi-Fi": resume automatically once the phone is on Wi-Fi again. */
export function resumeOnWifi() {
  wifiUnsub?.();
  useSetup.setState({ waitingForWifi: true });
  const check = (n: { wifi: boolean; offline: boolean }) => {
    if (n.wifi && !n.offline) {
      wifiUnsub?.();
      wifiUnsub = null;
      void startSetup({ allowMetered: false });
    }
  };
  wifiUnsub = useNet.subscribe(check);
  check(useNet.getState());
}

/** Bytes → "286 MB". */
export const mb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1e6))} MB`;

/** Spec copy used until the toolchain reports real sizes. */
export const FALLBACK = { rustVersion: '1.99.1', rustMB: 286, bookMB: 9, rustlingsMB: 3 };

export const bookEdition = () => `${toc.edition} edition`;
