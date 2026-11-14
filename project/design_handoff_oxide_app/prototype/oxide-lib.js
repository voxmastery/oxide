/* Oxide shared logic: Rust lexer/highlighter, rustc-style output parser, exercise + book data. */
(function () {
  const SYN = {
    dark: { kw: '#E8946A', ty: '#E6C072', fn: '#8DB6FF', str: '#A9D59B', fmt: '#E6C072', mac: '#6CD0D6', num: '#C9A3F2', life: '#F291B0', com: '#7D766F', attr: '#A0988F', pun: '#A9A29B', id: '#E9E5E0' },
    light: { kw: '#B03D10', ty: '#8A5B00', fn: '#2453C4', str: '#3B7A2B', fmt: '#8A5B00', mac: '#0B7480', num: '#7A3EB5', life: '#B02F6A', com: '#857E77', attr: '#6E6761', pun: '#5B554F', id: '#1F1D1B' }
  };
  const MARK = { err: '#FF6B76', warn: '#F2C25B', run: '#FFA14A' };
  const MARK_L = { err: '#C42B3A', warn: '#8F6200', run: '#C25A00' };
  const KW = new Set('as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while'.split(' '));
  const PRIM = new Set('i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str'.split(' '));

  function lex(line) {
    const out = []; let i = 0;
    while (i < line.length) {
      const r = line.slice(i); let m = null, k = 'pun';
      if (r.startsWith('//')) { out.push({ t: r, k: 'com' }); break; }
      if ((m = r.match(/^\s+/))) k = 'id';
      else if ((m = r.match(/^#!?\[.*?\]/))) k = 'attr';
      else if ((m = r.match(/^b?"(?:\\.|[^"\\])*"?/))) k = 'str';
      else if ((m = r.match(/^'(?:\\.|[^\\'])'/))) k = 'str';
      else if ((m = r.match(/^'[A-Za-z_]\w*/))) k = 'life';
      else if ((m = r.match(/^\d[\d_]*(?:\.\d[\d_]*)?(?:[iuf](?:8|16|32|64|128|size))?/))) k = 'num';
      else if ((m = r.match(/^[A-Za-z_]\w*!(?!=)/))) k = 'mac';
      else if ((m = r.match(/^[A-Za-z_]\w*/))) {
        const w = m[0], after = line.slice(i + w.length);
        k = KW.has(w) ? 'kw' : (PRIM.has(w) || /^[A-Z]/.test(w)) ? 'ty' : /^(\(|::<)/.test(after) ? 'fn' : 'id';
      } else m = [r[0]];
      if (k === 'str' && m[0].length > 2) m[0].split(/(\{[^{}]*\})/).forEach((s, j) => s && out.push({ t: s, k: j % 2 ? 'fmt' : 'str' }));
      else out.push({ t: m[0], k });
      i += m[0].length;
    }
    return out;
  }

  function applyMarks(toks, marks) {
    const res = []; let pos = 1;
    for (const tk of toks) {
      const s = pos, e = pos + tk.t.length, cuts = new Set([s, e]);
      marks.forEach(m => { const a = m.col, b = m.col + m.len; if (a > s && a < e) cuts.add(a); if (b > s && b < e) cuts.add(b); });
      const pts = [...cuts].sort((a, b) => a - b);
      for (let j = 0; j < pts.length - 1; j++) {
        const a = pts[j], b = pts[j + 1], mk = marks.find(m => a >= m.col && a < m.col + m.len);
        res.push({ t: tk.t.slice(a - s, b - s), k: tk.k, m: mk ? mk.kind : null });
      }
      pos = e;
    }
    return res;
  }

  function tokStyle(t, P, light) {
    const M = light ? MARK_L : MARK;
    const s = { color: P[t.k] };
    if (t.k === 'com') s.fontStyle = 'italic';
    if (t.m) Object.assign(s, { textDecorationLine: 'underline', textDecorationStyle: 'wavy', textDecorationColor: M[t.m], textDecorationThickness: '1.5px', textUnderlineOffset: '4px', textDecorationSkipInk: 'none', background: t.m === 'err' ? (light ? 'rgba(196,43,58,0.10)' : 'rgba(255,107,118,0.12)') : (light ? 'rgba(194,90,0,0.10)' : 'rgba(255,161,74,0.12)'), borderRadius: '2px' });
    return s;
  }

  function highlight(code, o = {}) {
    const P = SYN[o.light ? 'light' : 'dark'], marks = o.marks || [];
    return String(code).split('\n').map((line, idx) => {
      const n = idx + 1, lm = marks.filter(m => m.line === n);
      let toks = lex(line); if (lm.length) toks = applyMarks(toks, lm);
      return { n, k: n, mark: lm.length ? lm[0].kind : '', toks: toks.map((t, j) => ({ k: j, t: t.t, s: tokStyle(t, P, o.light) })) };
    });
  }

  // rustc / cargo output markup: §X switches style. Uppercase = bold.
  const TCD = { n: '#E4E0DB', d: '#8C867F', r: '#FF6B76', y: '#F2C25B', g: '#7FD99A', c: '#62D0E0', b: '#7FA9FF', w: '#F5F2EF', a: '#57D6C8', o: '#FF7A3D', m: '#D39CFF' };
  const TCL = { n: '#2B2621', d: '#776D63', r: '#BE2536', y: '#8F6200', g: '#2D7A39', c: '#0B717C', b: '#2350B5', w: '#1A1714', a: '#0E7C70', o: '#A8360A', m: '#7A3EB5' };
  function ansi(line, light) {
    const TC = light ? TCL : TCD;
    const parts = String(line).split(/§(.)/), out = [];
    if (parts[0]) out.push({ k: 0, t: parts[0], s: { color: TC.n } });
    for (let i = 1; i < parts.length; i += 2) {
      const c = parts[i], t = parts[i + 1];
      if (t) out.push({ k: i, t, s: { color: TC[c.toLowerCase()] || TC.n, fontWeight: c !== c.toLowerCase() ? 700 : 400 } });
    }
    return out;
  }
  const out = (lines, light) => lines.map((l, i) => ({ k: i, segs: ansi(l, light) }));

  const CARGO_HEAD = '   §GCompiling§n exercises v0.1.0 (/data/oxide/exercises)';

  const EX = {
    ownership3: {
      id: 'ownership3', title: 'ownership3', subtitle: 'Borrow, don\u2019t move', topic: 'Ownership', diff: 2, diffLabel: 'Medium', xp: 40,
      file: 'src/bin/ownership3.rs', tests: 2,
      code: [
        '// ownership3.rs',
        '// `greet` takes ownership of `name`,',
        '// so main() can\u2019t use it afterwards.',
        '// Make it compile by borrowing.',
        '',
        'fn greet(name: String) -> String {',
        '    format!("Hello, {name}!")',
        '}',
        '',
        'fn main() {',
        '    let name = String::from("Ferris");',
        '    let msg = greet(name);',
        '    println!("{msg} ({})", name.len());',
        '}',
        '',
        '#[cfg(test)]',
        'mod tests {',
        '    use super::*;',
        '',
        '    #[test]',
        '    fn greets() {',
        '        let g = greet("Corro".into());',
        '        assert_eq!(g, "Hello, Corro!");',
        '    }',
        '',
        '    #[test]',
        '    fn empty_name() {',
        '        let g = greet("".into());',
        '        assert_eq!(g, "Hello, !");',
        '    }',
        '}'
      ].join('\n'),
      check(code) {
        const sigRef = /fn\s+greet\s*\(\s*name\s*:\s*&\s*(str|String)\s*\)/.test(code);
        const callRef = /greet\(\s*&\s*name\s*\)/.test(code);
        const callClone = /greet\(\s*name\.clone\(\)\s*\)/.test(code);
        if (sigRef && callRef) return 'pass';
        if (!sigRef && callClone) return 'pass';
        if (sigRef) return 'E0308';
        return 'E0382';
      },
      results: {
        E0382: {
          code: 'E0382', title: 'borrow of moved value: `name`', where: 'line 13',
          marks: [{ line: 13, col: 28, len: 4, kind: 'err' }],
          diag: { loc: '13:28', labels: [{ at: '11:9', line: 11, t: 'move occurs because `name` has type `String`, which does not implement the `Copy` trait' }, { at: '12:21', line: 12, t: 'value moved here' }, { at: '13:28', line: 13, t: 'value borrowed here after move', p: true }], help: 'consider cloning the value if the performance cost is acceptable', short: 'used after it was moved into `greet`' },
          out: [
            CARGO_HEAD,
            '§Rerror[E0382]§W: borrow of moved value: `name`',
            '§B  --> §nsrc/bin/ownership3.rs:13:28',
            '§B   |',
            '§B11 |§n     let name = String::from("Ferris");',
            '§B   |         ---- move occurs because `name` has type `String`, which does not implement the `Copy` trait',
            '§B12 |§n     let msg = greet(name);',
            '§B   |                     ---- value moved here',
            '§B13 |§n     println!("{msg} ({})", name.len());',
            '§B   |                            §R^^^^ value borrowed here after move',
            '§B   |',
            '§Gnote§W: consider changing this parameter type in function `greet` to borrow instead if owning the value isn\u2019t necessary',
            '§B  --> §nsrc/bin/ownership3.rs:6:16',
            '§B   |',
            '§B6  |§n fn greet(name: String) -> String {',
            '§B   |    -----       §G^^^^^^ this parameter takes ownership of the value',
            '§B   |    |',
            '§B   |    in this function',
            '§Chelp§W: consider cloning the value if the performance cost is acceptable',
            '§B   |',
            '§B12 |§n     let msg = greet(name§g.clone()§n);',
            '§B   |                         §g++++++++',
            '',
            'For more information about this error, try `rustc --explain E0382`.',
            '§Rerror§W: could not compile `exercises` (bin "ownership3" test) due to 1 previous error'
          ],
          explain: {
            lead: 'You moved `name` into `greet` on line 12. After a move the old variable is no longer valid, so `name.len()` on line 13 reads a value main() doesn\u2019t own any more.',
            steps: [
              { n: '11', t: '`name` owns the String "Ferris".', ok: true },
              { n: '12', t: '`greet(name)` moves ownership into `greet`.', ok: true },
              { n: '13', t: '`name.len()` borrows a moved value.', ok: false }
            ],
            fixes: [
              { label: 'Borrow (what this exercise wants)', code: 'fn greet(name: &str) -> String\nlet msg = greet(&name);', note: '`greet` only reads the string, so a `&str` is enough.' },
              { label: 'Clone', code: 'let msg = greet(name.clone());', note: 'Compiles, but copies the heap data to give `greet` its own String.' }
            ],
            read: '4.2 References and Borrowing'
          }
        },
        E0308: {
          code: 'E0308', title: 'mismatched types', where: 'line 12',
          marks: [{ line: 12, col: 21, len: 4, kind: 'err' }],
          diag: { loc: '12:21', labels: [{ at: '12:15', line: 12, t: 'arguments to this function are incorrect' }, { at: '12:21', line: 12, t: 'expected `&str`, found `String`', p: true }], help: 'consider borrowing here: `&name`', short: '`greet` wants a `&str` now' },
          out: [
            CARGO_HEAD,
            '§Rerror[E0308]§W: mismatched types',
            '§B  --> §nsrc/bin/ownership3.rs:12:21',
            '§B   |',
            '§B12 |§n     let msg = greet(name);',
            '§B   |               ----- §R^^^^ expected `&str`, found `String`',
            '§B   |               |',
            '§B   |               arguments to this function are incorrect',
            '§B   |',
            '§Gnote§W: function defined here',
            '§B  --> §nsrc/bin/ownership3.rs:6:4',
            '§B   |',
            '§B6  |§n fn greet(name: &str) -> String {',
            '§B   |    §G^^^^^ §B----------',
            '§Chelp§W: consider borrowing here',
            '§B   |',
            '§B12 |§n     let msg = greet(§g&§nname);',
            '§B   |                     §g+',
            '',
            'For more information about this error, try `rustc --explain E0308`.',
            '§Rerror§W: could not compile `exercises` (bin "ownership3" test) due to 1 previous error'
          ],
          explain: {
            lead: 'Halfway there. `greet` now takes a `&str`, but line 12 still passes the owned `String`. Pass a reference instead.',
            steps: [
              { n: '6', t: '`greet` expects `&str`.', ok: true },
              { n: '12', t: '`greet(name)` passes a `String`.', ok: false }
            ],
            fixes: [{ label: 'Borrow at the call site', code: 'let msg = greet(&name);', note: '`&String` coerces to `&str` automatically (deref coercion).' }],
            read: '4.2 References and Borrowing'
          }
        },
        pass: {
          out: [
            CARGO_HEAD,
            '    §GFinished§n `test` profile [unoptimized + debuginfo] target(s) in 0.58s',
            '     §GRunning§n unittests src/bin/ownership3.rs (target/debug/deps/ownership3-9c1f04d2b7e3a815)',
            '',
            'running 2 tests',
            'test tests::empty_name ... §gok',
            'test tests::greets ... §gok',
            '',
            'test result: §gok§n. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s'
          ]
        }
      },
      hints: [
        'Look at line 12. What happens to `name` when you pass it to `greet` by value?',
        '`greet` only reads the string. A function that only reads should borrow: take a `&str` instead of a `String`.',
        'Change the signature to `fn greet(name: &str) -> String` and call it with `greet(&name)`.'
      ],
      solution: [
        { n: '6', op: '-', t: 'fn greet(name: String) -> String {' },
        { n: '6', op: '+', t: 'fn greet(name: &str) -> String {' },
        { n: '12', op: '-', t: '    let msg = greet(name);' },
        { n: '12', op: '+', t: '    let msg = greet(&name);' }
      ],
      apply(code) { return code.replace(/fn greet\(name: String\)/, 'fn greet(name: &str)').replace(/greet\(name\)/, 'greet(&name)'); },
      next: { id: 'ownership4', title: 'ownership4', subtitle: 'Mutable references' }
    },
    ownership4: {
      id: 'ownership4', title: 'ownership4', subtitle: 'Mutable references', topic: 'Ownership', diff: 2, diffLabel: 'Medium', xp: 40,
      file: 'src/bin/ownership4.rs', tests: 0,
      code: [
        '// ownership4.rs',
        '// `shout` should change the String in',
        '// place. Fix the signature and the call.',
        '',
        'fn shout(s: &String) {',
        '    s.push_str("!");',
        '}',
        '',
        'fn main() {',
        '    let mut cry = String::from("borrowck");',
        '    shout(&cry);',
        '    println!("{cry}");',
        '}'
      ].join('\n'),
      check(code) {
        const sig = /fn\s+shout\s*\(\s*s\s*:\s*&\s*mut\s+String\s*\)/.test(code), call = /shout\(\s*&\s*mut\s+cry\s*\)/.test(code);
        return sig && call ? 'pass' : sig ? 'E0308' : 'E0596';
      },
      results: {
        E0596: {
          code: 'E0596', title: 'cannot borrow `*s` as mutable, as it is behind a `&` reference', where: 'line 6',
          marks: [{ line: 6, col: 5, len: 1, kind: 'err' }],
          diag: { loc: '6:5', labels: [{ at: '6:5', line: 6, t: '`s` is a `&` reference, so the data it refers to cannot be borrowed as mutable', p: true }], help: 'consider changing this to be a mutable reference: `&mut String`', short: 'can\u2019t mutate through a shared `&`' },
          out: [CARGO_HEAD, '§Rerror[E0596]§W: cannot borrow `*s` as mutable, as it is behind a `&` reference', '§B --> §nsrc/bin/ownership4.rs:6:5', '§B  |', '§B6 |§n     s.push_str("!");', '§B  |     §R^ `s` is a `&` reference, so the data it refers to cannot be borrowed as mutable', '§B  |', '§Chelp§W: consider changing this to be a mutable reference', '§B  |', '§B5 |§n fn shout(s: &§gmut §nString) {', '§B  |              §g+++', '', 'For more information about this error, try `rustc --explain E0596`.', '§Rerror§W: could not compile `exercises` (bin "ownership4") due to 1 previous error'],
          explain: { lead: '`shout` receives a shared reference (`&String`). Shared references are read-only, so `push_str`, which needs `&mut self`, can’t be called through it.', steps: [{ n: '5', t: '`s: &String` is a shared, read-only borrow.', ok: true }, { n: '6', t: '`push_str` needs a `&mut String`.', ok: false }], fixes: [{ label: 'Ask for a mutable reference', code: 'fn shout(s: &mut String)\nshout(&mut cry);', note: 'The parameter and the call site both need `mut`.' }], read: '4.2 References and Borrowing' }
        },
        E0308: {
          code: 'E0308', title: 'mismatched types', where: 'line 11',
          marks: [{ line: 11, col: 11, len: 4, kind: 'err' }],
          diag: { loc: '11:11', labels: [{ at: '11:5', line: 11, t: 'arguments to this function are incorrect' }, { at: '11:11', line: 11, t: 'types differ in mutability', p: true }], help: 'expected `&mut String`, found `&String`', short: 'pass `&mut cry`, not `&cry`' },
          out: [CARGO_HEAD, '§Rerror[E0308]§W: mismatched types', '§B  --> §nsrc/bin/ownership4.rs:11:11', '§B   |', '§B11 |§n     shout(&cry);', '§B   |     ----- §R^^^^ types differ in mutability', '§B   |     |', '§B   |     arguments to this function are incorrect', '§B   |', '§B   = §Wnote§n: expected mutable reference `&mut String`', '                      found reference `&String`', '', 'For more information about this error, try `rustc --explain E0308`.', '§Rerror§W: could not compile `exercises` (bin "ownership4") due to 1 previous error'],
          explain: { lead: 'The signature is right now. The call still passes `&cry`, a shared reference. Pass `&mut cry`.', steps: [{ n: '11', t: '`&cry` is a `&String`, not a `&mut String`.', ok: false }], fixes: [{ label: 'Borrow mutably at the call site', code: 'shout(&mut cry);', note: '`cry` is declared with `let mut`, so this is allowed.' }], read: '4.2 References and Borrowing' }
        },
        pass: { out: [CARGO_HEAD, '    §GFinished§n `dev` profile [unoptimized + debuginfo] target(s) in 0.36s', '     §GRunning§n `target/debug/ownership4`', 'borrowck!'] }
      },
      hints: ['`push_str` changes the String. Which kind of reference lets a function change borrowed data?', 'A shared `&String` is read-only. The signature needs `&mut String`.', 'Use `fn shout(s: &mut String)` and call it with `shout(&mut cry)`.'],
      solution: [{ n: '5', op: '-', t: 'fn shout(s: &String) {' }, { n: '5', op: '+', t: 'fn shout(s: &mut String) {' }, { n: '11', op: '-', t: '    shout(&cry);' }, { n: '11', op: '+', t: '    shout(&mut cry);' }],
      apply(code) { return code.replace('fn shout(s: &String)', 'fn shout(s: &mut String)').replace('shout(&cry)', 'shout(&mut cry)'); },
      next: { id: 'iterators2', title: 'iterators2', subtitle: 'Max without panicking' }
    },
    iterators2: {
      id: 'iterators2', title: 'iterators2', subtitle: 'Max without panicking', topic: 'Iterators', diff: 2, diffLabel: 'Medium', xp: 40,
      file: 'src/bin/iterators2.rs', tests: 0,
      code: [
        '// iterators2.rs',
        '// Return the highest score, or None',
        '// for an empty slice. There\u2019s an',
        '// iterator method for exactly this.',
        '',
        'fn best(scores: &[u32]) -> Option<u32> {',
        '    let mut sorted = scores.to_vec();',
        '    sorted.sort();',
        '    Some(sorted[sorted.len() - 1])',
        '}',
        '',
        'fn main() {',
        '    println!("{:?}", best(&[72, 88, 95]));',
        '    println!("{:?}", best(&[]));',
        '}'
      ].join('\n'),
      check(code) { return /\.max\(\)/.test(code) && !/len\(\)\s*-\s*1/.test(code) ? 'pass' : 'panic'; },
      results: {
        panic: {
          code: 'panic', title: 'attempt to subtract with overflow', where: '9:17', runtime: true,
          marks: [{ line: 9, col: 17, len: 16, kind: 'run' }],
          diag: { loc: '9:17', labels: [{ at: '14:22', line: 14, t: 'called with an empty slice' }, { at: '9:17', line: 9, t: 'attempt to subtract with overflow', p: true }], help: 'run with `RUST_BACKTRACE=1` to see the call stack', short: '`0 - 1` overflowed a `usize`' },
          out: [
            CARGO_HEAD,
            '    §GFinished§n `dev` profile [unoptimized + debuginfo] target(s) in 0.37s',
            '     §GRunning§n `target/debug/iterators2`',
            'Some(95)',
            '',
            '§Wthread \'main\' panicked at src/bin/iterators2.rs:9:17:',
            '§Wattempt to subtract with overflow',
            '§dnote: run with `RUST_BACKTRACE=1` environment variable to display a backtrace',
            '§Rerror§W: process didn\u2019t exit successfully: `target/debug/iterators2` (exit status: 101)'
          ],
          explain: {
            lead: 'It compiled, then crashed at run time. With an empty slice `sorted.len()` is 0, and `0 - 1` overflows a `usize`. Debug builds check arithmetic and panic instead of wrapping.',
            steps: [
              { n: '13', t: '`best(&[72, 88, 95])` works and prints Some(95).', ok: true },
              { n: '14', t: '`best(&[])` reaches line 9 with len 0.', ok: true },
              { n: '9', t: '`0usize - 1` panics: attempt to subtract with overflow.', ok: false }
            ],
            fixes: [{ label: 'Let the iterator handle empty input', code: 'scores.iter().copied().max()', note: '`max()` already returns `Option`: None for an empty iterator.' }],
            read: '13.2 Processing a Series of Items with Iterators'
          }
        },
        pass: {
          out: [
            CARGO_HEAD,
            '    §GFinished§n `dev` profile [unoptimized + debuginfo] target(s) in 0.34s',
            '     §GRunning§n `target/debug/iterators2`',
            'Some(95)',
            'None'
          ]
        }
      },
      hints: [
        'Run it in your head with an empty slice. What is `sorted.len() - 1` when len is 0?',
        'You don\u2019t need to sort at all. Iterators have a method that returns the largest item as an `Option`.',
        'Replace the body with `scores.iter().copied().max()`.'
      ],
      solution: [
        { n: '7', op: '-', t: '    let mut sorted = scores.to_vec();' },
        { n: '8', op: '-', t: '    sorted.sort();' },
        { n: '9', op: '-', t: '    Some(sorted[sorted.len() - 1])' },
        { n: '7', op: '+', t: '    scores.iter().copied().max()' }
      ],
      apply(code) { return code.replace(/ {4}let mut sorted = scores\.to_vec\(\);\n {4}sorted\.sort\(\);\n {4}Some\(sorted\[sorted\.len\(\) - 1\]\)/, '    scores.iter().copied().max()'); },
      next: { id: 'iterators3', title: 'iterators3', subtitle: 'Collect into a Result' }
    }
  };

  const BOOK_42 = {
    chapter: '4.2', title: 'References and Borrowing', mins: 14, left: 6,
    blocks: [
      { type: 'p', text: 'When a function takes a `String` by value, the caller loses it. Most functions only need to read the data, so Rust lets you pass a reference instead: a pointer to a value that is guaranteed to stay valid while you use it.' },
      { type: 'code', code: 'fn main() {\n    let title = String::from("oxide");\n    let n = char_count(&title);\n    println!("\'{title}\' has {n} chars");\n}\n\nfn char_count(s: &String) -> usize {\n    s.chars().count()\n}', out: ['   §GCompiling§n playground v0.1.0', '    §GFinished§n `dev` profile [unoptimized + debuginfo] target(s) in 0.29s', '     §GRunning§n `target/debug/playground`', '\'oxide\' has 5 chars'] },
      { type: 'p', text: '`&title` creates a reference to `title` without moving it. Inside `char_count`, `s` points at the caller\u2019s string. When `s` goes out of scope nothing is dropped, because `s` never owned anything. ', hl: 'Creating a reference is called borrowing.', note: 'Borrow = temporary access, owner keeps the value. Compare with E0382 in ownership3.' },
      { type: 'h', text: 'Mutable references' },
      { type: 'p', text: 'References are immutable by default. To change borrowed data, both the variable and the reference need `mut`:' },
      { type: 'code', code: 'fn main() {\n    let mut log = String::from("build");\n    append(&mut log);\n    println!("{log}");\n}\n\nfn append(s: &mut String) {\n    s.push_str(" ok");\n}', out: ['   §GCompiling§n playground v0.1.0', '    §GFinished§n `dev` profile [unoptimized + debuginfo] target(s) in 0.31s', '     §GRunning§n `target/debug/playground`', 'build ok'] },
      { type: 'p', text: 'The trade-off: while a mutable reference to a value exists, no other reference to it can exist. This code tries to hold two at once:' },
      { type: 'code', fails: true, code: 'let mut s = String::from("hi");\nlet a = &mut s;\nlet b = &mut s;\nprintln!("{a}, {b}");', out: ['   §GCompiling§n playground v0.1.0', '§Rerror[E0499]§W: cannot borrow `s` as mutable more than once at a time', '§B --> §nsrc/main.rs:4:13', '§B  |', '§B3 |§n     let a = &mut s;', '§B  |             ------ first mutable borrow occurs here', '§B4 |§n     let b = &mut s;', '§B  |             §R^^^^^^ second mutable borrow occurs here', '§B5 |§n     println!("{a}, {b}");', '§B  |               --- first borrow later used here'] },
      { type: 'rule', text: 'At any moment you can have either one `&mut` or any number of `&` to a value, and a reference can never outlive the value it points to.' },
      { type: 'quiz' }
    ]
  };

  const CODE_DARK = { fontFamily: "'JetBrains Mono',monospace", fontSize: '0.86em', background: '#2A2826', color: '#F2CDB8', padding: '1px 5px', borderRadius: '5px', whiteSpace: 'nowrap' };
  const CODE_LIGHT = { fontFamily: "'JetBrains Mono',monospace", fontSize: '0.86em', background: '#EEE9E3', color: '#8A2F0C', padding: '1px 5px', borderRadius: '5px', whiteSpace: 'nowrap' };
  function rich(text, light) {
    return String(text).split('`').map((t, i) => ({ k: i, t, s: i % 2 ? (light ? CODE_LIGHT : CODE_DARK) : null })).filter(x => x.t);
  }
  const RUN_OK = {
    ownership3: [CARGO_HEAD, '    §GFinished§n `dev` profile [unoptimized + debuginfo] target(s) in 0.41s', '     §GRunning§n `target/debug/ownership3`', 'Hello, Ferris! (6)']
  };

  const HINT_LINES = { ownership3: [12, 6, 6], ownership4: [6, 5, 11], iterators2: [9, 7, 7] };
  const PANIC_TRACE = [
    '§Wthread \'main\' panicked at src/bin/iterators2.rs:9:17:',
    '§Wattempt to subtract with overflow',
    'stack backtrace:',
    '   0: §Wrust_begin_unwind',
    '   1: §Wcore::panicking::panic_fmt',
    '   2: §Wcore::panicking::panic_const::panic_const_sub_overflow',
    '   3: §Witerators2::best',
    '§b             at ./src/bin/iterators2.rs:9:17',
    '   4: §Witerators2::main',
    '§b             at ./src/bin/iterators2.rs:14:22',
    '§dnote: Some details are omitted, run with `RUST_BACKTRACE=full` for a verbose backtrace.'
  ];

  const WS = {
    init(props) {
      const v = props.variant || '';
      return { v, exId: props.arg || (v === 'panic' ? 'iterators2' : 'ownership3'), code: '', status: 'idle', res: null, mode: 'check', attempts: 0, hints: 0, tour: v === 'tour' ? 0 : -1, kbd: v === 'typing', kbdAlways: v === 'typing', success: false, sIn: false, xp: 0, lines: [], dirty: false, caret: null, snack: null };
    },
    boot(c, extra) {
      const ex = EX[c.state.exId], v = c.state.v; if (!ex) return;
      const s = { code: ex.code };
      if (v === 'typing') Object.assign(s, { code: ex.code.replace('fn greet(name: String)', 'fn greet(name: &str)').replace('greet(name)', 'greet(&name)'), attempts: 1, caret: { line: 12, col: 22 } });
      if (v === 'compiling') Object.assign(s, { status: 'compiling', lines: [CARGO_HEAD], attempts: 1 });
      if (['error', 'explain', 'hints', 'panic', 'passing', 'success'].includes(v)) {
        if (v === 'passing' || v === 'success') s.code = ex.apply(ex.code);
        const mode = v === 'panic' ? 'run' : 'check';
        Object.assign(s, WS.result(ex, s.code, mode), { mode });
        s.attempts = v === 'hints' ? 2 : (v === 'passing' || v === 'success') ? 2 : 1;
        s.hints = v === 'hints' ? 2 : (v === 'passing' || v === 'success') ? 1 : 0;
        if (v === 'success') Object.assign(s, { success: true, sIn: true, xp: ex.xp });
      }
      c.setState(Object.assign(s, extra ? extra(v, s) : {}));
    },
    cmd(ex, mode) { return ex ? (mode === 'run' || !ex.tests ? 'cargo run --bin ' : 'cargo test --bin ') + ex.id : ''; },
    result(ex, code, mode) {
      const key = ex.check(code), r = ex.results[key];
      let lines = r.out;
      if (key === 'pass' && mode === 'run' && RUN_OK[ex.id]) lines = RUN_OK[ex.id];
      if (mode === 'run') lines = lines.map(l => l.replace(' test)', ')'));
      return { status: key === 'pass' ? 'pass' : 'error', res: key, lines, dirty: false };
    },
    check(c, mode, hooks) {
      hooks = hooks || {};
      const ex = EX[c.state.exId];
      if (c.state.status === 'compiling' || !ex) return;
      clearTimeout(c._t1); clearTimeout(c._t2);
      c.setState(Object.assign({ status: 'compiling', mode, res: null, lines: [CARGO_HEAD], success: false, tour: -1 }, hooks.start ? hooks.start() : {}));
      c._t1 = setTimeout(() => {
        const r = WS.result(ex, c.state.code, mode), failed = r.status !== 'pass';
        c.setState(s => Object.assign(r, { attempts: s.attempts + (failed ? 1 : 0) }, hooks.done ? hooks.done(r, s) : {}));
        if (!failed && (mode === 'check' || !ex.tests)) c._t2 = setTimeout(() => WS.celebrate(c), hooks.delay || 850);
      }, 1400);
    },
    celebrate(c) {
      const ex = EX[c.state.exId];
      c.setState({ success: true, sIn: false, xp: 0 });
      c._t3 = setTimeout(() => c.setState({ sIn: true }), 40);
      clearInterval(c._xpI); let n = 0;
      c._xpI = setInterval(() => { n += 2; c.setState({ xp: Math.min(n, ex.xp) }); if (n >= ex.xp) clearInterval(c._xpI); }, 30);
    },
    cleanup(c) { [c._t1, c._t2, c._t3, c._t4].forEach(clearTimeout); clearInterval(c._xpI); if (c._h) window.removeEventListener('oxlib-ready', c._h); },
    reset(c) {
      const ex = EX[c.state.exId], prev = c.state.code; clearTimeout(c._t4);
      c.setState({ code: ex.code, dirty: false, status: 'idle', res: null, lines: [], caret: null, snack: { text: 'Reset to the original file', undo: prev } });
      c._t4 = setTimeout(() => c.setState({ snack: null }), 4000);
    },
    toast(c, text) { clearTimeout(c._t4); c.setState({ snack: { text } }); c._t4 = setTimeout(() => c.setState({ snack: null }), 3200); },
    next(c, back) {
      const ex = EX[c.state.exId], nx = ex.next && EX[ex.next.id];
      if (!nx) return back && back();
      c.setState({ exId: nx.id, code: nx.code, status: 'idle', res: null, lines: [], attempts: 0, hints: 0, success: false, sIn: false, dirty: false, caret: null, mode: 'check' });
    },
    explain(ex, res, light) {
      const r = res && ex.results[res]; if (!r || !r.explain) return null; const e = r.explain;
      return {
        lead: rich(e.lead, light), read: e.read, rustc: res !== 'panic' ? r.code : '', code: r.code, title: r.title,
        steps: e.steps.map((s, i) => ({ k: i, n: s.n, i: i + 1, ok: s.ok, segs: rich(s.t, light) })),
        fixes: e.fixes.map((f, i) => ({ k: i, label: f.label, lines: highlight(f.code, { light }), note: rich(f.note, light) }))
      };
    },
    success(c) {
      const S = c.state, ex = EX[S.exId], base = 1840, goal = 2400, xp = S.xp;
      return { on: S.success, sIn: S.sIn, xp, kicker: ex.tests ? 'ALL ' + ex.tests + ' TESTS PASSED' : 'RAN CLEAN', meta: S.attempts + (S.attempts === 1 ? ' attempt' : ' attempts') + ' · ' + S.hints + (S.hints === 1 ? ' hint' : ' hints') + ' · 4m 12s', total: (base + xp).toLocaleString('en-US') + ' / 2,400', pct: ((base + xp) / goal * 100).toFixed(1), toNext: (goal - base - xp) + ' XP to Lv 8', next: (ex.next && ex.next.title) || 'exercises' };
    },
    tests(code) {
      const ls = code.split('\n'), outT = [];
      ls.forEach((l, i) => { if (/#\[test\]/.test(l)) { const m = (ls[i + 1] || '').match(/fn\s+(\w+)/); if (m) outT.push({ line: i + 1, name: m[1] }); } });
      return outT;
    }
  };

  const FX = {
    spin(R, color, size, w) { size = size || 20; w = w || 2.5; return R.createElement('span', { style: { width: size + 'px', height: size + 'px', borderRadius: '50%', border: w + 'px solid ' + color, borderRightColor: 'transparent', display: 'block', boxSizing: 'border-box', animation: 'ox-spin 0.75s linear infinite', flex: 'none' } }); },
    indet(R, color, inset) { return R.createElement('div', { style: { position: 'absolute', top: 0, left: inset || 0, right: inset || 0, height: '2px', overflow: 'hidden', zIndex: 5 } }, R.createElement('div', { style: { width: '40%', height: '100%', background: color, animation: 'ox-indet 1.1s cubic-bezier(.4,0,.2,1) infinite' } })); },
    blink(R, color, w, h) { return R.createElement('span', { style: { display: 'inline-block', width: w + 'px', height: h + 'px', background: color, verticalAlign: 'middle', animation: 'ox-blink 1.05s steps(1) infinite' } }); },
    burst(R, cols, ringColor, inset) {
      const kids = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + 0.2, d = 56 + (i % 3) * 14;
        kids.push(R.createElement('span', { key: i, style: { position: 'absolute', left: '50%', top: '50%', width: i % 2 ? '6px' : '9px', height: i % 2 ? '6px' : '3px', marginLeft: '-4px', marginTop: '-2px', borderRadius: i % 3 === 0 ? '50%' : '1px', background: cols[i % cols.length], '--dx': (Math.cos(a) * d).toFixed(1) + 'px', '--dy': (Math.sin(a) * d).toFixed(1) + 'px', animation: 'ox-burst 950ms cubic-bezier(.15,.7,.3,1) 260ms both' } }));
      }
      kids.push(R.createElement('span', { key: 'ring', style: { position: 'absolute', left: inset || '15px', top: inset || '15px', right: inset || '15px', bottom: inset || '15px', borderRadius: '50%', border: '2px solid ' + ringColor, animation: 'ox-ring 900ms ease-out 200ms both' } }));
      return R.createElement('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' } }, kids);
    }
  };

  // ---- The Rust Book (rust-lang/book, MIT or Apache-2.0) + Rustlings (rust-lang/rustlings, MIT) ----
  const RL_HEAD = '   §GCompiling§n exercises v0.1.0 (/data/oxide/rustlings)';
  const MS = 'exercises/06_move_semantics/';
  const cl = (w, n, t) => '§B' + String(n).padEnd(w) + ' |' + (t === undefined ? '' : '§n ' + t);
  const ul = (w, col, len, ch, label, c) => '§B' + ' '.repeat(w) + ' |' + ' '.repeat(col) + (c ? '§' + c : '') + ch.repeat(len) + (label ? ' ' + label : '');
  const arrow = (w, loc) => '§B' + ' '.repeat(w) + '--> §n' + loc;
  const bar = (w) => '§B' + ' '.repeat(w) + ' |';
  const rlFail = (bin) => '§Rerror§W: could not compile `exercises` (bin "' + bin + '" test) due to 1 previous error';
  const rlPass = (bin, hash, t) => [RL_HEAD, '    §GFinished§n `test` profile [unoptimized + debuginfo] target(s) in ' + t, '     §GRunning§n unittests ' + MS + bin + '.rs (target/debug/deps/' + bin + '-' + hash + ')', '', 'running 1 test', 'test tests::' + bin + ' ... §gok', '', 'test result: §gok§n. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s'];
  const rlRun = (bin) => [RL_HEAD, '    §GFinished§n `dev` profile [unoptimized + debuginfo] target(s) in 0.31s', '     §GRunning§n `target/debug/' + bin + '`'];
  const RL_KINDS = ['NUDGE', 'FROM RUSTLINGS', 'ANSWER'];
  const READ_42 = '4.2 References and Borrowing';

  EX.move_semantics2 = {
    id: 'move_semantics2', title: 'move_semantics2', subtitle: 'Keep vec0 and vec1 usable at the same time', topic: 'move_semantics · 2 of 5', diff: 1, diffLabel: 'Easy', xp: 40,
    file: MS + 'move_semantics2.rs', tests: 1, head: RL_HEAD, runClean: true, hintKinds: RL_KINDS,
    rl: { pos: 27, idx: 2, of: 5, topic: 'move_semantics' },
    code: [
      'fn fill_vec(vec: Vec<i32>) -> Vec<i32> {',
      '    let mut vec = vec;',
      '',
      '    vec.push(88);',
      '',
      '    vec',
      '}',
      '',
      'fn main() {',
      '    // You can optionally experiment here.',
      '}',
      '',
      '#[cfg(test)]',
      'mod tests {',
      '    use super::*;',
      '',
      '    // TODO: Make both vectors `vec0` and `vec1` accessible at the same time to',
      '    // fix the compiler error in the test.',
      '    #[test]',
      '    fn move_semantics2() {',
      '        let vec0 = vec![22, 44, 66];',
      '',
      '        let vec1 = fill_vec(vec0);',
      '',
      '        assert_eq!(vec0, [22, 44, 66]);',
      '        assert_eq!(vec1, [22, 44, 66, 88]);',
      '    }',
      '}'
    ].join('\n'),
    check(code) {
      if (/fill_vec\(\s*vec0\.clone\(\)\s*\)/.test(code)) return 'pass';
      const a = code.indexOf('assert_eq!(vec0'), m = code.search(/fill_vec\(\s*vec0\s*\)/);
      if (a >= 0 && m >= 0 && a < m) return 'pass';
      const sigRef = /fn\s+fill_vec\s*\(\s*vec\s*:\s*&\s*(Vec<i32>|\[i32\])\s*\)/.test(code), callRef = /fill_vec\(\s*&\s*vec0\s*\)/.test(code);
      if (sigRef && callRef && /vec\.(clone|to_vec|to_owned)\(\)/.test(code)) return 'pass';
      if (callRef && !sigRef) return 'E0308';
      return 'E0382';
    },
    results: {
      E0382: {
        code: 'E0382', title: 'borrow of moved value: `vec0`', where: 'line 25',
        marks: [{ line: 25, col: 20, len: 4, kind: 'err' }],
        diag: { loc: '25:9', labels: [{ at: '21:13', line: 21, t: 'move occurs because `vec0` has type `Vec<i32>`, which does not implement the `Copy` trait' }, { at: '23:29', line: 23, t: 'value moved here' }, { at: '25:9', line: 25, t: 'value borrowed here after move', p: true }], help: 'consider cloning the value if the performance cost is acceptable', short: '`vec0` was moved into `fill_vec`' },
        out: [
          RL_HEAD,
          '§Rerror[E0382]§W: borrow of moved value: `vec0`',
          arrow(2, MS + 'move_semantics2.rs:25:9'),
          bar(2),
          cl(2, 21, '        let vec0 = vec![22, 44, 66];'),
          ul(2, 13, 4, '-', 'move occurs because `vec0` has type `Vec<i32>`, which does not implement the `Copy` trait'),
          cl(2, 22),
          cl(2, 23, '        let vec1 = fill_vec(vec0);'),
          ul(2, 29, 4, '-', 'value moved here'),
          cl(2, 24),
          cl(2, 25, '        assert_eq!(vec0, [22, 44, 66]);'),
          ul(2, 9, 30, '^', 'value borrowed here after move', 'R'),
          bar(2),
          '§Gnote§W: consider changing this parameter type in function `fill_vec` to borrow instead if owning the value isn\u2019t necessary',
          arrow(2, MS + 'move_semantics2.rs:1:18'),
          bar(2),
          cl(2, 1, 'fn fill_vec(vec: Vec<i32>) -> Vec<i32> {'),
          bar(2) + '    --------      §G^^^^^^^^ this parameter takes ownership of the value',
          bar(2) + '    |',
          bar(2) + '    in this function',
          '§B   = §Wnote§n: this error originates in the macro `assert_eq` (in Nightly builds, run with -Z macro-backtrace for more info)',
          '§Chelp§W: consider cloning the value if the performance cost is acceptable',
          bar(2),
          cl(2, 23, '        let vec1 = fill_vec(vec0§g.clone()§n);'),
          ul(2, 33, 8, '+', '', 'g'),
          '',
          'For more information about this error, try `rustc --explain E0382`.',
          rlFail('move_semantics2')
        ],
        explain: {
          lead: 'Passing `vec0` to `fill_vec` moves the vector into the function, which hands it back as `vec1`. Line 25 then reads `vec0`, which no longer owns anything.',
          steps: [
            { n: '21', t: '`vec0` owns the vector `[22, 44, 66]`.', ok: true },
            { n: '23', t: '`fill_vec(vec0)` moves it into `fill_vec`.', ok: true },
            { n: '25', t: '`assert_eq!(vec0, …)` borrows a moved value.', ok: false }
          ],
          fixes: [
            { label: 'Clone before the move', code: 'let vec1 = fill_vec(vec0.clone());', note: '`fill_vec` gets its own copy, so `vec0` stays valid. This is the official Rustlings solution.' },
            { label: 'Borrow, then copy inside', code: 'fn fill_vec(vec: &[i32]) -> Vec<i32> {\n    let mut vec = vec.to_vec();', note: 'Call it as `fill_vec(&vec0)`. The function makes the copy instead of the caller.' }
          ],
          read: READ_42
        }
      },
      E0308: {
        code: 'E0308', title: 'mismatched types', where: 'line 23',
        marks: [{ line: 23, col: 29, len: 5, kind: 'err' }],
        diag: { loc: '23:29', labels: [{ at: '23:20', line: 23, t: 'arguments to this function are incorrect' }, { at: '23:29', line: 23, t: 'expected `Vec<i32>`, found `&Vec<i32>`', p: true }], help: 'consider removing the borrow', short: '`fill_vec` wants an owned `Vec<i32>`' },
        out: [
          RL_HEAD,
          '§Rerror[E0308]§W: mismatched types',
          arrow(2, MS + 'move_semantics2.rs:23:29'),
          bar(2),
          cl(2, 23, '        let vec1 = fill_vec(&vec0);'),
          bar(2) + ' '.repeat(20) + '-------- §R^^^^^ expected `Vec<i32>`, found `&Vec<i32>`',
          bar(2) + ' '.repeat(20) + '|',
          bar(2) + ' '.repeat(20) + 'arguments to this function are incorrect',
          bar(2),
          '§B   = §Wnote§n: expected struct `Vec<_>`',
          '           found reference `&Vec<_>`',
          '§Gnote§W: function defined here',
          arrow(2, MS + 'move_semantics2.rs:1:4'),
          bar(2),
          cl(2, 1, 'fn fill_vec(vec: Vec<i32>) -> Vec<i32> {'),
          bar(2) + '    §G^^^^^^^^ §B-------------',
          '§Chelp§W: consider removing the borrow',
          bar(2),
          '§B23 §R-§n         let vec1 = fill_vec(§R&§nvec0);',
          '§B23 §g+§n         let vec1 = fill_vec(vec0);',
          bar(2),
          '',
          'For more information about this error, try `rustc --explain E0308`.',
          rlFail('move_semantics2')
        ],
        explain: {
          lead: 'Halfway there. `fill_vec` still takes an owned `Vec<i32>`, so `&vec0` doesn\u2019t type-check. Clone `vec0` instead, or change the parameter to a slice and copy inside.',
          steps: [{ n: '1', t: '`fill_vec` expects an owned `Vec<i32>`.', ok: true }, { n: '23', t: '`&vec0` is a `&Vec<i32>`.', ok: false }],
          fixes: [{ label: 'Clone instead of borrowing', code: 'let vec1 = fill_vec(vec0.clone());', note: 'This is the official Rustlings solution.' }],
          read: READ_42
        }
      },
      pass: { out: rlPass('move_semantics2', '4f0c9e1ab2d37c58', '0.49s') }
    },
    hints: [
      'Line 23 hands `vec0` to `fill_vec` by value. Who owns the vector after that line?',
      'When running this exercise for the first time, you\'ll notice an error about "borrow of moved value". In Rust, when an argument is passed to a function and it\'s not explicitly returned, you can\'t use the original variable anymore. We call this "moving" a variable. When we pass `vec0` into `fill_vec`, it\'s being "moved" into `vec1`, meaning we can\'t access `vec0` anymore.\n\nYou could make another, separate version of the data that\'s in `vec0` and pass it to `fill_vec` instead. This is called cloning in Rust.',
      'Clone at the call site: `let vec1 = fill_vec(vec0.clone());`'
    ],
    solution: [
      { n: '23', op: '-', t: '        let vec1 = fill_vec(vec0);' },
      { n: '23', op: '+', t: '        // Cloning `vec0` so that the clone is moved into `fill_vec`, not `vec0`' },
      { n: '24', op: '+', t: '        // itself.' },
      { n: '25', op: '+', t: '        let vec1 = fill_vec(vec0.clone());' }
    ],
    apply(code) { return code.replace('let vec1 = fill_vec(vec0);', 'let vec1 = fill_vec(vec0.clone());'); },
    next: { id: 'move_semantics3', title: 'move_semantics3', subtitle: 'Fix it without adding a new line' }
  };

  EX.move_semantics3 = {
    id: 'move_semantics3', title: 'move_semantics3', subtitle: 'Fix it without adding a new line', topic: 'move_semantics · 3 of 5', diff: 1, diffLabel: 'Easy', xp: 40,
    file: MS + 'move_semantics3.rs', tests: 1, head: RL_HEAD, hintKinds: RL_KINDS,
    rl: { pos: 28, idx: 3, of: 5, topic: 'move_semantics' },
    code: [
      '// TODO: Fix the compiler error in the function without adding any new line.',
      'fn fill_vec(vec: Vec<i32>) -> Vec<i32> {',
      '    vec.push(88);',
      '',
      '    vec',
      '}',
      '',
      'fn main() {',
      '    // You can optionally experiment here.',
      '}',
      '',
      '#[cfg(test)]',
      'mod tests {',
      '    use super::*;',
      '',
      '    #[test]',
      '    fn move_semantics3() {',
      '        let vec0 = vec![22, 44, 66];',
      '        let vec1 = fill_vec(vec0);',
      '        assert_eq!(vec1, [22, 44, 66, 88]);',
      '    }',
      '}'
    ].join('\n'),
    check(code) { return /fn\s+fill_vec\s*\(\s*mut\s+vec\s*:/.test(code) || /let\s+mut\s+vec\s*=\s*vec\s*;/.test(code) ? 'pass' : 'E0596'; },
    results: {
      E0596: {
        code: 'E0596', title: 'cannot borrow `vec` as mutable, as it is not declared as mutable', where: 'line 3',
        marks: [{ line: 3, col: 5, len: 3, kind: 'err' }],
        diag: { loc: '3:5', labels: [{ at: '3:5', line: 3, t: 'cannot borrow as mutable', p: true }], help: 'consider changing this to be mutable: `mut vec`', short: '`vec` isn\u2019t declared `mut`' },
        out: [
          RL_HEAD,
          '§Rerror[E0596]§W: cannot borrow `vec` as mutable, as it is not declared as mutable',
          arrow(1, MS + 'move_semantics3.rs:3:5'),
          bar(1),
          cl(1, 3, '    vec.push(88);'),
          ul(1, 5, 3, '^', 'cannot borrow as mutable', 'R'),
          bar(1),
          '§Chelp§W: consider changing this to be mutable',
          bar(1),
          cl(1, 2, 'fn fill_vec(§gmut §nvec: Vec<i32>) -> Vec<i32> {'),
          ul(1, 13, 3, '+', '', 'g'),
          '',
          'For more information about this error, try `rustc --explain E0596`.',
          rlFail('move_semantics3')
        ],
        explain: {
          lead: '`fill_vec` owns `vec`, but the binding isn\u2019t mutable, so `push` can\u2019t change it. In Rust, owning a value and being allowed to change it are separate things.',
          steps: [{ n: '2', t: '`vec: Vec<i32>` is an owned, immutable binding.', ok: true }, { n: '3', t: '`vec.push(88)` needs to borrow `vec` mutably.', ok: false }],
          fixes: [{ label: 'Make the parameter mutable', code: 'fn fill_vec(mut vec: Vec<i32>) -> Vec<i32> {', note: '`mut` goes before the parameter name, so no new line is needed.' }],
          read: READ_42
        }
      },
      pass: { out: rlPass('move_semantics3', 'b81d2e07c4a9f135', '0.44s') }
    },
    hints: [
      '`fill_vec` owns `vec`, but owning a value isn\u2019t the same as being allowed to change it. What does `push` need?',
      'The difference between this one and the previous ones is that the first line of `fn fill_vec` that had `let mut vec = vec;` is no longer there. You can, instead of adding that line back, add `mut` in one place that will change an existing binding to be a mutable binding instead of an immutable one :)',
      'Add `mut` before the parameter: `fn fill_vec(mut vec: Vec<i32>) -> Vec<i32>`.'
    ],
    solution: [
      { n: '1', op: '-', t: '// TODO: Fix the compiler error in the function without adding any new line.' },
      { n: '2', op: '-', t: 'fn fill_vec(vec: Vec<i32>) -> Vec<i32> {' },
      { n: '1', op: '+', t: 'fn fill_vec(mut vec: Vec<i32>) -> Vec<i32> {' },
      { n: '2', op: '+', t: '    //      ^^^ added' }
    ],
    apply(code) { return code.replace('fn fill_vec(vec: Vec<i32>)', 'fn fill_vec(mut vec: Vec<i32>)'); },
    next: { id: 'move_semantics4', title: 'move_semantics4', subtitle: 'Fix it only by reordering lines' }
  };

  EX.move_semantics4 = {
    id: 'move_semantics4', title: 'move_semantics4', subtitle: 'Fix it only by reordering lines', topic: 'move_semantics · 4 of 5', diff: 2, diffLabel: 'Medium', xp: 50,
    file: MS + 'move_semantics4.rs', tests: 1, head: RL_HEAD, runClean: true, hintKinds: RL_KINDS,
    rl: { pos: 29, idx: 4, of: 5, topic: 'move_semantics' },
    code: [
      'fn main() {',
      '    // You can optionally experiment here.',
      '}',
      '',
      '#[cfg(test)]',
      'mod tests {',
      '    // TODO: Fix the compiler errors only by reordering the lines in the test.',
      '    // Don\'t add, change or remove any line.',
      '    #[test]',
      '    fn move_semantics4() {',
      '        let mut x = Vec::new();',
      '        let y = &mut x;',
      '        let z = &mut x;',
      '        y.push(42);',
      '        z.push(13);',
      '        assert_eq!(x, [42, 13]);',
      '    }',
      '}'
    ].join('\n'),
    check(code) {
      const i = (s) => code.indexOf(s), y = i('let y = &mut x;'), z = i('let z = &mut x;'), yp = i('y.push(42);'), zp = i('z.push(13);'), a = i('assert_eq!(x, [42, 13]);');
      return y >= 0 && y < yp && yp < z && z < zp && zp < a ? 'pass' : 'E0499';
    },
    results: {
      E0499: {
        code: 'E0499', title: 'cannot borrow `x` as mutable more than once at a time', where: 'line 13',
        marks: [{ line: 13, col: 17, len: 6, kind: 'err' }],
        diag: { loc: '13:17', labels: [{ at: '12:17', line: 12, t: 'first mutable borrow occurs here' }, { at: '13:17', line: 13, t: 'second mutable borrow occurs here', p: true }, { at: '14:9', line: 14, t: 'first borrow later used here' }], help: 'a borrow lasts until its last use', short: 'two `&mut x` borrows overlap' },
        out: [
          RL_HEAD,
          '§Rerror[E0499]§W: cannot borrow `x` as mutable more than once at a time',
          arrow(2, MS + 'move_semantics4.rs:13:17'),
          bar(2),
          cl(2, 12, '        let y = &mut x;'),
          ul(2, 17, 6, '-', 'first mutable borrow occurs here'),
          cl(2, 13, '        let z = &mut x;'),
          ul(2, 17, 6, '^', 'second mutable borrow occurs here', 'R'),
          cl(2, 14, '        y.push(42);'),
          ul(2, 9, 1, '-', 'first borrow later used here'),
          '',
          'For more information about this error, try `rustc --explain E0499`.',
          rlFail('move_semantics4')
        ],
        explain: {
          lead: 'Two `&mut` borrows of `x` overlap. `y` is created on line 12 and still used on line 14, so `z` can\u2019t also borrow `x` mutably on line 13.',
          steps: [{ n: '12', t: '`y` borrows `x` mutably.', ok: true }, { n: '13', t: '`z` borrows `x` mutably while `y` is still in use.', ok: false }, { n: '14', t: '`y.push(42)` is the last use of `y`.', ok: true }],
          fixes: [{ label: 'Finish with `y` before creating `z`', code: 'let y = &mut x;\ny.push(42);\nlet z = &mut x;\nz.push(13);', note: 'A borrow ends at its last use, so moving `y.push(42)` up ends `y` before `z` starts.' }],
          read: READ_42
        }
      },
      pass: { out: rlPass('move_semantics4', '0d6a3b9e12f4c877', '0.41s') }
    },
    hints: [
      'A `&mut` borrow lasts until its last use. Where is `y` last used, compared with line 13?',
      'Carefully reason about the range in which each mutable reference is in scope. Does it help to update the value of `x` immediately after the mutable reference is taken?\nRead more about \'Mutable References\' in the book\'s section \'References and Borrowing\'.',
      'Swap lines 13 and 14: call `y.push(42);` before `let z = &mut x;`.'
    ],
    solution: [
      { n: '13', op: '-', t: '        let z = &mut x;' },
      { n: '14', op: '-', t: '        y.push(42);' },
      { n: '11', op: '+', t: '        // `y` used here.' },
      { n: '12', op: '+', t: '        y.push(42);' },
      { n: '13', op: '+', t: '        // The mutable reference `y` is not used anymore,' },
      { n: '14', op: '+', t: '        // therefore a new reference can be created.' },
      { n: '15', op: '+', t: '        let z = &mut x;' }
    ],
    apply(code) { return code.replace('        let z = &mut x;\n        y.push(42);', '        y.push(42);\n        let z = &mut x;'); },
    next: { id: 'move_semantics5', title: 'move_semantics5', subtitle: 'Fix it by adding or removing &' }
  };

  Object.assign(RUN_OK, { move_semantics2: rlRun('move_semantics2'), move_semantics3: rlRun('move_semantics3'), move_semantics4: rlRun('move_semantics4') });
  Object.assign(HINT_LINES, { move_semantics2: [23, 21, 23], move_semantics3: [3, 2, 2], move_semantics4: [13, 12, 13] });

  const BOOK_TOC = [
    { n: 1, t: 'Getting Started', s: ['Installation', 'Hello, World!', 'Hello, Cargo!'] },
    { n: 2, t: 'Programming a Guessing Game', s: [], project: 'guessing game' },
    { n: 3, t: 'Common Programming Concepts', s: ['Variables and Mutability', 'Data Types', 'Functions', 'Comments', 'Control Flow'] },
    { n: 4, t: 'Understanding Ownership', s: ['What is Ownership?', 'References and Borrowing', 'The Slice Type'] },
    { n: 5, t: 'Using Structs to Structure Related Data', s: ['Defining and Instantiating Structs', 'An Example Program Using Structs', 'Methods'] },
    { n: 6, t: 'Enums and Pattern Matching', s: ['Defining an Enum', 'The match Control Flow Construct', 'Concise Control Flow with if let and let...else'] },
    { n: 7, t: 'Packages, Crates, and Modules', s: ['Packages and Crates', 'Control Scope and Privacy with Modules', 'Paths for Referring to an Item in the Module Tree', 'Bringing Paths Into Scope with the use Keyword', 'Separating Modules into Different Files'] },
    { n: 8, t: 'Common Collections', s: ['Storing Lists of Values with Vectors', 'Storing UTF-8 Encoded Text with Strings', 'Storing Keys with Associated Values in Hash Maps'] },
    { n: 9, t: 'Error Handling', s: ['Unrecoverable Errors with panic!', 'Recoverable Errors with Result', 'To panic! or Not to panic!'] },
    { n: 10, t: 'Generic Types, Traits, and Lifetimes', s: ['Generic Data Types', 'Defining Shared Behavior with Traits', 'Validating References with Lifetimes'] },
    { n: 11, t: 'Writing Automated Tests', s: ['How to Write Tests', 'Controlling How Tests Are Run', 'Test Organization'] },
    { n: 12, t: 'An I/O Project: Building a Command Line Program', s: ['Accepting Command Line Arguments', 'Reading a File', 'Refactoring to Improve Modularity and Error Handling', 'Adding Functionality with Test Driven Development', 'Working with Environment Variables', 'Redirecting Errors to Standard Error'], project: 'minigrep' },
    { n: 13, t: 'Functional Language Features: Iterators and Closures', s: ['Closures', 'Processing a Series of Items with Iterators', 'Improving Our I/O Project', 'Performance in Loops vs. Iterators'] },
    { n: 14, t: 'More about Cargo and Crates.io', s: ['Customizing Builds with Release Profiles', 'Publishing a Crate to Crates.io', 'Cargo Workspaces', 'Installing Binaries with cargo install', 'Extending Cargo with Custom Commands'] },
    { n: 15, t: 'Smart Pointers', s: ['Using Box<T> to Point to Data on the Heap', 'Treating Smart Pointers Like Regular References', 'Running Code on Cleanup with the Drop Trait', 'Rc<T>, the Reference Counted Smart Pointer', 'RefCell<T> and the Interior Mutability Pattern', 'Reference Cycles Can Leak Memory'] },
    { n: 16, t: 'Fearless Concurrency', s: ['Using Threads to Run Code Simultaneously', 'Transfer Data Between Threads with Message Passing', 'Shared-State Concurrency', 'Extensible Concurrency with Send and Sync'] },
    { n: 17, t: 'Fundamentals of Asynchronous Programming: Async, Await, Futures, and Streams', s: ['Futures and the Async Syntax', 'Applying Concurrency with Async', 'Working With Any Number of Futures', 'Streams: Futures in Sequence', 'A Closer Look at the Traits for Async', 'Futures, Tasks, and Threads'] },
    { n: 18, t: 'Object Oriented Programming Features', s: ['Characteristics of Object-Oriented Languages', 'Using Trait Objects to Abstract over Shared Behavior', 'Implementing an Object-Oriented Design Pattern'] },
    { n: 19, t: 'Patterns and Matching', s: ['All the Places Patterns Can Be Used', 'Refutability: Whether a Pattern Might Fail to Match', 'Pattern Syntax'] },
    { n: 20, t: 'Advanced Features', s: ['Unsafe Rust', 'Advanced Traits', 'Advanced Types', 'Advanced Functions and Closures', 'Macros'] },
    { n: 21, t: 'Final Project: Building a Multithreaded Web Server', s: ['Building a Single-Threaded Web Server', 'From Single-Threaded to Multithreaded Server', 'Graceful Shutdown and Cleanup'], project: 'web server' },
    { n: 'A', t: 'Appendix', s: ['A - Keywords', 'B - Operators and Symbols', 'C - Derivable Traits', 'D - Useful Development Tools', 'E - Editions', 'F - Translations of the Book', 'G - How Rust is Made and \u201cNightly Rust\u201d'] }
  ];
  const BOOK_STATE = { read: ['1.1', '1.2', '1.3', '2', '3.1', '3.2', '3.3', '3.4', '3.5', '4.1'], cur: '4.2', curPct: 0.62 };
  const RL = {
    total: 95, done: 26,
    path: [
      { t: 'topic', dir: '00_intro', name: 'intro', n: 2, done: 2, book: '', secs: [] },
      { t: 'topic', dir: '01_variables', name: 'variables', n: 6, done: 6, book: '§3.1', secs: ['3.1'] },
      { t: 'topic', dir: '02_functions', name: 'functions', n: 5, done: 5, book: '§3.3', secs: ['3.3'] },
      { t: 'topic', dir: '03_if', name: 'if', n: 3, done: 3, book: '§3.5', secs: ['3.5'] },
      { t: 'quiz', name: 'quiz1', n: 1, done: 1, covers: 'variables, functions, if', secs: [] },
      { t: 'topic', dir: '04_primitive_types', name: 'primitive_types', n: 6, done: 6, book: '§3.2, §4.3', secs: ['3.2', '4.3'] },
      { t: 'topic', dir: '05_vecs', name: 'vecs', n: 2, done: 2, book: '§8.1', secs: ['8.1'] },
      { t: 'topic', dir: '06_move_semantics', name: 'move_semantics', n: 5, done: 1, book: '§4.1\u20132', secs: ['4.1', '4.2'], cur: true },
      { t: 'topic', dir: '07_structs', name: 'structs', n: 3, done: 0, book: '§5.1, §5.3', secs: ['5.1', '5.3'] },
      { t: 'topic', dir: '08_enums', name: 'enums', n: 3, done: 0, book: '§6, §19.3', secs: ['6', '19.3'] },
      { t: 'topic', dir: '09_strings', name: 'strings', n: 4, done: 0, book: '§8.2', secs: ['8.2'] },
      { t: 'topic', dir: '10_modules', name: 'modules', n: 3, done: 0, book: '§7', secs: ['7'] },
      { t: 'topic', dir: '11_hashmaps', name: 'hashmaps', n: 3, done: 0, book: '§8.3', secs: ['8.3'] },
      { t: 'quiz', name: 'quiz2', n: 1, done: 0, covers: 'strings, vecs, move semantics, modules, enums', secs: [] },
      { t: 'topic', dir: '12_options', name: 'options', n: 3, done: 0, book: '§10.1', secs: ['10.1'] },
      { t: 'topic', dir: '13_error_handling', name: 'error_handling', ex: 'errors', n: 6, done: 0, book: '§9', secs: ['9'] },
      { t: 'topic', dir: '14_generics', name: 'generics', n: 2, done: 0, book: '§10', secs: ['10'] },
      { t: 'topic', dir: '15_traits', name: 'traits', n: 5, done: 0, book: '§10.2', secs: ['10.2'] },
      { t: 'quiz', name: 'quiz3', n: 1, done: 0, covers: 'generics, traits', secs: [] },
      { t: 'topic', dir: '16_lifetimes', name: 'lifetimes', n: 3, done: 0, book: '§10.3', secs: ['10.3'] },
      { t: 'topic', dir: '17_tests', name: 'tests', n: 3, done: 0, book: '§11.1', secs: ['11.1'] },
      { t: 'topic', dir: '18_iterators', name: 'iterators', n: 5, done: 0, book: '§13.2\u20134', secs: ['13.2', '13.3', '13.4'] },
      { t: 'topic', dir: '19_smart_pointers', name: 'smart_pointers', n: 4, done: 0, book: '§15, §16.3', secs: ['15', '16.3'] },
      { t: 'topic', dir: '20_threads', name: 'threads', n: 3, done: 0, book: '§16.1\u20133', secs: ['16.1', '16.2', '16.3'] },
      { t: 'topic', dir: '21_macros', name: 'macros', n: 4, done: 0, book: '§20.5', secs: ['20.5'] },
      { t: 'topic', dir: '22_clippy', name: 'clippy', n: 3, done: 0, book: 'App. D', secs: ['D'] },
      { t: 'topic', dir: '23_conversions', name: 'conversions', n: 5, done: 0, book: '', secs: [] },
      { t: 'topic', dir: '24_async', name: 'async', n: 1, done: 0, book: '§17', secs: ['17'] }
    ],
    projects: [
      { name: 'guessing_game', ch: 2, title: 'Programming a Guessing Game', state: 'done' },
      { name: 'minigrep', ch: 12, title: 'An I/O Project: Building a Command Line Program', state: 'todo' },
      { name: 'hello', ch: 21, title: 'Final Project: Building a Multithreaded Web Server', state: 'todo' }
    ]
  };

  // ---- Toolchain, compiler error index, Book projects, intro1 ----
  const RUST = { ver: '1.99.1', hash: 'f0e3b1c27', date: '2026-10-15', cargoHash: '2d7f4a8e0', cargoDate: '2026-10-02' };
  const HELLO_RS = 'fn main() {\n    println!("Hello, world!");\n}';
  const newToml = (n) => '[package]\nname = "' + n + '"\nversion = "0.1.0"\nedition = "2024"\n\n[dependencies]';
  const GUESS = {
    main: [
      'use std::cmp::Ordering;',
      'use std::io;',
      '',
      'use rand::prelude::*;',
      '',
      'fn main() {',
      '    println!("Guess the number!");',
      '',
      '    let secret_number = rand::rng().random_range(1..=100);',
      '',
      '    loop {',
      '        println!("Please input your guess.");',
      '',
      '        let mut guess = String::new();',
      '',
      '        io::stdin()',
      '            .read_line(&mut guess)',
      '            .expect("Failed to read line");',
      '',
      '        let guess: u32 = match guess.trim().parse() {',
      '            Ok(num) => num,',
      '            Err(_) => continue,',
      '        };',
      '',
      '        println!("You guessed: {guess}");',
      '',
      '        match guess.cmp(&secret_number) {',
      '            Ordering::Less => println!("Too small!"),',
      '            Ordering::Greater => println!("Too big!"),',
      '            Ordering::Equal => {',
      '                println!("You win!");',
      '                break;',
      '            }',
      '        }',
      '    }',
      '}'
    ].join('\n'),
    toml: '[package]\nname = "guessing_game"\nversion = "0.1.0"\nedition = "2024"\n\n# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html\n\n[dependencies]\nrand = "0.10.1"',
    lock: '# This file is automatically @generated by Cargo.\n# It is not intended for manual editing.\nversion = 4\n\n[[package]]\nname = "guessing_game"\nversion = "0.1.0"\ndependencies = [\n "rand",\n]'
  };
  // rustc error index (rust-lang/rust, MIT or Apache-2.0), shortened
  const ERRS = {
    E0382: { t: 'borrow of moved value', sec: '4.2', md: [
      'A variable was used after its contents have been moved elsewhere.',
      'Erroneous code example:',
      { c: 'struct MyStruct { s: u32 }\n\nfn main() {\n    let mut x = MyStruct{ s: 5u32 };\n    let y = x;\n    x.s = 6;\n    println!("{}", x.s);\n}' },
      'Since `MyStruct` is a type that is not marked `Copy`, the data gets moved out of `x` when we set `y`. This is fundamental to Rust\'s ownership system: outside of workarounds like `Rc`, a value cannot be owned by more than one variable.',
      'Sometimes we don\'t need to move the value. Using a reference, we can let another function borrow the value without changing its ownership. In the example below, we don\'t actually have to move our string to `calculate_length`, we can give it a reference to it with `&` instead.',
      { c: 'fn main() {\n    let s1 = String::from("hello");\n\n    let len = calculate_length(&s1);\n\n    println!("The length of \'{}\' is {}.", s1, len);\n}\n\nfn calculate_length(s: &String) -> usize {\n    s.len()\n}' },
      'A mutable reference can be created with `&mut`.',
      'Sometimes we don\'t want a reference, but a duplicate. All types marked `Clone` can be duplicated by calling `.clone()`. Subsequent changes to a clone do not affect the original variable.',
      'For more information on Rust\'s ownership system, take a look at the References & Borrowing section of the Book.'
    ] },
    E0499: { t: 'cannot borrow as mutable more than once at a time', sec: '4.2', md: [
      'A variable was borrowed as mutable more than once.',
      'Erroneous code example:',
      { c: 'let mut i = 0;\nlet mut x = &mut i;\nlet mut a = &mut i;\nx;\n// error: cannot borrow `i` as mutable more than once at a time' },
      'Please note that in Rust, you can either have many immutable references, or one mutable reference. For more details you may want to read the References & Borrowing section of the Book.',
      'Example:',
      { c: 'let mut i = 0;\nlet mut x = &mut i; // ok!\n\n// or:\nlet mut i = 0;\nlet a = &i; // ok!\nlet b = &i; // still ok!\nlet c = &i; // still ok!\nb;\na;' }
    ] },
    E0596: { t: 'cannot borrow as mutable, as it is not declared as mutable', sec: '4.2', md: [
      'This error occurs because you tried to mutably borrow a non-mutable variable.',
      'Erroneous code example:',
      { c: 'let x = 1;\nlet y = &mut x; // error: cannot borrow mutably' },
      'In here, `x` isn\'t mutable, so when we try to mutably borrow it in `y`, it fails. To fix this error, you need to make `x` mutable:',
      { c: 'let mut x = 1;\nlet y = &mut x; // ok!' }
    ] },
    E0502: { t: 'cannot borrow as mutable because it is also borrowed as immutable', sec: '4.2', md: [
      'A variable already borrowed with a certain mutability (either mutable or immutable) was borrowed again with a different mutability.',
      'Erroneous code example:',
      { c: 'fn bar(x: &mut i32) {}\nfn foo(a: &mut i32) {\n    let y = &a; // a is borrowed as immutable.\n    bar(a); // error, a is borrowed as mutable while already\n            // borrowed as immutable.\n    println!("{}", y);\n}' },
      'To fix this error, ensure that you don\'t have any other references to the variable before trying to access it with a different mutability:',
      { c: 'fn bar(x: &mut i32) {}\nfn foo(a: &mut i32) {\n    bar(a);\n    let y = &a; // ok!\n    println!("{}", y);\n}' }
    ] },
    E0505: { t: 'cannot move out of a value because it is borrowed', sec: '4.2', md: [
      'A value was moved out while it was still borrowed.',
      'Erroneous code example:',
      { c: 'struct Value {}\n\nfn borrow(val: &Value) {}\n\nfn eat(val: Value) {}\n\nfn main() {\n    let x = Value{};\n    let _ref_to_val: &Value = &x;\n    eat(x);\n    borrow(_ref_to_val);\n}' },
      'Here, the function `eat` takes ownership of `x`. However, `x` cannot be moved because the borrow to `_ref_to_val` needs to last till the function `borrow`.'
    ] },
    E0597: { t: 'borrowed value does not live long enough', sec: '10.3', md: [
      'This error occurs because a value was dropped while it was still borrowed.',
      'Erroneous code example:',
      { c: 'struct Foo<\'a> {\n    x: Option<&\'a u32>,\n}\n\nlet mut x = Foo { x: None };\n{\n    let y = 0;\n    x.x = Some(&y); // error: `y` does not live long enough\n}\nprintln!("{:?}", x.x);' },
      'Here, `y` is dropped at the end of the inner scope, but it is borrowed by `x` until the `println`. To fix the previous example, just remove the scope so that `y` isn\'t dropped until after the println.'
    ] },
    E0308: { t: 'mismatched types', md: [
      'Expected type did not match the received type.',
      'Erroneous code examples:',
      { c: 'fn plus_one(x: i32) -> i32 {\n    x + 1\n}\n\nplus_one("Not a number");\n//       ^^^^^^^^^^^^^^ expected `i32`, found `&str`\n\nlet x: f32 = "Not a float";\n//     ---   ^^^^^^^^^^^^^ expected `f32`, found `&str`\n//     |\n//     expected due to this' },
      'This error occurs when an expression was used in a place where the compiler expected an expression of a different type. It can occur in several cases, the most common being when calling a function and passing an argument which has a different type than the matching type in the function declaration.'
    ] },
    E0425: { t: 'cannot find value in this scope', md: [
      'An unresolved name was used.',
      'Erroneous code example:',
      { c: 'let x = unknown_variable;  // error: unresolved name `unknown_variable`' },
      'Please verify that the name wasn\'t misspelled and ensure that the identifier being referred to is valid for the given situation.'
    ] }
  };

  const INTRO1 = [
    '// TODO: We sometimes encourage you to keep trying things on a given exercise',
    '// even after you already figured it out. If you got everything working and feel',
    '// ready for the next exercise, enter `n` in the terminal.',
    '//',
    '// The exercise file will be reloaded when you change one of the lines below!',
    '// Try adding a new `println!` and check the updated output in the terminal.',
    '',
    'fn main() {',
    '    println!(r#"       Welcome to...                      "#);',
    '    println!(r#"                 _   _ _                  "#);',
    '    println!(r#"  _ __ _   _ ___| |_| (_)_ __   __ _ ___  "#);',
    '    println!(r#" | \'__| | | / __| __| | | \'_ \\ / _` / __| "#);',
    '    println!(r#" | |  | |_| \\__ \\ |_| | | | | | (_| \\__ \\ "#);',
    '    println!(r#" |_|   \\__,_|___/\\__|_|_|_| |_|\\__, |___/ "#);',
    '    println!(r#"                               |___/      "#);',
    '    println!();',
    '    println!("This exercise compiles successfully. The remaining exercises contain a compiler");',
    '    println!("or logic error. The central concept behind Rustlings is to fix these errors and");',
    '    println!("solve the exercises. Good luck!");',
    '    println!();',
    '    println!("The file of this exercise is `exercises/00_intro/intro1.rs`. Have a look!");',
    '    println!("The current exercise path will be always shown under the progress bar.");',
    '    println!("You can click on the path to open the exercise file in your editor.");',
    '}'
  ];
  const introOut = INTRO1.filter(l => /^\s+println!/.test(l)).map(l => { const m = l.match(/println!\(r#"(.*)"#\);/) || l.match(/println!\("(.*)"\);/); return m ? m[1] : ''; });
  EX.intro1 = {
    id: 'intro1', title: 'intro1', subtitle: 'Welcome to Rustlings', topic: 'intro · 1 of 2', diff: 1, diffLabel: 'Easy', xp: 10,
    file: 'exercises/00_intro/intro1.rs', tests: 0, head: RL_HEAD, runClean: true, hintKinds: RL_KINDS,
    rl: { pos: 1, idx: 1, of: 2, topic: 'intro' },
    code: INTRO1.join('\n'),
    check() { return 'pass'; },
    results: { pass: { out: rlRun('intro1').concat(introOut) } },
    hints: ['This one already compiles. Tap Check to run it.', 'Enter `n` to move on to the next exercise.\nYou might need to press ENTER after typing `n`.', 'Nothing to change here. Check it, then go on to `intro2`.'],
    solution: [],
    apply(c) { return c; },
    next: { id: 'intro2', title: 'intro2', subtitle: '' }
  };
  RUN_OK.intro1 = EX.intro1.results.pass.out;
  HINT_LINES.intro1 = [8, 3, 8];

  function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  window.OxLib = { lex, highlight, ansi, out, rich, EX, BOOK_42, SYN, TC: TCD, TCL, seeded, CARGO_HEAD, RUN_OK, WS, FX, HINT_LINES, PANIC_TRACE, BOOK_TOC, BOOK_STATE, RL, RUST, HELLO_RS, newToml, GUESS, ERRS };
  window.dispatchEvent(new Event('oxlib-ready'));
})();
