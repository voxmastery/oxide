// Speed-run pieces used by the Exercise screen: the timer chip and the result card.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Share, Text, View } from 'react-native';
import { C } from '../../theme/tokens';
import { m, t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { Inset, Press, Row } from '../../ui/core';
import { Ferris } from '../ferris/Ferris';
import { useFerrisOn } from '../ferris/store';
import { fmtRunTime, shareText, SPEEDRUN_XP, SPEEDRUN_XP_PER_DAY, type RunOutcome } from './store';

/** Timer chip for the Exercise screen's chip row: waits for the first edit, ticks, then freezes. */
export function SpeedTimer({ startedAt, finalMs, best }: { startedAt: number | null; finalMs: number | null; best: number | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (startedAt === null || finalMs !== null) return;
    const id = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [startedAt, finalMs]);
  const running = startedAt !== null && finalMs === null;
  const ms = finalMs ?? (startedAt !== null ? Date.now() - startedAt : 0);
  const color = finalMs !== null ? C.done : running ? C.rustLight : C.secondary;
  return (
    <Row accessibilityRole="timer" accessibilityLabel={startedAt === null ? `Speed run. The timer starts when you type.${best !== null ? ` Best ${fmtRunTime(best)}.` : ''}` : `Speed run time ${fmtRunTime(ms)}`}
      style={{ height: 28, paddingLeft: 7, paddingRight: 10, borderRadius: 8, backgroundColor: running ? C.rustTint08 : 'transparent', gap: 5, flexShrink: 0 }}>
      <Icon name="timer" size={16} color={color} fill={running} />
      <Text style={m(13, undefined, 600, color, { fontVariant: ['tabular-nums'] })}>{fmtRunTime(ms)}</Text>
      <Inset color={running ? C.rustTint20 : '#36332F'} radius={8} />
    </Row>
  );
}

export type SpeedResult =
  | { kind: 'run'; outcome: RunOutcome }
  /** Passed without a single edit: nothing to time. */
  | { kind: 'noedit'; exercise: string }
  /** A fix or the solution was applied during the run: it doesn't count. */
  | { kind: 'assisted'; exercise: string; ms: number };

const signed = (ms: number) => `${ms < 0 ? '−' : '+'}${(Math.abs(ms) / 1000).toFixed(1)}s`;

/** Result card (bottom sheet over the Exercise screen), styled like the Success state. */
export function SpeedRunResult({ result, onAgain, onDone, onClose }: { result: SpeedResult; onAgain: () => void; onDone: () => void; onClose: () => void }) {
  const ferris = useFerrisOn();
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: 1, duration: 420, easing: Easing.bezier(0.2, 0.9, 0.25, 1.04), useNativeDriver: true }).start();
  }, [slide]);

  const o = result.kind === 'run' ? result.outcome : null;
  const exercise = result.kind === 'run' ? result.outcome.exercise : result.exercise;
  const best = !!o?.isBest;
  const kicker = o ? (best ? (o.prevBest === null ? 'FIRST SPEED RUN' : 'NEW PERSONAL BEST') : 'SPEED RUN') : result.kind === 'assisted' ? 'SPEED RUN · ASSISTED' : 'SPEED RUN';
  const kc = best ? C.done : C.secondary;
  const big = o ? fmtRunTime(o.ms) : result.kind === 'assisted' ? fmtRunTime(result.ms) : '—';

  let note: string;
  let noteColor: string = C.mutedHi2;
  if (o) {
    if (o.xp) { note = `+${o.xp} XP for a personal best`; noteColor = C.flame; }
    else if (o.capped) note = `Personal bests earn XP ${SPEEDRUN_XP_PER_DAY} times a day. This one is saved; XP is back tomorrow.`;
    else note = `Beat ${fmtRunTime(o.prevBest ?? 0)} to set a new best (+${SPEEDRUN_XP} XP).`;
  } else if (result.kind === 'assisted') note = 'A fix or the solution was applied during this run, so it isn’t saved. Try one on your own.';
  else note = 'It passed before you changed anything, so there was nothing to time.';

  const share = () => { if (o) Share.share({ message: shareText(o) }).catch(() => {}); };
  const mood = best ? 'celebrating' : result.kind === 'run' ? 'happy' : 'thinking';

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 12, justifyContent: 'flex-end' }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.scrim, opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }}>
        <Press onPress={onClose} overlay={null} style={{ flex: 1 }} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={{
        backgroundColor: C.s2, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 6, paddingHorizontal: 20, paddingBottom: 20, gap: 18,
        shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: -12 }, elevation: 16,
        transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }],
      }}>
        <View style={{ height: 18, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.handle }} /></View>
        <Row style={{ gap: 16 }}>
          <View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: best ? C.doneTint07 : C.s3, alignItems: 'center', justifyContent: 'center' }}>
            {ferris ? <Ferris mood={mood} size={62} /> : <Icon name="timer" size={36} color={best ? C.done : C.strong2} fill />}
          </View>
          <View style={{ gap: 6, flex: 1, minWidth: 0 }}>
            <Text style={m(11.5, undefined, 600, kc, { letterSpacing: 0.8 })}>{kicker}</Text>
            <Text style={m(21, 25, 600, C.text, { letterSpacing: -0.21 })} numberOfLines={1}>{exercise}</Text>
            <Text style={t(13, undefined, 400, C.mutedHi2)}>From the original file</Text>
          </View>
        </Row>
        <View style={{ gap: 12, padding: 16, borderRadius: 18, backgroundColor: '#232120' }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <Text style={m(34, 36, 700, best ? C.done : C.text, { fontVariant: ['tabular-nums'] })}>{big}</Text>
            {o && o.prevBest !== null ? (
              <Text style={m(13, undefined, 600, o.ms < o.prevBest ? C.done : C.mutedHi2, { fontVariant: ['tabular-nums'] })}>{signed(o.ms - o.prevBest)}</Text>
            ) : null}
          </Row>
          {o ? (
            <Row style={{ justifyContent: 'space-between', gap: 12 }}>
              <Text style={t(13, undefined, 400, C.mutedHi2)}>Personal best</Text>
              <Text style={m(13, undefined, 500, C.strong2, { fontVariant: ['tabular-nums'] })}>{fmtRunTime(best ? o.ms : o.prevBest ?? o.ms)}</Text>
            </Row>
          ) : null}
          {o ? (
            <Row style={{ justifyContent: 'space-between', gap: 12 }}>
              <Text style={t(13, undefined, 400, C.mutedHi2)}>Runs</Text>
              <Text style={m(13, undefined, 500, C.strong2, { fontVariant: ['tabular-nums'] })}>{o.runs}</Text>
            </Row>
          ) : null}
        </View>
        <Text style={t(13.5, 1.45, o?.xp ? 600 : 400, noteColor, { paddingHorizontal: 4 })}>{note}</Text>
        <View style={{ gap: 4 }}>
          <Press onPress={onAgain} overlay={null} pressedStyle={{ backgroundColor: C.rustPressed }} accessibilityRole="button"
            style={{ height: 56, borderRadius: 28, backgroundColor: C.rust, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="replay" size={22} color={C.onRust} />
            <Text style={t(16, undefined, 650, C.onRust)}>Run again</Text>
          </Press>
          <Row style={{ gap: 4 }}>
            {o ? (
              <Press onPress={share} radius={24} accessibilityRole="button" style={{ flex: 1, height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon name="share" size={20} color={C.strong2} />
                <Text style={t(15, undefined, 600, C.strong2)}>Share</Text>
              </Press>
            ) : null}
            <Press onPress={onDone} radius={24} accessibilityRole="button" style={{ flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={t(15, undefined, 600, C.strong2)}>Done</Text>
            </Press>
          </Row>
        </View>
      </Animated.View>
    </View>
  );
}
