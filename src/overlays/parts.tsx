// Shared pieces for the popups in design/project/Overlays.dc.html.
// The prototype's dialogs differ from the generic `Dialog` primitive (icon, 22/600 centered title,
// #C9C2BA body, 44 dp actions), so they are drawn here at its exact sizes.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme/tokens';
import { m, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Press, Row } from '../ui/core';
import { toc, rustlings } from '../content';
import { useNav } from '../nav/store';

/** The prototype's overlay scrim (dialogs and sheets): rgba(8,7,7,0.64). */
export const SCRIM = 'rgba(8,7,7,0.64)';
export const OR = C.rustLight;
export const RED = C.errorText;

/**
 * Centered dialog card, radius 28, #2B2928. The prototype's max-width (332, time picker 328) is a
 * content-box width, so cards with 24 dp side padding are up to 48 dp wider (capped by the 24 dp margins).
 */
export function DialogFrame({ children, maxWidth = 332, style }: { children: React.ReactNode; maxWidth?: number; style?: StyleProp<ViewStyle> }) {
  const closePop = useNav((s) => s.closePop);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [a]);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: SCRIM, opacity: a }}>
        <Pressable style={{ flex: 1 }} onPress={closePop} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[{ width: '100%', maxWidth, backgroundColor: C.dialog, borderRadius: 28, opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }, style]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/** Text action: 44 tall, padding 0 14, radius 22, Public Sans 600 14.5. */
export function TextAction({ label, onPress, color = OR, disabled, size = 14.5, height = 44, px = 14 }: { label: string; onPress: () => void; color?: string; disabled?: boolean; size?: number; height?: number; px?: number }) {
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole="button" radius={height / 2} style={{ height, minWidth: 44, paddingHorizontal: px, borderRadius: height / 2, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={t(size, undefined, 600, disabled ? C.disabled : color)}>{label}</Text>
    </Press>
  );
}

/** Confirmation dialog: icon, centered title, body, right-aligned actions. */
export function ConfirmDialog({ icon, iconColor = OR, title, body, actions }: {
  icon: string; iconColor?: string; title: string; body: string;
  actions: { label: string; onPress: () => void; color?: string }[];
}) {
  return (
    <DialogFrame maxWidth={332 + 48} style={{ paddingTop: 24, paddingHorizontal: 24, paddingBottom: 14, gap: 16 }}>
      <View style={{ alignSelf: 'center' }}><Icon name={icon} size={24} color={iconColor} /></View>
      <Text accessibilityRole="header" style={t(22, 1.3, 600, C.text, { textAlign: 'center' })}>{title}</Text>
      <Text style={t(14.5, 1.55, 400, C.mutedHi)}>{body}</Text>
      <Row style={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 4, paddingTop: 6 }}>
        {actions.map((x) => <TextAction key={x.label} label={x.label} onPress={x.onPress} color={x.color} />)}
      </Row>
    </DialogFrame>
  );
}

/** 20 dp radio: 2 dp ring #8C867F, #F74C00 ring + 10 dp dot when selected. */
export function RadioDot({ on }: { on: boolean }) {
  return (
    <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Inset color={on ? C.rust : C.tertiary} width={2} radius={10} />
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: on ? C.rust : 'transparent' }} />
    </View>
  );
}

/** Bottom padding the prototype's sheets end with (30 dp incl. the gesture bar). */
export function SheetEnd() {
  const insets = useSafeAreaInsets();
  // BottomSheet's ScrollView already adds 16.
  return <View style={{ height: 14 + insets.bottom }} />;
}

/** Sheet title block for menus: mono 600 15.5 title + mono 12 #8C867F subtitle, bottom hairline. */
export function MenuHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ gap: 4, paddingHorizontal: 24, paddingBottom: 14 }}>
      <Text numberOfLines={1} style={m(15.5, undefined, 600, C.text)}>{title}</Text>
      {sub ? <Text numberOfLines={1} style={m(12, undefined, 400, C.tertiary)}>{sub}</Text> : null}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
    </View>
  );
}

/** Menu row: min 56, padding 8 24, 24 dp icon #D9D3CC, 15.5 label. */
export function MenuRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" overlay="rgba(255,255,255,0.04)" style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8, paddingHorizontal: 24 }}>
      <Icon name={icon} size={24} color={C.strong2} />
      <Text style={t(15.5, 1.35, 400, C.text, { flex: 1 })}>{label}</Text>
    </Press>
  );
}

// ---------- Formatting ----------

/** 1840 → "1,840" (no Intl dependency on Hermes). */
export const num = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "20:30" → "8:30 PM". */
export function time12(v: string) {
  const [h, mm] = v.split(':').map((x) => Number(x) || 0);
  return `${h % 12 || 12}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// ---------- Content helpers (over the generated content) ----------

/** Book reading order: numbered sections, plus chapter intros for chapters without sections (ch. 2). */
export function sectionOrder(): string[] {
  return toc.chapters.flatMap((c) => (c.sections.length ? c.sections.map((x) => x.id) : [String(c.n)]));
}

export function sectionTitle(id: string): string {
  for (const c of toc.chapters) {
    if (c.intro?.id === id) return c.intro.title;
    const s = c.sections.find((x) => x.id === id);
    if (s) return s.title;
  }
  return '';
}

/** The Book sections a Rustlings exercise drills (from Rustlings' README map). */
export function sectionsForExercise(name: string): string[] {
  for (const n of rustlings.path) if (n.t === 'topic' && n.exercises.includes(name)) return n.secs;
  return [];
}
