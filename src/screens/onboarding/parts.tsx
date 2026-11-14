// Small building blocks shared by the onboarding steps (design/project/Onboarding.dc.html).
import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { C } from '../../theme/tokens';
import { ls, t } from '../../theme/fonts';
import { Inset, Press } from '../../ui/core';

/** Step heading: 28/1.18/650, −0.025em + 15/1.5 subtitle, gap 10, padding 0 4. */
export function StepHead({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ gap: 10, paddingHorizontal: 4 }}>
      <Text accessibilityRole="header" style={t(28, 1.18, 650, C.text, { letterSpacing: ls(-0.025, 28) })}>{title}</Text>
      <Text style={t(15, 1.5, 400, C.secondary)}>{sub}</Text>
    </View>
  );
}

/** 56 dp primary pill (onboarding size). */
export function Primary({ label, onPress, disabled, size = 16.5, style }: { label: string; onPress?: () => void; disabled?: boolean; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      overlay={null}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      pressedStyle={{ backgroundColor: C.rustPressed }}
      style={[{ height: 56, borderRadius: 28, backgroundColor: disabled ? C.track : C.rust, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }, style]}
    >
      <Text numberOfLines={1} style={t(size, undefined, 650, disabled ? C.disabled : C.onRust)}>{label}</Text>
    </Press>
  );
}

/** 48 dp text button in the primary text color (#ECE8E3 600 15). */
export function TextBtn({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" radius={24} style={{ height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
      <Text numberOfLines={1} style={t(15, undefined, 600, C.text)}>{label}</Text>
    </Press>
  );
}

/** Outlined 56 dp provider pill: inset 1 dp #3A3735, 600 15.5. */
export function OutlinePill({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" overlay="rgba(255,255,255,0.04)" radius={28} style={{ height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}>
      <Text numberOfLines={1} style={t(15.5, undefined, 600, C.text)}>{label}</Text>
      <Inset color={C.outline} radius={28} />
    </Press>
  );
}

/** Selection card surface: selected = rust tint + 2 dp rust ring, else #171615 + 1 dp hairline. */
export function selStyle(on: boolean) {
  return { bg: on ? C.rustTint08 : C.s1, bw: on ? 2 : 1, bd: on ? C.rust : C.hairline };
}

/** Footer note: 12/1.5 #8C867F, centered. */
export function FootNote({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text style={t(12, 1.5, 400, C.tertiary, { textAlign: 'center' })}>{children}</Text>
    </View>
  );
}
