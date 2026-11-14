// Blocks the Reader inserts around the Book's text (Reader.dc.html): marker, practice cards, tip, end cards.
import React from 'react';
import { Text, View } from 'react-native';
import type { Inline, RustlingsExercise } from '../../content';
import { C } from '../../theme/tokens';
import { m, t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { Inset, Row } from '../../ui/core';
import { Button } from '../../ui/controls';
import { Rich } from '../../ui/code';
import { InlineText } from './Inline';

const label = (color: string) => m(11, undefined, 500, color, { letterSpacing: 0.99 });

export function LeftOffMarker() {
  return (
    <Row style={{ gap: 10 }}>
      <View style={{ height: 1, flex: 1, backgroundColor: 'rgba(247,76,0,0.4)' }} />
      <Text style={m(10.5, undefined, 500, C.rustLight, { letterSpacing: 0.84 })}>YOU LEFT OFF HERE</Text>
      <View style={{ height: 1, flex: 1, backgroundColor: 'rgba(247,76,0,0.4)' }} />
    </Row>
  );
}

export function PracticeCard({ ex, onTry }: { ex: RustlingsExercise; onTry: () => void }) {
  return (
    <Row style={{ paddingVertical: 14, paddingLeft: 14, paddingRight: 12, borderRadius: 18, backgroundColor: C.s1, gap: 12 }}>
      <Inset color={C.doneTint22} radius={18} />
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.doneTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="data_object" size={22} color={C.done} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={m(10.5, undefined, 500, C.done, { letterSpacing: 0.84 })}>PRACTICE IN RUSTLINGS · +{ex.xp} XP</Text>
        <Text style={m(15, undefined, 600, C.text)}>{ex.name}</Text>
        {ex.summary ? <Rich text={ex.summary} style={t(13, 1.4, 400, C.secondary)} /> : null}
      </View>
      <Button variant="tonal" height={40} fontSize={13.5} label="Try it" onPress={onTry} style={{ paddingHorizontal: 14 }} />
    </Row>
  );
}

const em = (v: string): Inline => ({ k: 'em', c: [{ k: 't', v }] });

/** "IN OXIDE" tip (1.2). */
export function OxideTip() {
  const nodes: Inline[] = [{ k: 't', v: 'Oxide already made ' }, em('~/projects'), { k: 't', v: ' for you, and the Terminal tab opens there. You’ll use it at the end of this section.' }];
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: C.doneTint07, flexDirection: 'row', gap: 12 }}>
      <Inset color="rgba(87,214,200,0.18)" radius={14} />
      <Icon name="smartphone" size={20} color={C.done} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={label(C.done)}>IN OXIDE</Text>
        <InlineText nodes={nodes} style={t(15, 1.55, 400, C.strong2)} />
      </View>
    </View>
  );
}

function EndShell({ children, gap = 14 }: { children: React.ReactNode; gap?: number }) {
  return (
    <View style={{ marginTop: 8, padding: 18, borderRadius: 20, backgroundColor: C.s2, gap }}>
      <Inset radius={20} />
      {children}
    </View>
  );
}

const PracticeButton = ({ name, onPress }: { name: string; onPress: () => void }) => (
  <Button onPress={onPress} label={
    <Text style={t(15.5, undefined, 650, C.onRust)} numberOfLines={1}>Practice: <Text style={m(14.5, undefined, 400, C.onRust)}>{name}</Text></Text>
  }>
    <Icon name="arrow_forward" size={22} color={C.onRust} />
  </Button>
);

const UpNext = ({ text, onPress }: { text: string; onPress: () => void }) => (
  <Button variant="outlined" height={48} fontSize={14.5} label={text} onPress={onPress} />
);

/** 1.2: YOUR TURN. */
export function EndHello({ onTerminal, next }: { onTerminal: () => void; next?: { text: string; go: () => void } }) {
  return (
    <EndShell gap={12}>
      <Text style={label(C.secondary)}>YOUR TURN</Text>
      <Text style={t(17, 1.4, 600, C.text)}>Make a project and run it in the Terminal.</Text>
      <Text style={t(14.5, 1.55, 400, C.secondary)}>Cargo, Rust’s build tool, creates a project with this Hello, world! program already in it. Section 1.3 covers Cargo in full.</Text>
      <Button onPress={onTerminal} label="Open the Terminal" fontSize={15.5} style={{ marginTop: 4 }}>
        <Icon name="arrow_forward" size={22} color={C.onRust} />
      </Button>
      {next ? <UpNext text={next.text} onPress={next.go} /> : null}
    </EndShell>
  );
}

/** 4.2: THE RULES OF REFERENCES, as designed. */
export function EndRules({ practice, next }: { practice?: { name: string; go: () => void }; next?: { text: string; go: () => void } }) {
  const rules: Inline[][] = [
    [{ k: 't', v: 'At any given time, you can have ' }, em('either'), { k: 't', v: ' one mutable reference ' }, em('or'), { k: 't', v: ' any number of immutable references.' }],
    [{ k: 't', v: 'References must always be valid.' }],
  ];
  return (
    <EndShell>
      <Text style={label(C.secondary)}>THE RULES OF REFERENCES</Text>
      {rules.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
          <Text style={t(15.5, 1.55, 400, C.rustLight)}>•</Text>
          <View style={{ flex: 1 }}><InlineText nodes={r} style={t(15.5, 1.55, 400, C.reading)} /></View>
        </View>
      ))}
      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 2 }} />
      <Text style={t(13.5, 1.45, 400, C.secondary)}>Rustlings drills this section in move_semantics2–5.</Text>
      {practice ? <PracticeButton name={practice.name} onPress={practice.go} /> : null}
      {next ? <UpNext text={next.text} onPress={next.go} /> : null}
    </EndShell>
  );
}

/** Every other section: what Rustlings drills here, then what's next. */
export function EndGeneric({ sectionLabel, drills, practice, next }: { sectionLabel: string; drills: string; practice?: { name: string; go: () => void }; next?: { text: string; go: () => void } }) {
  return (
    <EndShell>
      <Text style={label(C.secondary)}>{sectionLabel}</Text>
      {drills ? <Text style={t(13.5, 1.45, 400, C.secondary)}>Rustlings drills this section in {drills}.</Text> : null}
      {practice ? <PracticeButton name={practice.name} onPress={practice.go} /> : null}
      {next ? <UpNext text={next.text} onPress={next.go} /> : null}
    </EndShell>
  );
}
