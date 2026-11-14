// Parsing of cargo's `--message-format=json-diagnostic-rendered-ansi` stream and of Rust panic
// messages. Pure functions, no I/O.

import type { Diagnostic } from './types';

type RustcSpan = {
  file_name: string;
  line_start: number;
  line_end: number;
  column_start: number;
  column_end: number;
  is_primary: boolean;
  label: string | null;
  suggested_replacement?: string | null;
  suggestion_applicability?: string | null;
};

type RustcDiagnostic = {
  message: string;
  code: { code: string } | null;
  level: string;
  spans: RustcSpan[];
  children: RustcDiagnostic[];
  rendered: string | null;
};

export type CargoArtifact = {
  packageId: string;
  /** "bin" | "lib" | "test" | "example" | "custom-build" | "proc-macro" … */
  kinds: string[];
  name: string;
  srcPath: string;
  /** cargo test --no-run: true for test harness builds. */
  test: boolean;
  executable: string | null;
};

export type CargoMessage =
  | { kind: 'diagnostic'; diagnostic: Diagnostic; packageId: string }
  | { kind: 'artifact'; artifact: CargoArtifact }
  | { kind: 'build-finished'; success: boolean }
  | { kind: 'other' };

const LEVELS = new Set(['error', 'warning', 'note', 'help', 'failure-note']);

export function toDiagnostic(d: RustcDiagnostic): Diagnostic {
  const level = (LEVELS.has(d.level) ? d.level : d.level.startsWith('error') ? 'error' : 'note') as Diagnostic['level'];
  return {
    level,
    message: d.message,
    code: d.code?.code ?? null,
    spans: (d.spans ?? []).map((s) => ({
      file: s.file_name,
      lineStart: s.line_start,
      lineEnd: s.line_end,
      colStart: s.column_start,
      colEnd: s.column_end,
      primary: s.is_primary,
      label: s.label,
      suggestedReplacement: s.suggested_replacement ?? null,
      applicability: s.suggestion_applicability ?? null,
    })),
    children: (d.children ?? []).map(toDiagnostic),
    rendered: d.rendered,
  };
}

/** One line of cargo's JSON output. Lines that are not JSON (a program's stdout) → 'other'. */
export function parseCargoMessage(line: string): CargoMessage {
  if (!line.startsWith('{')) return { kind: 'other' };
  let m: any;
  try {
    m = JSON.parse(line);
  } catch {
    return { kind: 'other' };
  }
  switch (m.reason) {
    case 'compiler-message':
      return { kind: 'diagnostic', diagnostic: toDiagnostic(m.message), packageId: m.package_id };
    case 'compiler-artifact':
      return {
        kind: 'artifact',
        artifact: {
          packageId: m.package_id,
          kinds: m.target?.kind ?? [],
          name: m.target?.name ?? '',
          srcPath: m.target?.src_path ?? '',
          test: !!m.profile?.test,
          executable: m.executable ?? null,
        },
      };
    case 'build-finished':
      return { kind: 'build-finished', success: !!m.success };
    default:
      return { kind: 'other' };
  }
}

/**
 * Lines of a rendered diagnostic as a terminal shows them. `rendered` ends with "\n\n" for
 * errors and warnings (a blank separator line) and with "\n" for the closing notes.
 */
export function renderedLines(d: Diagnostic): string[] {
  if (!d.rendered) return [];
  return d.rendered.replace(/\n$/, '').split('\n');
}

// ESC [ … m and the shift-in byte term uses after resets.
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*[A-Za-z]|\x0f/g;

export function stripAnsi(s: string): string {
  return s.replace(ANSI, '');
}

export type PanicInfo = { message: string; file: string; line: number; col: number };

/**
 * Finds the first panic in program/test output:
 *
 *   thread 'tests::bad' (11952) panicked at src/main.rs:22:24:
 *   assertion `left == right` failed: math is broken
 *     left: 2
 *    right: 3
 */
export function parsePanic(lines: string[]): PanicInfo | undefined {
  for (let i = 0; i < lines.length; i++) {
    const l = stripAnsi(lines[i]);
    const m = /^thread '([^']*)'(?: \(\d+\))? panicked at (.+?):(\d+):(\d+):?\s*(.*)$/.exec(l);
    if (!m) continue;
    const msg: string[] = [];
    // Older format puts the message on the same line after a comma or colon.
    if (m[5]) msg.push(m[5].replace(/^'|'$/g, ''));
    for (let j = i + 1; j < lines.length; j++) {
      const t = stripAnsi(lines[j]);
      if (t.startsWith('note: run with `RUST_BACKTRACE') || t.startsWith('stack backtrace:') || t === '') break;
      if (/^thread '/.test(t) || /^test /.test(t)) break;
      msg.push(t);
    }
    return { message: msg.join('\n'), file: m[2], line: Number(m[3]), col: Number(m[4]) };
  }
  return undefined;
}

/** First error code in a list of diagnostics ("E0382"), for "Explain E0382" buttons. */
export function firstErrorCode(diags: Diagnostic[]): string | null {
  for (const d of diags) if (d.level === 'error' && d.code) return d.code;
  return null;
}
