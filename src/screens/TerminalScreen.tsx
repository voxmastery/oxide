// Placeholder — replaced by the Terminal implementation (design/project/Terminal.dc.html).
import React from 'react';
import { View } from 'react-native';
import { Txt } from '../ui/core';
import type { ScreenProps } from './registry';

export default function TerminalScreen({ entry }: ScreenProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Txt>Terminal · {entry.screen}</Txt>
    </View>
  );
}
