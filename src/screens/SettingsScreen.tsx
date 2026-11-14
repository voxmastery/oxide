// Placeholder — replaced by the Settings implementation (design/project/Settings.dc.html).
import React from 'react';
import { View } from 'react-native';
import { Txt } from '../ui/core';
import type { ScreenProps } from './registry';

export default function SettingsScreen({ entry }: ScreenProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Txt>Settings · {entry.screen}</Txt>
    </View>
  );
}
