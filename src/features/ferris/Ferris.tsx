// Ferris: Oxide's own crab mascot, drawn in the app's rust palette (an original simple crab, not the
// official artwork). <Ferris mood size/> with a subtle idle animation (bob + blink), which stops when
// the system asks for reduced motion.
import React, { memo, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { C } from '../../theme/tokens';

export type FerrisMood = 'happy' | 'thinking' | 'worried' | 'celebrating' | 'sleepy';

const RUST = C.rust;
const RUST_DARK = '#C23C00';
const RUST_LEG = '#D94400';
const LIGHT = C.rustLight;
const EYE = C.onRustThumb;
const INK = C.onRust;

const VB_W = 120;
const VB_H = 104;

/** One pincer with its base at (0,0), jaws pointing to -x. */
function Claw({ x, y, rot, flip }: { x: number; y: number; rot: number; flip?: boolean }) {
  return (
    <G transform={`translate(${x} ${y}) ${flip ? 'scale(-1 1) ' : ''}rotate(${rot})`}>
      <Ellipse cx={-6.5} cy={-3.6} rx={7.6} ry={4.6} fill={RUST} transform="rotate(-16 -6.5 -3.6)" />
      <Ellipse cx={-5.2} cy={4} rx={6.2} ry={3.6} fill={RUST} transform="rotate(18 -5.2 4)" />
      <Circle cx={0} cy={0} r={5.6} fill={RUST} />
    </G>
  );
}

type Pose = { lx: number; ly: number; lr: number; rx: number; ry: number; rr: number; la: [number, number]; ra: [number, number] };

const POSE_REST: Pose = { lx: 15, ly: 55, lr: 18, rx: 105, ry: 55, rr: 18, la: [28, 64], ra: [92, 64] };
const POSES: Record<FerrisMood, Pose> = {
  happy: POSE_REST,
  worried: { ...POSE_REST, ly: 58, ry: 58, lr: 6, rr: 6 },
  sleepy: { ...POSE_REST, ly: 62, ry: 62, lr: -4, rr: -4 },
  thinking: { ...POSE_REST, rx: 99, ry: 36, rr: 62, ra: [90, 58] },
  celebrating: { lx: 17, ly: 28, lr: 62, rx: 103, ry: 28, rr: 62, la: [30, 58], ra: [90, 58] },
};

const PUPIL: Record<FerrisMood, [number, number]> = {
  happy: [0, 1],
  thinking: [2.2, -2.6],
  worried: [0, 2.6],
  celebrating: [0, 0],
  sleepy: [0, 0],
};

function Eye({ cx, cy, mood, closed }: { cx: number; cy: number; mood: FerrisMood; closed: boolean }) {
  if (closed || mood === 'sleepy') {
    return (
      <G>
        <Circle cx={cx} cy={cy} r={8} fill={LIGHT} />
        <Path d={`M${cx - 6} ${cy} Q${cx} ${cy + 4.6} ${cx + 6} ${cy}`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      </G>
    );
  }
  if (mood === 'celebrating') {
    return (
      <G>
        <Circle cx={cx} cy={cy} r={8} fill={EYE} />
        <Path d={`M${cx - 5} ${cy + 2} Q${cx} ${cy - 5} ${cx + 5} ${cy + 2}`} stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      </G>
    );
  }
  const [dx, dy] = PUPIL[mood];
  return (
    <G>
      <Circle cx={cx} cy={cy} r={8} fill={EYE} />
      <Circle cx={cx + dx} cy={cy + dy} r={3.5} fill={INK} />
      <Circle cx={cx + dx + 1.3} cy={cy + dy - 1.3} r={1.05} fill={EYE} />
    </G>
  );
}

function Face({ mood, blink }: { mood: FerrisMood; blink: boolean }) {
  return (
    <G>
      {/* Eye stalks */}
      <Path d="M51 43 L48 27" stroke={RUST} strokeWidth={4.2} strokeLinecap="round" />
      <Path d="M69 43 L72 27" stroke={RUST} strokeWidth={4.2} strokeLinecap="round" />
      <Eye cx={47} cy={22} mood={mood} closed={blink} />
      <Eye cx={73} cy={22} mood={mood} closed={blink} />

      {/* Brows */}
      {mood === 'worried' ? (
        <G>
          <Path d="M39 12 L52 8" stroke={LIGHT} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M68 8 L81 12" stroke={LIGHT} strokeWidth={2.6} strokeLinecap="round" />
        </G>
      ) : mood === 'thinking' ? (
        <G>
          <Path d="M40 11 L53 11" stroke={LIGHT} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M67 8 Q73.5 4.5 80 8" stroke={LIGHT} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        </G>
      ) : null}

      {/* Cheeks */}
      {mood === 'happy' || mood === 'celebrating' ? (
        <G opacity={0.55}>
          <Circle cx={39} cy={66} r={4.6} fill={LIGHT} />
          <Circle cx={81} cy={66} r={4.6} fill={LIGHT} />
        </G>
      ) : null}

      {/* Mouth */}
      {mood === 'happy' ? <Path d="M51 62 Q60 71 69 62" stroke={INK} strokeWidth={2.8} strokeLinecap="round" fill="none" /> : null}
      {mood === 'celebrating' ? <Path d="M50 60 Q60 77 70 60 Z" fill={INK} /> : null}
      {mood === 'worried' ? <Path d="M51 67 Q55.5 62 60 66 Q64.5 70 69 65" stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" /> : null}
      {mood === 'thinking' ? <Path d="M54 66 Q60 64.5 67 63" stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" /> : null}
      {mood === 'sleepy' ? <Ellipse cx={60} cy={66} rx={2.6} ry={3.1} fill={INK} /> : null}
    </G>
  );
}

function Extras({ mood }: { mood: FerrisMood }) {
  if (mood === 'worried') {
    return <Path d="M94 26 C94 26 89 33 89 36 A5 5 0 0 0 99 36 C99 33 94 26 94 26 Z" fill="#8DB6FF" opacity={0.85} />;
  }
  if (mood === 'sleepy') {
    return (
      <G>
        <Path d="M88 15 h7 l-7 8 h7" stroke={C.tertiary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d="M101 4 h5 l-5 6 h5" stroke={C.tertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </G>
    );
  }
  if (mood === 'thinking') {
    return (
      <G fill={C.tertiary}>
        <Circle cx={108} cy={18} r={1.9} />
        <Circle cx={113} cy={9} r={2.7} />
      </G>
    );
  }
  if (mood === 'celebrating') {
    return (
      <G>
        <Circle cx={6} cy={12} r={2.6} fill={C.done} />
        <Circle cx={114} cy={10} r={2.6} fill={C.checkpoint} />
        <Path d="M60 0 L61.6 3.4 L65 5 L61.6 6.6 L60 10 L58.4 6.6 L55 5 L58.4 3.4 Z" fill={C.checkpoint} />
        <Circle cx={28} cy={4} r={1.8} fill={C.text} />
        <Circle cx={94} cy={2} r={1.8} fill={C.done} />
      </G>
    );
  }
  return null;
}

const LEGS: [number, number, number, number][] = [[33, 76, 22, 88], [41, 80, 33, 95], [50, 83, 46, 97]];

const Drawing = memo(function Drawing({ mood, blink, size }: { mood: FerrisMood; blink: boolean; size: number }) {
  const p = POSES[mood];
  return (
    <Svg width={size} height={(size * VB_H) / VB_W} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      {/* Legs */}
      {LEGS.map(([x1, y1, x2, y2], i) => (
        <G key={i}>
          <Path d={`M${x1} ${y1} L${x2} ${y2}`} stroke={RUST_LEG} strokeWidth={4} strokeLinecap="round" />
          <Path d={`M${VB_W - x1} ${y1} L${VB_W - x2} ${y2}`} stroke={RUST_LEG} strokeWidth={4} strokeLinecap="round" />
        </G>
      ))}
      {/* Arms + claws */}
      <Path d={`M${p.la[0]} ${p.la[1]} L${p.lx} ${p.ly}`} stroke={RUST} strokeWidth={5} strokeLinecap="round" />
      <Path d={`M${p.ra[0]} ${p.ra[1]} L${p.rx} ${p.ry}`} stroke={RUST} strokeWidth={5} strokeLinecap="round" />
      <Claw x={p.lx} y={p.ly} rot={p.lr} />
      <Claw x={p.rx} y={p.ry} rot={p.rr} flip />
      {/* Shell */}
      <Path d="M24 68 C24 47 40 40 60 40 C80 40 96 47 96 68 C96 79 81 86 60 86 C39 86 24 79 24 68 Z" fill={RUST} />
      <Path d="M28 73 C38 82 82 82 92 73 C89 81 77 86 60 86 C43 86 31 81 28 73 Z" fill={RUST_DARK} />
      <Path d="M40 50 C46 45.5 54 43.5 62 43.5" stroke={LIGHT} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.55} />
      <Face mood={mood} blink={blink} />
      <Extras mood={mood} />
    </Svg>
  );
});

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (live) setReduce(!!v); }, () => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReduce(!!v));
    return () => { live = false; sub?.remove?.(); };
  }, []);
  return reduce;
}

