// Placeholder — implemented per docs/FEATURES_BRIEF.md.
import React from 'react';
import { View } from 'react-native';
import { Txt } from '../ui/core';
import type { ScreenProps } from './registry';

export default function LeagueScreen({ entry }: ScreenProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Txt>League · {entry.screen}</Txt>
    </View>
  );
}
