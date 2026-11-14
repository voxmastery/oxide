// Terminal projects sheet (rendered inside the Terminal screen, per Terminal.dc.html):
// ~/projects/*, rustlings, ~, then Book projects not made yet ("FROM THE BOOK").
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { C } from '../../theme/tokens';
import { m, t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { Press, Row } from '../../ui/core';
import { BottomSheet } from '../../overlays/primitives';
import { projects as bookProjects, rustlings, toc } from '../../content';
import { useApp } from '../../state/app';
import { rustlingsProgress } from '../../state/selectors';
import * as fs from '../../fs';

export function useProjects() {
  const v = fs.useFsVersion();
  const [list, setList] = useState<fs.ProjectInfo[]>([]);
  useEffect(() => {
    let live = true;
    fs.listProjects().then((l) => { if (live) setList(l); }).catch(() => {});
    return () => { live = false; };
  }, [v]);
  return list;
}

/** "Chapter 2 · Programming a Guessing Game" for the Book's projects; hello_world is 1.2. */
export function projectSub(name: string): string {
  const p = bookProjects.find((x) => x.name === name);
  if (p) return `Chapter ${p.chapter} · ${p.title.includes(': ') ? p.title.slice(p.title.indexOf(': ') + 2) : p.title}`;
  if (name === 'hello_world') {
    const s = toc.chapters[0]?.sections.find((x) => x.id === '1.2');
    return `Chapter 1 · ${s?.title ?? 'Hello, World!'}`;
  }
  return 'Cargo project';
}

type RowT = { k: string; name: string; path: string; sub: string; icon: string; on: boolean };

export function ProjectsSheet({ cwd, onClose, onCd, onPrefill }: { cwd: string; onClose: () => void; onCd: (path: string) => void; onPrefill: (text: string) => void }) {
  const list = useProjects();
  const done = useApp((s) => rustlingsProgress(s).done);
  const total = rustlings.total;
  const at = (p: string) => cwd === p || cwd.startsWith(p + '/');
  const rows: RowT[] = [
    ...list.map((p) => ({ k: p.name, name: p.name, path: fs.projectPath(p.name), sub: projectSub(p.name), icon: 'folder', on: at(fs.projectPath(p.name)) })),
    { k: 'rl', name: 'rustlings', path: fs.RUSTLINGS, sub: done ? `${done} of ${total} exercises done` : `${total} exercises`, icon: 'data_object', on: at(fs.RUSTLINGS) },
    { k: 'home', name: '~', path: fs.HOME, sub: 'Home folder', icon: 'home', on: cwd === fs.HOME },
  ];
  const made = new Set(list.map((p) => p.name));
  const book = bookProjects.filter((p) => !made.has(p.name));
  return (
    <BottomSheet onClose={onClose} style={{ backgroundColor: C.s2 }}>
      <Row style={{ paddingLeft: 24, paddingRight: 12, paddingBottom: 8 }}>
        <Text style={t(20, 1.3, 650, C.text, { flex: 1, letterSpacing: -0.2 })}>Projects</Text>
        <Press onPress={() => onPrefill('cargo new ')} overlay={null} pressedStyle={{ backgroundColor: C.raisedHover }} radius={22}
          style={{ height: 44, paddingLeft: 12, paddingRight: 16, borderRadius: 22, backgroundColor: C.raised, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="add" size={20} color={C.text} />
          <Text style={t(14, undefined, 600, C.text)}>New project</Text>
        </Press>
      </Row>
      {rows.map((r) => (
        <Press key={r.k} overlay="rgba(255,255,255,0.04)" onPress={() => { onClose(); if (!r.on) onCd(r.path); }}
          style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingLeft: 24, paddingRight: 20, backgroundColor: r.on ? C.rustTint08 : 'transparent' }}>
          <Icon name={r.icon} size={22} color={r.on ? C.rustLight : C.secondary} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={m(15, undefined, 500, r.on ? C.text : C.strong2)} numberOfLines={1}>{r.name}</Text>
            <Text style={t(12.5, undefined, 400, C.tertiary)} numberOfLines={1}>{r.sub}</Text>
          </View>
          {r.on ? <Icon name="check" size={20} color={C.rustLight} /> : <View style={{ width: 20 }} />}
        </Press>
      ))}
      {book.length ? (
        <>
          <Text style={m(11, undefined, 500, C.secondary, { paddingTop: 14, paddingHorizontal: 24, paddingBottom: 6, letterSpacing: 0.99 })}>FROM THE BOOK</Text>
          {book.map((p) => (
            <Press key={p.name} overlay="rgba(255,255,255,0.04)" onPress={() => onPrefill(`cargo new ${p.name}`)}
              style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingLeft: 24, paddingRight: 20 }}>
              <Icon name="folder_code" size={22} color={C.tertiary} />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={m(15, undefined, 500, C.strong2)} numberOfLines={1}>{p.name}</Text>
                <Text style={t(12.5, undefined, 400, C.tertiary)} numberOfLines={1}>{projectSub(p.name)}</Text>
              </View>
              <Text style={m(12, undefined, 500, C.tertiary)}>cargo new</Text>
            </Press>
          ))}
        </>
      ) : null}
    </BottomSheet>
  );
}
