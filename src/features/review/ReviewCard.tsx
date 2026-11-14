// Home card: "Review · N cards due". Renders nothing when nothing is due.
import React from 'react';
import { Text, View } from 'react-native';
import { C } from '../../theme/tokens';
import { m, t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { Press } from '../../ui/core';
import { navActions } from '../../nav/store';
import { minutesFor, useReviewDueCount } from './deck';

export function ReviewCard() {
  const n = useReviewDueCount();
  if (n <= 0) return null;
  return (
    <Press onPress={() => navActions().nav('review')} overlay={null} pressedStyle={{ backgroundColor: C.s3 }} accessibilityRole="button"
      accessibilityLabel={`Review, ${n} ${n === 1 ? 'card' : 'cards'} due`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingLeft: 14, paddingRight: 10, borderRadius: 18, backgroundColor: C.s1 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.rustTint14, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="cards" size={24} color={C.rustLight} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text numberOfLines={1} style={t(15, undefined, 600, C.text)}>Review</Text>
        <Text numberOfLines={1} style={t(12.5, undefined, 400, C.tertiary)}>{`About ${minutesFor(n)} min · things you’ve met before`}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={m(17, undefined, 600, C.text)}>{n}</Text>
        <Text style={t(11.5, undefined, 400, C.secondary)}>due</Text>
      </View>
      <Icon name="chevron_right" size={22} color={C.tertiary} />
    </Press>
  );
}
