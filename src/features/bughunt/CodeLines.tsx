// A highlighted Rust listing whose lines can be tapped (Bug Hunt's "find the line" step) or marked
// (the corrected program). Rows are full width so a tap anywhere on the line counts.
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { C, SYN } from '../../theme/tokens';
import { mono } from '../../theme/fonts';
import { highlight } from '../../rust/highlight';
import { Press } from '../../ui/core';

export type LineState = 'found' | 'miss' | 'fixed' | 'was' | undefined;

const BG: Record<Exclude<LineState, undefined>, string> = {
  found: C.rustTint14,
  miss: C.errorTint,
  fixed: C.doneTint,
  was: C.errorTint,
};
const BAR: Record<Exclude<LineState, undefined>, string> = {
  found: C.rust,
  miss: C.error,
  fixed: C.done,
  was: C.error,
};

export function CodeLines({
  code, states = {}, onTap, rowHeight = 20, fontSize = 12.5,
}: { code: string; states?: Record<number, LineState>; onTap?: (line: number) => void; rowHeight?: number; fontSize?: number }) {
  const lines = highlight(code);
  const P = SYN.dark;
  const w = String(lines.length).length;
  const [width, setWidth] = useState(0);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: width, paddingVertical: 8 }}>
          {lines.map((ln) => {
            const st = states[ln.n];
            const blank = ln.toks.every((tk) => !tk.t.trim());
            const tappable = !!onTap && !blank && st !== 'miss';
            const row = (
              <>
                {st ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: BAR[st] }} /> : null}
                <Text style={{ ...mono(400), fontSize, lineHeight: rowHeight, color: st === 'miss' || st === 'was' ? C.errorText : C.disabled, width: (w + 1) * fontSize * 0.62, textAlign: 'right', marginRight: 12 }}>{ln.n}</Text>
                <Text style={{ ...mono(400), fontSize, lineHeight: rowHeight, color: P.id, opacity: st === 'miss' ? 0.55 : 1, textDecorationLine: st === 'was' ? 'line-through' : 'none' }}>
                  {ln.toks.length === 0 ? ' ' : ln.toks.map((tk, i) => (
                    <Text key={i} style={[{ color: P[tk.k] }, tk.k === 'com' ? { fontFamily: 'JetBrainsMono_400Regular_Italic' } : null]}>{tk.t}</Text>
                  ))}
                </Text>
              </>
            );
            const style = { flexDirection: 'row' as const, alignItems: 'center' as const, height: rowHeight, paddingLeft: 8, paddingRight: 16, backgroundColor: st ? BG[st] : undefined };
            return tappable ? (
              <Press key={ln.n} onPress={() => onTap!(ln.n)} overlay="rgba(255,255,255,0.06)" accessibilityRole="button" accessibilityLabel={`Line ${ln.n}`} style={style}>
                {row}
              </Press>
            ) : (
              <View key={ln.n} style={style}>{row}</View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
