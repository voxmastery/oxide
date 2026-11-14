//! Counts the words in a text.
//!
//! Each `todo!()` is yours to replace. Build one milestone at a time and check it with
//! `cargo test --test milestones m1_` (then `m2_`, `m3_`…).

// The stubs don't use their arguments, imports or fields yet. Delete this line once every todo!() is gone.
#![allow(unused_variables, unused_imports, dead_code)]

use std::collections::HashMap;

/// Milestone 1: the words of `text`, lowercased, in order.
///
/// A word is a run of letters, digits and apostrophes (`'` or the curly `’`); everything else
/// separates words. Apostrophes at the start or end of a word are trimmed off, so `'Tis` is
/// `tis` and `don't` stays `don't`. `char::is_alphanumeric` knows about `é` and friends.
pub fn words(text: &str) -> Vec<String> {
    todo!()
}

/// Milestone 2: how many times each word appears.
pub fn count(text: &str) -> HashMap<String, usize> {
    todo!()
}

/// Milestone 3: the `n` most frequent words with their counts, most frequent first.
/// Words with the same count come in alphabetical order.
pub fn top(counts: &HashMap<String, usize>, n: usize) -> Vec<(String, usize)> {
    todo!()
}

/// Milestone 4: takes the stop words (`the`, `and`…) out of `counts`. They match whatever
/// their case: `"The"` in `stop` removes `the`.
pub fn remove_stop_words(counts: &mut HashMap<String, usize>, stop: &[&str]) {
    todo!()
}

#[derive(Debug, PartialEq)]
pub struct Stats {
    /// Words in the text, repeats included.
    pub total: usize,
    /// Different words.
    pub unique: usize,
    /// The longest word, counted in characters (not bytes). On a tie, the one that comes
    /// first alphabetically. `None` for a text with no words.
    pub longest: Option<String>,
}

/// Milestone 5: a few numbers about the text.
pub fn stats(text: &str) -> Stats {
    todo!()
}

/// Milestone 6: a bar chart of `entries`, one line per entry, lines joined with `\n`:
///
/// ```text
/// the ######## 4
/// cat #### 2
/// a   ## 1
/// ```
///
/// Words are padded on the right to the longest word (in characters), then a space, the
/// bar, a space and the count. The largest count gets `width` `#`s; the others get
/// `count * width / largest` (rounded down), but never less than one.
pub fn histogram(entries: &[(String, usize)], width: usize) -> String {
    todo!()
}
