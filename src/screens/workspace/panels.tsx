// Exercise sheet tab contents: Output, Explain, Hints, Solution (design/project/Workspace.dc.html).
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { C, SYN } from '../../theme/tokens';
import { m, t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { Press, Row } from '../../ui/core';
import { AnsiLines, Rich } from '../../ui/code';
import { highlight } from '../../rust/highlight';
import type { DiffLine } from '../../rust/diff';
import type { Explanation, ExplainFix } from '../../rust/explain';
import type { HintCard } from './model';

const LBL = m(11, undefined, 500, C.tertiary, { letterSpacing: 0.88 });

export function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={{ paddingVertical: 28, paddingHorizontal: 32, alignItems: 'center', gap: 10 }}>
      <Icon name={icon} size={32} color={C.iconOff} />
      <Text style={t(15, undefined, 600, C.text)}>{title}</Text>
      <Text style={t(13.5, 1.5, 400, C.secondary, { maxWidth: 280, textAlign: 'center' })}>{body}</Text>
    </View>
  );
}

export function OutputPanel({ command, lines, wrap, onWrap }: { command: string; lines: string[]; wrap: boolean; onWrap: () => void }) {
  return (
    <View style={{ paddingTop: 10, paddingBottom: 28 }}>
      <Row style={{ gap: 8, paddingLeft: 16, paddingRight: 10, paddingBottom: 8 }}>
        <Text style={m(12, undefined, 400, C.tertiary, { flex: 1, minWidth: 0 })} numberOfLines={1}>$ {command}</Text>
        <Press onPress={onWrap} radius={8} accessibilityLabel="Wrap lines"
          style={{ height: 30, paddingLeft: 8, paddingRight: 10, borderRadius: 8, borderWidth: 1, borderColor: wrap ? C.rustTint50 : C.outline, backgroundColor: wrap ? C.rustTint : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name="wrap_text" size={16} color={C.strong2} />
          <Text style={t(12, undefined, 500, C.strong2)}>Wrap</Text>
        </Press>
      </Row>
      {lines.length ? (
        <AnsiLines lines={lines} fontSize={11.5} lineHeight={17.5} wrap={wrap} style={{ paddingHorizontal: 16 }} />
      ) : (
        <EmptyState icon="terminal" title="No output yet" body="Check compiles this file and runs its tests. rustc’s messages show up here, unedited." />
      )}
    </View>
  );
}

/** Highlighted code in a #0F0E0E well (WAYS TO FIX), 12/19. */
export function CodeWell({ code }: { code: string }) {
  const P = SYN.dark;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: C.ground, borderRadius: 10 }} contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 12 }}>
      <View>
        {highlight(code).map((ln) => (
          <Text key={ln.n} style={m(12, 19, 400, P.id, { minHeight: 19 })}>
            {ln.toks.length ? ln.toks.map((tk, i) => <Text key={i} style={{ color: P[tk.k], fontFamily: tk.k === 'com' ? 'JetBrainsMono_400Regular_Italic' : undefined }}>{tk.t}</Text>) : ' '}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

/** The compact -/+ diff (Solution tab, HINT 3, solution fix). 12/22. */
export function DiffBlock({ diff }: { diff: DiffLine[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderRadius: 12, backgroundColor: C.ground }} contentContainerStyle={{ paddingVertical: 6, flexGrow: 1 }}>
      <View style={{ minWidth: '100%' }}>
        {diff.map((d, i) => {
          const add = d.op === '+';
          return (
            <Row key={i} style={{ backgroundColor: d.op === ' ' ? undefined : add ? 'rgba(87,214,200,0.10)' : 'rgba(255,107,118,0.10)', alignItems: 'flex-start' }}>
              <Text style={m(12, 22, 400, C.disabled, { width: 30, textAlign: 'right', paddingRight: 8 })}>{d.n}</Text>
              <Text style={m(12, 22, 400, add ? C.done : C.error, { width: 16 })}>{d.op === ' ' ? '' : d.op}</Text>
              <Text style={m(12, 22, 400, d.op === ' ' ? C.secondary : add ? '#CFF3EE' : '#F3C9CC', { paddingRight: 12 })}>{d.t || ' '}</Text>
            </Row>
          );
        })}
      </View>
    </ScrollView>
  );
}

function OutlineButton({ icon, label, onPress, height = 40, size = 14, weight = 500 as const }: { icon?: string; label: string; onPress: () => void; height?: number; size?: number; weight?: 500 | 600 }) {
  return (
    <Press onPress={onPress} radius={height / 2} accessibilityRole="button"
      style={{ height, paddingHorizontal: 16, paddingLeft: icon ? 12 : 16, borderRadius: height / 2, borderWidth: 1, borderColor: C.handle, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {icon ? <Icon name={icon} size={height >= 48 ? 20 : 18} color={C.text} /> : null}
      <Text style={t(size, undefined, weight, C.text)}>{label}</Text>
    </Press>
  );
}

export function ExplainPanel({ exp, readLabel, onRead, onRustc, onApply }: { exp: Explanation | null; readLabel: string | null; onRead: () => void; onRustc: () => void; onApply: (f: ExplainFix) => void }) {
  if (!exp) return <EmptyState icon="school" title="Nothing to explain" body="When Check hits an error or a panic, a plain-English walkthrough appears here." />;
  return (
    <View style={{ paddingTop: 18, paddingHorizontal: 18, paddingBottom: 32, gap: 18 }}>
      <Rich text={exp.lead} style={t(15.5, 1.6, 400, '#E6E1DB')} />
      <View style={{ gap: 4 }}>
        <Text style={[LBL, { paddingBottom: 4 }]}>WHAT HAPPENED</Text>
        {exp.steps.map((s, i) => (
          <Row key={i} style={{ gap: 12, alignItems: 'flex-start', paddingVertical: 6 }}>
            <View style={{ minWidth: 36, height: 22, borderRadius: 6, paddingHorizontal: 4, backgroundColor: s.ok ? C.raised : 'rgba(255,107,118,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={m(11, 22, 600, s.ok ? C.mutedHi2 : C.errorText)}>{s.line != null ? `L${s.line}` : '·'}</Text>
            </View>
            <Rich text={s.text} style={t(14, 1.5, 400, C.strong2, { flex: 1 })} />
            <Icon name={s.ok ? 'arrow_downward' : 'close'} size={20} color={s.ok ? C.disabled : C.error} />
          </Row>
        ))}
      </View>
      {exp.fixes.length ? (
        <View style={{ gap: 10 }}>
          <Text style={LBL}>WAYS TO FIX</Text>
          {exp.fixes.map((f, i) => (
            <View key={i} style={{ borderRadius: 16, backgroundColor: '#232120', padding: 14, gap: 10 }}>
              <Rich text={f.label} style={t(14.5, 1.35, 600, C.text)} />
              {f.code ? <CodeWell code={f.code} /> : f.diff ? <DiffBlock diff={f.diff} /> : null}
              <Rich text={f.note} style={t(13.5, 1.5, 400, C.mutedHi2)} />
              {f.apply ? <View style={{ alignSelf: 'flex-start' }}><OutlineButton icon="input" label="Apply to my file" onPress={() => onApply(f)} /></View> : null}
            </View>
          ))}
        </View>
      ) : null}
      {readLabel || exp.rustc ? (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
          {readLabel ? (
            <Press onPress={onRead} overlay="rgba(255,255,255,0.04)" style={{ minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name="menu_book" size={20} color={C.secondary} />
              <Text style={t(14, 1.35, 500, C.text, { flex: 1 })}>Read {readLabel}</Text>
              <Icon name="chevron_right" size={20} color={C.tertiary} />
            </Press>
          ) : null}
          {exp.rustc ? (
            <Press onPress={onRustc} overlay="rgba(255,255,255,0.04)" style={{ minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: readLabel ? 1 : 0, borderTopColor: C.border }}>
              <Icon name="terminal" size={20} color={C.secondary} />
              <Text style={m(13, undefined, 500, C.text, { flex: 1 })}>rustc --explain {exp.rustc}</Text>
              <Icon name="chevron_right" size={20} color={C.tertiary} />
            </Press>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function HintsPanel({ hints, shown, onReveal }: { hints: HintCard[]; shown: number; onReveal: () => void }) {
  return (
    <View style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 28, gap: 10 }}>
      {hints.map((h, i) => {
        const open = i < shown;
        return (
          <View key={i} style={{ borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: open ? '#232120' : 'transparent', borderWidth: open ? 0 : 1, borderColor: C.border, gap: 10 }}>
            <Text style={m(11, undefined, 600, open ? C.rustLight : C.tertiary, { letterSpacing: 0.77 })}>HINT {i + 1} · {h.kind}</Text>
            {open ? (h.diff ? <DiffBlock diff={h.diff} /> : <Rich text={h.text ?? ''} style={t(14.5, 1.55, 400, '#E4DFD9')} />) : null}
            {i === shown ? <View style={{ alignSelf: 'flex-start' }}><OutlineButton icon="visibility" label={`Reveal hint ${i + 1}`} onPress={onReveal} /></View> : null}
            {i > shown ? <Text style={t(13, undefined, 400, C.tertiary)}>Reveal hint {i} first</Text> : null}
          </View>
        );
      })}
      <Text style={t(13, 1.5, 400, C.tertiary, { textAlign: 'center', paddingTop: 4 })}>Every failed Check counts as an attempt. Hints don’t.</Text>
    </View>
  );
}

export function SolutionPanel(p: {
  locked: boolean; policy: 'after3' | 'afterPass' | 'never'; attempts: number; xp: number; diff: DiffLine[]; applied: boolean;
  onPeek: () => void; onHints: () => void; onApply: () => void; onUndo: () => void;
}) {
  if (p.locked) {
    const left = 3 - p.attempts;
    const title = p.policy === 'never' ? 'Solutions are hidden' : p.policy === 'afterPass' ? 'Unlocks after you pass' : 'Unlocks after 3 attempts';
    const lead = p.policy === 'after3' && left > 0 ? (left === 1 ? '1 more failed Check to go. ' : `${left} more failed Checks to go. `) : '';
    return (
      <View style={{ paddingTop: 28, paddingHorizontal: 28, paddingBottom: 32, alignItems: 'center', gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#262422', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lock" size={26} color={C.strong2} />
        </View>
        <Text style={t(16, undefined, 600, C.text)}>{title}</Text>
        {p.policy === 'after3' ? (
          <Row style={{ gap: 8 }}>
            {[0, 1, 2].map((i) => <View key={i} style={{ width: 28, height: 6, borderRadius: 3, backgroundColor: i < p.attempts ? C.rust : C.outline }} />)}
          </Row>
        ) : null}
        <Text style={t(13.5, 1.5, 400, C.secondary, { maxWidth: 290, textAlign: 'center' })}>{lead}Every failed Check counts as an attempt. Hints don’t.</Text>
        {p.policy !== 'never' ? (
          <Press onPress={p.onPeek} radius={22} overlay="rgba(255,255,255,0.04)" style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: C.outline, justifyContent: 'center' }}>
            <Text style={t(14, undefined, 600, C.text)}>See it now</Text>
          </Press>
        ) : null}
        <OutlineButton label="Open hints" onPress={p.onHints} />
      </View>
    );
  }
  return (
    <View style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 28, gap: 12 }}>
      <Text style={t(13.5, undefined, 400, C.secondary)}>Official solution from Rustlings</Text>
      {p.diff.length ? <DiffBlock diff={p.diff} /> : <Text style={t(13.5, 1.5, 400, C.tertiary)}>The official solution is the same as the original file.</Text>}
      {p.applied ? (
        <Row style={{ gap: 8 }}>
          <View style={{ flex: 1 }}><OutlineButton icon="undo" label="Undo" height={48} size={14.5} weight={600} onPress={p.onUndo} /></View>
        </Row>
      ) : (
        <OutlineButton icon="input" label="Apply to my file" height={48} size={14.5} weight={600} onPress={p.onApply} />
      )}
      <Text style={t(13, 1.5, 400, C.tertiary, { textAlign: 'center' })}>Passing with the solution applied earns 10 XP instead of {p.xp}.</Text>
    </View>
  );
}