/**
 * Ferris the crab. `size` is the width in dp (height is 104/120 of it).
 * `animated` (default true) turns the idle bob and blink on.
 */
export function Ferris({ mood = 'happy', size = 48, animated = true, style }: { mood?: FerrisMood; size?: number; animated?: boolean; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const live = animated && !reduce;
  const y = useRef(new Animated.Value(0)).current;
  const [blink, setBlink] = useState(false);

  // Idle bob (a few hops when celebrating, slow breathing when sleepy).
  useEffect(() => {
    y.setValue(0);
    if (!live) return;
    const k = size / VB_W;
    const ease = Easing.inOut(Easing.sin);
    const bob = (amp: number, ms: number) => Animated.sequence([
      Animated.timing(y, { toValue: -amp * k, duration: ms, easing: ease, useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: ms, easing: ease, useNativeDriver: true }),
    ]);
    const anim = mood === 'celebrating'
      ? Animated.sequence([
        Animated.loop(Animated.sequence([
          Animated.timing(y, { toValue: -9 * k, duration: 190, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(y, { toValue: 0, duration: 210, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]), { iterations: 3 }),
        Animated.loop(bob(2, 1300)),
      ])
      : Animated.loop(mood === 'sleepy' ? bob(1.2, 2200) : bob(2, 1300));
    anim.start();
    return () => anim.stop();
  }, [live, mood, size, y]);

  // Blink every few seconds (not when the eyes are already closed or squinting).
  useEffect(() => {
    if (!live || mood === 'sleepy' || mood === 'celebrating') { setBlink(false); return; }
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        t = setTimeout(() => { setBlink(false); loop(); }, 140);
      }, 2800 + Math.random() * 2600);
    };
    loop();
    return () => clearTimeout(t);
  }, [live, mood]);

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Ferris the crab, ${mood}`}
      style={[{ width: size, height: (size * VB_H) / VB_W, transform: [{ translateY: y }] }, style]}
    >
      <Drawing mood={mood} blink={blink} size={size} />
    </Animated.View>
  );
}
