// First-visit tour (Workspace.dc.html TOUR): a spotlight hole with a rust ring and a light tip card.
import React from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { C } from '../../theme/tokens';
import { m, t } from '../../theme/fonts';
import { Press, Row } from '../../ui/core';
import { inlineCode } from '../../ui/code';

const TIPS = [
  { title: 'Edit right here', body: 'Tap any line to type. Brackets, `::`, `->` and Tab sit in a key row above the keyboard.' },
  { title: 'Check your work', body: 'Check compiles the file and runs its tests, like `cargo test`. Run only executes `main()`.' },
  { title: 'Read the compiler', body: 'Errors land in this sheet, formatted exactly like rustc. Drag it up for the full message, or tap Explain for plain English.' },
  { title: 'Stuck?', body: 'Hints come in three levels, from a nudge to the answer. The solution unlocks after 3 attempts.' },
];

/** Holes at the 412 × 857 reference; bottom-anchored ones follow the screen's height. */
function geometry(i: number, W: number, H: number): { hole: [number, number, number, number, number]; tip: ViewStyle } {
  const fromBottom = (y: number) => H - (857 - y);
  switch (i) {
    case 0: return { hole: [6, 104, W - 12, Math.min(300, H - 104 - 260), 14], tip: { left: 16, right: 16, top: Math.min(420, H - 250) } };
    case 1: return { hole: [W - 124, fromBottom(785), 122, 64, 20], tip: { right: 16, width: 300, bottom: 84 } };
    case 2: return { hole: [4, fromBottom(703), W - 8, 72, 22], tip: { left: 16, right: 16, bottom: 166 } };
    default: return { hole: [4, fromBottom(783), 164, 68, 18], tip: { left: 16, width: 300, bottom: 84 } };
  }
}

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
}

export function Tour({ step, width: W, height: H, onNext, onSkip }: { step: number; width: number; height: number; onNext: () => void; onSkip: () => void }) {
  const tip = TIPS[step];
  const { hole: [x, y, w, h, r], tip: pos } = geometry(step, W, H);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}>
      <Svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Path d={`M0,0 H${W} V${H} H0 Z ${roundRect(x, y, w, h, r)}`} fill="rgba(8,7,7,0.74)" fillRule="evenodd" />
        <Rect x={x - 1} y={y - 1} width={w + 2} height={h + 2} rx={r + 1} stroke={C.rust} strokeWidth={2} fill="none" />
      </Svg>
      <View style={[{ position: 'absolute', backgroundColor: '#F4F0EB', borderRadius: 20, paddingTop: 18, paddingRight: 16, paddingBottom: 12, paddingLeft: 18, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: 16 }, elevation: 12 }, pos]}>
        <View style={{ gap: 6 }}>
          <Text style={m(11, undefined, 600, '#A2420F', { letterSpacing: 0.88 })}>TIP {step + 1} OF 4</Text>
          <Text style={t(17, undefined, 650, '#1B1917')}>{tip.title}</Text>
          <Text style={t(14, 1.5, 400, '#3D3935')}>
            {tip.body.split('`').map((s, i) => (i % 2 ? <Text key={i} style={[inlineCode(14), { backgroundColor: '#E6DFD6', color: '#8A2F0C' }]}>{' ' + s + ' '}</Text> : <Text key={i}>{s}</Text>))}
          </Text>
        </View>
        <Row style={{ justifyContent: 'space-between', marginTop: 14 }}>
          <Row style={{ gap: 6 }}>
            {[0, 1, 2, 3].map((i) => <View key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === step ? '#1B1917' : '#C9C2BA' }} />)}
          </Row>
          <Row style={{ gap: 4 }}>
            <Press onPress={onSkip} radius={20} overlay="rgba(0,0,0,0.05)" style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center' }}>
              <Text style={t(14, undefined, 600, '#3D3935')}>Skip</Text>
            </Press>
            <Press onPress={onNext} radius={20} overlay={null} pressedStyle={{ backgroundColor: C.rustPressed }} style={{ height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: C.rust, justifyContent: 'center' }}>
              <Text style={t(14, undefined, 650, C.onRust)}>{step === 3 ? 'Got it' : 'Next'}</Text>
            </Press>
          </Row>
        </Row>
      </View>
    </View>
  );
}
