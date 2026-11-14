// Hand-written copy from the prototype (design/project/oxide-lib.js, EX.intro1 and
// EX.move_semantics2–4). Used instead of the generated defaults because it reads better:
// subtitles, the HINT 1 nudge, the HINT 3 answer and, when rustc reports the expected error
// code, the plain-English Explain walkthrough.

export type CuratedFix = { label: string; code: string; note: string; apply?: (code: string) => string };
export type CuratedExplain = { lead: string; steps: { n: string; t: string; ok: boolean }[]; fixes: CuratedFix[]; read: string };
export type Curated = {
  subtitle: string;
  nudge: string;
  answer: string;
  explain: Record<string, CuratedExplain>;
};

const swap = (a: string, b: string) => (code: string) => (code.includes(a) ? code.replace(a, b) : code);

export const CURATED: Record<string, Curated> = {
  intro1: {
    subtitle: 'Welcome to Rustlings',
    nudge: 'This one already compiles. Tap Check to run it.',
    answer: 'Nothing to change here. Check it, then go on to `intro2`.',
    explain: {},
  },
  move_semantics2: {
    subtitle: 'Keep vec0 and vec1 usable at the same time',
    nudge: 'Line 23 hands `vec0` to `fill_vec` by value. Who owns the vector after that line?',
    answer: 'Clone at the call site: `let vec1 = fill_vec(vec0.clone());`',
    explain: {
      E0382: {
        lead: 'Passing `vec0` to `fill_vec` moves the vector into the function, which hands it back as `vec1`. Line 25 then reads `vec0`, which no longer owns anything.',
        steps: [
          { n: '21', t: '`vec0` owns the vector `[22, 44, 66]`.', ok: true },
          { n: '23', t: '`fill_vec(vec0)` moves it into `fill_vec`.', ok: true },
          { n: '25', t: '`assert_eq!(vec0, …)` borrows a moved value.', ok: false },
        ],
        fixes: [
          { label: 'Clone before the move', code: 'let vec1 = fill_vec(vec0.clone());', note: '`fill_vec` gets its own copy, so `vec0` stays valid. This is the official Rustlings solution.', apply: swap('let vec1 = fill_vec(vec0);', 'let vec1 = fill_vec(vec0.clone());') },
          {
            label: 'Borrow, then copy inside',
            code: 'fn fill_vec(vec: &[i32]) -> Vec<i32> {\n    let mut vec = vec.to_vec();',
            note: 'Call it as `fill_vec(&vec0)`. The function makes the copy instead of the caller.',
            apply: (c) => swap('let vec1 = fill_vec(vec0);', 'let vec1 = fill_vec(&vec0);')(
              swap('fn fill_vec(vec: Vec<i32>) -> Vec<i32> {\n    let mut vec = vec;', 'fn fill_vec(vec: &[i32]) -> Vec<i32> {\n    let mut vec = vec.to_vec();')(c),
            ),
          },
        ],
        read: '4.2',
      },
      E0308: {
        lead: 'Halfway there. `fill_vec` still takes an owned `Vec<i32>`, so `&vec0` doesn’t type-check. Clone `vec0` instead, or change the parameter to a slice and copy inside.',
        steps: [{ n: '1', t: '`fill_vec` expects an owned `Vec<i32>`.', ok: true }, { n: '23', t: '`&vec0` is a `&Vec<i32>`.', ok: false }],
        fixes: [{ label: 'Clone instead of borrowing', code: 'let vec1 = fill_vec(vec0.clone());', note: 'This is the official Rustlings solution.', apply: swap('fill_vec(&vec0)', 'fill_vec(vec0.clone())') }],
        read: '4.2',
      },
    },
  },
  move_semantics3: {
    subtitle: 'Fix it without adding a new line',
    nudge: '`fill_vec` owns `vec`, but owning a value isn’t the same as being allowed to change it. What does `push` need?',
    answer: 'Add `mut` before the parameter: `fn fill_vec(mut vec: Vec<i32>) -> Vec<i32>`.',
    explain: {
      E0596: {
        lead: '`fill_vec` owns `vec`, but the binding isn’t mutable, so `push` can’t change it. In Rust, owning a value and being allowed to change it are separate things.',
        steps: [{ n: '2', t: '`vec: Vec<i32>` is an owned, immutable binding.', ok: true }, { n: '3', t: '`vec.push(88)` needs to borrow `vec` mutably.', ok: false }],
        fixes: [{ label: 'Make the parameter mutable', code: 'fn fill_vec(mut vec: Vec<i32>) -> Vec<i32> {', note: '`mut` goes before the parameter name, so no new line is needed.', apply: swap('fn fill_vec(vec: Vec<i32>)', 'fn fill_vec(mut vec: Vec<i32>)') }],
        read: '4.2',
      },
    },
  },
  move_semantics4: {
    subtitle: 'Fix it only by reordering lines',
    nudge: 'A `&mut` borrow lasts until its last use. Where is `y` last used, compared with line 13?',
    answer: 'Swap lines 13 and 14: call `y.push(42);` before `let z = &mut x;`.',
    explain: {
      E0499: {
        lead: 'Two `&mut` borrows of `x` overlap. `y` is created on line 12 and still used on line 14, so `z` can’t also borrow `x` mutably on line 13.',
        steps: [{ n: '12', t: '`y` borrows `x` mutably.', ok: true }, { n: '13', t: '`z` borrows `x` mutably while `y` is still in use.', ok: false }, { n: '14', t: '`y.push(42)` is the last use of `y`.', ok: true }],
        fixes: [{ label: 'Finish with `y` before creating `z`', code: 'let y = &mut x;\ny.push(42);\nlet z = &mut x;\nz.push(13);', note: 'A borrow ends at its last use, so moving `y.push(42)` up ends `y` before `z` starts.', apply: swap('        let z = &mut x;\n        y.push(42);', '        y.push(42);\n        let z = &mut x;') }],
        read: '4.2',
      },
    },
  },
};
