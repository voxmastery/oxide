// Daily Bug Hunt puzzles. Each program compiles (Rust 2024) but does the wrong thing on one line.
// `options` are replacements for line `line` (1-based, written without indentation); `options[answer]`
// is the fix. `output` is what the fixed program prints, `actual` what the buggy one prints (stdout),
// `panic` the panic message when the buggy program panics instead.
// Every puzzle is checked by compiling and running it: buggy, fixed, and with each wrong option
// (a wrong option must fail to compile or print something other than `output`).

export type Puzzle = {
  /** Stable id, never reused. */
  id: string;
  title: string;
  /** Book chapter the puzzle belongs to. */
  chapter: number;
  /** Book section to read about the idea. */
  section: string;
  /** What the program is meant to do, in one or two plain sentences. */
  intent: string;
  code: string;
  line: number;
  options: string[];
  answer: number;
  explain: string;
  output: string;
  actual: string;
  panic?: string;
  /** The buggy program's output changes between runs. */
  varies?: boolean;
};

// Raw text keeps Rust escapes (`\n`) as written; `\${` is the only escape needed inside the template.
const rs = (s: TemplateStringsArray) => s.raw[0].replace(/\\\$/g, '$').replace(/^\n/, '').replace(/\s+$/, '');

export const PUZZLES: Puzzle[] = [
  // ---------- Chapter 3: Common Programming Concepts ----------
  {
    id: 'sum-to-ten', title: 'One short of ten', chapter: 3, section: '3.5',
    intent: 'Add up the numbers 1 through 10.',
    code: rs`
fn main() {
    let mut total = 0;
    for n in 1..10 {
        total += n;
    }
    println!("sum = {total}");
}`,
    line: 3,
    options: ['for n in 0..10 {', 'for n in 1..=10 {', 'for n in 2..=10 {', 'for n in 1..=9 {'],
    answer: 1,
    explain: '`1..10` is a half-open range: it stops before 10, so the loop only sees 1 to 9. `1..=10` includes the end.',
    output: 'sum = 55', actual: 'sum = 45',
  },
  {
    id: 'shadow-bonus', title: 'The bonus that vanished', chapter: 3, section: '3.1',
    intent: 'Add a 5-point bonus to the score and print the final score.',
    code: rs`
fn main() {
    let mut score = 10;
    let bonus = true;
    if bonus {
        let score = score + 5;
        println!("bonus: {score}");
    }
    println!("final: {score}");
}`,
    line: 5,
    options: ['let mut score = score + 5;', 'score += 5;', 'score + 5;', 'let score = score * 1 + 5;'],
    answer: 1,
    explain: '`let score = …` inside the `if` block makes a new variable that shadows the outer one until the block ends. The outer `score` never changes. Assigning with `score += 5` updates the original.',
    output: 'bonus: 15\nfinal: 15', actual: 'bonus: 15\nfinal: 10',
  },
  {
    id: 'int-average', title: 'Half a point missing', chapter: 3, section: '3.2',
    intent: 'Print the exact average of 7 and 8.',
    code: rs`
fn main() {
    let a: i32 = 7;
    let b: i32 = 8;
    let avg = (a + b) / 2;
    println!("average: {avg}");
}`,
    line: 4,
    options: ['let avg = ((a + b) / 2) as f64;', 'let avg = (a + b) as f64 / 2.0;', 'let avg = (a + b) / 2 + 0;', 'let avg = (a + b + 1) / 2;'],
    answer: 1,
    explain: 'Dividing two integers gives an integer: `15 / 2` is `7`, and the remainder is dropped. Convert to `f64` before dividing. Casting after the division is too late; the half is already gone.',
    output: 'average: 7.5', actual: 'average: 7',
  },
  {
    id: 'wrap-brightness', title: 'Too bright to see', chapter: 3, section: '3.2',
    intent: 'Raise the brightness by 10, but never past the maximum of 255.',
    code: rs`
fn main() {
    let level: u8 = 250;
    let boosted = level.wrapping_add(10);
    println!("brightness: {boosted}");
}`,
    line: 3,
    options: ['let boosted = level.overflowing_add(10).0;', 'let boosted = level.checked_add(10).unwrap_or(0);', 'let boosted = level.saturating_add(10);', 'let boosted = level.wrapping_add(10) % 255;'],
    answer: 2,
    explain: '`wrapping_add` goes past 255 and wraps around to 0, so 250 + 10 becomes 4. `saturating_add` stops at the type’s maximum, which is exactly what a brightness cap needs.',
    output: 'brightness: 255', actual: 'brightness: 4',
  },
  {
    id: 'float-equal', title: 'Almost balanced', chapter: 3, section: '3.2',
    intent: 'Check that 0.1 + 0.2 adds up to 0.3 and print “balanced”.',
    code: rs`
fn main() {
    let total: f64 = 0.1 + 0.2;
    if total == 0.3 {
        println!("balanced");
    } else {
        println!("off by a little");
    }
}`,
    line: 3,
    options: ['if total == 0.30 {', 'if total.round() == 0.3 {', 'if (total - 0.3).abs() < 1e-9 {', 'if total.floor() == 0.3 {'],
    answer: 2,
    explain: '`0.1` and `0.2` can’t be stored exactly in binary, so their sum is `0.30000000000000004`. Compare floats with a small tolerance instead of `==`.',
    output: 'balanced', actual: 'off by a little',
  },
  {
    id: 'countdown', title: 'Liftoff, a second early', chapter: 3, section: '3.5',
    intent: 'Count down 3, 2, 1, then print “liftoff!”.',
    code: rs`
fn main() {
    let mut n = 3;
    while n > 1 {
        println!("{n}...");
        n -= 1;
    }
    println!("liftoff!");
}`,
    line: 3,
    options: ['while n >= 0 {', 'while n != 1 {', 'while n > 0 {', 'while n > 2 {'],
    answer: 2,
    explain: 'With `n > 1` the loop stops as soon as `n` reaches 1, before printing it. The condition has to stay true for 1 too: `n > 0`.',
    output: '3...\n2...\n1...\nliftoff!', actual: '3...\n2...\nliftoff!',
  },
  {
    id: 'loop-label', title: 'Breaking out too little', chapter: 3, section: '3.5',
    intent: 'Find the first even number in the grid, reading row by row.',
    code: rs`
fn main() {
    let grid = [[1, 3, 4], [6, 7, 8]];
    let mut first_even = None;
    'rows: for row in grid {
        for x in row {
            if x % 2 == 0 {
                first_even = Some(x);
                break;
            }
        }
    }
    println!("{first_even:?}");
}`,
    line: 8,
    options: ['continue;', "break 'rows;", "continue 'rows;", 'return;'],
    answer: 1,
    explain: 'A plain `break` only leaves the innermost loop, so the outer loop moves to the next row and overwrites the answer with 6. `break \'rows` leaves the labelled outer loop as well.',
    output: 'Some(4)', actual: 'Some(6)',
  },
  {
    id: 'tuple-swap', title: 'Portrait by accident', chapter: 3, section: '3.2',
    intent: 'Print the screen size as width×height.',
    code: rs`
fn main() {
    let size = (1920, 1080); // (width, height)
    let (height, width) = size;
    println!("{width}x{height}");
}`,
    line: 3,
    options: ['let (width, height) = size;', 'let (width, height) = (size.1, size.0);', 'let (height, width) = (size.0, size.1);', 'let (_, width) = size;'],
    answer: 0,
    explain: 'Tuple destructuring is positional: the first name gets the first element. The names don’t matter to the compiler, so `(height, width)` silently swaps them.',
    output: '1920x1080', actual: '1080x1920',
  },
  {
    id: 'caesar-wrap', title: 'Off the end of the alphabet', chapter: 3, section: '3.2',
    intent: 'Shift the letter three places forward, wrapping from z back to a.',
    code: rs`
fn main() {
    let c = 'y';
    let shifted = (c as u8 + 3) as char;
    println!("{shifted}");
}`,
    line: 3,
    options: ['let shifted = ((c as u8 + 3) % 26) as char;', 'let shifted = char::from(c as u8 + 3);', 'let shifted = ((c as u8 - b\'a\' + 3) % 26) as char;', 'let shifted = (b\'a\' + (c as u8 - b\'a\' + 3) % 26) as char;'],
    answer: 3,
    explain: 'Adding 3 to `y` goes past `z` into punctuation (`|`). To wrap, work with the position in the alphabet (`c - b\'a\'`), take it `% 26`, then add `b\'a\'` back.',
    output: 'b', actual: '|',
  },

  // ---------- Chapter 4: Understanding Ownership ----------
  {
    id: 'clone-push', title: 'Added to the wrong list', chapter: 4, section: '4.2',
    intent: 'Add “grace” to the list of names and print how many names there are.',
    code: rs`
fn main() {
    let mut names = vec![String::from("ada")];
    let mut copy = names.clone();
    copy.push(String::from("grace"));
    println!("{}", names.len());
}`,
    line: 3,
    options: ['let mut copy = names.to_vec();', 'let copy = &mut names;', 'let copy = &names;', 'let mut copy = names.iter().cloned().collect::<Vec<_>>();'],
    answer: 1,
    explain: '`clone()` makes a whole new `Vec`; pushing to it leaves `names` untouched. To change the original through another name, borrow it mutably with `&mut names`.',
    output: '2', actual: '1',
  },
  {
    id: 'utf8-slice', title: 'Half a letter', chapter: 4, section: '4.3',
    intent: 'Print the first three letters of each word.',
    code: rs`
fn main() {
    for word in ["crème", "brûlée", "tarte"] {
        let start = &word[..3];
        println!("{start}");
    }
}`,
    line: 3,
    options: ['let start = &word[..4];', 'let start: String = word.chars().take(3).collect();', 'let start: String = word.chars().rev().take(3).collect();', 'let start = word.get(..3).unwrap_or(word);'],
    answer: 1,
    explain: 'String slices count bytes, not letters. `è` takes two bytes in UTF-8, so byte 3 lands in the middle of it and the program panics. Take characters with `chars()` instead.',
    output: 'crè\nbrû\ntar', actual: '', panic: 'byte index 3 is not a char boundary',
  },
  {
    id: 'iter-mut-clone', title: 'Doubling a copy', chapter: 4, section: '4.2',
    intent: 'Double every price in the list.',
    code: rs`
fn main() {
    let mut prices = vec![10, 20, 30];
    for p in prices.clone().iter_mut() {
        *p *= 2;
    }
    println!("{prices:?}");
}`,
    line: 3,
    options: ['for p in prices.to_vec().iter_mut() {', 'for p in prices.iter_mut() {', 'for p in prices.iter() {', 'for p in prices.clone().iter_mut().rev() {'],
    answer: 1,
    explain: 'The loop doubles the values of a temporary clone, which is thrown away afterwards. `iter_mut()` on `prices` itself hands out `&mut` references into the original vector.',
    output: '[20, 40, 60]', actual: '[10, 20, 30]',
  },
  {
    id: 'returned-string', title: 'Shouting into the void', chapter: 4, section: '4.1',
    intent: 'Add an exclamation mark to the message and print it.',
    code: rs`
fn shout(mut s: String) -> String {
    s.push('!');
    s
}

fn main() {
    let msg = String::from("hello");
    shout(msg.clone());
    println!("{msg}");
}`,
    line: 8,
    options: ['shout(msg.to_owned());', 'let _ = shout(msg.clone());', 'let msg = shout(msg);', 'shout(msg.clone()).push(\'!\');'],
    answer: 2,
    explain: '`shout` takes ownership of a `String` and gives back a new one, but the result is ignored, and it only ever saw a clone. Pass `msg` in and keep what comes back: `let msg = shout(msg);`.',
    output: 'hello!', actual: 'hello',
  },
  {
    id: 'first-word', title: 'A word with a tail', chapter: 4, section: '4.3',
    intent: 'Return the first word of the sentence, without the space.',
    code: rs`
fn first_word(s: &str) -> &str {
    for (i, b) in s.bytes().enumerate() {
        if b == b' ' {
            return &s[..i + 1];
        }
    }
    s
}

fn main() {
    println!("[{}]", first_word("hello world"));
}`,
    line: 4,
    options: ['return &s[..i];', 'return &s[..i - 1];', 'return &s[i..];', 'return &s[1..i];'],
    answer: 0,
    explain: '`i` is the index of the space. A range `..i` already stops just before it; `..i + 1` includes the space itself.',
    output: '[hello]', actual: '[hello ]',
  },

  // ---------- Chapter 5: Structs ----------
  {
    id: 'self-by-value', title: 'Hits that never land', chapter: 5, section: '5.3',
    intent: 'Count two hits.',
    code: rs`
#[derive(Clone, Copy)]
struct Counter { hits: u32 }

impl Counter {
    fn hit(mut self) {
        self.hits += 1;
    }
}

fn main() {
    let mut c = Counter { hits: 0 };
    c.hit();
    c.hit();
    println!("{}", c.hits);
}`,
    line: 5,
    options: ['fn hit(&mut self) {', 'fn hit(&self) {', 'fn hit(mut self: Self) {', 'fn hit(self) {'],
    answer: 0,
    explain: 'Because `Counter` is `Copy`, `hit(mut self)` gets its own copy and changes that. Taking `&mut self` borrows the caller’s value so the change sticks.',
    output: '2', actual: '0',
  },
  {
    id: 'derive-order', title: 'Downgrade by derive', chapter: 5, section: '5.2',
    intent: 'Decide that version 2.0 is newer than 1.9.',
    code: rs`
#[derive(PartialEq, PartialOrd)]
struct Version { minor: u32, major: u32 }

fn main() {
    let old = Version { major: 1, minor: 9 };
    let new = Version { major: 2, minor: 0 };
    println!("{}", if new > old { "upgrade" } else { "no update" });
}`,
    line: 2,
    options: ['struct Version { minor: u64, major: u64 }', 'struct Version { minor: i32, major: i32 }', 'struct Version { major: u32, minor: u32 }', 'struct Version { minor: u32, major: u32, }'],
    answer: 2,
    explain: 'A derived `PartialOrd` compares fields in the order they are declared. With `minor` first, 2.0 loses to 1.9 because 0 < 9. Declare `major` first.',
    output: 'upgrade', actual: 'no update',
  },
  {
    id: 'can-hold', title: 'A photo that doesn’t fit', chapter: 5, section: '5.3',
    intent: 'Check whether the photo fits inside the frame.',
    code: rs`
struct Rect { w: u32, h: u32 }

impl Rect {
    fn can_hold(&self, other: &Rect) -> bool {
        self.w > other.w || self.h > other.h
    }
}

fn main() {
    let frame = Rect { w: 30, h: 50 };
    let photo = Rect { w: 40, h: 20 };
    println!("fits: {}", frame.can_hold(&photo));
}`,
    line: 5,
    options: ['self.w >= other.w || self.h >= other.h', 'self.w > other.w && self.h > other.h', 'self.w * self.h > other.w * other.h', 'self.h > other.w && self.w > other.h'],
    answer: 1,
    explain: 'To fit, the photo must be smaller in both directions. With `||`, being shorter is enough, even though the photo is 10 wider than the frame. Use `&&`.',
    output: 'fits: false', actual: 'fits: true',
  },
  {
    id: 'fahrenheit', title: 'A fever in the kettle', chapter: 5, section: '5.1',
    intent: 'Convert 100 °C to Fahrenheit.',
    code: rs`
struct Celsius(f64);
struct Fahrenheit(f64);

fn to_f(c: Celsius) -> Fahrenheit {
    Fahrenheit((c.0 + 32.0) * 9.0 / 5.0)
}

fn main() {
    let boiling = to_f(Celsius(100.0));
    println!("{}°F", boiling.0);
}`,
    line: 5,
    options: ['Fahrenheit(c.0 * 5.0 / 9.0 + 32.0)', 'Fahrenheit(c.0 + 32.0 * 9.0 / 5.0)', 'Fahrenheit(c.0 * 9.0 / 5.0 + 32.0)', 'Fahrenheit((c.0 - 32.0) * 5.0 / 9.0)'],
    answer: 2,
    explain: 'The formula is °C × 9/5, then + 32. The parentheses add 32 first, so the whole thing gets scaled. Multiplication already binds tighter than addition, so no parentheses are needed.',
    output: '212°F', actual: '237.6°F',
  },

  // ---------- Chapter 6: Enums and Pattern Matching ----------
  {
    id: 'range-arms', title: 'Never “lots”', chapter: 6, section: '6.2',
    intent: 'Label 0 as “none”, 1–9 as “some”, and 10 or more as “lots”.',
    code: rs`
fn label(n: u32) -> &'static str {
    match n {
        0 => "none",
        1.. => "some",
        10.. => "lots",
    }
}

fn main() {
    for n in [0, 3, 10, 42] {
        println!("{n}: {}", label(n));
    }
}`,
    line: 4,
    options: ['2.. => "some",', '1..=9 => "some",', '1..=99 => "some",', '_ => "some",'],
    answer: 1,
    explain: '`match` tries arms from top to bottom and takes the first that fits. `1..` covers every number from 1 up, so the `10..` arm below it can never run. Close the range: `1..=9`.',
    output: '0: none\n3: some\n10: lots\n42: lots', actual: '0: none\n3: some\n10: some\n42: some',
  },
  {
    id: 'binding-arm', title: 'Everything is a hit', chapter: 6, section: '6.2',
    intent: 'Say “hit” only for the guess that equals the target.',
    code: rs`
fn main() {
    let target = 7;
    for guess in [3, 7, 9] {
        let verdict = match guess {
            target => "hit",
            _ => "miss",
        };
        println!("{guess}: {verdict}");
    }
}`,
    line: 5,
    options: ['ref target => "hit",', 'g if g == target => "hit",', 'x if x != target => "hit",', 'target if true => "hit",'],
    answer: 1,
    explain: 'A plain name in a pattern doesn’t compare against a variable: it binds a new variable called `target` that matches anything. Compare in a match guard instead: `g if g == target`.',
    output: '3: miss\n7: hit\n9: miss', actual: '3: hit\n7: hit\n9: hit',
  },
  {
    id: 'option-min', title: 'Nothing is the smallest', chapter: 6, section: '6.1',
    intent: 'Find the lowest score, skipping players with no score.',
    code: rs`
fn main() {
    let scores = [Some(4), None, Some(2), Some(9)];
    let lowest = scores.iter().min().unwrap();
    println!("lowest: {lowest:?}");
}`,
    line: 3,
    options: ['let lowest = scores.iter().max().unwrap();', 'let lowest = scores.iter().copied().min().unwrap();', 'let lowest = scores.iter().flatten().min().unwrap();', 'let lowest = scores.iter().flatten().max().unwrap();'],
    answer: 2,
    explain: '`Option` is ordered with `None` before every `Some`, so the minimum is `None`. `flatten()` skips the `None`s and yields the numbers inside the `Some`s.',
    output: 'lowest: 2', actual: 'lowest: None',
  },
  {
    id: 'fizzbuzz-order', title: 'FizzBuzz without the Buzz', chapter: 6, section: '6.2',
    intent: 'Print Fizz for multiples of 3, Buzz for 5, FizzBuzz for both.',
    code: rs`
fn main() {
    for n in [3, 5, 7, 15] {
        match (n % 3 == 0, n % 5 == 0) {
            (true, _) => println!("Fizz"),
            (false, true) => println!("Buzz"),
            (true, true) => println!("FizzBuzz"),
            (false, false) => println!("{n}"),
        }
    }
}`,
    line: 4,
    options: ['(true, true) => println!("Fizz"),', '(_, false) => println!("Fizz"),', '(true, false) => println!("Fizz"),', '(true, _) if n > 15 => println!("Fizz"),'],
    answer: 2,
    explain: '`(true, _)` also matches `(true, true)`, so 15 stops at “Fizz” and the FizzBuzz arm is unreachable. Make the first arm specific: `(true, false)`.',
    output: 'Fizz\nBuzz\n7\nFizzBuzz', actual: 'Fizz\nBuzz\n7\nFizz',
  },
  {
    id: 'eager-default', title: 'Loading for nothing', chapter: 6, section: '6.1',
    intent: 'Only load the default when there is no cached value.',
    code: rs`
fn fallback() -> u32 {
    println!("loading default...");
    42
}

fn main() {
    let cached = Some(7);
    let v = cached.unwrap_or(fallback());
    println!("value {v}");
}`,
    line: 8,
    options: ['let v = cached.or(Some(fallback())).unwrap();', 'let v = cached.map_or(fallback(), |x| x);', 'let v = cached.unwrap_or_else(fallback);', 'let v = cached.xor(Some(fallback())).unwrap();'],
    answer: 2,
    explain: 'Arguments are evaluated before the call, so `unwrap_or(fallback())` runs `fallback` even when there’s a value. `unwrap_or_else` takes a function and only calls it for `None`.',
    output: 'value 7', actual: 'loading default...\nvalue 7',
  },

  // ---------- Chapter 7: Packages, Crates, and Modules ----------
  {
    id: 'wrong-module', title: 'Hello in the wrong language', chapter: 7, section: '7.4',
    intent: 'This is the French build: greet in French.',
    code: rs`
mod en {
    pub fn greet() -> &'static str { "hello" }
}
mod fr {
    pub fn greet() -> &'static str { "bonjour" }
}

use en::greet;

fn main() {
    println!("{}", greet());
}`,
    line: 8,
    options: ['use self::en::greet;', 'use fr::greet;', 'use crate::en::greet;', 'use fr::greet as greet_fr;'],
    answer: 1,
    explain: 'Both modules have a `greet`, and `use` decides which one the short name means. `use en::greet` brings in the English one.',
    output: 'bonjour', actual: 'hello',
  },
  {
    id: 'glob-shadow', title: 'The helper next door', chapter: 7, section: '7.4',
    intent: 'Round to two decimal places with the helper from `util`.',
    code: rs`
mod util {
    pub fn round(x: f64) -> f64 {
        (x * 100.0).round() / 100.0
    }
}

use util::*;

fn round(x: f64) -> f64 {
    x.floor()
}

fn main() {
    println!("{}", round(2.346));
}`,
    line: 14,
    options: ['println!("{}", self::round(2.346));', 'println!("{}", crate::round(2.346));', 'println!("{}", util::round(2.346));', 'println!("{}", round(2.346).round());'],
    answer: 2,
    explain: 'A glob import (`use util::*`) never wins against an item defined in the same module, so `round` means the local one that floors. Spell out the path: `util::round`.',
    output: '2.35', actual: '2',
  },

  // ---------- Chapter 8: Common Collections ----------
  {
    id: 'swap-remove', title: 'Queue jumper', chapter: 8, section: '8.1',
    intent: 'Serve the first person in the queue; the next one waits at the front.',
    code: rs`
fn main() {
    let mut queue = vec!["ann", "bob", "cy", "dee"];
    let served = queue.swap_remove(0);
    println!("served {served}, next {}", queue[0]);
}`,
    line: 3,
    options: ['let served = queue.pop().unwrap();', 'let served = queue.swap_remove(1);', 'let served = queue.remove(0);', 'let served = queue.remove(queue.len() - 1);'],
    answer: 2,
    explain: '`swap_remove` is fast because it fills the gap with the last element, so “dee” jumps to the front. `remove` shifts everyone along and keeps the order.',
    output: 'served ann, next bob', actual: 'served ann, next dee',
  },
  {
    id: 'char-count', title: 'Four letters in Zoë', chapter: 8, section: '8.2',
    intent: 'Count the letters in the name.',
    code: rs`
fn main() {
    let name = "Zoë";
    println!("{} letters", name.len());
}`,
    line: 3,
    options: ['println!("{} letters", name.bytes().count());', 'println!("{} letters", name.chars().count());', 'println!("{} letters", name.as_bytes().len());', 'println!("{} letters", name.split(\' \').count());'],
    answer: 1,
    explain: '`len()` is the length in bytes. `ë` takes two bytes in UTF-8, so a three-letter name has length 4. `chars().count()` counts characters.',
    output: '3 letters', actual: '4 letters',
  },
  {
    id: 'bytes-rev', title: 'Reversed into mojibake', chapter: 8, section: '8.2',
    intent: 'Print the word backwards.',
    code: rs`
fn main() {
    let word = "héllo";
    let rev: String = word
        .bytes()
        .rev()
        .map(|b| b as char)
        .collect();
    println!("{rev}");
}`,
    line: 4,
    options: ['.char_indices()', '.chars()', '.bytes().rev()'],
    answer: 1,
    explain: 'Reversing bytes splits `é` (two bytes) apart and turns each byte into a separate, wrong character. Reverse the `chars()` instead.',
    output: 'olléh', actual: 'oll©Ãh',
  },
  {
    id: 'count-start', title: 'Counting from one', chapter: 8, section: '8.3',
    intent: 'Count how often each word appears.',
    code: rs`
use std::collections::HashMap;

fn main() {
    let text = "the cat and the hat";
    let mut counts = HashMap::new();
    for w in text.split(' ') {
        *counts.entry(w).or_insert(1) += 1;
    }
    println!("the: {}", counts["the"]);
}`,
    line: 7,
    options: ['counts.insert(w, 1);', '*counts.entry(w).or_insert(0) += 1;', '*counts.entry(w).or_insert(1) *= 2;', 'counts.entry(w).or_insert(0);'],
    answer: 1,
    explain: 'The first time a word shows up, `or_insert(1)` stores 1 and then `+= 1` makes it 2, so every count is one too high. Start at 0.',
    output: 'the: 2', actual: 'the: 3',
  },
  {
    id: 'hashmap-order', title: 'Alphabetical, sometimes', chapter: 8, section: '8.3',
    intent: 'List the fruit in alphabetical order.',
    code: rs`
use std::collections::HashMap;

fn main() {
    let mut stock = HashMap::new();
    stock.insert("pears", 3);
    stock.insert("apples", 5);
    stock.insert("figs", 2);
    for (fruit, n) in &stock {
        println!("{fruit}: {n}");
    }
}`,
    line: 4,
    options: ['let mut stock = HashMap::with_capacity(3);', 'let mut stock: HashMap<&str, i32> = HashMap::new();', 'let mut stock = std::collections::BTreeMap::new();', 'let mut stock = HashMap::new(); // sorted'],
    answer: 2,
    explain: 'A `HashMap` has no order, and Rust randomises it on purpose, so the output changes from run to run. A `BTreeMap` keeps its keys sorted.',
    output: 'apples: 5\nfigs: 2\npears: 3', actual: 'pears: 3\napples: 5\nfigs: 2', varies: true,
  },
  {
    id: 'split-spaces', title: 'Six words in three', chapter: 8, section: '8.2',
    intent: 'Count the words in the shopping list.',
    code: rs`
fn main() {
    let line = "add  milk   eggs";
    let words: Vec<&str> = line.split(' ').collect();
    println!("{} words", words.len());
}`,
    line: 3,
    options: ['let words: Vec<&str> = line.trim().split(\' \').collect();', 'let words: Vec<&str> = line.split_whitespace().collect();', 'let words: Vec<&str> = line.split_terminator(\' \').collect();', 'let words: Vec<&str> = line.split(\' \').rev().collect();'],
    answer: 1,
    explain: '`split(\' \')` splits at every space, so two spaces in a row produce an empty string between them. `split_whitespace()` treats any run of whitespace as one separator.',
    output: '3 words', actual: '6 words',
  },
  {
    id: 'string-sort', title: '100 before 9', chapter: 8, section: '8.2',
    intent: 'Sort the numbers from smallest to largest.',
    code: rs`
fn main() {
    let mut nums = vec!["10", "9", "100", "1"];
    nums.sort();
    println!("{nums:?}");
}`,
    line: 3,
    options: ['nums.sort_unstable();', 'nums.sort_by_key(|s| s.len());', 'nums.sort_by_key(|s| s.parse::<u32>().unwrap());', 'nums.reverse();'],
    answer: 2,
    explain: 'These are strings, and strings sort character by character like a dictionary: “100” comes before “9” because ‘1’ < ‘9’. Sort by the parsed number.',
    output: '["1", "9", "10", "100"]', actual: '["1", "10", "100", "9"]',
  },
  {
    id: 'case-sort', title: 'Capitals first', chapter: 8, section: '8.2',
    intent: 'Sort the names alphabetically, ignoring upper and lower case.',
    code: rs`
fn main() {
    let mut names = vec!["bob", "Alice", "carol", "Dave"];
    names.sort();
    println!("{names:?}");
}`,
    line: 3,
    options: ['names.sort_unstable();', 'names.sort_by(|a, b| b.cmp(a));', 'names.sort_by_key(|n| n.len());', 'names.sort_by_key(|n| n.to_lowercase());'],
    answer: 3,
    explain: 'String comparison uses character codes, and every capital letter comes before every lowercase one. Compare lowercased copies with `sort_by_key(|n| n.to_lowercase())`.',
    output: '["Alice", "bob", "carol", "Dave"]', actual: '["Alice", "Dave", "bob", "carol"]',
  },

  // ---------- Chapter 9: Error Handling ----------
  {
    id: 'parse-trim', title: 'A space that costs five', chapter: 9, section: '9.2',
    intent: 'Add up the numbers, treating lines that aren’t numbers as 0.',
    code: rs`
fn main() {
    let lines = ["4", " 5", "x", "6"];
    let mut sum = 0;
    for l in lines {
        sum += l.parse::<i32>().unwrap_or(0);
    }
    println!("sum = {sum}");
}`,
    line: 5,
    options: ['sum += l.trim_end().parse::<i32>().unwrap_or(0);', 'sum += l.parse::<i32>().unwrap_or(5);', 'sum += l.trim().parse::<i32>().unwrap_or(0);', 'sum += l.parse::<i32>().unwrap_or_default();'],
    answer: 2,
    explain: '`parse` doesn’t skip whitespace, so `" 5"` is an error and quietly becomes 0. `trim()` the input first.',
    output: 'sum = 15', actual: 'sum = 10',
  },
  {
    id: 'question-mark', title: 'Swallowed errors', chapter: 9, section: '9.2',
    intent: 'Parse every entry, and fail if any entry isn’t a number.',
    code: rs`
use std::num::ParseIntError;

fn parse_all(raw: &[&str]) -> Result<Vec<i32>, ParseIntError> {
    let mut out = Vec::new();
    for s in raw {
        let n = s.parse().unwrap_or_default();
        out.push(n);
    }
    Ok(out)
}

fn main() {
    println!("{:?}", parse_all(&["1", "2", "three"]));
}`,
    line: 6,
    options: ['let n = s.parse().unwrap_or(-1);', 'let n = s.parse()?;', 'let n = s.parse().ok()?;', 'let n = s.parse().unwrap();'],
    answer: 1,
    explain: '`unwrap_or_default()` turns the error into 0, so the caller never finds out. The `?` operator returns the error from `parse_all` straight away.',
    output: 'Err(ParseIntError { kind: InvalidDigit })', actual: 'Ok([1, 2, 0])',
  },
  {
    id: 'age-check', title: 'Every age is fine', chapter: 9, section: '9.3',
    intent: 'Reject ages below 0 or above 150.',
    code: rs`
fn check_age(age: i32) -> Result<i32, String> {
    if age < 0 && age > 150 {
        return Err(format!("{age} is not an age"));
    }
    Ok(age)
}

fn main() {
    for a in [30, -1, 200] {
        println!("{:?}", check_age(a));
    }
}`,
    line: 2,
    options: ['if age > 0 && age < 150 {', 'if age < 0 || age > 150 {', 'if !(age < 0 && age > 150) {', 'if age < 0 && age >= 150 {'],
    answer: 1,
    explain: 'No number is below 0 and above 150 at the same time, so the check never fires. Either condition alone should reject the age: use `||`.',
    output: 'Ok(30)\nErr("-1 is not an age")\nErr("200 is not an age")', actual: 'Ok(30)\nOk(-1)\nOk(200)',
  },

  // ---------- Chapter 10: Generic Types, Traits, and Lifetimes ----------
  {
    id: 'debug-display', title: 'Price in Debug', chapter: 10, section: '10.2',
    intent: 'Print the price formatted as dollars and cents.',
    code: rs`
use std::fmt;

#[derive(Debug)]
struct Money(u32);

impl fmt::Display for Money {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "\${}.{:02}", self.0 / 100, self.0 % 100)
    }
}

fn main() {
    let price = Money(1999);
    println!("price: {price:?}");
}`,
    line: 14,
    options: ['println!("price: {price:#?}");', 'println!("price: {price}");', 'println!("price: {:?}", price.to_string());', 'println!("price: {}", price.0);'],
    answer: 1,
    explain: '`{:?}` uses the derived `Debug` impl, which prints the struct as it is. `{}` uses the `Display` impl you wrote.',
    output: 'price: $19.99', actual: 'price: Money(1999)',
  },
  {
    id: 'longest-tie', title: 'A tie goes to the last', chapter: 10, section: '10.3',
    intent: 'Find the longest word; on a tie, keep the one that came first.',
    code: rs`
fn longer<'a>(a: &'a str, b: &'a str) -> &'a str {
    if b.len() >= a.len() { b } else { a }
}

fn main() {
    let mut best = "";
    for w in ["tide", "crab", "shell", "coral", "sea"] {
        best = longer(best, w);
    }
    println!("{best}");
}`,
    line: 2,
    options: ['if a.len() > b.len() { a } else { b }', 'if b.len() > a.len() { b } else { a }', 'if b.len() >= a.len() { a } else { b }', 'if b.len() < a.len() { b } else { a }'],
    answer: 1,
    explain: 'With `>=`, a word of equal length replaces the current best, so “coral” overtakes “shell”. A strict `>` keeps the earlier word on a tie.',
    output: 'shell', actual: 'coral',
  },
  {
    id: 'square-area', title: 'A square with a linear area', chapter: 10, section: '10.2',
    intent: 'Describe a 3 × 3 square by its area.',
    code: rs`
trait Shape {
    fn area(&self) -> f64;
    fn describe(&self) -> String {
        format!("area {:.1}", self.area())
    }
}

struct Square(f64);

impl Shape for Square {
    fn area(&self) -> f64 {
        self.0 * 2.0
    }
}

fn main() {
    println!("{}", Square(3.0).describe());
}`,
    line: 12,
    options: ['self.0 * 2.0 * 2.0', 'self.0.powi(2)', 'self.0.sqrt()', '2.0_f64.powf(self.0)'],
    answer: 1,
    explain: 'The default `describe` method trusts `area()`, and `area` doubles the side instead of squaring it. A square’s area is side × side, `self.0.powi(2)`.',
    output: 'area 9.0', actual: 'area 6.0',
  },

  // ---------- Chapter 12: An I/O Project ----------
  {
    id: 'case-insensitive', title: 'Half case-insensitive', chapter: 12, section: '12.5',
    intent: 'Find every line containing “rust”, in any case.',
    code: rs`
fn search<'a>(query: &str, text: &'a str) -> Vec<&'a str> {
    let query = query.to_lowercase();
    let mut hits = Vec::new();
    for line in text.lines() {
        if line.contains(&query) {
            hits.push(line);
        }
    }
    hits
}

fn main() {
    let text = "Rust is fast.\n\
                Trust the borrow checker.\n\
                RUST is fun.";
    for hit in search("rust", text) {
        println!("{hit}");
    }
}`,
    line: 5,
    options: ['if line.contains(&query.to_uppercase()) {', 'if line.starts_with(&query) {', 'if line.to_lowercase().contains(&query) {', 'if line.to_lowercase().starts_with(&query) {'],
    answer: 2,
    explain: 'Only the query is lowercased, so “Rust” and “RUST” don’t contain “rust”. Lowercase each line before comparing, as the Book’s `search_case_insensitive` does.',
    output: 'Rust is fast.\nTrust the borrow checker.\nRUST is fun.', actual: 'Trust the borrow checker.',
  },
  {
    id: 'args-zero', title: 'Searching for itself', chapter: 12, section: '12.1',
    intent: 'Read the search word and file name from the arguments.',
    code: rs`
fn main() {
    // What std::env::args() gives for:
    // minigrep needle poem.txt
    let args = vec!["minigrep", "needle", "poem.txt"];
    let query = args[0];
    let file = args[2];
    println!("Searching for {query} in {file}");
}`,
    line: 5,
    options: ['let query = args[1];', 'let query = args[2];', 'let query = args.len();', 'let query = args.last().unwrap();'],
    answer: 0,
    explain: 'The first argument, `args[0]`, is the program’s own name. What the user typed starts at `args[1]`.',
    output: 'Searching for needle in poem.txt', actual: 'Searching for minigrep in poem.txt',
  },

  // ---------- Chapter 13: Iterators and Closures ----------
  {
    id: 'lazy-map', title: 'Nothing happened', chapter: 13, section: '13.2',
    intent: 'Log an uppercase copy of each item.',
    code: rs`
fn main() {
    let mut log = Vec::new();
    let items = ["a", "b", "c"];
    items.iter().map(|i| log.push(i.to_uppercase()));
    println!("{log:?}");
}`,
    line: 4,
    options: ['let _ = items.iter().map(|i| log.push(i.to_uppercase()));', 'items.iter().for_each(|i| log.push(i.to_uppercase()));', 'items.iter().map(|i| log.push(i.to_uppercase())).rev();', 'items.iter().filter(|i| { log.push(i.to_uppercase()); true });'],
    answer: 1,
    explain: 'Iterator adapters like `map` are lazy: they do nothing until something consumes them, and nothing does here (the compiler warns about it). `for_each` consumes the iterator and runs the closure for each item.',
    output: '["A", "B", "C"]', actual: '[]',
  },
  {
    id: 'move-copy', title: 'Ticks on a copy', chapter: 13, section: '13.1',
    intent: 'Count how many times `tick` was called.',
    code: rs`
fn main() {
    let mut count = 0;
    let mut tick = move || {
        count += 1;
        count
    };
    tick();
    tick();
    println!("ticks: {count}");
}`,
    line: 3,
    options: ['let mut tick = || {', 'let tick = move || {', 'let mut tick = move || -> i32 {'],
    answer: 0,
    explain: '`move` makes the closure take its own copy of `count` (an integer is `Copy`), so it counts on that copy and the outer `count` stays 0. Without `move`, the closure borrows `count` and changes it.',
    output: 'ticks: 2', actual: 'ticks: 0',
  },
  {
    id: 'take-while', title: 'Stopped at the first cold day', chapter: 13, section: '13.2',
    intent: 'Keep every temperature above 20.',
    code: rs`
fn main() {
    let temps = [18, 21, 25, 19, 27];
    let warm: Vec<i32> = temps
        .into_iter()
        .take_while(|&t| t > 20)
        .collect();
    println!("{warm:?}");
}`,
    line: 5,
    options: ['.skip_while(|&t| t > 20)', '.filter(|&t| t > 20)', '.take_while(|&t| t >= 20)', '.skip_while(|&t| t <= 20)'],
    answer: 1,
    explain: '`take_while` stops for good at the first item that fails, and 18 fails straight away. `filter` checks every item.',
    output: '[21, 25, 27]', actual: '[]',
  },
  {
    id: 'max-tie', title: 'The later winner', chapter: 13, section: '13.2',
    intent: 'Pick the top score; on a tie, the player who scored first wins.',
    code: rs`
fn main() {
    let scores = [("ana", 9), ("ben", 7), ("cat", 9)];
    let top = scores.iter().max_by_key(|s| s.1).unwrap();
    println!("winner: {}", top.0);
}`,
    line: 3,
    options: ['let top = scores.iter().min_by_key(|s| s.1).unwrap();', 'let top = scores.iter().max_by(|a, b| a.1.cmp(&b.1)).unwrap();', 'let top = scores.iter().rev().max_by_key(|s| s.1).unwrap();', 'let top = scores.iter().max_by_key(|s| s.0).unwrap();'],
    answer: 2,
    explain: 'When several items share the maximum, `max_by_key` returns the last one. Reversing first makes the earliest player the last one it sees.',
    output: 'winner: ana', actual: 'winner: cat',
  },
  {
    id: 'sum-u8', title: 'Overflowing a byte', chapter: 13, section: '13.2',
    intent: 'Add up the byte values.',
    code: rs`
fn main() {
    let bytes: [u8; 3] = [200, 100, 50];
    let total: u8 = bytes.iter().sum();
    println!("total: {total}");
}`,
    line: 3,
    options: ['let total: u32 = bytes.iter().sum();', 'let total = bytes.iter().fold(0u8, |a, &b| a.wrapping_add(b));', 'let total: u32 = bytes.iter().map(|&b| b as u32).sum();', 'let total: u8 = bytes.iter().map(|&b| b.saturating_add(0)).sum();'],
    answer: 2,
    explain: 'The sum has the type you ask for, and a `u8` tops out at 255. In a debug build the overflow panics; in release it would wrap to 94. Widen each byte before adding.',
    output: 'total: 350', actual: '', panic: 'attempt to add with overflow',
  },

  // ---------- Chapter 15: Smart Pointers ----------
  {
    id: 'rc-clone', title: 'A share that isn’t shared', chapter: 15, section: '15.5',
    intent: 'Push to the shared list through a second handle.',
    code: rs`
use std::cell::RefCell;
use std::rc::Rc;

fn main() {
    let shared = Rc::new(RefCell::new(vec![1]));
    let other = Rc::new((*shared).clone());
    other.borrow_mut().push(2);
    println!("{:?}", shared.borrow());
}`,
    line: 6,
    options: ['let other = Rc::new(RefCell::clone(&shared));', 'let other = Rc::clone(&shared);', 'let other = Rc::new(shared.as_ref().clone());', 'let other = Rc::new(shared.take().into());'],
    answer: 1,
    explain: '`(*shared).clone()` clones the `RefCell` and the vector inside it, and the new `Rc` owns that separate copy. `Rc::clone(&shared)` copies only the pointer, so both handles point at the same list.',
    output: '[1, 2]', actual: '[1]',
  },
  {
    id: 'drop-underscore', title: 'Done before it started', chapter: 15, section: '15.3',
    intent: 'The timer should report “done” after loading has finished.',
    code: rs`
struct Timer(&'static str);

impl Drop for Timer {
    fn drop(&mut self) {
        println!("{} done", self.0);
    }
}

fn main() {
    let _ = Timer("load");
    println!("loading...");
}`,
    line: 10,
    options: ['drop(Timer("load"));', 'Timer("load");', 'let _timer = Timer("load");', 'let _ = Timer("load").0;'],
    answer: 2,
    explain: '`let _ = …` doesn’t bind anything, so the value is dropped right away. A name, even one starting with an underscore like `_timer`, keeps it alive until the end of the scope.',
    output: 'loading...\nload done', actual: 'load done\nloading...',
  },
  {
    id: 'rc-ptr-eq', title: 'Same text, different box', chapter: 15, section: '15.4',
    intent: 'Tell whether both handles point to the same allocation.',
    code: rs`
use std::rc::Rc;

fn main() {
    let a = Rc::new(String::from("config"));
    let b = Rc::new(String::from("config"));
    if a == b {
        println!("shared");
    } else {
        println!("separate copies");
    }
}`,
    line: 6,
    options: ['if *a == *b {', 'if a.as_str() == b.as_str() {', 'if Rc::ptr_eq(&a, &b) {', 'if Rc::strong_count(&a) == Rc::strong_count(&b) {'],
    answer: 2,
    explain: '`==` on two `Rc`s compares the values inside, and both hold “config”. `Rc::ptr_eq` asks whether they point to the same allocation.',
    output: 'separate copies', actual: 'shared',
  },

  // ---------- Chapter 16: Fearless Concurrency ----------
  {
    id: 'arc-new', title: 'Four threads, zero count', chapter: 16, section: '16.3',
    intent: 'Four threads each add 1 to a shared counter.',
    code: rs`
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];
    for _ in 0..4 {
        let c = Arc::new(Mutex::new(*counter.lock().unwrap()));
        handles.push(thread::spawn(move || {
            *c.lock().unwrap() += 1;
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    println!("count = {}", *counter.lock().unwrap());
}`,
    line: 8,
    options: ['let c = Arc::new(Mutex::new(0));', 'let c = Arc::clone(&counter);', 'let c = Arc::downgrade(&counter);', 'let c = Arc::new(counter.lock().unwrap().clone());'],
    answer: 1,
    explain: 'Each thread gets a brand-new mutex holding a copy of the number, so the shared counter is never touched. `Arc::clone` gives each thread a handle to the same mutex.',
    output: 'count = 4', actual: 'count = 0',
  },

  // ---------- Chapter 19: Patterns and Matching ----------
  {
    id: 'slice-pattern', title: 'Never “just one”', chapter: 19, section: '19.3',
    intent: 'Describe a list as empty, a single item, or by its first item.',
    code: rs`
fn describe(v: &[i32]) -> String {
    match v {
        [] => "empty".to_string(),
        [x, ..] => format!("starts with {x}"),
        [x] => format!("just {x}"),
    }
}

fn main() {
    println!("{}", describe(&[7]));
    println!("{}", describe(&[1, 2, 3]));
    println!("{}", describe(&[]));
}`,
    line: 4,
    options: ['[.., x] => format!("starts with {x}"),', '[x, rest @ ..] => format!("starts with {x}"),', '[x, _, ..] => format!("starts with {x}"),', '[x, ..] if !v.is_empty() => format!("starts with {x}"),'],
    answer: 2,
    explain: '`..` can match zero elements, so `[x, ..]` also matches a one-item slice and the `[x]` arm below is unreachable. `[x, _, ..]` needs at least two items.',
    output: 'just 7\nstarts with 1\nempty', actual: 'starts with 7\nstarts with 1\nempty',
  },
  {
    id: 'at-binding', title: 'Teenagers, all of them', chapter: 19, section: '19.3',
    intent: 'Sort ages into child (0–12), teen (13–19) and adult.',
    code: rs`
fn group(age: u32) -> String {
    match age {
        a @ 0..=12 => format!("{a}: child"),
        a @ 13.. => format!("{a}: teen"),
        a => format!("{a}: adult"),
    }
}

fn main() {
    for age in [8, 15, 42] {
        println!("{}", group(age));
    }
}`,
    line: 4,
    options: ['a @ 13..=19 => format!("{a}: teen"),', 'a @ 13 | 19 => format!("{a}: teen"),', 'a @ 13..=99 => format!("{a}: teen"),', 'a @ 14.. => format!("{a}: teen"),'],
    answer: 0,
    explain: '`13..` has no upper end, so it takes 42 as well and the `adult` arm never runs. Bound it: `13..=19`.',
    output: '8: child\n15: teen\n42: adult', actual: '8: child\n15: teen\n42: teen',
  },
];
