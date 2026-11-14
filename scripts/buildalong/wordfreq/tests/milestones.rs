// Milestone tests for the wordfreq build-along. Run one milestone with
// `cargo test --test milestones m3_`. Oxide puts this file back the way it was before each
// "Check milestone", so add your own tests in another file.

use std::collections::HashMap;

use wordfreq::{Stats, count, histogram, remove_stop_words, stats, top, words};

fn map(pairs: &[(&str, usize)]) -> HashMap<String, usize> {
    pairs.iter().map(|(w, c)| (w.to_string(), *c)).collect()
}

fn owned(pairs: &[(&str, usize)]) -> Vec<(String, usize)> {
    pairs.iter().map(|(w, c)| (w.to_string(), *c)).collect()
}

// ---- Milestone 1: split into words -----------------------------------------------------

#[test]
fn m1_splits_on_punctuation_and_lowercases() {
    assert_eq!(words("Hello, world! Hello."), vec!["hello", "world", "hello"]);
}

#[test]
fn m1_keeps_apostrophes_inside_words() {
    assert_eq!(words("Don't panic"), vec!["don't", "panic"]);
    assert_eq!(words("'Tis the season'"), vec!["tis", "the", "season"]);
    assert_eq!(words("I’m sure it’s fine"), vec!["i’m", "sure", "it’s", "fine"]);
}

#[test]
fn m1_numbers_and_accents_are_word_characters() {
    assert_eq!(words("Rust 2024 edition"), vec!["rust", "2024", "edition"]);
    assert_eq!(words("Crème BRÛLÉE"), vec!["crème", "brûlée"]);
}

#[test]
fn m1_hyphens_and_underscores_split() {
    assert_eq!(words("well-known snake_case"), vec!["well", "known", "snake", "case"]);
}

#[test]
fn m1_no_words() {
    assert!(words("").is_empty());
    assert!(words("  ... --- !!! ''  ").is_empty());
}

// ---- Milestone 2: count them -----------------------------------------------------------

#[test]
fn m2_counts_each_word() {
    assert_eq!(count("the cat and the hat"), map(&[("the", 2), ("cat", 1), ("and", 1), ("hat", 1)]));
}

#[test]
fn m2_case_does_not_matter() {
    assert_eq!(count("Rust rust RUST, rust!"), map(&[("rust", 4)]));
}

#[test]
fn m2_empty_text() {
    assert!(count("").is_empty());
}

// ---- Milestone 3: the most frequent ----------------------------------------------------

#[test]
fn m3_most_frequent_first() {
    let c = count("b a c b a b");
    assert_eq!(top(&c, 3), owned(&[("b", 3), ("a", 2), ("c", 1)]));
    assert_eq!(top(&c, 1), owned(&[("b", 3)]));
}

#[test]
fn m3_ties_are_alphabetical() {
    let c = count("pear fig apple fig apple pear kiwi");
    assert_eq!(top(&c, 4), owned(&[("apple", 2), ("fig", 2), ("pear", 2), ("kiwi", 1)]));
}

#[test]
fn m3_n_larger_or_zero() {
    let c = count("one two two");
    assert_eq!(top(&c, 10), owned(&[("two", 2), ("one", 1)]));
    assert!(top(&c, 0).is_empty());
}

// ---- Milestone 4: stop words -----------------------------------------------------------

#[test]
fn m4_removes_stop_words() {
    let mut c = count("The cat and THE hat");
    remove_stop_words(&mut c, &["the", "and"]);
    assert_eq!(c, map(&[("cat", 1), ("hat", 1)]));
}

#[test]
fn m4_stop_words_match_any_case() {
    let mut c = count("cats and dogs");
    remove_stop_words(&mut c, &["AND", "Of", "missing"]);
    assert_eq!(c, map(&[("cats", 1), ("dogs", 1)]));
}

// ---- Milestone 5: stats ----------------------------------------------------------------

#[test]
fn m5_stats_of_a_sentence() {
    assert_eq!(
        stats("The quick brown fox jumps over the lazy dog"),
        Stats { total: 9, unique: 8, longest: Some("brown".to_string()) }
    );
}

#[test]
fn m5_longest_counts_characters() {
    // "naïve" is 5 characters but 6 bytes; on a tie the alphabetically first word wins.
    assert_eq!(stats("naïve abcde").longest, Some("abcde".to_string()));
    assert_eq!(stats("naïve abcd").longest, Some("naïve".to_string()));
}

#[test]
fn m5_empty_text() {
    assert_eq!(stats(""), Stats { total: 0, unique: 0, longest: None });
}

// ---- Milestone 6: a bar chart ----------------------------------------------------------

#[test]
fn m6_histogram() {
    let h = histogram(&owned(&[("the", 4), ("cat", 2), ("a", 1)]), 8);
    assert_eq!(h, "the ######## 4\ncat #### 2\na   ## 1");
}

#[test]
fn m6_every_bar_has_at_least_one() {
    let h = histogram(&owned(&[("x", 100), ("y", 1)]), 10);
    assert_eq!(h, "x ########## 100\ny # 1");
}

#[test]
fn m6_pads_by_characters() {
    let h = histogram(&owned(&[("née", 2), ("ab", 1)]), 4);
    assert_eq!(h, "née #### 2\nab  ## 1");
}

#[test]
fn m6_empty_chart() {
    assert_eq!(histogram(&[], 10), "");
}
