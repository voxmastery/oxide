// Placeholder — implemented per docs/FEATURES_BRIEF.md.
import React from 'react';
import { View } from 'react-native';
import { Txt } from '../ui/core';
import type { ScreenProps } from './registry';

export default function BugHuntScreen({ entry }: ScreenProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Txt>BugHunt · {entry.screen}</Txt>
    </View>
  );
}
