// Popup primitives from design/SPEC.md "Popups": Dialog, BottomSheet, Moment.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, PanResponder, Pressable, ScrollView, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { C, MOTION } from '../theme/tokens';
import { t } from '../theme/fonts';
import { Press, Row } from '../ui/core';
import { useNav } from '../nav/store';

/**
 * Dialog: card #2B2928, radius 28, max-width 312, top padding 24, centered over a dim backdrop.
 * Title 20–24 #ECE8E3, body 14–15/1.5 #A39C95, right-aligned text actions (#FF8A55 600, 48 tall).
 */
export function Dialog({
  title, body, children, actions, icon, titleSize = 24, onDismiss, scrim = 'rgba(0,0,0,0.55)', width = 312, center = false, style,
}: {
  title?: React.ReactNode; body?: React.ReactNode; children?: React.ReactNode;
  actions?: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean }[];
  icon?: React.ReactNode; titleSize?: number; onDismiss?: () => void; scrim?: string; width?: number; center?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const closePop = useNav((s) => s.closePop);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [a]);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: scrim, opacity: a }}>
        <Pressable style={{ flex: 1 }} onPress={onDismiss ?? closePop} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        style={[{ width: '100%', maxWidth: width, backgroundColor: C.dialog, borderRadius: 28, paddingTop: 24, overflow: 'hidden', opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }, style]}
      >
        {icon ? <View style={{ alignItems: 'center', marginBottom: 16 }}>{icon}</View> : null}
        {title ? (
          <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
            {typeof title === 'string' ? <Text style={t(titleSize, 1.25, 400, C.text, center ? { textAlign: 'center' } : undefined)}>{title}</Text> : title}
          </View>
        ) : null}
        {body ? (
          <View style={{ paddingHorizontal: 24 }}>
            {typeof body === 'string' ? <Text style={t(14.5, 1.5, 400, C.secondary)}>{body}</Text> : body}
          </View>
        ) : null}
        {children}
        {actions?.length ? (
          <Row style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 20, paddingHorizontal: 12, paddingBottom: 12 }}>
            {actions.map((x) => (
              <Press key={x.label} onPress={x.onPress} disabled={x.disabled} radius={20} style={{ height: 40, paddingHorizontal: 12, borderRadius: 20, justifyContent: 'center' }}>
                <Text style={t(14, undefined, 600, x.disabled ? C.disabled : x.danger ? C.errorText : C.rustLight)}>{x.label}</Text>
              </Press>
            ))}
          </Row>
        ) : null}
      </Animated.View>
    </View>
  );
}

/**
 * Bottom sheet: #1C1B1A, top radius 28, 28 dp handle row with a 32 × 4 #4A4643 handle,
 * scrim rgba(10,9,9,0.62), max height 86%. Slides in (460 ms bezier .2,.9,.25,1.04);
 * tap outside or drag down to close.
 */
export function BottomSheet({ children, onClose, scroll = true, style, maxHeight = 0.86 }: { children: React.ReactNode; onClose?: () => void; scroll?: boolean; style?: StyleProp<ViewStyle>; maxHeight?: number }) {
  const closePop = useNav((s) => s.closePop);
  const close = onClose ?? closePop;
  const { height } = useWindowDimensions();
  const y = useRef(new Animated.Value(height)).current;
  const scrimA = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, { toValue: 0, duration: MOTION.sheet.duration, easing: Easing.bezier(...MOTION.sheet.bezier), useNativeDriver: true }),
      Animated.timing(scrimA, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [y, scrimA]);
  const dismiss = () => {
    Animated.parallel([
      Animated.timing(y, { toValue: height, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scrimA, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => close());
  };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) y.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 1.2) dismiss();
        else Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    }),
  ).current;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.scrim, opacity: scrimA }}>
        <Pressable style={{ flex: 1 }} onPress={dismiss} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={[{ backgroundColor: C.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: `${maxHeight * 100}%`, transform: [{ translateY: y }] }, style]}>
        <View {...pan.panHandlers} style={{ height: 28, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: C.handle }} />
        </View>
        {scroll ? <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: 16 }}>{children}</ScrollView> : children}
      </Animated.View>
    </View>
  );
}

/** Full-screen moment (Mission complete, Level up): covers everything below the status bar. */
export function Moment({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [a]);
  return <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.ground, opacity: a }, style]}>{children}</Animated.View>;
}

/** Sheet row: 56–64 tall, 22 dp icon. */
export function SheetRow({ icon, title, subtitle, onPress, right, danger }: { icon?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; onPress?: () => void; right?: React.ReactNode; danger?: boolean }) {
  return (
    <Press onPress={onPress} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8, paddingHorizontal: 24 }}>
      {icon}
      <View style={{ flex: 1 }}>
        {typeof title === 'string' ? <Text style={t(15.5, 1.35, 500, danger ? C.errorText : C.text)}>{title}</Text> : title}
        {subtitle ? (typeof subtitle === 'string' ? <Text style={t(13, 1.4, 400, C.secondary)}>{subtitle}</Text> : subtitle) : null}
      </View>
      {right}
    </Press>
  );
}
