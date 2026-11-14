// Placeholder — replaced by the Workspace implementation (design/project/Workspace.dc.html).
import React from 'react';
import { View } from 'react-native';
import { Txt } from '../ui/core';
import type { ScreenProps } from './registry';

export default function WorkspaceScreen({ entry }: ScreenProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Txt>Workspace · {entry.screen}</Txt>
    </View>
  );
}
