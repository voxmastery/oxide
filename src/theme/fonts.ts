import {
  PublicSans_300Light,
  PublicSans_400Regular,
  PublicSans_400Regular_Italic,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
  PublicSans_800ExtraBold,
} from '@expo-google-fonts/public-sans';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_400Regular_Italic,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { MaterialSymbolsOutlined_400Regular } from '@expo-google-fonts/material-symbols-outlined/400Regular';
import { MaterialSymbolsOutlined_400Regular_Filled } from '@expo-google-fonts/material-symbols-outlined/400Regular_Filled';
import type { TextStyle } from 'react-native';

export const FONT_ASSETS = {
  PublicSans_300Light,
  PublicSans_400Regular,
  PublicSans_400Regular_Italic,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
  PublicSans_800ExtraBold,
  JetBrainsMono_400Regular,
  JetBrainsMono_400Regular_Italic,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
  MaterialSymbols: MaterialSymbolsOutlined_400Regular,
  MaterialSymbolsFilled: MaterialSymbolsOutlined_400Regular_Filled,
};

/**
 * Static font files stand in for the prototype's variable weights.
 * 650 (used for headings and primary buttons) maps to Bold; on screen the difference is small.
 */
export type Weight = 300 | 400 | 500 | 600 | 650 | 700 | 800;

export function sans(weight: Weight = 400, italic = false): TextStyle {
  if (italic) return { fontFamily: 'PublicSans_400Regular_Italic' };
  const f =
    weight <= 300 ? 'PublicSans_300Light'
    : weight === 400 ? 'PublicSans_400Regular'
    : weight === 500 ? 'PublicSans_500Medium'
    : weight === 600 ? 'PublicSans_600SemiBold'
    : weight <= 700 ? 'PublicSans_700Bold'
    : 'PublicSans_800ExtraBold';
  return { fontFamily: f };
}

export function mono(weight: Weight = 400, italic = false): TextStyle {
  if (italic) return { fontFamily: 'JetBrainsMono_400Regular_Italic' };
  const f =
    weight <= 400 ? 'JetBrainsMono_400Regular'
    : weight === 500 ? 'JetBrainsMono_500Medium'
    : weight === 600 || weight === 650 ? 'JetBrainsMono_600SemiBold'
    : 'JetBrainsMono_700Bold';
  // Ligatures off for code everywhere (spec: font-variant-ligatures: none).
  return { fontFamily: f, fontVariant: [] };
}

/** Text style shorthand: t(size, lineHeightMultiplier?, weight?, color?) */
export function t(size: number, lh?: number, weight: Weight = 400, color?: string, extra?: TextStyle): TextStyle {
  return {
    ...sans(weight),
    fontSize: size,
    ...(lh ? { lineHeight: Math.round(size * lh * 10) / 10 } : null),
    ...(color ? { color } : null),
    ...extra,
  };
}

export function m(size: number, lineHeight?: number, weight: Weight = 400, color?: string, extra?: TextStyle): TextStyle {
  return {
    ...mono(weight),
    fontSize: size,
    ...(lineHeight ? { lineHeight } : null),
    ...(color ? { color } : null),
    ...extra,
  };
}

/** Letter-spacing in em → dp. */
export const ls = (em: number, size: number) => em * size;

/** Section label: JetBrains Mono 11 / 500, letter-spacing 0.09em, uppercase, #A39C95. */
export const sectionLabel: TextStyle = { ...mono(500), fontSize: 11, letterSpacing: 0.99, textTransform: 'uppercase', color: '#A39C95' };
/** Small label: JetBrains Mono 10.5 / 500, 0.08em. */
export const smallLabel: TextStyle = { ...mono(500), fontSize: 10.5, letterSpacing: 0.84, textTransform: 'uppercase' };
