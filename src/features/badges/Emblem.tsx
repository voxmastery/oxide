// Badge emblems: a shape (circle, hexagon, shield, rounded square) with a simple line glyph, drawn with
// react-native-svg in the app palette. Locked badges are drawn in surface greys.
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { C } from '../../theme/tokens';
import { m } from '../../theme/fonts';
import type { Badge, BadgeShape, GlyphName } from './defs';

/** Glyphs on a 24 × 24 grid. `f` = filled, otherwise stroked. */
const GLYPHS: Record<GlyphName, { d: string; f?: boolean }[]> = {
  check: [{ d: 'M5.5 12.5 L10 17 L18.5 7.5' }],
  flame: [{ d: 'M12 2.5 C15.5 6.5 18.5 9.5 18.5 14.2 A6.5 6.5 0 0 1 5.5 14.2 C5.5 11.2 7.2 9.2 8.6 7.4 C9.2 9.6 10.4 10.8 11.8 11 C12.6 8.4 12.6 5.6 12 2.5 Z', f: true }],
  book: [{ d: 'M3.5 5.5 C6.5 4.3 9.5 4.5 12 6.3 C14.5 4.5 17.5 4.3 20.5 5.5 V18.8 C17.5 17.7 14.5 17.8 12 19.6 C9.5 17.8 6.5 17.7 3.5 18.8 Z' }, { d: 'M12 6.3 V19.6' }],
  prompt: [{ d: 'M5 7.5 L10 12 L5 16.5' }, { d: 'M12.5 17 H19' }],
  bug: [
    { d: 'M7.5 10.5 A4.5 5.5 0 0 1 16.5 10.5 V14 A4.5 5.5 0 0 1 7.5 14 Z' },
    { d: 'M9.5 6 L8 3.8 M14.5 6 L16 3.8 M7.5 11 H4 M7.5 15 L4.5 17 M16.5 11 H20 M16.5 15 L19.5 17 M12 9 V19' },
  ],
  crate: [{ d: 'M4 8 L12 4 L20 8 V16 L12 20 L4 16 Z' }, { d: 'M4 8 L12 12 L20 8 M12 12 V20' }],
  key: [{ d: 'M11.5 12 A3.8 3.8 0 1 1 11.5 11.99 Z' }, { d: 'M11.5 12 H20.5 M17.5 12 V15.5 M20.5 12 V14.5' }],
  grid: [{ d: 'M4.5 4.5 H10.5 V10.5 H4.5 Z M13.5 4.5 H19.5 V10.5 H13.5 Z M4.5 13.5 H10.5 V19.5 H4.5 Z' }, { d: 'M13.5 13.5 H19.5 V19.5 H13.5 Z', f: true }],
  spark: [{ d: 'M12 3 L13.8 10.2 L21 12 L13.8 13.8 L12 21 L10.2 13.8 L3 12 L10.2 10.2 Z', f: true }],
  trophy: [{ d: 'M7.5 4 H16.5 V9.5 A4.5 4.5 0 0 1 7.5 9.5 Z' }, { d: 'M7.5 6 H4.5 C4.5 9 6 10.5 8 10.8 M16.5 6 H19.5 C19.5 9 18 10.5 16 10.8 M12 14 V17.5 M8.5 20 H15.5 M9.5 17.5 H14.5' }],
  chevrons: [{ d: 'M6 13.5 L12 7.5 L18 13.5' }, { d: 'M6 18.5 L12 12.5 L18 18.5' }],
  flag: [{ d: 'M6 21 V3.5' }, { d: 'M6 4.5 H17.5 L15 8.5 L17.5 12.5 H6' }],
  download: [{ d: 'M12 3.5 V14 M7.5 9.8 L12 14.3 L16.5 9.8' }, { d: 'M4.5 15.5 V19.5 H19.5 V15.5' }],
  list: [{ d: 'M4 6.5 L5.6 8 L8.5 5 M4 12.5 L5.6 14 L8.5 11' }, { d: 'M11 6.5 H20 M11 12.5 H20 M11 18.5 H20 M4.5 18.5 H8' }],
  tags: [{ d: 'M8 7 L3.5 12 L8 17 M16 7 L20.5 12 L16 17 M13.8 5 L10.2 19' }],
  bars: [{ d: 'M5.5 20 V12 M10 20 V5 M14.5 20 V9 M19 20 V14.5' }],
  ledger: [{ d: 'M3.5 9 L12 4 L20.5 9 Z' }, { d: 'M6 11 V17 M10 11 V17 M14 11 V17 M18 11 V17 M3.5 20 H20.5' }],
  cells: [{ d: 'M9.5 3.5 H14.5 V8.5 H9.5 Z M14.5 9.5 H19.5 V14.5 H14.5 Z M4.5 15.5 H9.5 V20.5 H4.5 Z M9.5 15.5 H14.5 V20.5 H9.5 Z M14.5 15.5 H19.5 V20.5 H14.5 Z', f: true }],
  bubble: [{ d: 'M4.5 5 H19.5 V15.5 H11 L6.5 19.5 V15.5 H4.5 Z' }, { d: 'M8.5 10.3 H8.6 M12 10.3 H12.1 M15.4 10.3 H15.5' }],
};

function ShapePath({ shape, fill, stroke }: { shape: BadgeShape; fill: string; stroke: string }) {
  const p = { fill, stroke, strokeWidth: 1.5 };
  switch (shape) {
    case 'circle': return <Circle cx={24} cy={24} r={21.5} {...p} />;
    case 'hex': return <Path d="M24 2.5 L42.6 13.25 V34.75 L24 45.5 L5.4 34.75 V13.25 Z" strokeLinejoin="round" {...p} />;
    case 'shield': return <Path d="M24 2.8 L41.5 8.6 V22.5 C41.5 33.5 34 41.5 24 45.4 C14 41.5 6.5 33.5 6.5 22.5 V8.6 Z" strokeLinejoin="round" {...p} />;
    case 'square': return <Rect x={3.5} y={3.5} width={41} height={41} rx={13} {...p} />;
  }
}

function alpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** A badge emblem, `size` dp square. */
export function Emblem({ badge, size = 52, earned }: { badge: Badge; size?: number; earned: boolean }) {
  const col = earned ? badge.color : C.iconOff;
  const fill = earned ? alpha(badge.color, 0.14) : C.s3;
  const stroke = earned ? alpha(badge.color, 0.7) : C.border;
  const glyph = badge.glyph ? GLYPHS[badge.glyph] : null;
  // Glyph-less badges (Rustlings topics) show their label large in the middle.
  const bigLabel = !glyph && badge.label;
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <ShapePath shape={badge.shape} fill={fill} stroke={stroke} />
        {glyph ? (
          <G transform={badge.label ? 'translate(13.5 9.5) scale(0.875)' : 'translate(12 12)'}>
            {glyph.map((g, i) => (
              <Path key={i} d={g.d} fill={g.f ? col : 'none'} stroke={g.f ? 'none' : col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </G>
        ) : null}
      </Svg>
      {bigLabel ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text allowFontScaling={false} style={m(size * 0.3, size * 0.36, 600, col)}>{badge.label}</Text>
        </View>
      ) : badge.label ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: size * 0.13, alignItems: 'center' }}>
          <Text allowFontScaling={false} style={m(size * 0.19, size * 0.22, 700, col)}>{badge.label}</Text>
        </View>
      ) : null}
    </View>
  );
}
