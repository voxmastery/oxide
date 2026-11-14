// Placeholder — replaced by the Profile implementation (design/project/Profile.dc.html).
import React from 'react';
import { View } from 'react-native';
import { Txt } from '../ui/core';
import type { ScreenProps } from './registry';

export default function ProfileScreen({ entry }: ScreenProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Txt>Profile · {entry.screen}</Txt>
    </View>
  );
}
