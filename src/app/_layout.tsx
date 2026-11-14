import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Slot } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FONT_ASSETS } from '../theme/fonts';
import { C } from '../theme/tokens';
import { startNetWatch } from '../shell/net';

export default function RootLayout() {
  const [loaded] = useFonts(FONT_ASSETS);
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(C.ground).catch(() => {});
    startNetWatch();
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: C.ground }}>{loaded ? <Slot /> : null}</View>
    </SafeAreaProvider>
  );
}
