// Success state (Workspace.dc.html "success"): burst, check, XP counting up, level, Rustlings,
// streak and mission progress, Next / Compare.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { C } from '../../theme/tokens';
import { m, t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { Press, Row } from '../../ui/core';
import { Bar } from '../../ui/controls';
import { levelOf } from '../../state/selectors';

export type SuccessInfo = {
  name: string;
  kicker: string;
  meta: string;
  xpBefore: number;
  earned: number;
  rlDone: number;
  rlTotal: number;
  topicLabel: string;
  streakTitle: string;
  streakSub: string;
  next: string | null;
};

const COLS = ['#F74C00', '#57D6C8', '#F2C25B', '#ECE8E3'];

function Burst() {
  const a = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 950, delay: 260, easing: Easing.bezier(0.15, 0.7, 0.3, 1), useNativeDriver: true }).start();
    Animated.timing(ring, { toValue: 1, duration: 900, delay: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [a, ring]);
  const kids = [];
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2 + 0.2;
    const d = 56 + (i % 3) * 14;
    const w = i % 2 ? 6 : 9;
    const h = i % 2 ? 6 : 3;
    kids.push(
      <Animated.View key={i} style={{
        position: 'absolute', left: 46 - 4, top: 46 - 2, width: w, height: h, borderRadius: i % 3 === 0 ? 4.5 : 1, backgroundColor: COLS[i % 4],
        opacity: a.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [
          { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(ang) * d] }) },
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(ang) * d] }) },
          { scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) },
        ],
      }} />,
    );
  }
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {kids}
      <Animated.View style={{
        position: 'absolute', left: 15, top: 15, right: 15, bottom: 15, borderRadius: 31, borderWidth: 2, borderColor: C.done,
        opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
        transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.8] }) }],
      }} />
    </View>
  );
}

export function Success({ info, onNext, onCompare, onClose, onSpeedRun }: { info: SuccessInfo; onNext: () => void; onCompare: () => void; onClose: () => void; onSpeedRun?: () => void }) {
  const slide = useRef(new Animated.Value(0)).current;
  const [xp, setXp] = useState(0);
  useEffect(() => {
    Animated.timing(slide, { toValue: 1, duration: 460, easing: Easing.bezier(0.2, 0.9, 0.25, 1.04), useNativeDriver: true }).start();
    let n = 0;
    const id = setInterval(() => { n += 2; setXp(Math.min(n, info.earned)); if (n >= info.earned) clearInterval(id); }, 30);
    return () => clearInterval(id);
  }, [slide, info.earned]);
  const total = info.xpBefore + xp;
  const lv = levelOf(info.xpBefore + info.earned);
  const fmt = (n: number) => n.toLocaleString('en-US');
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 12, justifyContent: 'flex-end' }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,9,9,0.62)', opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }}>
        <Press onPress={onClose} overlay={null} style={{ flex: 1 }} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={{
        backgroundColor: C.s2, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 6, paddingHorizontal: 20, paddingBottom: 20, gap: 18,
        shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: -12 }, elevation: 16,
        transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }],
      }}>
        <View style={{ height: 18, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.handle }} /></View>
        <Row style={{ gap: 16 }}>
          <View style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }}>
            <Burst />
            <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: C.done, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={36} color={C.onDone} />
            </View>
          </View>
          <View style={{ gap: 6, flex: 1, minWidth: 0 }}>
            <Text style={m(11.5, undefined, 600, C.done, { letterSpacing: 0.8 })}>{info.kicker}</Text>
            <Text style={m(21, 25, 600, C.text, { letterSpacing: -0.21 })} numberOfLines={1}>{info.name}</Text>
            <Text style={t(13, undefined, 400, C.mutedHi2)}>{info.meta}</Text>
          </View>
        </Row>
        <View style={{ gap: 12, padding: 16, borderRadius: 18, backgroundColor: '#232120' }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={m(30, 30, 700, C.flame, { fontVariant: ['tabular-nums'] })}>+{xp} XP</Text>
            <Text style={m(12.5, undefined, 500, C.mutedHi2, { fontVariant: ['tabular-nums'] })}>{fmt(total)} / {fmt(lv.to)}</Text>
          </Row>
          <Bar value={(total - lv.from) / Math.max(1, lv.to - lv.from)} height={8} track={C.outline} />
          <Row style={{ justifyContent: 'space-between', gap: 12 }}>
            <Text style={t(13, undefined, 400, C.mutedHi2, { flexShrink: 1 })} numberOfLines={1}>Lv {lv.level} · {lv.title}</Text>
            <Text style={t(13, undefined, 400, C.mutedHi2, { fontVariant: ['tabular-nums'] })}>{fmt(Math.max(0, lv.to - total))} XP to Lv {lv.level + 1}</Text>
          </Row>
        </View>
        <Row style={{ gap: 14, paddingHorizontal: 4 }}>
          <Icon name="data_object" size={28} color={C.done} />
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <Text style={t(15, undefined, 600, C.text)}>Rustlings {info.rlDone} of {info.rlTotal}</Text>
              <Text style={m(12, undefined, 500, C.mutedHi2)} numberOfLines={1}>{info.topicLabel}</Text>
            </Row>
            <Bar value={info.rlDone / Math.max(1, info.rlTotal)} height={4} color={C.done} track={C.outline} />
          </View>
        </Row>
        <Row style={{ gap: 14, paddingHorizontal: 4 }}>
          <Icon name="local_fire_department" size={28} color={C.flame} fill />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={t(15, undefined, 600, C.text)}>{info.streakTitle}</Text>
            <Text style={t(13, undefined, 400, C.mutedHi2)}>{info.streakSub}</Text>
          </View>
        </Row>
        <View style={{ gap: 4 }}>
          <Press onPress={onNext} overlay={null} pressedStyle={{ backgroundColor: C.rustPressed }} accessibilityRole="button"
            style={{ height: 56, borderRadius: 28, backgroundColor: C.rust, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {info.next ? (
              <>
                <Text style={t(16, undefined, 650, C.onRust)}>Next:</Text>
                <Text style={m(15, undefined, 500, C.onRust)}>{info.next}</Text>
              </>
            ) : <Text style={t(16, undefined, 650, C.onRust)}>Back to Practice</Text>}
            <Icon name="arrow_forward" size={22} color={C.onRust} />
          </Press>
          <Press onPress={onCompare} radius={24} style={{ height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={t(15, undefined, 600, C.strong2)}>Compare with the official solution</Text>
          </Press>
          {onSpeedRun ? (
            <Press onPress={onSpeedRun} radius={24} accessibilityRole="button" style={{ height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="timer" size={20} color={C.strong2} />
              <Text style={t(15, undefined, 600, C.strong2)}>Speed run from the original file</Text>
            </Press>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}
