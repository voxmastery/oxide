//! A to-do list kept in a plain text file.
//! Reference solution for the `todo` build-along (not shipped in the app).

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
    /// `[ ] 1 Buy milk` or `[x] 2 Call mum`.
    pub fn to_line(&self) -> String {
        let mark = if self.done { 'x' } else { ' ' };
        format!("[{mark}] {} {}", self.id, self.text)
    }

    /// The reverse of `to_line`. `None` when the line isn't in that format.
    pub fn from_line(line: &str) -> Option<Task> {
        let (done, rest) = if let Some(rest) = line.strip_prefix("[ ] ") {
            (false, rest)
        } else if let Some(rest) = line.strip_prefix("[x] ") {
            (true, rest)
        } else {
            return None;
        };
        let (id, text) = rest.split_once(' ')?;
        let id: u32 = id.parse().ok()?;
        Some(Task { id, text: text.to_string(), done })
    }
}

/// The list. Ids start at 1 and are never reused.
#[derive(Debug, PartialEq)]
pub struct TodoList {
    tasks: Vec<Task>,
    next_id: u32,
}

impl TodoList {
    pub fn new() -> TodoList {
        TodoList { tasks: Vec::new(), next_id: 1 }
    }

    /// Adds a task (text trimmed) and returns its id.
    pub fn add(&mut self, text: &str) -> u32 {
        let id = self.next_id;
        self.next_id += 1;
        self.tasks.push(Task { id, text: text.trim().to_string(), done: false });
        id
    }

    pub fn tasks(&self) -> &[Task] {
        &self.tasks
    }

    pub fn complete(&mut self, id: u32) -> Result<(), TodoError> {
        let task = self.tasks.iter_mut().find(|t| t.id == id).ok_or(TodoError::NotFound(id))?;
        task.done = true;
        Ok(())
    }

    pub fn remove(&mut self, id: u32) -> Result<Task, TodoError> {
        let i = self.tasks.iter().position(|t| t.id == id).ok_or(TodoError::NotFound(id))?;
        Ok(self.tasks.remove(i))
    }

    /// Tasks not done yet, in order.
    pub fn pending(&self) -> Vec<&Task> {
        self.tasks.iter().filter(|t| !t.done).collect()
    }

    /// One `to_line` per task, each ending in `\n`.
    pub fn to_text(&self) -> String {
        let mut out = String::new();
        for t in &self.tasks {
            out.push_str(&t.to_line());
            out.push('\n');
        }
        out
    }

    /// Parses `to_text` output. Blank lines are skipped; ids continue after the largest one.
    pub fn from_text(text: &str) -> Result<TodoList, TodoError> {
        let mut tasks = Vec::new();
        for (i, line) in text.lines().enumerate() {
            if line.trim().is_empty() {
                continue;
            }
            tasks.push(Task::from_line(line).ok_or(TodoError::BadLine(i + 1))?);
        }
        let next_id = tasks.iter().map(|t| t.id).max().unwrap_or(0) + 1;
        Ok(TodoList { tasks, next_id })
    }

    pub fn save(&self, path: impl AsRef<Path>) -> Result<(), TodoError> {
        fs::write(path, self.to_text()).map_err(|e| TodoError::Io(e.to_string()))
    }

    /// A missing file is an empty list.
    pub fn load(path: impl AsRef<Path>) -> Result<TodoList, TodoError> {
        match fs::read_to_string(path) {
            Ok(text) => TodoList::from_text(&text),
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(TodoList::new()),
            Err(e) => Err(TodoError::Io(e.to_string())),
        }
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

/// `args` are the words after the program name.
pub fn parse_args(args: &[String]) -> Result<Command, TodoError> {
    let id = |s: &String, usage: &str| s.parse::<u32>().map_err(|_| TodoError::Usage(usage.to_string()));
    match args {
        [] => Ok(Command::List),
        [cmd] if cmd == "list" => Ok(Command::List),
        [cmd, rest @ ..] if cmd == "add" => {
            let text = rest.join(" ");
            if text.trim().is_empty() {
                Err(TodoError::Usage("usage: todo add <text>".to_string()))
            } else {
                Ok(Command::Add(text))
            }
        }
        [cmd, n] if cmd == "done" => Ok(Command::Done(id(n, "usage: todo done <id>")?)),
        [cmd, n] if cmd == "rm" => Ok(Command::Remove(id(n, "usage: todo rm <id>")?)),
        _ => Err(TodoError::Usage("usage: todo [list | add <text> | done <id> | rm <id>]".to_string())),
    }
}

/// Applies a command and returns what to print.
pub fn run(list: &mut TodoList, cmd: Command) -> Result<String, TodoError> {
    match cmd {
        Command::Add(text) => {
            let id = list.add(&text);
            Ok(format!("Added {id}: {}", text.trim()))
        }
        Command::Done(id) => {
            list.complete(id)?;
            let text = &list.tasks().iter().find(|t| t.id == id).expect("just completed").text;
            Ok(format!("Done {id}: {text}"))
        }
        Command::Remove(id) => {
            let task = list.remove(id)?;
            Ok(format!("Removed {id}: {}", task.text))
        }
        Command::List => {
            if list.tasks().is_empty() {
                Ok("Nothing to do.".to_string())
            } else {
                Ok(list.to_text().trim_end().to_string())
            }
        }
    }
}
