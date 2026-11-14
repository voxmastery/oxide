// Celebration effects with RN Animated: `ox-ring` (scale .7 → 1.8 while fading) and `ox-burst`
// (particles flying out, shrinking to .35 and fading), as in design/project/oxide-lib.js FX.burst.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

/** Expanding rings centered in a `size` box. `count` rings staggered by `stagger` ms. */
export function Rings({ size, color, count = 3, stagger = 380, delay = 200, duration = 1300, loop = true, width = 2 }: {
  size: number; color: string; count?: number; stagger?: number; delay?: number; duration?: number; loop?: boolean; width?: number;
}) {
  const vals = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => {
    const one = (v: Animated.Value, i: number) =>
      Animated.sequence([
        Animated.delay(delay + i * stagger),
        Animated.timing(v, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]);
    const anim = Animated.parallel(vals.map(one));
    const run = loop
      ? Animated.loop(Animated.sequence([anim, Animated.delay(900)]))
      : anim;
    run.start();
    return () => run.stop();
  }, [vals, delay, stagger, duration, loop]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: width, borderColor: color,
            opacity: v.interpolate({ inputRange: [0, 0.001, 1], outputRange: [0, 0.9, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.8] }) }],
          }}
        />
      ))}
    </View>
  );
}

/** One-shot particle burst from the center of its parent. */
export function Burst({ colors, distance = 56, spread = 14, count = 16, delay = 260, duration = 950 }: {
  colors: string[]; distance?: number; spread?: number; count?: number; delay?: number; duration?: number;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(a, { toValue: 1, duration, delay, easing: Easing.bezier(0.15, 0.7, 0.3, 1), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [a, delay, duration]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: count }, (_, i) => {
        const ang = (i / count) * Math.PI * 2 + 0.2;
        const d = distance + (i % 3) * spread;
        const w = i % 2 ? 6 : 9, h = i % 2 ? 6 : 3;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute', width: w, height: h, borderRadius: i % 3 === 0 ? w / 2 : 1, backgroundColor: colors[i % colors.length],
              opacity: a.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [
                { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(ang) * d] }) },
                { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(ang) * d] }) },
                { scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
