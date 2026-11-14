// One Book project (design/project/Project.dc.html). entry.arg = guessing_game | minigrep | hello.
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { C } from '../theme/tokens';
import { m, sectionLabel, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Press, Row, TopLine } from '../ui/core';
import { Button, IconButton } from '../ui/controls';
import { navActions } from '../nav/store';
import { useApp } from '../state/app';
import { chapterOf, projectByName, projects, type BookProject } from '../content';
import { deleteProject, listProjects, restoreProject, useFsVersion, type ProjectInfo } from '../fs';
import type { ScreenProps } from './registry';

const fileIcon = (f: string) => (f.endsWith('.rs') ? 'description' : f.endsWith('.toml') ? 'settings' : 'draft');

export default function ProjectScreen({ entry }: ScreenProps) {
  const { nav, back, pop, showToast } = navActions();
  const p: BookProject = projectByName((entry.arg ?? 'guessing_game') as BookProject['name']) ?? projects[0];
  const current = useApp((s) => s.book.current);
  const v = useFsVersion();
  const [info, setInfo] = useState<ProjectInfo | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    listProjects().then((ps) => { if (live) setInfo(ps.find((x) => x.name === p.name) ?? null); }).catch(() => { if (live) setInfo(null); });
    return () => { live = false; };
  }, [v, p.name]);
  const made = !!info;
  const root = `~/projects/${p.name}`;
  const curCh = chapterOf(current)?.n;
  const firstPre = p.prerequisite?.match(/chapters? (\d+)/)?.[1];
  const pre = !made && p.prerequisite
    ? p.prerequisite + (typeof curCh === 'number' && curCh < Number(firstPre ?? p.chapter) ? ` You’re on chapter ${curCh}, so you may want those first.` : '')
    : '';
  const [status, sbg, sc] = made ? ['Done', 'rgba(87,214,200,0.14)', C.done] : ['Not started', C.s3, C.mutedHi];
  const files = info?.files ?? [];

  const onDelete = () => pop('delproj', {
    name: p.name,
    onDelete: async () => {
      try {
        await deleteProject(p.name);
        back();
        showToast(`${p.name} deleted`, 'Undo', () => { restoreProject(p.name).catch(() => {}); });
      } catch { showToast(`Couldn’t delete ${p.name}`); }
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <Row style={{ height: 56, gap: 2, paddingHorizontal: 4 }}>
        <IconButton name="arrow_back" onPress={back} label="Back" />
        <View style={{ flex: 1 }} />
        {made ? <IconButton name="delete" color={C.strong2} onPress={onDelete} label="Delete project" /> : null}
      </Row>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 16, paddingTop: 4, paddingHorizontal: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 10, paddingHorizontal: 4 }}>
          <Text style={sectionLabel}>CHAPTER {p.chapter} · PROJECT</Text>
          <Text style={m(30, 33, 600, C.text, { letterSpacing: -0.6 })}>{p.name}</Text>
          <Text style={t(15.5, 1.55, 400, C.mutedHi)}>{p.description}</Text>
          <Row style={{ gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
            <View style={{ height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: sbg, justifyContent: 'center' }}>
              <Text style={t(12.5, undefined, 600, sc)}>{status}</Text>
            </View>
            <View style={{ height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: C.s3, justifyContent: 'center' }}>
              <Text style={t(12.5, undefined, 500, C.mutedHi)}>{p.steps.length}{p.chapter === 2 ? ' parts' : ' sections'}</Text>
            </View>
          </Row>
        </View>
        {pre ? (
          <Row style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: C.s1, gap: 12, alignItems: 'flex-start' }}>
            <Icon name="info" size={20} color={C.checkpoint} />
            <Text style={t(14, 1.5, 400, C.strong2, { flex: 1 })}>{pre}</Text>
          </Row>
        ) : null}
        <View style={{ borderRadius: 20, backgroundColor: C.s1, paddingVertical: 8 }}>
          <Text style={[sectionLabel, { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 6 }]}>IN THE BOOK</Text>
          {p.steps.map((s, i) => (
            <Press key={i} onPress={() => nav('reader', { arg: String(s.section), params: s.anchor ? { anchor: s.anchor } : undefined })} overlay="rgba(255,255,255,0.03)"
              style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingHorizontal: 16 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: made ? C.done : 'transparent', borderWidth: made ? 0 : 1.5, borderColor: C.outline, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={m(12, undefined, 600, made ? C.onDone : C.secondary)}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={t(15, 1.35, 500, C.text)}>{s.title}</Text>
                <Text style={m(12, undefined, 400, C.tertiary)}>{p.chapter === 2 ? '' : `${s.section} · `}{s.teaches}</Text>
              </View>
            </Press>
          ))}
        </View>
        {made ? (
          <View style={{ borderRadius: 20, backgroundColor: C.s1, paddingVertical: 8 }}>
            <Text style={[sectionLabel, { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 6 }]}>FILES</Text>
            {files.map((f) => (
              <Press key={f} onPress={() => nav('editor', { arg: p.name, params: { file: f } })} overlay="rgba(255,255,255,0.03)"
                style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6, paddingHorizontal: 16 }}>
                <Icon name={fileIcon(f)} size={22} color={C.secondary} />
                <Text style={m(14.5, undefined, 500, C.text, { flex: 1 })} numberOfLines={1}>{f}</Text>
                <Text style={t(13.5, undefined, 600, C.rustLight)}>Edit</Text>
              </Press>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 14 }}>
        <TopLine color={C.divider} />
        <Button
          height={56}
          fontSize={16.5}
          icon="terminal"
          label={made ? 'Open in the Terminal' : `Create ${p.name}`}
          onPress={() => nav('terminal', made ? { params: { cwd: root } } : { params: { cwd: '~/projects', run: `cargo new ${p.name}` } })}
        />
      </View>
    </View>
  );
}
