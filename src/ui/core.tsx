import React from 'react';
import {
  Pressable,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { C } from '../theme/tokens';
import { sans, sectionLabel as sectionLabelStyle } from '../theme/fonts';

/** Text with app defaults: Public Sans 400, primary text color, no font scaling surprises. */
export function Txt({ style, ...p }: TextProps) {
  return <Text {...p} style={[{ ...sans(400), color: C.text, fontSize: 14 }, style]} />;
}

/**
 * The prototype's `box-shadow: inset 0 0 0 Npx color` hairline, drawn as an overlay so it
 * doesn't change layout (an RN border would take up space).
 */
export function Inset({ color = C.hairline, width = 1, radius = 0, style }: { color?: string; width?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: width, borderColor: color, borderRadius: radius }, style]}
    />
  );
}

/** Top hairline divider: `inset 0 1px 0 rgba(255,255,255,0.05)`. */
export function TopLine({ color = C.hairline }: { color?: string }) {
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: color }} />;
}

export type PressProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Pressed/hover overlay color. Rows and icon buttons use rgba(255,255,255,0.03–0.06). */
  overlay?: string | null;
  /** Background swap when pressed (e.g. primary #F74C00 → #FF5A10). */
  pressedStyle?: StyleProp<ViewStyle>;
  radius?: number;
  children?: React.ReactNode;
};

/** Pressable with the design's press/hover feedback. */
export function Press({ style, overlay = 'rgba(255,255,255,0.05)', pressedStyle, radius, children, disabled, ...p }: PressProps) {
  return (
    <Pressable
      {...p}
      disabled={disabled}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        radius !== undefined ? { borderRadius: radius } : null,
        style,
        (pressed || hovered) && !disabled ? pressedStyle : null,
      ]}
    >
      {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => (
        <>
          {children}
          {overlay && (pressed || hovered) && !disabled ? (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: overlay, borderRadius: radius ?? (StyleFlat(style).borderRadius as number | undefined) }}
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

function StyleFlat(s: StyleProp<ViewStyle>): ViewStyle {
  if (!s) return {};
  if (Array.isArray(s)) return Object.assign({}, ...s.map((x) => StyleFlat(x as StyleProp<ViewStyle>)));
  return s as ViewStyle;
}

export function Row({ style, ...p }: ViewProps) {
  return <View {...p} style={[{ flexDirection: 'row', alignItems: 'center' }, style]} />;
}

export function Gap({ h, w }: { h?: number; w?: number }) {
  return <View style={{ height: h, width: w }} />;
}

/** JetBrains Mono 11/500 uppercase label, with an optional right-aligned value. */
export function SectionLabel({ children, right, style, rightStyle }: { children: React.ReactNode; right?: React.ReactNode; style?: StyleProp<ViewStyle>; rightStyle?: StyleProp<TextStyle> }) {
  return (
    <Row style={[{ justifyContent: 'space-between' }, style]}>
      <Text style={sectionLabelStyle}>{children}</Text>
      {right !== undefined ? <Text style={[sectionLabelStyle, { textTransform: 'none', letterSpacing: 0 }, rightStyle]}>{right}</Text> : null}
    </Row>
  );
}

/** Card surfaces. hero = surface-2 + 1dp hairline; card = surface-1. */
export function Card({ hero, radius, style, children, ...p }: ViewProps & { hero?: boolean; radius?: number }) {
  const r = radius ?? (hero ? 24 : 18);
  return (
    <View {...p} style={[{ backgroundColor: hero ? C.s2 : C.s1, borderRadius: r }, style]}>
      {children}
      {hero ? <Inset radius={r} /> : null}
    </View>
  );
}
