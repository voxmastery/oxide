// Where Ferris shows up: a reaction bubble in the Exercise sheet, a small line under a failed
// Terminal command, and the on/off row for Settings.
import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import { C } from '../../theme/tokens';
import { t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { Inset, Press, Row, TopLine } from '../../ui/core';
import { Switch } from '../../ui/controls';
import { Rich } from '../../ui/code';
import { Ferris } from './Ferris';
import type { Reaction } from './react';
import { terminalSentence } from './react';
import { useFerrisOn, useFerrisStore } from './store';

/** Exercise sheet: Ferris + one line (+ "Want a nudge?" → Hints after 2 failures). Hidden when Ferris is off. */
export function FerrisBubble({ reaction, onNudge }: { reaction: Reaction | null; onNudge?: () => void }) {
  const on = useFerrisOn();
  if (!on || !reaction) return null;
  return (
    <Row style={{ alignItems: 'flex-end', gap: 10, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 2 }}>
      <Ferris mood={reaction.mood} size={46} />
      <View style={{ flex: 1, minWidth: 0, gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, borderBottomLeftRadius: 6, backgroundColor: C.s3 }}>
        <Rich text={reaction.text} style={t(13.5, 1.45, 400, C.reading)} />
        {reaction.nudge && onNudge ? (
          <Press onPress={onNudge} radius={18} hitSlop={{ top: 4, bottom: 4 }} accessibilityRole="button"
            style={{ alignSelf: 'flex-start', height: 36, paddingLeft: 10, paddingRight: 14, borderRadius: 18, backgroundColor: '#2E2B29', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="lightbulb" size={18} color={C.checkpoint} />
            <Text style={t(13, undefined, 600, C.textNav)}>Want a nudge?</Text>
          </Press>
        ) : null}
        <Inset color={C.hairline} radius={16} />
      </View>
    </Row>
  );
}

const REACTS = /^(cargo|rustc|rustlings)$/;

/**
 * Terminal: a small Ferris line under a failed cargo/rustc/rustlings command, read from its output.
 * `lines` is the block's plain text (ANSI stripped). Renders nothing when there's nothing to say.
 */
export const FerrisTerminalLine = memo(function FerrisTerminalLine({ cmd, failed, lines }: { cmd: string; failed: boolean; lines: string[] }) {
  const on = useFerrisOn();
  const prog = cmd.trim().split(/\s+/)[0] ?? '';
  const relevant = on && failed && REACTS.test(prog);
  const text = useMemo(() => (relevant ? terminalSentence(lines) : null), [relevant, lines]);
  if (!text) return null;
  return (
    <Row style={{ gap: 8, paddingTop: 2, alignItems: 'center' }}>
      <Ferris mood="worried" size={30} animated={false} />
      <Rich text={text} style={t(12.5, 1.4, 400, C.mutedHi2, { flex: 1, minWidth: 0 })} />
    </Row>
  );
});

/**
 * Settings row (matches Settings' SRow: 64 dp, 16 dp sides). Put it in a Settings group, e.g.
 * "Practice"; pass `line` when it isn't the first row of its group.
 */
export function FerrisSettingRow({ line }: { line?: boolean }) {
  const on = useFerrisOn();
  const toggle = () => useFerrisStore.getState().setFerris(!on);
  return (
    <Press onPress={toggle} overlay="rgba(255,255,255,0.03)" accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel="Ferris"
      style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 16 }}>
      {line ? <TopLine /> : null}
      <Ferris mood={on ? 'happy' : 'sleepy'} size={26} animated={false} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={t(15, undefined, 500, C.text)}>Ferris</Text>
        <Text style={t(13, 1.4, 400, C.secondary)}>A small crab that reacts when you check code or a command fails</Text>
      </View>
      <Switch value={on} onChange={(v) => useFerrisStore.getState().setFerris(v)} />
    </Press>
  );
}
