import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { C, MOTION } from '../theme/tokens';
import { m as mono, t as txt } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Press, Row } from './core';

// ---------- Buttons ----------

export type ButtonVariant = 'primary' | 'tonal' | 'outlined' | 'text' | 'danger-outlined' | 'danger-text';

export type ButtonProps = {
  label?: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** Height in dp. Primary 52 (56 onboarding), outlined/text 48, tonal 34–44. */
  height?: number;
  icon?: string;
  iconFill?: boolean;
  /** Icon after the label (e.g. arrow_forward). */
  trailingIcon?: string;
  fontSize?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  /** Primary success-badge shadow `0 6px 18px rgba(247,76,0,0.22)`. */
  glow?: boolean;
  children?: React.ReactNode;
  accessibilityLabel?: string;
};

export function Button({
  label, onPress, variant = 'primary', height, icon, iconFill, trailingIcon, fontSize, disabled, style, labelStyle, glow, children, accessibilityLabel,
}: ButtonProps) {
  const h = height ?? (variant === 'primary' ? 52 : variant === 'tonal' ? 40 : 48);
  const r = h / 2;
  const primary = variant === 'primary';
  const bg = primary ? (disabled ? C.raised : C.rust) : variant === 'tonal' ? C.raised : 'transparent';
  const fg = primary
    ? disabled ? C.disabled : C.onRust
    : variant.startsWith('danger') ? C.errorText
    : variant === 'text' ? C.rustLight
    : C.text;
  const fs = fontSize ?? (primary ? 16 : 15);
  const weight = primary ? 650 : 600;
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      overlay={primary ? null : 'rgba(255,255,255,0.05)'}
      pressedStyle={primary ? { backgroundColor: C.rustPressed } : variant === 'tonal' ? { backgroundColor: C.raisedHover } : undefined}
      style={[
        { height: h, borderRadius: r, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: variant === 'text' ? 12 : 20 },
        glow && !disabled ? { shadowColor: '#F74C00', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6 } : null,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={20} color={fg} fill={iconFill} /> : null}
      {label !== undefined ? (
        typeof label === 'string' ? <Text style={[txt(fs, undefined, weight, fg), labelStyle]} numberOfLines={1}>{label}</Text> : label
      ) : null}
      {children}
      {trailingIcon ? <Icon name={trailingIcon} size={20} color={fg} /> : null}
      {variant === 'outlined' || variant === 'danger-outlined' ? <Inset color={C.outline} radius={r} /> : null}
    </Press>
  );
}

/** 48 × 48 round icon button. */
export function IconButton({ name, onPress, color = C.text, size = 24, fill, style, label, disabled }: { name: string; onPress?: () => void; color?: string; size?: number; fill?: boolean; style?: StyleProp<ViewStyle>; label?: string; disabled?: boolean }) {
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label ?? name}
      radius={24}
      style={[{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Icon name={name} size={size} color={disabled ? C.disabled : color} fill={fill} />
    </Press>
  );
}

// ---------- Switch (M3, 52 × 32) ----------

export function Switch({ value, onChange, disabled }: { value: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  const a = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: value ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, a]);
  const size = a.interpolate({ inputRange: [0, 1], outputRange: [16, 24] });
  const left = a.interpolate({ inputRange: [0, 1], outputRange: [8, 24] });
  return (
    <Press
      onPress={() => onChange?.(!value)}
      disabled={disabled}
      overlay={null}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={{ width: 52, height: 32, borderRadius: 16, backgroundColor: value ? C.rust : C.s4, opacity: disabled ? 0.38 : 1 }}
    >
      {!value ? <Inset color={C.disabled} width={2} radius={16} /> : null}
      <Animated.View
        style={{
          position: 'absolute',
          top: a.interpolate({ inputRange: [0, 1], outputRange: [8, 4] }),
          left,
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: value ? C.onRustThumb : C.tertiary,
        }}
      />
    </Press>
  );
}

// ---------- Radio (22 dp, 2 dp ring, 10 dp dot) ----------

export function Radio({ selected, size = 22 }: { selected: boolean; size?: number }) {
  const dot = size === 20 ? 10 : 10;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: selected ? C.rust : C.secondary, alignItems: 'center', justifyContent: 'center' }}>
      {selected ? <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: C.rust }} /> : null}
    </View>
  );
}

// ---------- Progress ----------

