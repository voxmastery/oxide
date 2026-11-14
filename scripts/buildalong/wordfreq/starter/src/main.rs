// `cargo run -- poem.txt` counts the words in a file; `cargo run` reads what you type
// (end with an empty line). This file works once the library is built.

use std::env;
use std::fs;
use std::io::{self, BufRead};
use std::process;

use wordfreq::{count, histogram, remove_stop_words, stats, top};

const STOP: &[&str] = &["a", "an", "and", "the", "of", "to", "in", "is", "it", "that", "i", "you"];

fn main() {
    let text = match env::args().nth(1) {
        Some(path) => fs::read_to_string(&path).unwrap_or_else(|e| {
            eprintln!("error: can’t read {path}: {e}");
            process::exit(1);
        }),
        None => {
            println!("Type or paste some text, then an empty line:");
            let mut text = String::new();
            for line in io::stdin().lock().lines() {
                let line = line.expect("stdin");
                if line.is_empty() {
                    break;
                }
                text.push_str(&line);
                text.push('\n');
            }
            text
        }
    };

    let s = stats(&text);
    println!("{} words, {} different", s.total, s.unique);
    if let Some(w) = s.longest {
        println!("longest: {w}");
    }
    let mut counts = count(&text);
    remove_stop_words(&mut counts, STOP);
    println!();
    println!("{}", histogram(&top(&counts, 10), 30));
}
