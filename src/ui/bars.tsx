import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { C } from '../theme/tokens';
import { t } from '../theme/fonts';
import { IconButton } from './controls';
import { Row } from './core';

/** Tab-root header, 64 dp: title 24/650 −0.02em, optional subtitle 12.5 #A39C95, actions right. */
export function RootHeader({ title, subtitle, right, style }: { title: string; subtitle?: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Row style={[{ height: 64, paddingLeft: 20, paddingRight: 8, justifyContent: 'space-between' }, style]}>
      <View style={{ flex: 1 }}>
        <Text style={t(24, 1.2, 650, C.text, { letterSpacing: -0.48 })} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={t(12.5, 1.3, 400, C.secondary)} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <Row>{right}</Row>
    </Row>
  );
}

/** Pushed-screen top bar, 56 dp: back + title (20/600 or 15.5/600 with a subtitle) + actions. */
export function TopBar({
  title, subtitle, onBack, right, style, children, backIcon = 'arrow_back',
}: { title?: React.ReactNode; subtitle?: React.ReactNode; onBack?: () => void; right?: React.ReactNode; style?: StyleProp<ViewStyle>; children?: React.ReactNode; backIcon?: string }) {
  return (
    <Row style={[{ height: 56, paddingHorizontal: 4, gap: 4 }, style]}>
      {onBack ? <IconButton name={backIcon} onPress={onBack} label="Back" /> : <View style={{ width: 12 }} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        {children ?? (
          <>
            {typeof title === 'string' ? (
              <Text style={subtitle ? t(15.5, 1.3, 600, C.text) : t(20, 1.3, 600, C.text)} numberOfLines={1}>{title}</Text>
            ) : title}
            {subtitle ? (typeof subtitle === 'string' ? <Text style={t(12.5, 1.3, 400, C.secondary)} numberOfLines={1}>{subtitle}</Text> : subtitle) : null}
          </>
        )}
      </View>
      <Row>{right}</Row>
    </Row>
  );
}
