// `cargo run` shows a glider crossing a small world whose edges wrap around.
// `cargo run -- pattern.txt 30` runs your own picture for 30 generations.
// This file works once the library is built.

use std::env;
use std::fs;
use std::process;

use life::Grid;

const GLIDER: &str = "
    .#......
    ..#.....
    ###.....
    ........
    ........
    ........
    ........
    ........
";

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let picture = match args.first() {
        Some(path) => fs::read_to_string(path).unwrap_or_else(|e| {
            eprintln!("error: can’t read {path}: {e}");
            process::exit(1);
        }),
        None => GLIDER.to_string(),
    };
    let generations: usize = args.get(1).and_then(|n| n.parse().ok()).unwrap_or(12);
    let mut grid = match Grid::parse(&picture) {
        Ok(g) => g.with_wrap(true),
        Err(e) => {
            eprintln!("error: {e:?}");
            process::exit(1);
        }
    };
    for generation in 0..=generations {
        println!("Generation {generation} · {} alive", grid.population());
        println!("{grid}");
        println!();
        grid = grid.step();
    }
    match grid.period(100) {
        Some(p) => println!("It repeats every {p} generation{}.", if p == 1 { "" } else { "s" }),
        None => println!("No repeat within 100 generations."),
    }
}
