// rustc error codes grouped into families. Common codes are mapped by hand; the rest fall back to
// keywords in rustc's own description, then "Other".
import { errors, type ErrorCodeDoc } from '../../content';

export type FamilyId = 'ownership' | 'types' | 'lifetimes' | 'traits' | 'names' | 'patterns' | 'other';

export const FAMILIES: { id: FamilyId; title: string; icon: string }[] = [
  { id: 'ownership', title: 'Ownership & borrowing', icon: 'key' },
  { id: 'types', title: 'Types', icon: 'data_object' },
  { id: 'lifetimes', title: 'Lifetimes', icon: 'hourglass_empty' },
  { id: 'traits', title: 'Traits', icon: 'extension' },
  { id: 'names', title: 'Names & paths', icon: 'alternate_email' },
  { id: 'patterns', title: 'Patterns', icon: 'call_split' },
  { id: 'other', title: 'Other', icon: 'more_horiz' },
];

const codes = (s: string) => s.trim().split(/\s+/).map((n) => `E${n}`);

const HAND: [FamilyId, string[]][] = [
  ['ownership', codes(`0161 0373 0381 0382 0384 0492 0499 0500 0501 0502 0503 0505 0506 0507 0508 0509 0510 0515 0521
    0524 0594 0596 0597 0626 0712 0713 0716 0745 0764 0793`)],
  ['lifetimes', codes(`0106 0195 0226 0227 0228 0261 0262 0309 0310 0311 0316 0476 0478 0491 0496 0581 0582 0621 0623
    0637 0657 0700 0726 0794 0803`)],
  ['patterns', codes(`0004 0005 0023 0025 0026 0027 0029 0030 0130 0158 0164 0170 0408 0409 0416 0527 0528 0529 0530
    0531 0532 0533 0561 0579 0586 0638 0642 0730 0769 0783`)],
  ['traits', codes(`0033 0034 0038 0046 0049 0050 0053 0059 0116 0117 0118 0119 0120 0183 0184 0185 0186 0191 0197
    0198 0199 0200 0201 0204 0206 0207 0210 0220 0221 0222 0223 0224 0225 0229 0271 0275 0276 0277 0321 0322 0323
    0324 0325 0326 0328 0366 0367 0371 0374 0375 0377 0378 0379 0380 0390 0404 0405 0407 0437 0438 0520 0525 0562
    0567 0568 0592 0593 0643 0665 0666 0714 0715 0719 0720 0746 0749 0750 0751 0782 0785 0790 0804`)],
  ['names', codes(`0252 0254 0255 0259 0260 0364 0365 0401 0403 0411 0415 0422 0423 0424 0425 0426 0428 0432 0433
    0434 0446 0449 0451 0463 0573 0574 0575 0576 0577 0583 0599 0601 0603 0616 0624 0659 0742 0761 0767 0800`)],
  ['types', codes(`0054 0055 0057 0061 0062 0063 0067 0069 0070 0071 0072 0107 0109 0121 0124 0178 0214 0282 0283
    0284 0308 0317 0368 0369 0391 0392 0393 0436 0559 0560 0600 0604 0605 0606 0607 0608 0609 0610 0614 0615 0617
    0618 0620 0631 0641 0689 0747 0797`)],
];
const HAND_MAP = new Map<string, FamilyId>();
for (const [f, list] of HAND) for (const c of list) if (!HAND_MAP.has(c)) HAND_MAP.set(c, f);

const RULES: [FamilyId, RegExp][] = [
  ['lifetimes', /lifetime|outlive/i],
  ['ownership', /borrow|moved|move out|mutable/i],
  ['patterns', /pattern|match/i],
  ['traits', /trait|impl\b|implementation/i],
  ['names', /import|module|crate|private|visibility|scope|undeclared|not found|name/i],
  ['types', /type|cast|generic|field|argument/i],
];

export function familyOf(code: string): FamilyId {
  const hand = HAND_MAP.get(code);
  if (hand) return hand;
  const title = errors[code]?.title ?? '';
  for (const [f, re] of RULES) if (re.test(title)) return f;
  return 'other';
}

/** Every error code rustc still emits, by family, in code order. */
export const BY_FAMILY: Record<FamilyId, ErrorCodeDoc[]> = (() => {
  const out = Object.fromEntries(FAMILIES.map((f) => [f.id, [] as ErrorCodeDoc[]])) as Record<FamilyId, ErrorCodeDoc[]>;
  Object.values(errors)
    .filter((e) => !e.removed)
    .sort((a, b) => a.code.localeCompare(b.code))
    .forEach((e) => out[familyOf(e.code)].push(e));
  return out;
})();
