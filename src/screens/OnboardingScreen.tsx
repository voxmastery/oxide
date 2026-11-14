// Placeholder — replaced by the Onboarding implementation (design/project/Onboarding.dc.html).
import React from 'react';
import { View } from 'react-native';
import { Txt } from '../ui/core';
import type { ScreenProps } from './registry';

export default function OnboardingScreen({ entry }: ScreenProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Txt>Onboarding · {entry.screen}</Txt>
    </View>
  );
}
