// Design tokens from design/SPEC.md ("Design tokens"). Dark theme only (Paper was never designed).

export const C = {
  // Rust (brand)
  rust: '#F74C00',
  rustPressed: '#FF5A10',
  rustLight: '#FF8A55',
  rustHoverText: '#FFA070',
  rustTint: 'rgba(247,76,0,0.16)',
  rustTint08: 'rgba(247,76,0,0.08)',
  rustTint14: 'rgba(247,76,0,0.14)',
  rustTint20: 'rgba(247,76,0,0.2)',
  rustTint50: 'rgba(247,76,0,0.5)',
  onRust: '#1A0B04',
  flame: '#FF7A3D',
  onRustThumb: '#FFF1EA',

  // Surfaces, darkest to lightest
  ground: '#0F0E0E',
  well: '#121110',
  inputBar: '#141312',
  bar: '#161514',
  s1: '#171615',
  s2: '#1A1918',
  sheet: '#1C1B1A',
  s3: '#1E1C1B',
  s4: '#211F1E',
  raised: '#2A2826',
  raisedHover: '#34312E',
  dialog: '#2B2928',
  track: '#2C2A28',
  border: '#2E2C2A',
  outline: '#3A3735',
  handle: '#4A4643',
  snackbar: '#ECE8E3',
  snackbarText: '#1F1D1B',
  snackbarAction: '#A8360A',
  hairline: 'rgba(255,255,255,0.05)',
  divider: '#1C1A19',
  lineDark: '#24221F',
  scrim: 'rgba(10,9,9,0.62)',
  dialogScrim: 'rgba(0,0,0,0.55)',
  canvas: '#1B1A19',

  // Text
  text: '#ECE8E3',
  textNav: '#F1EDE8',
  reading: '#E2DDD7',
  strong2: '#D9D3CC',
  mutedHi: '#C9C2BA',
  mutedHi2: '#B3ACA5',
  navOff: '#A8A19A',
  secondary: '#A39C95',
  tertiary: '#8C867F',
  disabled: '#6E6862',
  iconOff: '#5C5752',

  // Status
  done: '#57D6C8',
  onDone: '#06201C',
  doneTint: 'rgba(87,214,200,0.12)',
  doneTint07: 'rgba(87,214,200,0.07)',
  doneTint22: 'rgba(87,214,200,0.22)',
  error: '#FF6B76',
  errorTint: 'rgba(255,107,118,0.12)',
  errorTint14: 'rgba(255,107,118,0.14)',
  errorText: '#FF8F98',
  checkpoint: '#F2C25B',
  onCheckpoint: '#10100F',
  checkpointTint: 'rgba(242,194,91,0.2)',
  running: '#FFA14A',

  inlineCodeText: '#F2CDB8',
  inlineCodeBg: '#2A2826',
} as const;

/** Rust syntax colors (dark). Light versions kept for when Paper gets designed. */
export const SYN = {
  dark: { kw: '#E8946A', ty: '#E6C072', fn: '#8DB6FF', str: '#A9D59B', fmt: '#E6C072', mac: '#6CD0D6', num: '#C9A3F2', life: '#F291B0', com: '#7D766F', attr: '#A0988F', pun: '#A9A29B', id: '#E9E5E0' },
  light: { kw: '#B03D10', ty: '#8A5B00', fn: '#2453C4', str: '#3B7A2B', fmt: '#8A5B00', mac: '#0B7480', num: '#7A3EB5', life: '#B02F6A', com: '#857E77', attr: '#6E6761', pun: '#5B554F', id: '#1F1D1B' },
} as const;
export type SynKey = keyof typeof SYN.dark;

/** Line marks in the editor. */
export const MARK = { err: '#FF6B76', warn: '#F2C25B', run: '#FFA14A' } as const;

/** Terminal (ANSI) colors. Markup `§x` = color, capital letter = bold. */
export const TC = { n: '#E4E0DB', d: '#8C867F', r: '#FF6B76', y: '#F2C25B', g: '#7FD99A', c: '#62D0E0', b: '#7FA9FF', w: '#F5F2EF', a: '#57D6C8', o: '#FF7A3D', m: '#D39CFF' } as const;
export const TCL = { n: '#2B2621', d: '#776D63', r: '#BE2536', y: '#8F6200', g: '#2D7A39', c: '#0B717C', b: '#2350B5', w: '#1A1714', a: '#0E7C70', o: '#A8360A', m: '#7A3EB5' } as const;

export const R = { bar: 2, badge: 6, chip: 10, key: 12, input: 14, listing: 16, group: 18, settings: 20, hero: 24, dialog: 28 } as const;

/** Sizes in dp at the 412 × 915 reference. */
export const SZ = {
  statusBar: 36,
  topBar: 56,
  topBarRoot: 64,
  navBar: 80,
  gestureBar: 22,
  iconButton: 48,
  row: 64,
  rowCompact: 56,
  primary: 52,
  primaryOnboarding: 56,
  ring: 36,
  ringInner: 30,
  key: 44,
} as const;

export const MOTION = {
  sheet: { duration: 460, bezier: [0.2, 0.9, 0.25, 1.04] as const },
  progress: { duration: 600, bezier: [0.2, 0.8, 0.2, 1] as const },
  navIndicator: 200,
  toast: 4000,
};
