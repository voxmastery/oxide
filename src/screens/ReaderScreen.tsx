// Placeholder — replaced by the Reader implementation (design/project/Reader.dc.html).
import React from 'react';
import { View } from 'react-native';
import { Txt } from '../ui/core';
import type { ScreenProps } from './registry';

export default function ReaderScreen({ entry }: ScreenProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Txt>Reader · {entry.screen}</Txt>
    </View>
  );
}
