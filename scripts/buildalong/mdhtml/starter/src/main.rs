// `cargo run -- notes.md` prints notes.md as HTML; `cargo run -- notes.md notes.html` writes
// it to a file. This file works once the library is built.

use std::env;
use std::fs;
use std::process;

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let input = args.first().map(String::as_str).unwrap_or("notes.md");
    let src = fs::read_to_string(input).unwrap_or_else(|e| {
        eprintln!("error: can’t read {input}: {e}");
        process::exit(1);
    });
    let html = mdhtml::to_html(&src);
    match args.get(1) {
        Some(out) => {
            fs::write(out, html + "\n").unwrap_or_else(|e| {
                eprintln!("error: can’t write {out}: {e}");
                process::exit(1);
            });
            println!("Wrote {out}");
        }
        None => println!("{html}"),
    }
}
