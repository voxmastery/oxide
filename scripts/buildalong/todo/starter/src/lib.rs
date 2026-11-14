//! A to-do list kept in a plain text file.
//!
//! Each `todo!()` is yours to replace. Build one milestone at a time and check it with
//! `cargo test --test milestones m1_` (then `m2_`, `m3_`…).

// The stubs don't use their arguments, imports or fields yet. Delete this line once every todo!() is gone.
#![allow(unused_variables, unused_imports, dead_code)]

use std::fmt;
use std::fs;
use std::io;
use std::path::Path;

/// One thing to do.
#[derive(Debug, Clone, PartialEq)]
pub struct Task {
    pub id: u32,
    pub text: String,
    pub done: bool,
}

/// Everything that can go wrong.
#[derive(Debug, PartialEq)]
pub enum TodoError {
    /// No task has this id.
    NotFound(u32),
    /// This line of the file (1-based) isn't a task.
    BadLine(usize),
    /// Reading or writing the file failed.
    Io(String),
    /// The command line didn't make sense.
    Usage(String),
}

impl fmt::Display for TodoError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TodoError::NotFound(id) => write!(f, "no task with id {id}"),
            TodoError::BadLine(n) => write!(f, "line {n} is not a task"),
            TodoError::Io(msg) => write!(f, "file error: {msg}"),
            TodoError::Usage(msg) => write!(f, "{msg}"),
        }
    }
}

impl Task {
    /// Milestone 3: `[ ] 1 Buy milk` for a pending task, `[x] 2 Call mum` for a done one.
    pub fn to_line(&self) -> String {
        todo!()
    }

    /// Milestone 3: the reverse of `to_line`. `None` when the line isn't in that format
    /// (no `[ ] ` / `[x] ` at the start, an id that isn't a number, or no space after the id).
    pub fn from_line(line: &str) -> Option<Task> {
        todo!()
    }
}

/// The list. Ids start at 1 and are never reused, even after a task is removed.
#[derive(Debug, PartialEq)]
pub struct TodoList {
    tasks: Vec<Task>,
    next_id: u32,
}

impl TodoList {
    /// Milestone 1: an empty list whose first task will get id 1.
    pub fn new() -> TodoList {
        todo!()
    }

    /// Milestone 1: adds a pending task (with surrounding spaces trimmed) and returns its id.
    pub fn add(&mut self, text: &str) -> u32 {
        todo!()
    }

    /// Milestone 1: all tasks, in the order they were added.
    pub fn tasks(&self) -> &[Task] {
        todo!()
    }

    /// Milestone 2: marks a task done, or `Err(TodoError::NotFound(id))`.
    pub fn complete(&mut self, id: u32) -> Result<(), TodoError> {
        todo!()
    }

    /// Milestone 2: takes a task out of the list and gives it back, or `NotFound`.
    pub fn remove(&mut self, id: u32) -> Result<Task, TodoError> {
        todo!()
    }

    /// Milestone 2: the tasks that aren't done yet, in order.
    pub fn pending(&self) -> Vec<&Task> {
        todo!()
    }

    /// Milestone 4: one `to_line()` per task, each followed by `\n`. An empty list is `""`.
    pub fn to_text(&self) -> String {
        todo!()
    }

    /// Milestone 4: parses `to_text` output. Blank lines are skipped. A line that isn't a task
    /// is `Err(TodoError::BadLine(n))` with `n` counted from 1. New ids continue after the
    /// largest id in the text.
    pub fn from_text(text: &str) -> Result<TodoList, TodoError> {
        todo!()
    }

    /// Milestone 5: writes `to_text()` to the file. I/O errors become `TodoError::Io(message)`.
    pub fn save(&self, path: impl AsRef<Path>) -> Result<(), TodoError> {
        todo!()
    }

    /// Milestone 5: reads a list saved with `save`. A file that doesn't exist yet is an empty
    /// list (hint: `io::ErrorKind::NotFound`).
    pub fn load(path: impl AsRef<Path>) -> Result<TodoList, TodoError> {
        todo!()
    }
}

/// What the user asked for on the command line.
#[derive(Debug, PartialEq)]
pub enum Command {
    Add(String),
    Done(u32),
    Remove(u32),
    List,
}

/// Milestone 6: `args` are the words after the program name.
///
/// - nothing, or `list` → `Command::List`
/// - `add Buy oat milk` → `Command::Add("Buy oat milk")` (the words joined with spaces)
/// - `done 2` → `Command::Done(2)`, `rm 2` → `Command::Remove(2)`
/// - anything else (unknown command, `add` with no text, an id that isn't a number)
///   → `Err(TodoError::Usage(message))`
pub fn parse_args(args: &[String]) -> Result<Command, TodoError> {
    todo!()
}

/// Milestone 7: applies a command to the list and returns the text to print.
///
/// - `Add` → `Added 3: Buy oat milk`
/// - `Done` → `Done 2: Call mum`
/// - `Remove` → `Removed 2: Call mum`
/// - `List` → every task's `to_line()`, one per line (no `\n` at the end),
///   or `Nothing to do.` when the list is empty
pub fn run(list: &mut TodoList, cmd: Command) -> Result<String, TodoError> {
    todo!()
}
