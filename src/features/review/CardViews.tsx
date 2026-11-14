// One review card per kind: the question side, then the answer once picked/revealed.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { C } from '../../theme/tokens';
import { m, t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { Inset, Press, Row } from '../../ui/core';
import { Button } from '../../ui/controls';
import { CodeView, Rich } from '../../ui/code';
import { navActions } from '../../nav/store';
import { sectionById } from '../../content';
import { Option, QuestionView, type Answered, type OptState } from '../../screens/reader/Quiz';
import { QuizCode } from '../../screens/reader/Inline';
import { errorChoices, type Card, type ErrorCard, type ExerciseCard, type QuizCard } from './cards';

/** Result of the question side: right/wrong for choice cards, null for recall cards. */
export type CardResult = { correct: boolean | null };

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function Label({ text, color, right }: { text: string; color: string; right?: string }) {
  return (
    <Row style={{ gap: 8 }}>
      <Text numberOfLines={1} style={m(11, undefined, 500, color, { letterSpacing: 0.99, flexShrink: 1 })}>{text}</Text>
      <View style={{ flex: 1 }} />
      {right ? <Text numberOfLines={1} style={t(11.5, undefined, 400, C.tertiary)}>{right}</Text> : null}
    </Row>
  );
}

function LinkRow({ icon, label, onPress, mono: isMono }: { icon: string; label: string; onPress: () => void; mono?: boolean }) {
  return (
    <Press onPress={onPress} overlay="rgba(255,255,255,0.04)" radius={10} accessibilityRole="link"
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, borderRadius: 10 }}>
      <Icon name={icon} size={18} color={C.rustLight} />
      <Text numberOfLines={1} style={isMono ? m(13, undefined, 500, C.rustLight, { flex: 1 }) : t(14, undefined, 600, C.rustLight, { flex: 1 })}>{label}</Text>
    </Press>
  );
}

function ReadLink({ section }: { section?: string }) {
  const sec = section ? sectionById(section) : undefined;
  if (!sec) return null;
  return <LinkRow icon="menu_book" label={`Read ${sec.id} ${sec.title}`} onPress={() => navActions().nav('reader', { arg: sec.id })} />;
}

function AnswerBox({ title, color, children }: { title: string; color: string; children?: React.ReactNode }) {
  return (
    <View style={{ gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.s4 }}>
      <Text style={t(14, 1.4, 650, color)}>{title}</Text>
      {children}
    </View>
  );
}

// ---------- error you fixed ----------

function ErrorView({ card, seed, met, onResult }: { card: ErrorCard; seed: string; met: string[]; onResult: (r: CardResult) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const choices = errorChoices(card, met, seed);
  const done = pick !== null;
  const right = pick === card.code;
  return (
    <>
      <Label text="AN ERROR YOU FIXED" color={C.errorText} />
      <QuizCode code={card.snippet} />
      <Text style={t(15.5, 1.5, 600, C.text)}>What’s wrong with this code?</Text>
      <View style={{ gap: 8 }}>
        {choices.map((c) => {
          const st: OptState = !done ? 'idle' : c.code === card.code ? 'right' : c.code === pick ? 'wrong' : 'dim';
          return <Option key={c.code} label={cap(c.title)} state={st} disabled={done}
            onPress={() => { setPick(c.code); onResult({ correct: c.code === card.code }); }} />;
        })}
      </View>
      {done ? (
        <AnswerBox title={right ? `Right: ${card.code}` : `Not quite. This is ${card.code}`} color={right ? C.done : C.errorText}>
          <Text style={t(14, 1.45, 600, C.text)}>{cap(card.title)}</Text>
          {card.about ? <Rich text={card.about} style={t(14, 1.55, 400, C.strong2)} /> : null}
          <View>
            <ReadLink section={card.section} />
            <LinkRow icon="terminal" mono label={`rustc --explain ${card.code}`}
              onPress={() => navActions().nav('terminal', { params: { run: `rustc --explain ${card.code}` } })} />
          </View>
        </AnswerBox>
      ) : null}
    </>
  );
}

// ---------- quick check you missed ----------

function QuizView({ card, onResult }: { card: QuizCard; onResult: (r: CardResult) => void }) {
  const [ans, setAns] = useState<Answered | null>(null);
  const sec = sectionById(card.section);
  return (
    <>
      <Label text="A QUICK CHECK YOU MISSED" color={C.checkpoint} right={sec ? `${sec.id} ${sec.title}` : undefined} />
      <QuestionView qid={`review:${card.qid}`} q={card.question} answered={ans}
        onAnswer={(a) => { setAns({ ...a, fresh: false }); onResult({ correct: a.correct }); }} />
      {ans ? <ReadLink section={card.section} /> : null}
    </>
  );
}

// ---------- exercise you passed ----------

function ExerciseView({ card, onResult }: { card: ExerciseCard; onResult: (r: CardResult) => void }) {
  const [shown, setShown] = useState(false);
  const target = card.snippet.split('\n')[card.line - 1] ?? '';
  const col = target.length - target.trimStart().length + 1;
  return (
    <>
      <Label text={`RUSTLINGS · ${card.exercise.toUpperCase()}`} color={C.done} right="from the solution" />
      <View style={{ borderRadius: 12, backgroundColor: C.ground, overflow: 'hidden' }}>
        <CodeView code={card.snippet} fontSize={12} lineHeight={19} padding={12} style={{ paddingVertical: 2 }}
          marks={[{ line: card.line, col, len: target.trim().length, kind: 'run' }]} />
      </View>
      <Text style={t(15.5, 1.5, 600, C.text)}>What does the highlighted line do?</Text>
      {!shown ? (
        <>
          <Text style={t(13.5, 1.5, 400, C.secondary, { marginTop: -6 })}>Answer it in your head, then check.</Text>
          <Button variant="tonal" height={40} fontSize={14} label="Show answer" onPress={() => { setShown(true); onResult({ correct: null }); }} style={{ alignSelf: 'flex-start' }} />
        </>
      ) : (
        <AnswerBox title="The change in the official solution" color={C.done}>
          <View style={{ borderRadius: 10, backgroundColor: C.ground, paddingVertical: 8, paddingHorizontal: 12, gap: 2 }}>
            {card.before.map((l, i) => <Text key={`b${i}`} style={m(12, 19, 400, C.errorText)}>{`- ${l}`}</Text>)}
            <Text style={m(12, 19, 400, C.done)}>{`+ ${card.lineText}`}</Text>
          </View>
          {card.notes.map((n, i) => <Rich key={i} text={n} style={t(14, 1.55, 400, C.strong2)} />)}
          {card.summary ? <Rich text={`The task was: ${card.summary}`} style={t(13.5, 1.5, 400, C.secondary)} /> : null}
          <View>
            <LinkRow icon="data_object" mono label={`Open ${card.exercise}`} onPress={() => navActions().nav('workspace', { arg: card.exercise })} />
            <ReadLink section={card.section} />
          </View>
        </AnswerBox>
      )}
    </>
  );
}

export function CardView({ card, seed, met, onResult }: { card: Card; seed: string; met: string[]; onResult: (r: CardResult) => void }) {
  return (
    <View style={{ padding: 16, borderRadius: 20, backgroundColor: C.s2, gap: 14 }}>
      <Inset radius={20} />
      {card.kind === 'error' ? <ErrorView card={card} seed={seed} met={met} onResult={onResult} />
        : card.kind === 'quiz' ? <QuizView card={card} onResult={onResult} />
        : <ExerciseView card={card} onResult={onResult} />}
    </View>
  );
}
