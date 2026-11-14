import React from 'react';
import { ScrollView, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { C, MARK, SYN } from '../theme/tokens';
import { mono } from '../theme/fonts';
import { highlightAny, type Mark } from '../rust/highlight';
import { ansi } from '../rust/ansi';
import { TC } from '../theme/tokens';

const MARK_BG = { err: 'rgba(255,107,118,0.12)', warn: 'rgba(242,194,91,0.12)', run: 'rgba(255,161,74,0.12)' } as const;

/** Highlighted, non-editable code. Code listing default: 12.5/20, horizontal scroll. */
export function CodeView({
  code, lang = 'rust', fontSize = 12.5, lineHeight = 20, gutter = false, marks = [], scroll = true, padding = 16, style, wrap = false,
}: { code: string; lang?: string; fontSize?: number; lineHeight?: number; gutter?: boolean; marks?: Mark[]; scroll?: boolean; padding?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  const lines = highlightAny(code, lang, marks);
  const P = SYN.dark;
  const w = String(lines.length).length;
  const body = (
    <View style={{ paddingVertical: padding - 4, paddingHorizontal: padding }}>
      {lines.map((ln) => (
        <View key={ln.n} style={{ flexDirection: 'row', backgroundColor: ln.mark ? MARK_BG[ln.mark] : undefined }}>
          {gutter ? (
            <Text style={{ ...mono(400), fontSize, lineHeight, color: C.disabled, width: (w + 1) * fontSize * 0.6, textAlign: 'right', marginRight: 12 }}>{ln.n}</Text>
          ) : null}
          <Text style={{ ...mono(400), fontSize, lineHeight, color: P.id, flexShrink: wrap ? 1 : 0 }}>
            {ln.toks.length === 0 ? ' ' : ln.toks.map((tk, i) => (
              <Text
                key={i}
                style={[
                  { color: P[tk.k] },
                  tk.k === 'com' ? { fontFamily: 'JetBrainsMono_400Regular_Italic' } : null,
                  tk.m ? { textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: MARK[tk.m], backgroundColor: MARK_BG[tk.m] } : null,
                ]}
              >
                {tk.t}
              </Text>
            ))}
          </Text>
        </View>
      ))}
    </View>
  );
  return scroll && !wrap ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style}>{body}</ScrollView>
  ) : (
    <View style={style}>{body}</View>
  );
}

/** Terminal/compiler output lines with ANSI colors, verbatim. 12/18 (well: 11/17). */
export function AnsiLines({
  lines, fontSize = 12, lineHeight = 18, wrap = false, style, textStyle,
}: { lines: string[]; fontSize?: number; lineHeight?: number; wrap?: boolean; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> }) {
  const body = (
    <View>
      {lines.map((l, i) => (
        <Text key={i} style={[{ ...mono(400), fontSize, lineHeight, color: TC.n }, textStyle]}>
          {l === '' ? ' ' : ansi(l).map((s, j) => (
            <Text key={j} style={{ color: TC[s.c], fontFamily: s.bold ? 'JetBrainsMono_700Bold' : 'JetBrainsMono_400Regular' }}>{s.t}</Text>
          ))}
        </Text>
      ))}
    </View>
  );
  return wrap ? <View style={style}>{body}</View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style}>{body}</ScrollView>;
}

/** Inline code chip style for prose: JetBrains Mono 0.86em, #F2CDB8 on #2A2826. */
export function inlineCode(baseSize: number): TextStyle {
  return { ...mono(400), fontSize: Math.round(baseSize * 0.86 * 10) / 10, color: C.inlineCodeText, backgroundColor: C.inlineCodeBg, borderRadius: 5 };
}

/** Render a string with `backtick` code spans (the prototype's `rich()`). */
export function Rich({ text, style, codeStyle }: { text: string; style?: StyleProp<TextStyle>; codeStyle?: StyleProp<TextStyle> }) {
  const flat = (Array.isArray(style) ? Object.assign({}, ...style) : style) as TextStyle | undefined;
  const size = flat?.fontSize ?? 14;
  return (
    <Text style={style}>
      {String(text).split('`').map((p, i) =>
        i % 2 ? <Text key={i} style={[inlineCode(size), codeStyle]}>{' ' + p + ' '}</Text> : p ? <Text key={i}>{p}</Text> : null,
      )}
    </Text>
  );
}
