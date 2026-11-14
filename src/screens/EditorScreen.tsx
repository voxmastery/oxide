// Placeholder — replaced by the Editor implementation (design/project/Editor.dc.html).
import React from 'react';
import { View } from 'react-native';
import { Txt } from '../ui/core';
import type { ScreenProps } from './registry';

export default function EditorScreen({ entry }: ScreenProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Txt>Editor · {entry.screen}</Txt>
    </View>
  );
}
