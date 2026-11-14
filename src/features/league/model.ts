// League rules and the standings calculation. Pure functions of the stored data and the clock, so a
// finished week always settles the same way.
import { addWeeks, weekNumber } from './week';

export type TierId = 'bronze' | 'rust' | 'steel' | 'titanium';
export type Tier = { id: TierId; name: string; color: string; tint: string; rival: [number, number] };

/** Bronze → Rust → Steel → Titanium. `rival` = range of a practice rival's XP for a full week. */
export const TIERS: Tier[] = [
  { id: 'bronze', name: 'Bronze', color: '#C98B5E', tint: 'rgba(201,139,94,0.16)', rival: [60, 520] },
  { id: 'rust', name: 'Rust', color: '#F74C00', tint: 'rgba(247,76,0,0.16)', rival: [180, 820] },
  { id: 'steel', name: 'Steel', color: '#97AABD', tint: 'rgba(151,170,189,0.16)', rival: [320, 1150] },
  { id: 'titanium', name: 'Titanium', color: '#C9C2E6', tint: 'rgba(201,194,230,0.16)', rival: [480, 1500] },
];

export const GROUP_SIZE = 10;
export const MOVE = 3;
/** How many of your own previous weeks race alongside you. */
export const PAST_WEEKS = 2;

export type EntryKind = 'you' | 'past' | 'rival';
export type Entry = { id: string; kind: EntryKind; name: string; sub: string; xp: number; rank: number };

export type Standings = {
  week: string;
  tier: number;
  entries: Entry[];
  you: Entry;
  /** Ranks 1..up move up, ranks down..size move down (0 = nobody). */
  upTo: number;
  downFrom: number;
  final: boolean;
};

export type WeekResult = { week: string; tier: number; rank: number; size: number; xp: number; move: 'up' | 'down' | 'stay'; next: number };

export type LeagueData = {
  /** XP earned per week (key = Monday). */
  weeks: Record<string, number>;
  /** Tier you were in for each week you were around for. */
  tiers: Record<string, number>;
  results: Record<string, WeekResult>;
};

// Deterministic randomness: the same week and tier always produce the same rivals.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How a rival's XP builds up over the week: xp(f) = final × f^k (f = fraction of the week gone). */
const PACES: { sub: string; k: number }[] = [
  { sub: 'Steady pace', k: 1 },
  { sub: 'Early starter', k: 0.55 },
  { sub: 'Late finisher', k: 2.2 },
  { sub: 'Weekend push', k: 3 },
  { sub: 'Little and often', k: 0.85 },
];

export type Rival = { id: string; sub: string; final: number; k: number };

export function rivalsFor(week: string, tier: number, count: number): Rival[] {
  const w = weekNumber(week);
  const rnd = mulberry32(w * 7919 + tier * 104729 + 17);
  const [lo, hi] = TIERS[tier].rival;
  return Array.from({ length: count }, (_, i) => {
    const pace = PACES[Math.floor(rnd() * PACES.length)];
    const final = Math.round((lo + (hi - lo) * Math.pow(rnd(), 1.2)) / 5) * 5;
    return { id: `rival-${w}-${tier}-${i}`, sub: pace.sub, final, k: pace.k };
  });
}

export const rivalXpAt = (r: Rival, f: number) => Math.round(r.final * Math.pow(Math.max(0, Math.min(1, f)), r.k));

/** The table for `week` at fraction `f` of the way through it (f = 1: final). */
export function standings(data: LeagueData, week: string, f: number, tier = data.tiers[week] ?? 0): Standings {
  const final = f >= 1;
  const mine = data.weeks[week] ?? 0;
  const past: Entry[] = [];
  for (let i = 1; i <= PAST_WEEKS; i++) {
    const k = addWeeks(week, -i);
    const xp = data.weeks[k] ?? 0;
    if (xp > 0) past.push({ id: `past-${k}`, kind: 'past', name: i === 1 ? 'You, last week' : `You, ${i} weeks ago`, sub: 'Your own pace to beat', xp, rank: 0 });
  }
  const rivals = rivalsFor(week, tier, GROUP_SIZE - 1 - past.length).map<Entry>((r) => ({
    id: r.id, kind: 'rival', name: 'Practice rival', sub: r.sub, xp: rivalXpAt(r, f), rank: 0,
  }));
  const you: Entry = { id: 'you', kind: 'you', name: 'You', sub: 'This week', xp: mine, rank: 0 };
  const order: Record<EntryKind, number> = { you: 0, past: 1, rival: 2 };
  const entries = [you, ...past, ...rivals].sort((a, b) => b.xp - a.xp || order[a.kind] - order[b.kind]);
  entries.forEach((e, i) => { e.rank = i + 1; });
  const size = entries.length;
  return {
    week, tier, entries, you, final,
    upTo: tier < TIERS.length - 1 ? MOVE : 0,
    downFrom: tier > 0 ? size - MOVE + 1 : 0,
  };
}

/** Settle a finished week: where you placed and which tier you move to. */
export function settle(data: LeagueData, week: string): WeekResult {
  const s = standings(data, week, 1);
  const rank = s.you.rank;
  const move: WeekResult['move'] = s.upTo && rank <= s.upTo ? 'up' : s.downFrom && rank >= s.downFrom ? 'down' : 'stay';
  const next = s.tier + (move === 'up' ? 1 : move === 'down' ? -1 : 0);
  return { week, tier: s.tier, rank, size: s.entries.length, xp: s.you.xp, move, next };
}
