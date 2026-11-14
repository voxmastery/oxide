// Milestone tests for the bank build-along. Run one milestone with
// `cargo test --test milestones m3_`. Oxide puts this file back the way it was before each
// "Check milestone", so add your own tests in another file.

use bank::{Account, Bank, BankError, Transaction, format_cents};

// ---- Milestone 1: an account -----------------------------------------------------------

#[test]
fn m1_new_account_is_empty() {
    let acc = Account::new("Ada");
    assert_eq!(acc.owner(), "Ada");
    assert_eq!(acc.balance(), 0);
}

#[test]
fn m1_deposits_add_up() {
    let mut acc = Account::new("Ada");
    acc.deposit(1250).unwrap();
    acc.deposit(75).unwrap();
    assert_eq!(acc.balance(), 1325);
}

// ---- Milestone 2: errors with Result ---------------------------------------------------

#[test]
fn m2_bad_deposit_is_an_error() {
    let mut acc = Account::new("Ada");
    assert_eq!(acc.deposit(0), Err(BankError::InvalidAmount(0)));
    assert_eq!(acc.deposit(-500), Err(BankError::InvalidAmount(-500)));
    assert_eq!(acc.balance(), 0);
}

#[test]
fn m2_withdraw() {
    let mut acc = Account::new("Ada");
    acc.deposit(1000).unwrap();
    assert_eq!(acc.withdraw(300), Ok(()));
    assert_eq!(acc.balance(), 700);
    assert_eq!(acc.withdraw(700), Ok(()));
    assert_eq!(acc.balance(), 0);
}

#[test]
fn m2_overdraw_is_an_error() {
    let mut acc = Account::new("Ada");
    acc.deposit(250).unwrap();
    assert_eq!(acc.withdraw(1000), Err(BankError::InsufficientFunds { needed: 1000, available: 250 }));
    assert_eq!(acc.balance(), 250);
}

#[test]
fn m2_bad_withdrawal_is_an_error() {
    let mut acc = Account::new("Ada");
    acc.deposit(250).unwrap();
    assert_eq!(acc.withdraw(0), Err(BankError::InvalidAmount(0)));
    assert_eq!(acc.withdraw(-1), Err(BankError::InvalidAmount(-1)));
    assert_eq!(acc.balance(), 250);
}

// ---- Milestone 3: a history ------------------------------------------------------------

#[test]
fn m3_history_records_each_change() {
    let mut acc = Account::new("Ada");
    acc.deposit(1000).unwrap();
    acc.withdraw(250).unwrap();
    acc.deposit(5).unwrap();
    assert_eq!(acc.history(), &[Transaction::Deposit(1000), Transaction::Withdrawal(250), Transaction::Deposit(5)]);
}

#[test]
fn m3_failures_are_not_recorded() {
    let mut acc = Account::new("Ada");
    acc.deposit(100).unwrap();
    let _ = acc.deposit(-1);
    let _ = acc.withdraw(500);
    assert_eq!(acc.history(), &[Transaction::Deposit(100)]);
}

// ---- Milestone 4: many accounts --------------------------------------------------------

#[test]
fn m4_open_gives_ids_from_one() {
    let mut bank = Bank::new();
    assert_eq!(bank.open("Ada"), 1);
    assert_eq!(bank.open("Grace"), 2);
    assert_eq!(bank.account(2).unwrap().owner(), "Grace");
    assert!(bank.account(3).is_none());
}

#[test]
fn m4_deposit_and_withdraw_by_id() {
    let mut bank = Bank::new();
    let ada = bank.open("Ada");
    bank.deposit(ada, 2000).unwrap();
    bank.withdraw(ada, 500).unwrap();
    assert_eq!(bank.account(ada).unwrap().balance(), 1500);
    assert_eq!(bank.withdraw(ada, 9999), Err(BankError::InsufficientFunds { needed: 9999, available: 1500 }));
}

#[test]
fn m4_unknown_id_is_an_error() {
    let mut bank = Bank::new();
    bank.open("Ada");
    assert_eq!(bank.deposit(42, 100), Err(BankError::AccountNotFound(42)));
    assert_eq!(bank.withdraw(42, 100), Err(BankError::AccountNotFound(42)));
}

