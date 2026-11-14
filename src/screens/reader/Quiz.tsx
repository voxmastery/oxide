// "Quick check" cards from Brown University's interactive edition (Reader.dc.html, SPEC "Inserted blocks").
import React, { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { Quiz, QuizQuestion } from '../../content';
import { useApp, XP } from '../../state/app';
import { C } from '../../theme/tokens';
import { m, sans, t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { Inset, Press, Row } from '../../ui/core';
import { Button } from '../../ui/controls';
import { Md, MdLine, QuizCode } from './Inline';

// ---------- deterministic shuffle ----------

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function shuffled<T>(xs: T[], seed: string): T[] {
  let a = hash(seed) || 1;
  const rnd = () => { a = (a + 0x6d2b79f5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

const norm = (s: string) => s.replace(/`/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

// ---------- option ----------

type OptState = 'idle' | 'picked' | 'right' | 'wrong' | 'dim';

function Option({ label, state, square, onPress, disabled }: { label: string; state: OptState; square?: boolean; onPress: () => void; disabled: boolean }) {
  const bd = state === 'right' ? C.done : state === 'wrong' ? C.error : state === 'picked' ? C.rust : C.border;
  const bg = state === 'right' ? 'rgba(87,214,200,0.08)' : state === 'wrong' ? 'rgba(255,107,118,0.08)' : state === 'picked' ? C.rustTint08 : 'transparent';
  const rc = state === 'right' ? C.done : state === 'wrong' ? C.error : state === 'picked' ? C.rust : C.iconOff;
  const rf = state === 'right' ? C.done : state === 'wrong' ? C.error : state === 'picked' ? C.rust : 'transparent';
  const icon = state === 'right' || state === 'picked' ? 'check' : state === 'wrong' ? 'close' : '';
  const r = square ? 6 : 11;
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole={square ? 'checkbox' : 'radio'} accessibilityState={{ checked: state !== 'idle' && state !== 'dim', disabled }} radius={14}
      style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: bg, opacity: state === 'dim' ? 0.5 : 1 }}>
      <Inset color={bd} width={1.5} radius={14} />
      <View style={{ width: 22, height: 22, borderRadius: r, backgroundColor: rf, alignItems: 'center', justifyContent: 'center' }}>
        <Inset color={rc} width={2} radius={r} />
        {icon ? <Icon name={icon} size={16} color={C.ground} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <MdLine src={label} style={t(14.5, 1.45, 400, C.text)} />
      </View>
    </Press>
  );
}

function Verdict({ correct, fresh, wrongText, context, extra }: { correct: boolean; fresh: boolean; wrongText: string; context?: string; extra?: React.ReactNode }) {
  return (
    <View style={{ gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.s4 }}>
      <Text style={t(14, 1.4, 650, correct ? C.done : C.errorText)}>{correct ? (fresh ? `Correct · +${XP.quickCheck} XP` : 'Correct') : wrongText}</Text>
      {extra}
      {context ? <Md src={context} style={t(14, 1.55, 400, C.strong2)} gap={8} /> : null}
    </View>
  );
}

function AnswerInput({ value, onChange, onSubmit, state, placeholder, mono }: { value: string; onChange: (s: string) => void; onSubmit: () => void; state: 'idle' | 'right' | 'wrong'; placeholder: string; mono?: boolean }) {
  const bd = state === 'right' ? C.done : state === 'wrong' ? C.error : C.border;
  return (
    <View style={{ minHeight: 48, borderRadius: 14, backgroundColor: C.ground, justifyContent: 'center' }}>
      <Inset color={bd} width={1.5} radius={14} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        editable={state === 'idle'}
        placeholder={placeholder}
        placeholderTextColor={C.tertiary}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        multiline={mono}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        style={[mono ? m(13, 20, 400, C.text) : { ...sans(400), fontSize: 15, color: C.text }, { paddingHorizontal: 14, paddingVertical: 12, outlineWidth: 0 } as object]}
      />
    </View>
  );
}

// ---------- one question ----------

type Answered = { correct: boolean; fresh: boolean; picks?: string[]; text?: string; compiles?: boolean };

function QuestionView({ qid, q, answered, onAnswer }: { qid: string; q: QuizQuestion; answered: Answered | null; onAnswer: (a: Answered) => void }) {
  const done = !!answered;
  const [sel, setSel] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [compiles, setCompiles] = useState<boolean | null>(null);

  if (q.type === 'MultipleChoice') {
    const opts = shuffled([...q.answer, ...q.distractors], qid);
    const multi = !!q.multi || q.answer.length > 1;
    const check = (picks: string[]) => {
      const ok = picks.length === q.answer.length && picks.every((p) => q.answer.includes(p));
      onAnswer({ correct: ok, fresh: true, picks });
    };
    const picks = answered?.picks ?? sel;
    return (
      <>
        {q.code ? <QuizCode code={q.code} /> : null}
        <Md src={q.prompt} style={t(15.5, 1.5, 600, C.text)} />
        {multi && !done ? <Text style={t(12.5, 1.4, 400, C.tertiary, { marginTop: -6 })}>Select all that apply.</Text> : null}
        <View style={{ gap: 8 }}>
          {opts.map((o) => {
            const isAns = q.answer.includes(o), picked = picks.includes(o);
            const st: OptState = !done ? (picked ? 'picked' : 'idle') : isAns ? 'right' : picked ? 'wrong' : 'dim';
            return <Option key={o} label={o} square={multi} state={st} disabled={done}
              onPress={() => (multi ? setSel((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o])) : check([o]))} />;
          })}
        </View>
        {multi && !done ? <Button variant="tonal" height={40} fontSize={14} label="Check" disabled={!sel.length} onPress={() => check(sel)} style={{ alignSelf: 'flex-start' }} /> : null}
        {answered ? <Verdict correct={answered.correct} fresh={answered.fresh} wrongText={multi ? 'Not quite. The highlighted answers are right.' : 'Not quite. The highlighted answer is right.'} context={q.context} /> : null}
      </>
    );
  }

  if (q.type === 'ShortAnswer') {
    const submit = () => { if (text.trim()) onAnswer({ correct: norm(text) === norm(q.answer), fresh: true, text }); };
    return (
      <>
        <Md src={q.prompt} style={t(15.5, 1.5, 600, C.text)} />
        <AnswerInput value={answered?.text ?? text} onChange={setText} onSubmit={submit} state={!answered ? 'idle' : answered.correct ? 'right' : 'wrong'} placeholder="Your answer" />
        {!done ? <Button variant="tonal" height={40} fontSize={14} label="Check" disabled={!text.trim()} onPress={submit} style={{ alignSelf: 'flex-start' }} /> : null}
        {answered ? (
          <Verdict correct={answered.correct} fresh={answered.fresh} wrongText="Not quite."
            extra={!answered.correct ? <MdLine src={`The answer is \`${q.answer}\`.`} style={t(14, 1.55, 400, C.text)} /> : null}
            context={q.context} />
        ) : null}
      </>
    );
  }

  // Tracing: does it compile? then what does it print?
  const shown = answered?.compiles ?? compiles;
  const pickCompile = (yes: boolean) => {
    if (yes !== q.doesCompile) { onAnswer({ correct: false, fresh: true, compiles: yes }); return; }
    if (!q.doesCompile) { onAnswer({ correct: true, fresh: true, compiles: yes }); return; }
    setCompiles(yes);
  };
  const submitOut = () => onAnswer({ correct: norm(text) === norm(q.stdout ?? ''), fresh: true, compiles: true, text });
  const optState = (yes: boolean): OptState => {
    const isAns = yes === q.doesCompile, picked = shown === yes;
    if (!done) return picked ? 'picked' : 'idle';
    return isAns ? 'right' : picked ? 'wrong' : 'dim';
  };
  const askOut = q.doesCompile && shown === true;
  const lineNote = !q.doesCompile && q.lineNumber ? `The error is on line ${q.lineNumber}.` : '';
  return (
    <>
      <QuizCode code={q.program} />
      <Text style={t(15.5, 1.5, 600, C.text)}>Does this program compile?</Text>
      <View style={{ gap: 8 }}>
        <Option label="Yes, it compiles" state={optState(true)} disabled={done || shown !== null} onPress={() => pickCompile(true)} />
        <Option label="No, it doesn’t compile" state={optState(false)} disabled={done || shown !== null} onPress={() => pickCompile(false)} />
      </View>
      {askOut ? (
        <>
          <Text style={t(15.5, 1.5, 600, C.text)}>What does it print?</Text>
          <AnswerInput value={answered?.text ?? text} onChange={setText} onSubmit={submitOut} state={!answered ? 'idle' : answered.correct ? 'right' : 'wrong'} placeholder="Program output" mono />
          {!done ? <Button variant="tonal" height={40} fontSize={14} label="Check" onPress={submitOut} style={{ alignSelf: 'flex-start' }} /> : null}
        </>
      ) : null}
      {answered ? (
        <Verdict correct={answered.correct} fresh={answered.fresh}
          wrongText={answered.compiles !== q.doesCompile ? 'Not quite. The highlighted answer is right.' : 'Not quite. It prints:'}
          extra={q.doesCompile && q.stdout != null && (answered.compiles !== q.doesCompile || !answered.correct || answered.text == null)
            ? <QuizCode code={q.stdout} lang="text" />
            : lineNote ? <Text style={t(14, 1.55, 400, C.text)}>{lineNote}</Text> : null}
          context={q.context} />
      ) : null}
    </>
  );
}

