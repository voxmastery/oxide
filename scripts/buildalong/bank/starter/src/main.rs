// `cargo run`, then type commands:
//   open Ada · deposit 1 12.50 · withdraw 1 3 · transfer 1 2 5.25 · show 1 · quit
// This file works once the library is built.

use std::io::{self, BufRead, Write};

use bank::{Bank, BankError, format_cents};

/// "12", "12.5" or "12.50" → cents (a leading `-` makes it negative).
fn parse_amount(s: &str) -> Option<i64> {
    let (negative, s) = match s.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, s),
    };
    let (whole, frac) = s.split_once('.').unwrap_or((s, ""));
    let digits = |x: &str| x.chars().all(|c| c.is_ascii_digit());
    if whole.is_empty() || !digits(whole) || frac.len() > 2 || !digits(frac) {
        return None;
    }
    let whole: i64 = whole.parse().ok()?;
    let frac: i64 = format!("{frac:0<2}").parse().ok()?;
    let cents = whole.checked_mul(100)?.checked_add(frac)?;
    Some(if negative { -cents } else { cents })
}

fn id(s: &str) -> Option<u32> {
    s.parse().ok()
}

fn main() {
    let mut bank = Bank::new();
    println!("Commands: open <name>, deposit <id> <amount>, withdraw <id> <amount>,");
    println!("transfer <from> <to> <amount>, show <id>, quit");
    let stdin = io::stdin();
    loop {
        print!("> ");
        io::stdout().flush().unwrap();
        let mut line = String::new();
        if stdin.lock().read_line(&mut line).unwrap() == 0 {
            break;
        }
        let words: Vec<&str> = line.split_whitespace().collect();
        let result: Result<String, BankError> = match words.as_slice() {
            ["quit"] => break,
            ["open", name] => {
                let n = bank.open(name);
                Ok(format!("Opened account {n} for {name}"))
            }
            ["deposit", i, a] => match (id(i), parse_amount(a)) {
                (Some(i), Some(a)) => bank.deposit(i, a).map(|_| format!("Deposited {}", format_cents(a))),
                _ => Ok("usage: deposit <id> <amount>".to_string()),
            },
            ["withdraw", i, a] => match (id(i), parse_amount(a)) {
                (Some(i), Some(a)) => bank.withdraw(i, a).map(|_| format!("Withdrew {}", format_cents(a))),
                _ => Ok("usage: withdraw <id> <amount>".to_string()),
            },
            ["transfer", f, t, a] => match (id(f), id(t), parse_amount(a)) {
                (Some(f), Some(t), Some(a)) => bank.transfer(f, t, a).map(|_| format!("Moved {}", format_cents(a))),
                _ => Ok("usage: transfer <from> <to> <amount>".to_string()),
            },
            ["show", i] => match id(i).and_then(|i| bank.account(i)) {
                Some(acc) => Ok(format!("{acc}\n{}", acc.statement())),
                None => Ok(format!("no account {i}")),
            },
            [] => continue,
            _ => Ok("unknown command".to_string()),
        };
        match result {
            Ok(msg) => println!("{msg}"),
            Err(e) => println!("error: {e}"),
        }
    }
}
