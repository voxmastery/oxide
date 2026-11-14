// Placeholder — replaced by the Home implementation (design/project/Home.dc.html).
import React from 'react';
import { View } from 'react-native';
import { Txt } from '../ui/core';
import type { ScreenProps } from './registry';

export default function HomeScreen({ entry }: ScreenProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Txt>Home · {entry.screen}</Txt>
    </View>
  );
}
