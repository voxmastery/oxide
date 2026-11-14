// Reminder time: Material 3 time picker (design/project/Overlays.dc.html, `is.time`).
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { C } from '../theme/tokens';
import { t } from '../theme/fonts';
import { Inset, Press, Row } from '../ui/core';
import { navActions } from '../nav/store';
import { useApp } from '../state/app';
import { scheduleReminder } from '../state/reminders';
import type { OverlayProps } from './registry';
import { DialogFrame, TextAction, time12 } from './parts';

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function applyReminder(time: string | null) {
  const { showToast } = navActions();
  useApp.getState().setPlan(time ? { reminder: true, reminderTime: time } : { reminder: false });
  showToast(time ? `Reminder set for ${time12(time)}` : 'Daily reminder off');
  scheduleReminder(time).catch(() => {
    if (time) showToast('Oxide can’t send notifications. Allow them in system settings.');
  });
}

export function ReminderDialog(_: OverlayProps) {
  const initial = useApp.getState().plan.reminderTime || '20:30';
  const [H, M] = initial.split(':').map((x) => Number(x) || 0);
  const [h, setH] = useState(H % 12 || 12);
  const [min, setMin] = useState(M);
  const [pm, setPm] = useState(H >= 12);
  const [mode, setMode] = useState<'h' | 'm'>('h');
  const { closePop } = navActions();
  const hm = mode === 'h';
  const v24 = `${String((h % 12) + (pm ? 12 : 0)).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  const deg = hm ? (h % 12) * 30 - 90 : min * 6 - 90;

  const box = (on: boolean) => (on ? { bg: '#5C2A12', c: '#FFDBCC' } : { bg: C.outline, c: C.text });
  const digit = t(50, undefined, 400, undefined, { lineHeight: 58 });
  const half = (on: boolean) => ({ bg: on ? 'rgba(247,76,0,0.28)' : 'transparent', c: on ? '#FFDBCC' : C.mutedHi });

  return (
    <DialogFrame maxWidth={328 + 48} style={{ paddingTop: 24, paddingHorizontal: 24, paddingBottom: 14, gap: 20 }}>
      <Text style={t(12.5, undefined, 600, C.mutedHi, { letterSpacing: 0.5 })}>Select time</Text>
      <Row style={{ gap: 6 }}>
        <Press onPress={() => setMode('h')} accessibilityRole="button" accessibilityLabel={`Hour ${h}`} accessibilityState={{ selected: hm }} overlay={null}
          style={{ width: 88, height: 80, borderRadius: 12, backgroundColor: box(hm).bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[digit, { color: box(hm).c }]}>{h}</Text>
        </Press>
        <Text style={[digit, { width: 20, textAlign: 'center', color: C.text }]}>:</Text>
        <Press onPress={() => setMode('m')} accessibilityRole="button" accessibilityLabel={`Minute ${min}`} accessibilityState={{ selected: !hm }} overlay={null}
          style={{ width: 88, height: 80, borderRadius: 12, backgroundColor: box(!hm).bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[digit, { color: box(!hm).c }]}>{String(min).padStart(2, '0')}</Text>
        </Press>
        <View style={{ width: 52, height: 80, borderRadius: 10, overflow: 'hidden' }}>
          <Press onPress={() => setPm(false)} overlay={null} accessibilityRole="button" accessibilityState={{ selected: !pm }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: half(!pm).bg }}>
            <Text style={t(14, undefined, 600, half(!pm).c)}>AM</Text>
          </Press>
          <View style={{ height: 1, backgroundColor: C.disabled }} />
          <Press onPress={() => setPm(true)} overlay={null} accessibilityRole="button" accessibilityState={{ selected: pm }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: half(pm).bg }}>
            <Text style={t(14, undefined, 600, half(pm).c)}>PM</Text>
          </Press>
          <Inset color={C.disabled} radius={10} />
        </View>
      </Row>

      <View style={{ alignSelf: 'center', width: 256, height: 256, borderRadius: 128, backgroundColor: C.outline }}>
        {/* Hand: 100 dp from the center, rotated about the center. */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 28, top: 127, width: 200, height: 2, transform: [{ rotate: `${deg}deg` }] }}>
          <View style={{ position: 'absolute', left: 100, top: 0, width: 100, height: 2, backgroundColor: C.rust }} />
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', left: 124, top: 124, width: 8, height: 8, borderRadius: 4, backgroundColor: C.rust }} />
        {(hm ? HOURS : MINS).map((n, i) => {
          const a = ((i * 30 - 90) * Math.PI) / 180;
          const on = hm ? n === h : n === min;
          return (
            <Press
              key={n}
              overlay={null}
              accessibilityRole="button"
              accessibilityLabel={hm ? `${n} o’clock` : `${n} minutes`}
              accessibilityState={{ selected: on }}
              onPress={() => { if (hm) { setH(n); setMode('m'); } else setMin(n); }}
              style={{ position: 'absolute', left: Math.round(104 + 100 * Math.cos(a)), top: Math.round(104 + 100 * Math.sin(a)), width: 48, height: 48, borderRadius: 24, backgroundColor: on ? C.rust : 'transparent', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={t(16, undefined, 500, on ? C.onRust : C.text)}>{hm ? String(n) : String(n).padStart(2, '0')}</Text>
            </Press>
          );
        })}
      </View>

      <Row style={{ gap: 4 }}>
        <TextAction label="Turn off" onPress={() => { closePop(); applyReminder(null); }} />
        <View style={{ flex: 1 }} />
        <TextAction label="Cancel" onPress={closePop} />
        <TextAction label="OK" onPress={() => { closePop(); applyReminder(v24); }} />
      </Row>
    </DialogFrame>
  );
}
