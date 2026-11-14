//! Counts the words in a text.
//! Reference solution for the `wordfreq` build-along (not shipped in the app).

use std::collections::HashMap;

fn is_apostrophe(c: char) -> bool {
    c == '\'' || c == '’'
}

/// The words of `text`, lowercased.
pub fn words(text: &str) -> Vec<String> {
    text.split(|c: char| !(c.is_alphanumeric() || is_apostrophe(c)))
        .map(|w| w.trim_matches(is_apostrophe))
        .filter(|w| !w.is_empty())
        .map(|w| w.to_lowercase())
        .collect()
}

/// How often each word appears.
pub fn count(text: &str) -> HashMap<String, usize> {
    let mut counts = HashMap::new();
    for w in words(text) {
        *counts.entry(w).or_insert(0) += 1;
    }
    counts
}

/// The `n` most frequent words, most frequent first; ties in alphabetical order.
pub fn top(counts: &HashMap<String, usize>, n: usize) -> Vec<(String, usize)> {
    let mut all: Vec<(String, usize)> = counts.iter().map(|(w, c)| (w.clone(), *c)).collect();
    all.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    all.truncate(n);
    all
}

/// Removes the given words (matched without regard to case).
pub fn remove_stop_words(counts: &mut HashMap<String, usize>, stop: &[&str]) {
    for w in stop {
        counts.remove(&w.to_lowercase());
    }
}

#[derive(Debug, PartialEq)]
pub struct Stats {
    /// Words in the text, repeats included.
    pub total: usize,
    /// Different words.
    pub unique: usize,
    /// The longest word (in characters); the alphabetically first one on a tie.
    pub longest: Option<String>,
}

pub fn stats(text: &str) -> Stats {
    let ws = words(text);
    let counts = count(text);
    let mut longest: Option<&String> = None;
    for w in counts.keys() {
        longest = match longest {
            None => Some(w),
            Some(l) => {
                let (wl, ll) = (w.chars().count(), l.chars().count());
                if wl > ll || (wl == ll && w < l) { Some(w) } else { Some(l) }
            }
        };
    }
    Stats { total: ws.len(), unique: counts.len(), longest: longest.cloned() }
}

/// A bar chart: one line per entry, `word  ##### 5`.
pub fn histogram(entries: &[(String, usize)], width: usize) -> String {
    let max = entries.iter().map(|(_, c)| *c).max().unwrap_or(0);
    let pad = entries.iter().map(|(w, _)| w.chars().count()).max().unwrap_or(0);
    entries
        .iter()
        .map(|(w, c)| {
            let len = if *c == 0 { 0 } else { (c * width / max).max(1) };
            format!("{w:<pad$} {} {c}", "#".repeat(len))
        })
        .collect::<Vec<_>>()
        .join("\n")
}