#[test]
fn m4_total() {
    let mut bank = Bank::new();
    assert_eq!(bank.total(), 0);
    let a = bank.open("Ada");
    let g = bank.open("Grace");
    bank.deposit(a, 1000).unwrap();
    bank.deposit(g, 234).unwrap();
    assert_eq!(bank.total(), 1234);
}

// ---- Milestone 5: transfers ------------------------------------------------------------

fn two_accounts() -> (Bank, u32, u32) {
    let mut bank = Bank::new();
    let a = bank.open("Ada");
    let g = bank.open("Grace");
    bank.deposit(a, 1000).unwrap();
    bank.deposit(g, 200).unwrap();
    (bank, a, g)
}

fn balances(bank: &Bank, a: u32, g: u32) -> (i64, i64) {
    (bank.account(a).unwrap().balance(), bank.account(g).unwrap().balance())
}

#[test]
fn m5_transfer_moves_money() {
    let (mut bank, a, g) = two_accounts();
    assert_eq!(bank.transfer(a, g, 300), Ok(()));
    assert_eq!(balances(&bank, a, g), (700, 500));
    assert_eq!(bank.account(a).unwrap().history().last(), Some(&Transaction::Withdrawal(300)));
    assert_eq!(bank.account(g).unwrap().history().last(), Some(&Transaction::Deposit(300)));
}

#[test]
fn m5_failed_transfer_changes_nothing() {
    let (mut bank, a, g) = two_accounts();
    assert_eq!(bank.transfer(g, a, 500), Err(BankError::InsufficientFunds { needed: 500, available: 200 }));
    assert_eq!(bank.transfer(a, g, 0), Err(BankError::InvalidAmount(0)));
    assert_eq!(balances(&bank, a, g), (1000, 200));
    assert_eq!(bank.account(a).unwrap().history().len(), 1);
    assert_eq!(bank.account(g).unwrap().history().len(), 1);
}

#[test]
fn m5_transfer_to_a_missing_account_changes_nothing() {
    let (mut bank, a, g) = two_accounts();
    assert_eq!(bank.transfer(a, 9, 100), Err(BankError::AccountNotFound(9)));
    assert_eq!(bank.transfer(9, a, 100), Err(BankError::AccountNotFound(9)));
    assert_eq!(balances(&bank, a, g), (1000, 200));
    assert_eq!(bank.account(a).unwrap().history().len(), 1);
}

#[test]
fn m5_transfer_to_yourself_is_an_error() {
    let (mut bank, a, g) = two_accounts();
    assert_eq!(bank.transfer(a, a, 100), Err(BankError::SameAccount));
    assert_eq!(balances(&bank, a, g), (1000, 200));
}

// ---- Milestone 6: money as text --------------------------------------------------------

#[test]
fn m6_format_cents() {
    assert_eq!(format_cents(1234), "12.34");
    assert_eq!(format_cents(5), "0.05");
    assert_eq!(format_cents(100), "1.00");
    assert_eq!(format_cents(0), "0.00");
    assert_eq!(format_cents(-250), "-2.50");
    assert_eq!(format_cents(-5), "-0.05");
}

#[test]
fn m6_account_display() {
    let mut acc = Account::new("Ada");
    acc.deposit(1250).unwrap();
    assert_eq!(acc.to_string(), "Ada: 12.50");
}

#[test]
fn m6_error_display() {
    assert_eq!(BankError::InvalidAmount(-5).to_string(), "invalid amount: -0.05");
    assert_eq!(
        BankError::InsufficientFunds { needed: 1000, available: 250 }.to_string(),
        "insufficient funds: needed 10.00, available 2.50"
    );
    assert_eq!(BankError::AccountNotFound(7).to_string(), "no account with id 7");
    assert_eq!(BankError::SameAccount.to_string(), "can’t transfer to the same account");
}

// ---- Milestone 7: a statement ----------------------------------------------------------

#[test]
fn m7_statement() {
    let mut acc = Account::new("Ada");
    acc.deposit(1250).unwrap();
    acc.withdraw(300).unwrap();
    acc.deposit(5).unwrap();
    assert_eq!(acc.statement(), "+12.50\n-3.00\n+0.05\nbalance 9.55");
}

#[test]
fn m7_empty_statement() {
    assert_eq!(Account::new("Ada").statement(), "balance 0.00");
}
