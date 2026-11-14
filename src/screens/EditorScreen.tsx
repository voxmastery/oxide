// Project file editor (design/project/Editor.dc.html). entry.arg = project name, params.file = relative path.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { C } from '../theme/tokens';
import { m, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Press, Row } from '../ui/core';
import { IconButton } from '../ui/controls';
import { CodeEditor } from '../ui/CodeEditor';
import { navActions } from '../nav/store';
import { useActiveMinutes } from '../state/useActiveMinutes';
import { listProjects, read, write } from '../fs';
import type { ScreenProps } from './registry';

const DEFAULT_FILES = ['src/main.rs', 'Cargo.toml'];

export default function EditorScreen({ entry }: ScreenProps) {
  useActiveMinutes();
  const { nav, back } = navActions();
  const project = entry.arg ?? 'hello_world';
  const root = `~/projects/${project}`;
  const [files, setFiles] = useState<string[]>(DEFAULT_FILES);
  const [file, setFile] = useState<string>((entry.params?.file as string | undefined) ?? 'src/main.rs');
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const pending = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    listProjects().then((ps) => {
      const p = ps.find((x) => x.name === project);
      if (!p) return;
      const text = p.files.filter((f) => !f.startsWith('target/') && f !== 'Cargo.lock' && /\.(rs|toml|txt|md)$/.test(f));
      const ordered = [...DEFAULT_FILES.filter((f) => text.includes(f)), ...text.filter((f) => !DEFAULT_FILES.includes(f))];
      if (ordered.length) setFiles(ordered);
    }).catch(() => {});
  }, [project]);

  useEffect(() => {
    if (file in texts) return;
    let live = true;
    read(`${root}/${file}`).then((s) => { if (live) { setTexts((x) => ({ ...x, [file]: s })); setError(null); } })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [file, root, texts]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const todo = pending.current;
    pending.current = {};
    await Promise.all(Object.entries(todo).map(([f, s]) => write(`${root}/${f}`, s)));
    setSaved(true);
  }, [root]);

  useEffect(() => () => { clearTimeout(timer.current); const todo = pending.current; Object.entries(todo).forEach(([f, s]) => { write(`${root}/${f}`, s).catch(() => {}); }); }, [root]);

  const onChange = (v: string) => {
    setTexts((x) => ({ ...x, [file]: v }));
    pending.current[file] = v;
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { flush().catch(() => setSaved(false)); }, 600);
  };

  const run = async () => {
    try { await flush(); } catch { /* the Terminal will show the build's view of the files */ }
    nav('terminal', { params: { cwd: '~/projects', run: `cd ${project} && cargo run` } });
  };

  const fname = file.slice(file.lastIndexOf('/') + 1);
  const code = texts[file];

  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <Row style={{ height: 56, gap: 2, paddingLeft: 4, paddingRight: 10 }}>
        <IconButton name="arrow_back" onPress={back} label="Back" />
        <View style={{ flex: 1, minWidth: 0, gap: 3, paddingLeft: 2 }}>
          <Text style={m(16, undefined, 600, C.text)} numberOfLines={1}>{fname}</Text>
          <Text style={m(11.5, undefined, 400, C.tertiary)} numberOfLines={1}>{root}/{file}</Text>
        </View>
        <Text style={t(12.5, undefined, 400, saved ? C.tertiary : C.rustLight, { paddingHorizontal: 10 })}>{saved ? 'Saved' : 'Saving…'}</Text>
        <Press onPress={run} radius={20} overlay={null} pressedStyle={{ backgroundColor: C.rustPressed }} accessibilityRole="button"
          style={{ height: 40, paddingLeft: 10, paddingRight: 16, borderRadius: 20, backgroundColor: C.rust, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="play_arrow" size={22} color={C.onRust} fill />
          <Text style={t(14, undefined, 650, C.onRust)}>Run</Text>
        </Press>
      </Row>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingHorizontal: 12 }}>
          {files.map((f) => {
            const on = f === file;
            return (
              <Press key={f} onPress={() => setFile(f)} overlay={null} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ height: 44, paddingHorizontal: 12, justifyContent: 'center' }}>
                <Text style={m(13, undefined, 500, on ? C.text : C.secondary)}>{f}</Text>
                <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: on ? C.rust : 'transparent', zIndex: 2 }} />
              </Press>
            );
          })}
        </ScrollView>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
      </View>
      <View style={{ flex: 1, minHeight: 0 }}>
        {code !== undefined ? (
          <CodeEditor key={file} value={code} onChange={onChange} lang={file.endsWith('.toml') ? 'toml' : file.endsWith('.rs') ? 'rust' : 'text'} padBottom={24} />
        ) : error ? (
          <Text style={t(14, 1.5, 400, C.secondary, { padding: 24 })}>{error}</Text>
        ) : null}
      </View>
    </View>
  );
}
