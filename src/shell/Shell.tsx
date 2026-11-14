// The phone frame from design/project/OxidePhone.dc.html: status bar, offline banner, content,
// navigation bar, gesture bar, snackbar and the popup layer.
import React, { useEffect } from 'react';
import { BackHandler, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme/tokens';
import { t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Press, Row } from '../ui/core';
import { FULL_POPUPS, TAB_OF, TAB_ROOTS, useNav, type TabId } from '../nav/store';
import { SCREENS } from '../screens/registry';
import { OverlayHost } from '../overlays/OverlayHost';
import { useNet } from './net';
import { useApp } from '../state/app';

/** On web we draw the prototype's device chrome so screenshots match the design 1:1. */
export const FRAME = Platform.OS === 'web';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'learn', icon: 'menu_book', label: 'Learn' },
  { id: 'practice', icon: 'data_object', label: 'Practice' },
  { id: 'terminal', icon: 'terminal', label: 'Terminal' },
  { id: 'profile', icon: 'person', label: 'Profile' },
];

function StatusBarMock({ offline }: { offline: boolean }) {
  return (
    <Row style={{ height: 36, justifyContent: 'space-between', paddingLeft: 28, paddingRight: 22, backgroundColor: C.ground }}>
      <Text style={t(14, undefined, 500, C.text, { fontVariant: ['tabular-nums'] })}>21:14</Text>
      <Row style={{ gap: 7 }}>
        <Icon name={offline ? 'wifi_off' : 'wifi'} size={17} fill />
        <Icon name="signal_cellular_alt" size={17} fill />
        <View style={{ width: 24, height: 12, borderRadius: 4, borderWidth: 1.5, borderColor: C.text, padding: 1.5 }}>
          <View style={{ width: '74%', height: '100%', borderRadius: 1.5, backgroundColor: C.text }} />
        </View>
      </Row>
    </Row>
  );
}

function NavBar() {
  const top = useNav((s) => s.stack[s.stack.length - 1]);
  const tab = useNav((s) => s.tab);
  const active = TAB_OF[top.screen];
  return (
    <Row style={{ height: 80, backgroundColor: C.bar, paddingHorizontal: 4 }} accessibilityRole="tablist">
      {TABS.map((x) => {
        const on = x.id === active;
        return (
          <Press key={x.id} overlay={null} onPress={() => tab(x.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={x.label}
            style={{ flex: 1, height: 80, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <View style={{ width: 60, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.rustTint20 : 'transparent' }}>
              <Icon name={x.icon} size={24} color={on ? C.rustLight : C.navOff} fill={on} />
            </View>
            <Text style={t(12, undefined, on ? 600 : 500, on ? C.textNav : C.navOff, { letterSpacing: 0.12 })}>{x.label}</Text>
          </Press>
        );
      })}
    </Row>
  );
}

function Snackbar({ bottom }: { bottom: number }) {
  const toast = useNav((s) => s.toast);
  const act = useNav((s) => s.toastAction);
  if (!toast) return null;
  return (
    <View style={{ position: 'absolute', left: 12, right: 12, bottom, zIndex: 40, minHeight: 48, borderRadius: 6, backgroundColor: C.snackbar, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingRight: 6, paddingLeft: 16, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
      <Text style={t(14, 1.4, 400, C.snackbarText, { flex: 1, paddingVertical: 10 })}>{toast.text}</Text>
      {toast.action ? (
        <Press onPress={act} radius={20} overlay="rgba(0,0,0,0.06)" style={{ height: 40, paddingHorizontal: 12, borderRadius: 20, justifyContent: 'center' }}>
          <Text style={t(14, undefined, 650, C.snackbarAction)}>{toast.action}</Text>
        </Press>
      ) : null}
    </View>
  );
}

function OfflineBanner() {
  return (
    <Row style={{ gap: 10, paddingVertical: 8, paddingRight: 16, paddingLeft: 18, backgroundColor: '#221E18', borderBottomWidth: 1, borderBottomColor: 'rgba(242,194,91,0.16)' }}>
      <Icon name="cloud_off" size={18} color={C.checkpoint} />
      <Text style={t(13, 1.35, 400, '#E2DBD2', { flex: 1 })}>Offline. The Book, exercises and your local toolchain still work.</Text>
    </Row>
  );
}

export function Shell() {
  const stack = useNav((s) => s.stack);
  const popup = useNav((s) => s.popup);
  const onboarded = useApp((s) => s.onboarded);
  const offline = useNet((s) => s.offline);
  const insets = useSafeAreaInsets();
  const top = stack[stack.length - 1];

  // First run: start in onboarding until the plan is set.
  useEffect(() => {
    if (!onboarded && top.screen !== 'onboarding') useNav.getState().reset('onboarding', { variant: 'welcome' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarded]);

  // Android back: close popup → pop screen → (root) leave the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const s = useNav.getState();
      if (s.popup) { s.closePop(); return true; }
      const cur = s.stack[s.stack.length - 1];
      if (s.stack.length > 1 || !TAB_ROOTS.includes(cur.screen)) { s.back(); return true; }
      if (cur.screen !== 'home') { s.tab('home'); return true; }
      return false;
    });
    return () => sub.remove();
  }, []);

  const showNav = TAB_ROOTS.includes(top.screen);
  const Screen = SCREENS[top.screen];
  const bottomBg = showNav || top.screen === 'workspace' ? C.bar : C.ground;
  const statusH = FRAME ? 36 : insets.top;
  const gestureH = FRAME ? 22 : insets.bottom;
  const full = popup && FULL_POPUPS.includes(popup.kind);

  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      {FRAME ? <StatusBarMock offline={offline} /> : <View style={{ height: statusH, backgroundColor: C.ground }} />}
      {offline ? <OfflineBanner /> : null}
      <View style={{ flex: 1, minHeight: 0 }}>
        <Screen key={top.key} entry={top} />
      </View>
      {showNav ? <NavBar /> : null}
      <View style={{ height: gestureH, backgroundColor: bottomBg, alignItems: 'center', justifyContent: 'center' }}>
        {FRAME ? <View style={{ width: 108, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.42)' }} /> : null}
      </View>
      <Snackbar bottom={(showNav ? 114 : 40) + (FRAME ? 0 : insets.bottom - 0)} />
      {popup ? (
        <View pointerEvents={popup.kind === 'push' ? 'box-none' : 'auto'} style={{ position: 'absolute', top: full ? statusH : 0, left: 0, right: 0, bottom: 0, zIndex: 60 }}>
          <OverlayHost popup={popup} />
        </View>
      ) : null}
    </View>
  );
}

