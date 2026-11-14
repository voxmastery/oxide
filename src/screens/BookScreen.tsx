// Placeholder — replaced by the Book implementation (design/project/Book.dc.html).
import React from 'react';
import { View } from 'react-native';
import { Txt } from '../ui/core';
import type { ScreenProps } from './registry';

export default function BookScreen({ entry }: ScreenProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Txt>Book · {entry.screen}</Txt>
    </View>
  );
}
