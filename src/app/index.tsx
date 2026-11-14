import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Shell } from '../shell/Shell';
import { useApp } from '../state/app';
import { useNav } from '../nav/store';
import { C } from '../theme/tokens';

/**
 * The only route. Navigation inside the app follows the prototype's single-stack model
 * (src/nav/store.ts) rather than nested native navigators.
 * Web: `?demo=1` seeds the prototype's established-user state for design comparison;
 * the phone is drawn at the 412 × 915 reference size, centered.
 */
export default function Index() {
  const hydrated = useApp((s) => s.hydrated);
  useEffect(() => {
    if (Platform.OS === 'web' && hydrated && typeof location !== 'undefined') {
      const q = new URLSearchParams(location.search);
      if (q.get('demo') === '1' && !useApp.getState().onboarded) { useApp.getState().seedDemo(); useNav.getState().reset('home'); }
      if (q.get('reset') === '1') useApp.getState().resetAll();
    }
  }, [hydrated]);
  if (!hydrated) return <View style={{ flex: 1, backgroundColor: C.ground }} />;
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 412, height: 915, maxHeight: '100%', borderRadius: 34, overflow: 'hidden', backgroundColor: C.ground }}>
          <Shell />
        </View>
      </View>
    );
  }
  return <Shell />;
}
