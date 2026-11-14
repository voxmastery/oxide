// Types of the native OxideToolchain module (android/src/main/java/expo/modules/oxidetoolchain).

export type ProcOutputEvent = {
  id: string;
  stream: 'stdout' | 'stderr';
  /** Without the newline. When `partial` is true the line is still open (a prompt). */
  line: string;
  partial: boolean;
};

export type ProcExitEvent = { id: string; code: number; signal: string | null; durationMs: number };

export type ProcWaitingEvent = { id: string };

export type NativeInstallProgress = {
  pkg: 'rust';
  state: 'waiting' | 'downloading' | 'installing' | 'done' | 'paused' | 'error';
  progress: number;
  bytesDone: number;
  bytesTotal: number;
  log: string | null;
  error: string | null;
};

export type NativeToolchainInfo = {
  installed: boolean;
  nativeToolsPresent: boolean;
  dataInstalled: boolean;
  rustVersion: string | null;
  rustcVersionLine: string | null;
  cargoVersionLine: string | null;
  sizeBytes: number;
  unavailableReason: string | null;
  nativeLibraryDir: string;
  filesDir: string;
  sysroot: string;
  cargoHome: string;
  target: string;
};

export type NativeManifestInfo = {
  rustVersion: string;
  rustcVersionLine: string;
  downloadBytes: number;
  installedBytes: number;
};

export type OxideToolchainEvents = {
  onProcOutput: (e: ProcOutputEvent) => void;
  onProcExit: (e: ProcExitEvent) => void;
  onProcWaiting: (e: ProcWaitingEvent) => void;
  onInstallProgress: (e: NativeInstallProgress) => void;
};
