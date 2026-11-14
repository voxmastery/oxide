// One command block: `$ command` header with status, ANSI output (scrolls sideways, prose wraps)
// and action buttons for known errors.
import React, { memo, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { C, SYN, TC } from '../../theme/tokens';
import { m, t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { Inset, Press, Row } from '../../ui/core';
import { Spinner } from '../../ui/controls';
import { ansi } from '../../rust/ansi';
import { highlightAny } from '../../rust/highlight';
import { errors } from '../../content';
import { navActions } from '../../nav/store';
import { lineText, type Block, type Line } from './store';
import { submit } from './shell';
import { FerrisTerminalLine } from '../../features/ferris';

const OUT = m(12, 18, 400, TC.n);
const BOLD = 'JetBrainsMono_700Bold';
const REG = 'JetBrainsMono_400Regular';

function OneLine({ l, width }: { l: Line; width: number }) {
  if (typeof l === 'string') {
    if (l === '') return <Text style={OUT}> </Text>;
    return (
      <Text style={OUT}>
        {ansi(l).map((s, i) => <Text key={i} style={{ color: TC[s.c], fontFamily: s.bold ? BOLD : REG }}>{s.t}</Text>)}
      </Text>
    );
  }
  if ('w' in l) {
    return (
      <Text style={[OUT, { width }]}>
        {l.w === '' ? ' ' : ansi(l.w).map((s, i) => <Text key={i} style={{ color: TC[s.c], fontFamily: s.bold ? BOLD : REG }}>{s.t}</Text>)}
      </Text>
    );
  }
  const toks = l.code === '' ? [] : highlightAny(l.code, l.lang)[0]?.toks ?? [];
  return (
    <Text style={OUT}>
      {l.pre ? l.pre : null}
      {toks.length === 0 && !l.pre ? ' ' : toks.map((tk, i) => (
        <Text key={i} style={{ color: SYN.dark[tk.k], fontFamily: tk.k === 'com' ? 'JetBrainsMono_400Regular_Italic' : REG }}>{tk.t}</Text>
      ))}
    </Text>
  );
}

const CHUNK = 120;
const NO_LINES: string[] = [];

/** A slice of lines; re-renders only when its lines change (output streams into the last chunk). */
const Chunk = memo(
  function Chunk({ lines, width }: { lines: Line[]; width: number }) {
    return <>{lines.map((l, i) => <OneLine key={i} l={l} width={width} />)}</>;
  },
  (a, b) => a.width === b.width && a.lines.length === b.lines.length && a.lines[0] === b.lines[0] && a.lines[a.lines.length - 1] === b.lines[b.lines.length - 1],
);

function Output({ b, width }: { b: Block; width: number }) {
  const chunks: Line[][] = [];
  for (let i = 0; i < b.lines.length; i += CHUNK) chunks.push(b.lines.slice(i, i + CHUNK));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
      <View>
        {b.dropped ? <Text style={[OUT, { color: TC.d }]}>{`… ${b.dropped} earlier lines not shown`}</Text> : null}
        {chunks.map((c, i) => <Chunk key={i} lines={c} width={width} />)}
      </View>
    </ScrollView>
  );
}

type Act = { k: string; icon: string; ic: string; label: string; onPress: () => void };

function actions(b: Block): Act[] {
  const { nav, tab } = navActions();
  const out: Act[] = [];
  if (b.st !== 'run' && b.err && errors[b.err]) out.push({ k: 'x', icon: 'help', ic: C.errorText, label: `Explain ${b.err}`, onPress: () => { submit(`rustc --explain ${b.err}`); } });
  if (b.st !== 'run' && b.ex) out.push({ k: 'e', icon: 'data_object', ic: C.done, label: `Open ${b.ex}`, onPress: () => nav('workspace', { arg: b.ex }) });
  const sec = b.explain ? errors[b.explain]?.section : undefined;
  if (sec) out.push({ k: 'r', icon: 'menu_book', ic: C.rustLight, label: `Read ${sec}`, onPress: () => nav('reader', { arg: sec }) });
  if (b.practice) out.push({ k: 'p', icon: 'data_object', ic: C.done, label: 'Open Practice', onPress: () => tab('practice') });
  return out;
}

export const BlockView = memo(function BlockView({ b, running, program, width, onLayoutH }: { b: Block; running: boolean; program: boolean; width: number; onLayoutH?: (id: number, h: number) => void }) {
  const run = b.st === 'run';
  const meta = running && program ? 'running' : run ? '' : b.st === 'err' ? `exit ${b.code}` : b.dur;
  const mc = b.st === 'err' ? C.errorText : running && program ? C.rustLight : C.tertiary;
  const acts = actions(b);
  const failed = b.st === 'err' && !!b.cmd;
  const plainLines = useMemo(() => (failed ? b.lines.map(lineText) : NO_LINES), [failed, b.lines]);
  const open = () => navActions().pop('cmd', { command: b.cmd, meta: b.st === 'err' ? `exit ${b.code}` : b.dur || b.cwd, output: b.lines.map(lineText) });
  return (
    <Press
      overlay={null}
      onPress={b.cmd ? open : undefined}
      disabled={!b.cmd}
      onLayout={(e) => onLayoutH?.(b.id, e.nativeEvent.layout.height)}
      style={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 14, gap: 8, borderBottomWidth: 1, borderBottomColor: C.divider }}
    >
      {b.cmd ? (
        <Row style={{ gap: 8, minHeight: 20 }}>
          <Text style={m(13.5, undefined, 600, C.rustLight)}>$</Text>
          <Text style={m(13.5, undefined, 500, C.text, { flex: 1, minWidth: 0 })} numberOfLines={1}>{b.cmd}</Text>
          {run && !(running && program) ? <Spinner size={13} width={2} color={C.rustLight} /> : null}
          {meta ? <Text style={m(11.5, undefined, 500, mc)} numberOfLines={1}>{meta}</Text> : null}
          <Press onPress={open} radius={20} accessibilityLabel="More" style={{ width: 40, height: 40, marginVertical: -10, marginRight: -12, marginLeft: -4, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="more_vert" size={18} color={C.disabled} />
          </Press>
        </Row>
      ) : null}
      {b.lines.length || b.dropped ? <Output b={b} width={width} /> : null}
      {acts.length ? (
        <Row style={{ gap: 8, flexWrap: 'wrap', paddingTop: 2 }}>
          {acts.map((a) => (
            <Press key={a.k} onPress={a.onPress} overlay={null} pressedStyle={{ backgroundColor: '#262422' }} style={{ height: 40, paddingLeft: 10, paddingRight: 14, borderRadius: 12, backgroundColor: C.s3, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name={a.icon} size={18} color={a.ic} />
              <Text style={t(13, undefined, 600, C.text)} numberOfLines={1}>{a.label}</Text>
              <Inset color={C.border} radius={12} />
            </Press>
          ))}
        </Row>
      ) : null}
      {failed ? <FerrisTerminalLine cmd={b.cmd} failed={failed} lines={plainLines} /> : null}
    </Press>
  );
});
