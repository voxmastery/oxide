// Placeholder — replaced by the Project implementation (design/project/Project.dc.html).
import React from 'react';
import { View } from 'react-native';
import { Txt } from '../ui/core';
import type { ScreenProps } from './registry';

export default function ProjectScreen({ entry }: ScreenProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Txt>Project · {entry.screen}</Txt>
    </View>
  );
}
