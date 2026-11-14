// Practice tab entry point: the section header plus one card that continues the current
// build-along project (or invites you to start one). Mount it in PracticeScreen.
import React from 'react';
import { Text, View } from 'react-native';
import { C } from '../../theme/tokens';
import { m, sectionLabel, t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { Press, Row } from '../../ui/core';
import { Bar } from '../../ui/controls';
import { navActions } from '../../nav/store';
import { PROJECTS } from './data';
import { useBuildAlongSummary } from './progress';

export function BuildAlongCard() {
  const { nav } = navActions();
  const { current, finished } = useBuildAlongSummary();
  const allDone = finished === PROJECTS.length;
  const open = () => nav('buildalong', current ? { arg: current.project.name } : undefined);

  return (
    <View style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 12, paddingHorizontal: 20 }}>
        <Text style={sectionLabel}>BUILD-ALONG PROJECTS</Text>
        <Text style={m(12, undefined, 500, C.tertiary)}>{finished} of {PROJECTS.length}</Text>
      </Row>
      <Press onPress={open} radius={18} overlay="rgba(255,255,255,0.03)" accessibilityRole="button"
        style={{ marginHorizontal: 16, borderRadius: 18, backgroundColor: C.s1, padding: 16, gap: 12 }}>
        {current ? (
          <>
            <Row style={{ gap: 14 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.rustTint14, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="construction" size={20} color={C.rustLight} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={m(15, undefined, 500, C.text)} numberOfLines={1}>{current.project.name}</Text>
                <Text style={t(12.5, undefined, 400, C.tertiary)} numberOfLines={1}>
                  Milestone {current.status.nextIndex + 1} of {current.status.total} · {current.status.next?.title}
                </Text>
              </View>
              <Text style={m(12.5, undefined, 500, C.rustLight)}>{current.status.doneCount}/{current.status.total}</Text>
            </Row>
            <Bar value={current.status.doneCount / current.status.total} height={4} />
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={t(13, 1.4, 400, C.secondary, { flex: 1 })} numberOfLines={1}>{current.project.title}</Text>
              <Row style={{ gap: 4 }}>
                <Text style={t(13.5, undefined, 600, C.rustLight)}>Continue</Text>
                <Icon name="arrow_forward" size={18} color={C.rustLight} />
              </Row>
            </Row>
          </>
        ) : (
          <>
            <Row style={{ gap: 14, alignItems: 'flex-start' }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: allDone ? C.doneTint : C.s3, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={allDone ? 'check' : 'handyman'} size={20} color={allDone ? C.done : C.secondary} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={t(15, 1.35, 600, C.text)}>{allDone ? 'All five projects built' : 'Five small programs beyond the Book'}</Text>
                <Text style={t(13, 1.45, 400, C.secondary)}>
                  {allDone
                    ? 'Your code is still in ~/projects. Open any of them to keep going.'
                    : 'A to-do list, a word counter, a bank ledger, a Markdown converter and the Game of Life, built a milestone at a time. Real tests tell you when each step works.'}
                </Text>
              </View>
            </Row>
            <Row style={{ justifyContent: 'flex-end', gap: 4 }}>
              <Text style={t(13.5, undefined, 600, C.rustLight)}>{allDone ? 'See projects' : 'Browse projects'}</Text>
              <Icon name="arrow_forward" size={18} color={C.rustLight} />
            </Row>
          </>
        )}
      </Press>
    </View>
  );
}
