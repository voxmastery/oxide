//! A tiny bank: accounts, a ledger and transfers. Money is counted in cents (`i64`), so
//! `1250` is 12.50 and there are no rounding surprises.
//!
//! Each `todo!()` is yours to replace. Build one milestone at a time and check it with
//! `cargo test --test milestones m1_` (then `m2_`, `m3_`…).

// The stubs don't use their arguments, imports or fields yet. Delete this line once every todo!() is gone.
#![allow(unused_variables, unused_imports, dead_code)]

use std::collections::HashMap;
use std::fmt;

/// One line of an account's history.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Transaction {
    Deposit(i64),
    Withdrawal(i64),
}

/// Everything that can go wrong.
#[derive(Debug, PartialEq)]
pub enum BankError {
    /// Amounts must be more than zero.
    InvalidAmount(i64),
    InsufficientFunds { needed: i64, available: i64 },
    AccountNotFound(u32),
    SameAccount,
}

/// Milestone 6: cents as money: `1234` → `"12.34"`, `5` → `"0.05"`, `-250` → `"-2.50"`.
pub fn format_cents(cents: i64) -> String {
    todo!()
}

impl fmt::Display for BankError {
    /// Milestone 6:
    /// - `InvalidAmount(-5)` → `invalid amount: -0.05`
    /// - `InsufficientFunds { needed: 1000, available: 250 }` →
    ///   `insufficient funds: needed 10.00, available 2.50`
    /// - `AccountNotFound(7)` → `no account with id 7`
    /// - `SameAccount` → `can’t transfer to the same account`
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        todo!()
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Account {
    owner: String,
    balance: i64,
    history: Vec<Transaction>,
}

impl Account {
    /// Milestone 1: a new, empty account.
    pub fn new(owner: &str) -> Account {
        todo!()
    }

    /// Milestone 1
    pub fn owner(&self) -> &str {
        todo!()
    }

    /// Milestone 1: the balance in cents.
    pub fn balance(&self) -> i64 {
        todo!()
    }

    /// Milestone 1: adds money. Milestone 2: an amount of zero or less is
    /// `Err(BankError::InvalidAmount(amount))` and changes nothing.
    /// Milestone 3: a deposit that worked is recorded in the history.
    pub fn deposit(&mut self, amount: i64) -> Result<(), BankError> {
        todo!()
    }

    /// Milestone 2: takes money out. Zero or less is `InvalidAmount`; more than the balance is
    /// `InsufficientFunds { needed: amount, available: balance }`. Either way nothing changes.
    /// Milestone 3: a withdrawal that worked is recorded in the history.
    pub fn withdraw(&mut self, amount: i64) -> Result<(), BankError> {
        todo!()
    }

    /// Milestone 3: every deposit and withdrawal that worked, oldest first.
    pub fn history(&self) -> &[Transaction] {
        todo!()
    }

    /// Milestone 7: one line per transaction (`+12.50` for a deposit, `-3.00` for a
    /// withdrawal), then `balance 9.50`. Lines joined with `\n`, no `\n` at the end.
    pub fn statement(&self) -> String {
        todo!()
    }
}

impl fmt::Display for Account {
    /// Milestone 6: `Ada: 12.50`
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        todo!()
    }
}

/// Many accounts, by id. Ids start at 1.
#[derive(Debug)]
pub struct Bank {
    accounts: HashMap<u32, Account>,
    next_id: u32,
}

impl Bank {
    /// Milestone 4
    pub fn new() -> Bank {
        todo!()
    }

    /// Milestone 4: opens an empty account and returns its id (1, 2, 3…).
    pub fn open(&mut self, owner: &str) -> u32 {
        todo!()
    }

    /// Milestone 4
    pub fn account(&self, id: u32) -> Option<&Account> {
        todo!()
    }

    /// Milestone 4: like `Account::deposit`, or `Err(BankError::AccountNotFound(id))`.
    pub fn deposit(&mut self, id: u32, amount: i64) -> Result<(), BankError> {
        todo!()
    }

    /// Milestone 4: like `Account::withdraw`, or `AccountNotFound`.
    pub fn withdraw(&mut self, id: u32, amount: i64) -> Result<(), BankError> {
        todo!()
    }

    /// Milestone 4: all the money in the bank.
    pub fn total(&self) -> i64 {
        todo!()
    }

    /// Milestone 5: moves money between two accounts. It either fully happens or changes
    /// nothing: check everything that can fail before you change a balance.
    /// - `from == to` → `SameAccount`
    /// - an id that doesn't exist → `AccountNotFound(that id)`
    /// - a bad amount or too little money → the same errors as `withdraw`
    pub fn transfer(&mut self, from: u32, to: u32, amount: i64) -> Result<(), BankError> {
        todo!()
    }
}
