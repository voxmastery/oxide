// `cargo run -- add Buy oat milk`, `cargo run -- done 1`, `cargo run -- rm 1`, `cargo run`.
// The list lives in todo.txt next to Cargo.toml. This file works once the library is built.

use std::env;
use std::process;

use todo::{TodoError, TodoList, parse_args, run};

const FILE: &str = "todo.txt";

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if let Err(e) = try_main(&args) {
        eprintln!("error: {e}");
        process::exit(1);
    }
}

fn try_main(args: &[String]) -> Result<(), TodoError> {
    let cmd = parse_args(args)?;
    let mut list = TodoList::load(FILE)?;
    let out = run(&mut list, cmd)?;
    list.save(FILE)?;
    println!("{out}");
    Ok(())
}
