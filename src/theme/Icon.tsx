import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import CODEPOINTS from './iconCodepoints.json';

const CP = CODEPOINTS as Record<string, number>;

export type IconProps = {
  name: string;
  size?: number;
  color?: string;
  /** Material Symbols FILL axis: true = filled variant. */
  fill?: boolean;
  style?: StyleProp<TextStyle>;
};

/** Material Symbols Outlined, rendered by codepoint so it does not depend on font ligatures. */
export function Icon({ name, size = 24, color = '#ECE8E3', fill = false, style }: IconProps) {
  const cp = CP[name];
  if (cp === undefined && __DEV__) console.warn(`Icon: unknown Material Symbol "${name}"`);
  return (
    <Text
      accessible={false}
      allowFontScaling={false}
      style={[
        {
          fontFamily: fill ? 'MaterialSymbolsFilled' : 'MaterialSymbols',
          fontSize: size,
          lineHeight: size,
          width: size,
          height: size,
          color,
          textAlign: 'center',
          includeFontPadding: false,
        },
        style,
      ]}
    >
      {cp !== undefined ? String.fromCodePoint(cp) : ''}
    </Text>
  );
}
