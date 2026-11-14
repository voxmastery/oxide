// Lays out a Book page for the Reader: the Book's blocks plus the blocks Oxide inserts.
import { quizzes, type Block, type Quiz, type RustlingsExercise, type SectionId } from '../../content';

export type RItem =
  | { k: 'b'; b: Block; key: string }
  | { k: 'quiz'; quiz: Quiz; key: string }
  | { k: 'practice'; ex: RustlingsExercise; key: string }
  | { k: 'tip'; key: string }
  | { k: 'end'; key: string };

/**
 * Practice cards go at the end of the chunks the page's H2s make (before the next H2, or at
 * the end), spread evenly, so each card follows the part of the text it drills.
 */
export function buildItems(id: SectionId, blocks: Block[], o: { quizzes: boolean; practice: RustlingsExercise[] }): RItem[] {
  const ends: number[] = [];
  blocks.forEach((b, i) => { if (b.type === 'h2' && i > 0) ends.push(i); });
  ends.push(blocks.length);
  const at = new Map<number, RustlingsExercise[]>();
  const K = o.practice.length;
  o.practice.forEach((ex, k) => {
    const pos = ends[Math.max(0, Math.min(ends.length - 1, Math.ceil(((k + 1) * ends.length) / K) - 1))];
    at.set(pos, [...(at.get(pos) ?? []), ex]);
  });
  const items: RItem[] = [];
  let tipDone = id !== '1.2';
  blocks.forEach((b, i) => {
    (at.get(i) ?? []).forEach((ex) => items.push({ k: 'practice', ex, key: 'x' + ex.name }));
    if (b.type === 'quiz') {
      const q = quizzes[b.id];
      if (o.quizzes && q && q.questions.length) items.push({ k: 'quiz', quiz: q, key: 'q' + b.id });
    } else items.push({ k: 'b', b, key: 'b' + i });
    if (!tipDone && b.type === 'code' && b.lang === 'console') { items.push({ k: 'tip', key: 'tip' }); tipDone = true; }
  });
  (at.get(blocks.length) ?? []).forEach((ex) => items.push({ k: 'practice', ex, key: 'x' + ex.name }));
  items.push({ k: 'end', key: 'end' });
  return items;
}

/** "move_semantics1–5", "vecs1–2 and move_semantics1–5", "intro1". */
export function drillsText(exs: RustlingsExercise[]): string {
  const byTopic = new Map<string, RustlingsExercise[]>();
  exs.forEach((e) => byTopic.set(e.topic, [...(byTopic.get(e.topic) ?? []), e]));
  const parts = [...byTopic.values()].map((list) => {
    const a = list[0], z = list[list.length - 1];
    if (list.length === 1) return a.name;
    const pre = a.name.replace(/\d+$/, '');
    const consecutive = list.every((e, i) => e.index === a.index + i) && z.name.startsWith(pre);
    return consecutive ? `${a.name}–${z.index}` : list.map((e) => e.name).join(', ');
  });
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
