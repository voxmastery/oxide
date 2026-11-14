// Placeholder — replaced by the Practice implementation (design/project/Practice.dc.html).
import React from 'react';
import { View } from 'react-native';
import { Txt } from '../ui/core';
import type { ScreenProps } from './registry';

export default function PracticeScreen({ entry }: ScreenProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Txt>Practice · {entry.screen}</Txt>
    </View>
  );
}
