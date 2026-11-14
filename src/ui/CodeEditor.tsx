// Shared code editor (design/project/CodeEditor.dc.html): highlighted Rust/TOML with a line-number
// gutter, current-line highlight, error/warning/run line marks with a wavy underline, and a symbol
// key row above the keyboard. Used by the Exercise (Workspace) and project Editor screens.
//
// Editing uses a real multiline TextInput with transparent text, laid exactly over the highlighted
// lines (same font, size, line height and left offset), so the platform keeps caret, selection,
// IME and clipboard behavior. The editor only post-processes edits (auto-indent, bracket pairs).
import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View,
  type HostInstance, type NativeSyntheticEvent, type ScrollViewInstance, type StyleProp, type TextInputInstance, type TextInputSelectionChangeEvent, type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C, MARK, SYN } from '../theme/tokens';
import { mono } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { highlightAny, type Mark, type MarkKind, type Tok } from '../rust/highlight';
import { useApp } from '../state/app';
import { Press, Row } from './core';

const MB: Record<MarkKind, string> = { err: 'rgba(255,107,118,0.08)', warn: 'rgba(242,194,91,0.07)', run: 'rgba(255,161,74,0.08)' };
const TOK_BG: Record<MarkKind, string> = { err: 'rgba(255,107,118,0.12)', warn: 'rgba(242,194,91,0.12)', run: 'rgba(255,161,74,0.12)' };
const CUR_BG = 'rgba(255,255,255,0.035)';
const GUTTER_DIM = '#5C5752';
const GUTTER_CUR = '#D6D0C9';
const CARET = C.rust;
const PAIRS: Record<string, string> = { '{': '}', '(': ')', '[': ']', '"': '"' };
const CLOSERS = new Set([')', '}', ']']);
const SYMBOLS = ['{', '}', '(', ')', ';', ':', '&', '<', '>', '!', '::', '->'];
const GUTTER_W = 44;
const PAD_L = 4;
const PAD_R = 24;
const PAD_T = 10;

/** prefs.codeSize (11–20, default 14) → editor font size / line height. 14 → 13/21 (the design). */
export function editorMetrics(codeSize: number) {
  const fontSize = Math.max(10, Math.min(19, (codeSize || 14) - 1));
  const lineHeight = Math.round((fontSize * 21) / 13);
  // JetBrains Mono advance width is 600/1000 em.
  return { fontSize, lineHeight, charW: fontSize * 0.6 };
}

export type CodeEditorHandle = {
  focus: () => void;
  blur: () => void;
  undo: () => void;
  redo: () => void;
  /** Insert at the current selection (replacing it). */
  insert: (text: string) => void;
};

export type CodeEditorProps = {
  value: string;
  onChange: (v: string) => void;
  lang?: string;
  marks?: Mark[];
  readOnly?: boolean;
  /** Extra space below the last line (the Exercise sheet covers the bottom). */
  padBottom?: number;
  /** Scroll so this 1-based line is in view (e.g. the first error). */
  scrollToLine?: number;
  onFocusChange?: (focused: boolean) => void;
  /** Show the hide-keyboard key at the end of the key row (Workspace has its own). */
  hideKey?: boolean;
  bg?: string;
  style?: StyleProp<ViewStyle>;
};

type Sel = { start: number; end: number };
type Snap = { v: string; sel: Sel };

const Line = memo(function Line({ toks, mark, cur, fs, lh }: { toks: Tok[]; mark: MarkKind | null; cur: boolean; fs: number; lh: number }) {
  const P = SYN.dark;
  return (
    <View style={{ height: lh, backgroundColor: mark ? MB[mark] : cur ? CUR_BG : undefined }}>
      <Text style={{ ...mono(400), fontSize: fs, lineHeight: lh, height: lh, color: P.id }}>
        {toks.length === 0 ? ' ' : toks.map((tk, i) => (
          <Text
            key={i}
            style={[
              { color: P[tk.k] },
              tk.k === 'com' ? { fontFamily: 'JetBrainsMono_400Regular_Italic' } : null,
              tk.m ? { backgroundColor: TOK_BG[tk.m], borderRadius: 2 } : null,
            ]}
          >
            {tk.t}
          </Text>
        ))}
      </Text>
    </View>
  );
});

