//! A tiny bank: accounts, a ledger and transfers. Money is in cents (`i64`).
//! Reference solution for the `bank` build-along (not shipped in the app).

use std::collections::HashMap;
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Transaction {
    Deposit(i64),
    Withdrawal(i64),
}

#[derive(Debug, PartialEq)]
pub enum BankError {
    /// Amounts must be more than zero.
    InvalidAmount(i64),
    InsufficientFunds { needed: i64, available: i64 },
    AccountNotFound(u32),
    SameAccount,
}

/// `1234` → `"12.34"`, `-5` → `"-0.05"`.
pub fn format_cents(cents: i64) -> String {
    let sign = if cents < 0 { "-" } else { "" };
    let abs = cents.unsigned_abs();
    format!("{sign}{}.{:02}", abs / 100, abs % 100)
}

impl fmt::Display for BankError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BankError::InvalidAmount(a) => write!(f, "invalid amount: {}", format_cents(*a)),
            BankError::InsufficientFunds { needed, available } => {
                write!(f, "insufficient funds: needed {}, available {}", format_cents(*needed), format_cents(*available))
            }
            BankError::AccountNotFound(id) => write!(f, "no account with id {id}"),
            BankError::SameAccount => write!(f, "can’t transfer to the same account"),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Account {
    owner: String,
    balance: i64,
    history: Vec<Transaction>,
}

impl Account {
    pub fn new(owner: &str) -> Account {
        Account { owner: owner.to_string(), balance: 0, history: Vec::new() }
    }

    pub fn owner(&self) -> &str {
        &self.owner
    }

    pub fn balance(&self) -> i64 {
        self.balance
    }

    pub fn deposit(&mut self, amount: i64) -> Result<(), BankError> {
        if amount <= 0 {
            return Err(BankError::InvalidAmount(amount));
        }
        self.balance += amount;
        self.history.push(Transaction::Deposit(amount));
        Ok(())
    }

    pub fn withdraw(&mut self, amount: i64) -> Result<(), BankError> {
        if amount <= 0 {
            return Err(BankError::InvalidAmount(amount));
        }
        if amount > self.balance {
            return Err(BankError::InsufficientFunds { needed: amount, available: self.balance });
        }
        self.balance -= amount;
        self.history.push(Transaction::Withdrawal(amount));
        Ok(())
    }

    pub fn history(&self) -> &[Transaction] {
        &self.history
    }

    pub fn statement(&self) -> String {
        let mut lines: Vec<String> = self
            .history
            .iter()
            .map(|t| match t {
                Transaction::Deposit(a) => format!("+{}", format_cents(*a)),
                Transaction::Withdrawal(a) => format!("-{}", format_cents(*a)),
            })
            .collect();
        lines.push(format!("balance {}", format_cents(self.balance)));
        lines.join("\n")
    }
}

impl fmt::Display for Account {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.owner, format_cents(self.balance))
    }
}

#[derive(Debug)]
pub struct Bank {
    accounts: HashMap<u32, Account>,
    next_id: u32,
}

impl Bank {
    pub fn new() -> Bank {
        Bank { accounts: HashMap::new(), next_id: 1 }
    }

    pub fn open(&mut self, owner: &str) -> u32 {
        let id = self.next_id;
        self.next_id += 1;
        self.accounts.insert(id, Account::new(owner));
        id
    }

    pub fn account(&self, id: u32) -> Option<&Account> {
        self.accounts.get(&id)
    }

    fn account_mut(&mut self, id: u32) -> Result<&mut Account, BankError> {
        self.accounts.get_mut(&id).ok_or(BankError::AccountNotFound(id))
    }

    pub fn deposit(&mut self, id: u32, amount: i64) -> Result<(), BankError> {
        self.account_mut(id)?.deposit(amount)
    }

    pub fn withdraw(&mut self, id: u32, amount: i64) -> Result<(), BankError> {
        self.account_mut(id)?.withdraw(amount)
    }

    pub fn transfer(&mut self, from: u32, to: u32, amount: i64) -> Result<(), BankError> {
        if from == to {
            return Err(BankError::SameAccount);
        }
        if !self.accounts.contains_key(&to) {
            return Err(BankError::AccountNotFound(to));
        }
        self.account_mut(from)?.withdraw(amount)?;
        self.account_mut(to)?.deposit(amount)
    }

    pub fn total(&self) -> i64 {
        self.accounts.values().map(|a| a.balance()).sum()
    }
}