// ---------- the card ----------

export function QuickCheck({ quiz }: { quiz: Quiz }) {
  const stored = useApp((s) => s.quickChecks);
  const answer = useApp((s) => s.answerQuickCheck);
  const ids = useMemo(() => quiz.questions.map((_, i) => `${quiz.id}/${i}`), [quiz]);
  const [local, setLocal] = useState<Record<number, Answered>>({});
  const firstOpen = ids.findIndex((id) => !(id in stored));
  const [idx, setIdx] = useState(firstOpen < 0 ? ids.length - 1 : firstOpen);
  const q = quiz.questions[idx];
  const id = ids[idx];
  const ans: Answered | null = local[idx] ?? (id in stored ? { correct: stored[id], fresh: false } : null);
  const n = quiz.questions.length;
  return (
    <View style={{ padding: 16, borderRadius: 20, backgroundColor: C.s2, gap: 14 }}>
      <Inset color="rgba(242,194,91,0.2)" radius={20} />
      <Row style={{ gap: 8 }}>
        <Icon name="quiz" size={18} color={C.checkpoint} />
        <Text style={m(11, undefined, 500, C.checkpoint, { letterSpacing: 0.99 })}>QUICK CHECK{n > 1 ? ` · ${idx + 1} OF ${n}` : ''}</Text>
        <View style={{ flex: 1 }} />
        <Text style={t(11.5, undefined, 400, C.tertiary)} numberOfLines={1}>Brown interactive edition</Text>
      </Row>
      <QuestionView key={id} qid={id} q={q} answered={ans}
        onAnswer={(a) => {
          const fresh = !(id in useApp.getState().quickChecks);
          setLocal((l) => ({ ...l, [idx]: { ...a, fresh: fresh && a.correct } }));
          answer(id, a.correct);
        }} />
      {ans && idx < n - 1 ? (
        <Button variant="tonal" height={40} fontSize={14} label="Next question" trailingIcon="arrow_forward" onPress={() => setIdx(idx + 1)} style={{ alignSelf: 'flex-start' }} />
      ) : null}
    </View>
  );
}