/** Wavy underline under a marked span (CSS `text-decoration-style: wavy` has no RN equivalent). */
function Wave({ x, y, w, color }: { x: number; y: number; w: number; color: string }) {
  const step = 3;
  let d = `M 0 2`;
  for (let i = 0, up = true; i < w; i += step, up = !up) d += ` L ${Math.min(w, i + step)} ${up ? 0.5 : 3}`;
  return (
    <Svg pointerEvents="none" width={w} height={4} style={{ position: 'absolute', left: x, top: y }}>
      <Path d={d} stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

function lineOf(v: string, pos: number) {
  let n = 1;
  for (let i = 0; i < pos && i < v.length; i++) if (v.charCodeAt(i) === 10) n++;
  return n;
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { value, onChange, lang = 'rust', marks = [], readOnly, padBottom = 24, scrollToLine, onFocusChange, hideKey = true, bg = C.ground, style },
  ref,
) {
  const codeSize = useApp((s) => s.prefs.codeSize);
  const symbolRow = useApp((s) => s.prefs.symbolRow);
  const autoClose = useApp((s) => s.prefs.autoClose);
  const { fontSize: fs, lineHeight: lh, charW } = editorMetrics(codeSize);

  const inputRef = useRef<TextInputInstance>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const valueRef = useRef(value);
  const selRef = useRef<Sel>({ start: 0, end: 0 });
  const pendingSel = useRef<Sel | null>(null);
  const undoStack = useRef<Snap[]>([]);
  const redoStack = useRef<Snap[]>([]);
  const lastPush = useRef(0);
  const [focused, setFocused] = useState(false);
  const [curLine, setCurLine] = useState(1);
  const [, force] = useState(0);
  const [nativeSel, setNativeSel] = useState<Sel | undefined>(undefined);

  // External value changes (reset, apply, undo by the parent) keep our ref in sync.
  if (value !== valueRef.current && pendingSel.current === null) valueRef.current = value;

  const lines = useMemo(() => highlightAny(value, lang, marks), [value, lang, marks]);
  const maxLen = useMemo(() => value.split('\n').reduce((a, l) => Math.max(a, l.length), 0), [value]);
  const contentW = PAD_L + (maxLen + 2) * charW + PAD_R;

  const applySel = useCallback((sel: Sel) => {
    const node = inputRef.current as unknown as { setSelectionRange?: (a: number, b: number) => void; setSelection?: (a: number, b: number) => void } | null;
    if (!node) return;
    if (Platform.OS === 'web' && node.setSelectionRange) node.setSelectionRange(sel.start, sel.end);
    else if (node.setSelection) node.setSelection(sel.start, sel.end);
    else setNativeSel(sel);
  }, []);

  useLayoutEffect(() => {
    if (pendingSel.current) {
      const s = pendingSel.current;
      pendingSel.current = null;
      selRef.current = s;
      applySel(s);
      setCurLine(lineOf(valueRef.current, s.start));
    }
  });

  useEffect(() => { if (nativeSel) { const t = setTimeout(() => setNativeSel(undefined), 0); return () => clearTimeout(t); } }, [nativeSel]);

  // Web: textarea attributes RN-web does not expose.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!node || !node.style) return;
    node.setAttribute('wrap', 'off');
    node.setAttribute('data-oxed', '1');
    node.style.caretColor = CARET;
    node.style.whiteSpace = 'pre';
    node.style.overflow = 'hidden';
    node.style.fontVariantLigatures = 'none';
    node.style.tabSize = '4';
    if (typeof document !== 'undefined' && !document.getElementById('oxed-style')) {
      const st = document.createElement('style');
      st.id = 'oxed-style';
      st.textContent = 'textarea[data-oxed]::selection{background:rgba(247,76,0,0.38);color:transparent}textarea[data-oxed]{outline:none}';
      document.head.appendChild(st);
    }
  }, []);

  useEffect(() => {
    if (!scrollToLine) return;
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, (scrollToLine - 8) * lh), animated: true }), 60);
    return () => clearTimeout(t);
  }, [scrollToLine, lh]);

  const commit = useCallback((next: string, sel: Sel, forcePush = false) => {
    const prev = valueRef.current;
    if (next === prev) {
      pendingSel.current = sel;
      force((n) => n + 1);
      return;
    }
    const now = Date.now();
    if (forcePush || now - lastPush.current > 600) {
      undoStack.current.push({ v: prev, sel: selRef.current });
      if (undoStack.current.length > 200) undoStack.current.shift();
    }
    lastPush.current = now;
    redoStack.current = [];
    valueRef.current = next;
    pendingSel.current = sel;
    onChange(next);
  }, [onChange]);

  const insert = useCallback((text: string) => {
    if (readOnly) return;
    const v = valueRef.current;
    const { start: s, end: e } = selRef.current;
    if (autoClose && CLOSERS.has(text) && s === e && v[s] === text) { commit(v, { start: s + 1, end: s + 1 }); return; }
    let ins = text;
    let back = 0;
    if (autoClose && PAIRS[text]) {
      if (s === e) { ins = text + PAIRS[text]; back = 1; } else ins = text + v.slice(s, e) + PAIRS[text];
    }
    const c = s + ins.length - back;
    commit(v.slice(0, s) + ins + v.slice(e), { start: c, end: c }, ins.length > 1);
  }, [autoClose, commit, readOnly]);

  const undo = useCallback(() => {
    const u = undoStack.current.pop();
    if (!u) return;
    redoStack.current.push({ v: valueRef.current, sel: selRef.current });
    lastPush.current = 0;
    valueRef.current = u.v;
    pendingSel.current = u.sel;
    onChange(u.v);
  }, [onChange]);

  const redo = useCallback(() => {
    const r = redoStack.current.pop();
    if (!r) return;
    undoStack.current.push({ v: valueRef.current, sel: selRef.current });
    valueRef.current = r.v;
    pendingSel.current = r.sel;
    onChange(r.v);
  }, [onChange]);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => { inputRef.current?.blur(); Keyboard.dismiss(); },
    undo, redo, insert,
  }), [undo, redo, insert]);

  /** Native edit → post-process (auto-indent on Enter, bracket and quote pairs). */
  const onChangeText = (next: string) => {
    const prev = valueRef.current;
    const before = selRef.current;
    let p = 0;
    const maxP = Math.min(prev.length, next.length, Math.max(before.start, 0) || 0);
    while (p < maxP && prev.charCodeAt(p) === next.charCodeAt(p)) p++;
    let sfx = 0;
    while (sfx < prev.length - p && sfx < next.length - p && prev.charCodeAt(prev.length - 1 - sfx) === next.charCodeAt(next.length - 1 - sfx)) sfx++;
    const inserted = next.slice(p, next.length - sfx);
    const removed = prev.slice(p, prev.length - sfx);
    const head = prev.slice(0, p);
    const tail = prev.slice(prev.length - sfx);

    if (inserted === '\n') {
      const ls = head.lastIndexOf('\n') + 1;
      const indent = (head.slice(ls).match(/^[ \t]*/) ?? [''])[0];
      const pc = head[head.length - 1];
      const nc = tail[0];
      if (pc && PAIRS[pc] && PAIRS[pc] === nc && pc !== '"') {
        const ins = '\n' + indent + '    \n' + indent;
        const c = p + 1 + indent.length + 4;
        return commit(head + ins + tail, { start: c, end: c }, true);
      }
      const ins = '\n' + indent + (pc === '{' || pc === '(' || pc === '[' ? '    ' : '');
      return commit(head + ins + tail, { start: p + ins.length, end: p + ins.length }, true);
    }
    if (autoClose && inserted.length === 1 && removed === '') {
      const ch = inserted;
      if (CLOSERS.has(ch) && tail[0] === ch) return commit(prev, { start: p + 1, end: p + 1 });
      if (ch === '"' && tail[0] === '"') return commit(prev, { start: p + 1, end: p + 1 });
      if (PAIRS[ch] && !(ch === '"' && /\w/.test(head[head.length - 1] ?? ''))) {
        return commit(head + ch + PAIRS[ch] + tail, { start: p + 1, end: p + 1 });
      }
    }
    if (autoClose && inserted === '' && removed.length === 1 && PAIRS[removed] && PAIRS[removed] === tail[0] && before.start === before.end) {
      return commit(head + tail.slice(1), { start: p, end: p });
    }
    const c = p + inserted.length;
    commit(next, { start: c, end: c });
  };

  const onSelectionChange = (e: TextInputSelectionChangeEvent) => {
    const sel = e.nativeEvent.selection;
    if (pendingSel.current) return;
    selRef.current = sel;
    const ln = lineOf(valueRef.current, sel.start);
    if (ln !== curLine) setCurLine(ln);
  };

  const onKeyPress = (e: NativeSyntheticEvent<{ key: string }>) => {
    if (Platform.OS !== 'web') return;
    const ne = e.nativeEvent as unknown as KeyboardEvent & { key: string };
    if (ne.key === 'Tab') { (e as unknown as { preventDefault: () => void }).preventDefault(); insert('    '); }
    else if ((ne.ctrlKey || ne.metaKey) && ne.key.toLowerCase() === 'z') {
      (e as unknown as { preventDefault: () => void }).preventDefault();
      if (ne.shiftKey) redo(); else undo();
    }
  };

  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setFocus = (f: boolean) => {
    clearTimeout(blurTimer.current);
    if (f) { setFocused(true); onFocusChange?.(true); return; }
    // A tap on the key row can blur the input for a moment on web; only hide after a beat.
    blurTimer.current = setTimeout(() => { setFocused(false); onFocusChange?.(false); }, 120);
  };
  useEffect(() => () => clearTimeout(blurTimer.current), []);
  const keyRowRef = useRef<HostInstance>(null);
  const keyRowMounted = focused && symbolRow && !readOnly;
  useEffect(() => {
    if (Platform.OS !== 'web' || !keyRowMounted) return;
    const node = keyRowRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const h = (e: Event) => e.preventDefault();
    node.addEventListener('mousedown', h);
    return () => node.removeEventListener('mousedown', h);
  }, [keyRowMounted]);

  const showKeys = focused && symbolRow && !readOnly;
  const keyPress = (fn: () => void) => () => { fn(); if (Platform.OS === 'web') setTimeout(() => inputRef.current?.focus(), 0); };
  const textH = lines.length * lh;

  return (
    // Edge-to-edge Android doesn't resize the window for the keyboard; keep the key row above it.
    <KeyboardAvoidingView enabled={Platform.OS !== 'web'} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[{ flex: 1, minHeight: 0, backgroundColor: bg }, style]}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: PAD_T, paddingBottom: padBottom, flexGrow: 1 }}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: GUTTER_W, backgroundColor: bg }}>
            {lines.map((ln) => {
              const cur = focused && ln.n === curLine;
              const mc = ln.mark ? MARK[ln.mark] : null;
              return (
                <View key={ln.n} style={{ height: lh, backgroundColor: ln.mark ? MB[ln.mark] : cur ? CUR_BG : undefined, justifyContent: 'center' }}>
                  {mc ? <View style={{ position: 'absolute', left: 9, top: (lh - 6) / 2, width: 6, height: 6, borderRadius: 3, backgroundColor: mc }} /> : null}
                  <Text style={{ ...mono(400), fontSize: fs - 1, lineHeight: lh, textAlign: 'right', paddingRight: 12, color: mc ?? (cur ? GUTTER_CUR : GUTTER_DIM) }}>{ln.n}</Text>
                </View>
              );
            })}
          </View>
          <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: contentW, flexGrow: 1 }}>
              <View style={{ paddingLeft: PAD_L, paddingRight: PAD_R }}>
                {lines.map((ln) => (
                  <Line key={ln.n} toks={ln.toks} mark={ln.mark} cur={focused && ln.n === curLine} fs={fs} lh={lh} />
                ))}
              </View>
              {marks.map((mk, i) => (
                mk.line <= lines.length ? <Wave key={i} x={PAD_L + (mk.col - 1) * charW} y={(mk.line - 1) * lh + lh - 4} w={Math.max(charW, mk.len * charW)} color={MARK[mk.kind]} /> : null
              ))}
              <TextInput
                ref={inputRef}
                value={value}
                onChangeText={onChangeText}
                onSelectionChange={onSelectionChange}
                onKeyPress={onKeyPress}
                onFocus={() => setFocus(true)}
                onBlur={() => setFocus(false)}
                selection={nativeSel}
                editable={!readOnly}
                multiline
                scrollEnabled={false}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
                cursorColor={CARET}
                selectionColor="rgba(247,76,0,0.38)"
                selectionHandleColor={CARET}
                textAlignVertical="top"
                underlineColorAndroid="transparent"
                style={{
                  position: 'absolute', top: 0, left: PAD_L, width: contentW - PAD_L, height: textH + lh,
                  margin: 0, padding: 0, paddingTop: 0, paddingBottom: 0, borderWidth: 0,
                  ...mono(400), fontSize: fs, lineHeight: lh, color: 'transparent', backgroundColor: 'transparent',
                  includeFontPadding: false,
                }}
              />
            </View>
          </ScrollView>
        </View>
      </ScrollView>
      {showKeys ? (
        <View ref={keyRowRef} style={{ backgroundColor: C.sheet, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
          <Row style={{ height: 52 }}>
            <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center', gap: 4, paddingLeft: 6, paddingRight: 4 }}>
              {SYMBOLS.map((k) => (
                <Press key={k} focusable={false} onPress={keyPress(() => insert(k))} overlay={null} pressedStyle={{ backgroundColor: C.tertiary }} accessibilityLabel={k}
                  style={{ minWidth: 44, height: 44, paddingHorizontal: 9, borderRadius: 9, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ ...mono(500), fontSize: 15, color: '#F0ECE7' }}>{k}</Text>
                </Press>
              ))}
            </ScrollView>
            <Row style={{ gap: 2, paddingHorizontal: 6, height: 34, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.08)' }}>
              <KeyIcon name="keyboard_tab" label="Tab" onPress={keyPress(() => insert('    '))} />
              <KeyIcon name="undo" label="Undo" dim={!undoStack.current.length} onPress={keyPress(undo)} />
              <KeyIcon name="redo" label="Redo" dim={!redoStack.current.length} onPress={keyPress(redo)} />
              {hideKey ? <KeyIcon name="keyboard_hide" label="Hide keyboard" onPress={() => { clearTimeout(blurTimer.current); inputRef.current?.blur(); Keyboard.dismiss(); setFocused(false); onFocusChange?.(false); }} /> : null}
            </Row>
          </Row>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
});

function KeyIcon({ name, label, onPress, dim }: { name: string; label: string; onPress: () => void; dim?: boolean }) {
  return (
    <Press focusable={false} onPress={onPress} accessibilityLabel={label} overlay={null} pressedStyle={{ backgroundColor: C.outline }}
      style={{ width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={22} color={dim ? GUTTER_DIM : '#F0ECE7'} />
    </Press>
  );
}

export default CodeEditor;