/** Linear progress bar. Fill animates width over 600 ms. */
export function Bar({ value, height = 4, color = C.rust, track = C.track, radius, style }: { value: number; height?: number; color?: string; track?: string; radius?: number; style?: StyleProp<ViewStyle> }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const a = useRef(new Animated.Value(v)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: v, duration: MOTION.progress.duration, easing: Easing.bezier(...MOTION.progress.bezier), useNativeDriver: false }).start();
  }, [v, a]);
  const r = radius ?? height / 2;
  return (
    <View style={[{ height, borderRadius: r, backgroundColor: track, overflow: 'hidden' }, style]}>
      <Animated.View style={{ height, borderRadius: r, backgroundColor: color, width: a.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

/** Segmented strip: one segment per item, weighted. */
export function SegBar({ segs, height = 8, gap = 2, style }: { segs: { weight: number; fill: number; color: string; track?: string }[]; height?: number; gap?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Row style={[{ gap, height }, style]}>
      {segs.map((s, i) => (
        <View key={i} style={{ flex: s.weight, height, borderRadius: 2, backgroundColor: s.track ?? C.track, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(Math.max(0, Math.min(1, s.fill)) * 1000) / 10}%`, height, backgroundColor: s.color }} />
        </View>
      ))}
    </Row>
  );
}

function arcPath(cx: number, cy: number, r: number, frac: number) {
  const f = Math.max(0, Math.min(0.9999, frac));
  const a = f * 2 * Math.PI - Math.PI / 2;
  const x = cx + r * Math.cos(a);
  const y = cy + r * Math.sin(a);
  const large = f > 0.5 ? 1 : 0;
  return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`;
}

/**
 * Status ring: 36 dp conic gradient (rust arc over #3A3735) with a 30 dp inner disc in the
 * row background. `done` = solid #57D6C8 with #06201C content.
 */
export function Ring({
  value = 0, size = 36, inner = 30, color = C.rust, track = C.outline, bg = C.ground, done, children, diamond,
}: { value?: number; size?: number; inner?: number; color?: string; track?: string; bg?: string; done?: boolean; children?: React.ReactNode; diamond?: boolean }) {
  const c = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: diamond ? [{ rotate: '45deg' }] : undefined }}>
      {done ? (
        <View style={{ position: 'absolute', width: size, height: size, borderRadius: diamond ? 6 : c, backgroundColor: C.done }} />
      ) : diamond ? (
        <View style={{ position: 'absolute', width: size, height: size, borderRadius: 6, backgroundColor: value > 0 ? color : track }}>
          <View style={{ position: 'absolute', top: (size - inner) / 2, left: (size - inner) / 2, width: inner, height: inner, borderRadius: 4, backgroundColor: bg }} />
        </View>
      ) : (
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle cx={c} cy={c} r={c} fill={track} />
          {value > 0 ? (value >= 1 ? <Circle cx={c} cy={c} r={c} fill={color} /> : <Path d={arcPath(c, c, c, value)} fill={color} />) : null}
          <Circle cx={c} cy={c} r={inner / 2} fill={bg} />
        </Svg>
      )}
      <View style={{ transform: diamond ? [{ rotate: '-45deg' }] : undefined, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}

// ---------- Badges & chips ----------

/** "Lv 7": 24 tall, radius 6, rust tint, #FF8A55, mono 12.5/600. */
export function LevelBadge({ level, style }: { level: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height: 24, borderRadius: 6, backgroundColor: C.rustTint, paddingHorizontal: 8, justifyContent: 'center' }, style]}>
      <Text style={mono(12.5, undefined, 600, C.rustLight)}>Lv {level}</Text>
    </View>
  );
}

/** Error code badge: 24 tall, radius 6, rgba(255,107,118,0.12), #FF8F98, mono 12/600. */
export function ErrorBadge({ code, style }: { code: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height: 24, borderRadius: 6, backgroundColor: C.errorTint, paddingHorizontal: 7, justifyContent: 'center' }, style]}>
      <Text style={mono(12, undefined, 600, C.errorText)}>{code}</Text>
    </View>
  );
}

/** Small tag (e.g. Book § tags in Practice). */
export function Tag({ label, color, bg, style, mono: isMono = true }: { label: string; color: string; bg: string; style?: StyleProp<ViewStyle>; mono?: boolean }) {
  return (
    <View style={[{ height: 22, borderRadius: 6, backgroundColor: bg, paddingHorizontal: 7, justifyContent: 'center' }, style]}>
      <Text style={isMono ? mono(11, undefined, 500, color) : txt(11.5, undefined, 600, color)}>{label}</Text>
    </View>
  );
}

/** Spinner (ox-spin). */
export function Spinner({ size = 16, color = C.rustLight, width = 2 }: { size?: number; color?: string; width?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.timing(a, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, [a]);
  return (
    <Animated.View
      style={{
        width: size, height: size, borderRadius: size / 2, borderWidth: width, borderColor: color, borderTopColor: 'transparent',
        transform: [{ rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    />
  );
}

/** Pulsing dot (ox-pulse): opacity 1 → 0.3 over 1.2 s. */
export function PulseDot({ size = 8, color = C.done }: { size?: number; color?: string }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      Animated.timing(a, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, [a]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: a }} />;
}

/** Blinking caret (ox-blink). */
export function useBlink(on = true) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!on) return;
    const l = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0, duration: 0, delay: 530, useNativeDriver: true }),
      Animated.timing(a, { toValue: 1, duration: 0, delay: 530, useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, [a, on]);
  return a;
}

/** Indeterminate bar (ox-indet): translateX −110% → 260%. */
export function IndeterminateBar({ height = 4, color = C.rust, track = C.track }: { height?: number; color?: string; track?: string }) {
  const a = useRef(new Animated.Value(0)).current;
  const [w, setW] = React.useState(0);
  useEffect(() => {
    const l = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, [a]);
  const seg = w * 0.4;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={{ width: seg, height, borderRadius: height / 2, backgroundColor: color, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-1.1 * seg, 2.6 * seg] }) }] }} />
    </View>
  );
}
