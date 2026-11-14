// Inline AST (src/content/types.ts `Inline`) and the tiny Markdown used by Brown's quizzes, as RN <Text>.
import React from 'react';
import { Linking, Text, View, type TextStyle } from 'react-native';
import { parseBookLink, type Inline } from '../../content';
import { navActions } from '../../nav/store';
import { C } from '../../theme/tokens';
import { sans } from '../../theme/fonts';
import { inlineCode } from '../../ui/code';
import { CodeView } from '../../ui/code';

const NB = ' ';

/** Where a link goes: another Book page, an anchor on this page, an error code, or the web. */
export function followLink(href: string, onAnchor?: (anchor: string) => void) {
  if (href.startsWith('#')) { onAnchor?.(href.slice(1)); return; }
  const b = parseBookLink(href);
  if (b) { navActions().nav('reader', { arg: b.id, params: b.anchor ? { anchor: b.anchor } : undefined }); return; }
  const e = /^error:(E\d{4})$/.exec(href);
  if (e) { navActions().nav('terminal', { params: { run: `rustc --explain ${e[1]}` } }); return; }
  if (/^https?:/.test(href)) Linking.openURL(href).catch(() => navActions().showToast('Couldn’t open the link.'));
}

type Ctx = { size: number; em?: boolean; strong?: boolean; onAnchor?: (a: string) => void; codeColor?: string };

function renderInline(nodes: Inline[], ctx: Ctx, key = 'i'): React.ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}.${i}`;
    switch (n.k) {
      case 't': return n.v;
      // Padding 1 5 can't be set on nested Text on Android: pad with proportional no-break spaces instead.
      case 'code': return (
        <Text key={k} style={[inlineCode(ctx.size), ctx.codeColor ? { color: ctx.codeColor } : null]}>
          <Text style={sans(400)}>{NB}</Text>{n.v}<Text style={sans(400)}>{NB}</Text>
        </Text>
      );
      case 'em': return <Text key={k} style={ctx.strong ? sans(700) : sans(400, true)}>{renderInline(n.c, { ...ctx, em: true }, k)}</Text>;
      case 'strong': return <Text key={k} style={sans(700)}>{renderInline(n.c, { ...ctx, strong: true }, k)}</Text>;
      case 'link': return (
        <Text key={k} accessibilityRole="link" onPress={() => followLink(n.href, ctx.onAnchor)} style={{ color: C.rustLight }}>
          {renderInline(n.c, ctx, k)}
        </Text>
      );
    }
    return null;
  });
}

export function InlineText({ nodes, style, onAnchor, codeColor }: { nodes: Inline[]; style: TextStyle; onAnchor?: (a: string) => void; codeColor?: string }) {
  return <Text style={style}>{renderInline(nodes, { size: style.fontSize ?? 16, onAnchor, codeColor })}</Text>;
}

export const plainText = (nodes: Inline[]): string => nodes.map((n) => (n.k === 't' || n.k === 'code' ? n.v : plainText(n.c))).join('');

// ---------- Mini Markdown (quiz prompts, options, explanations) ----------

/** `code`, **strong**, *em*, [link](url) → Inline[]. */
export function mdInline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = /(`+)([\s\S]*?)\1|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(s))) {
    if (mm.index > last) out.push({ k: 't', v: s.slice(last, mm.index) });
    if (mm[1]) out.push({ k: 'code', v: mm[2].trim() });
    else if (mm[3]) out.push({ k: 'strong', c: mdInline(mm[3]) });
    else if (mm[4]) out.push({ k: 'em', c: mdInline(mm[4]) });
    else if (mm[5]) out.push({ k: 'link', href: mm[6], c: mdInline(mm[5]) });
    last = mm.index + mm[0].length;
  }
  if (last < s.length) out.push({ k: 't', v: s.slice(last) });
  return out;
}

type MdPart = { kind: 'p'; text: string } | { kind: 'code'; code: string; lang: string };

export function mdParts(src: string): MdPart[] {
  const parts: MdPart[] = [];
  const re = /```([\w-]*)[^\n]*\n([\s\S]*?)```/g;
  let last = 0;
  let mm: RegExpExecArray | null;
  const pushText = (s: string) => s.split(/\n\s*\n/).map((x) => x.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean).forEach((text) => parts.push({ kind: 'p', text }));
  while ((mm = re.exec(src))) {
    pushText(src.slice(last, mm.index));
    parts.push({ kind: 'code', lang: mm[1] || 'rust', code: mm[2].replace(/\n$/, '') });
    last = mm.index + mm[0].length;
  }
  pushText(src.slice(last));
  return parts;
}

/** Quiz well: #0F0E0E, radius 12, 12/19 mono. */
export function QuizCode({ code, lang = 'rust' }: { code: string; lang?: string }) {
  return (
    <View style={{ borderRadius: 12, backgroundColor: C.ground, overflow: 'hidden' }}>
      <CodeView code={code} lang={lang === 'ide' ? 'rust' : lang} fontSize={12} lineHeight={19} padding={12} style={{ paddingVertical: 2 }} />
    </View>
  );
}

/** Markdown block: paragraphs in `style`, fenced code as quiz wells. */
export function Md({ src, style, gap = 10 }: { src: string; style: TextStyle; gap?: number }) {
  const parts = mdParts(src);
  return (
    <View style={{ gap }}>
      {parts.map((p, i) => p.kind === 'p'
        ? <InlineText key={i} nodes={mdInline(p.text)} style={style} />
        : <QuizCode key={i} code={p.code} lang={p.lang} />)}
    </View>
  );
}

/** Inline-only markdown (options): one Text. */
export function MdLine({ src, style }: { src: string; style: TextStyle }) {
  const parts = mdParts(src);
  if (parts.length === 1 && parts[0].kind === 'p') return <InlineText nodes={mdInline(parts[0].text)} style={style} />;
  return <Md src={src} style={style} gap={6} />;
}

