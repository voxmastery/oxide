// Milestone tests for the todo build-along. Run one milestone with
// `cargo test --test milestones m3_`. Oxide puts this file back the way it was before each
// "Check milestone", so add your own tests in another file.

use todo::{Command, Task, TodoError, TodoList, parse_args, run};

fn args(words: &[&str]) -> Vec<String> {
    words.iter().map(|w| w.to_string()).collect()
}

// ---- Milestone 1: a list of tasks ------------------------------------------------------

#[test]
fn m1_new_list_is_empty() {
    let list = TodoList::new();
    assert!(list.tasks().is_empty());
}

#[test]
fn m1_add_returns_ids_from_one() {
    let mut list = TodoList::new();
    assert_eq!(list.add("Buy oat milk"), 1);
    assert_eq!(list.add("Call mum"), 2);
    assert_eq!(list.add("Water the plants"), 3);
    assert_eq!(list.tasks().len(), 3);
}

#[test]
fn m1_tasks_keep_order_and_start_pending() {
    let mut list = TodoList::new();
    list.add("Buy oat milk");
    list.add("Call mum");
    let t = list.tasks();
    assert_eq!(t[0], Task { id: 1, text: "Buy oat milk".to_string(), done: false });
    assert_eq!(t[1], Task { id: 2, text: "Call mum".to_string(), done: false });
}

#[test]
fn m1_add_trims_spaces() {
    let mut list = TodoList::new();
    list.add("   Read chapter 8  ");
    assert_eq!(list.tasks()[0].text, "Read chapter 8");
}

// ---- Milestone 2: done, remove, pending ------------------------------------------------

#[test]
fn m2_complete_marks_done() {
    let mut list = TodoList::new();
    list.add("Buy oat milk");
    list.add("Call mum");
    assert_eq!(list.complete(2), Ok(()));
    assert!(!list.tasks()[0].done);
    assert!(list.tasks()[1].done);
}

#[test]
fn m2_complete_unknown_id_is_not_found() {
    let mut list = TodoList::new();
    list.add("Buy oat milk");
    assert_eq!(list.complete(9), Err(TodoError::NotFound(9)));
}

#[test]
fn m2_remove_gives_the_task_back() {
    let mut list = TodoList::new();
    list.add("Buy oat milk");
    list.add("Call mum");
    let removed = list.remove(1).unwrap();
    assert_eq!(removed.text, "Buy oat milk");
    assert_eq!(list.tasks().len(), 1);
    assert_eq!(list.tasks()[0].id, 2);
    assert_eq!(list.remove(1), Err(TodoError::NotFound(1)));
}

#[test]
fn m2_ids_are_never_reused() {
    let mut list = TodoList::new();
    list.add("a");
    list.add("b");
    list.remove(2).unwrap();
    assert_eq!(list.add("c"), 3);
}

#[test]
fn m2_pending_skips_done_tasks() {
    let mut list = TodoList::new();
    list.add("a");
    list.add("b");
    list.add("c");
    list.complete(2).unwrap();
    let ids: Vec<u32> = list.pending().iter().map(|t| t.id).collect();
    assert_eq!(ids, vec![1, 3]);
}

// ---- Milestone 3: one task per line ----------------------------------------------------

#[test]
fn m3_to_line() {
    let t = Task { id: 1, text: "Buy oat milk".to_string(), done: false };
    assert_eq!(t.to_line(), "[ ] 1 Buy oat milk");
    let t = Task { id: 12, text: "Call mum".to_string(), done: true };
    assert_eq!(t.to_line(), "[x] 12 Call mum");
}

#[test]
fn m3_from_line() {
    assert_eq!(
        Task::from_line("[ ] 1 Buy oat milk"),
        Some(Task { id: 1, text: "Buy oat milk".to_string(), done: false })
    );
    assert_eq!(
        Task::from_line("[x] 12 Call mum"),
        Some(Task { id: 12, text: "Call mum".to_string(), done: true })
    );
}

#[test]
fn m3_from_line_rejects_other_lines() {
    assert_eq!(Task::from_line("Buy oat milk"), None);
    assert_eq!(Task::from_line("[?] 1 Buy oat milk"), None);
    assert_eq!(Task::from_line("[ ] one Buy oat milk"), None);
    assert_eq!(Task::from_line("[ ] 1"), None);
    assert_eq!(Task::from_line(""), None);
}

#[test]
fn m3_line_round_trip() {
    let t = Task { id: 7, text: "Fix the [x] bug in parse()".to_string(), done: true };
    assert_eq!(Task::from_line(&t.to_line()), Some(t));
}

// ---- Milestone 4: the whole list as text -----------------------------------------------

#[test]
fn m4_to_text() {
    let mut list = TodoList::new();
    assert_eq!(list.to_text(), "");
    list.add("Buy oat milk");
    list.add("Call mum");
    list.complete(2).unwrap();
    assert_eq!(list.to_text(), "[ ] 1 Buy oat milk\n[x] 2 Call mum\n");
}

#[test]
fn m4_from_text_round_trip() {
    let mut list = TodoList::new();
    list.add("Buy oat milk");
    list.add("Call mum");
    list.complete(1).unwrap();
    let back = TodoList::from_text(&list.to_text()).unwrap();
    assert_eq!(back.tasks(), list.tasks());
}

#[test]
fn m4_from_text_skips_blank_lines() {
    let list = TodoList::from_text("\n[ ] 1 a\n\n   \n[x] 2 b\n").unwrap();
    assert_eq!(list.tasks().len(), 2);
}

#[test]
fn m4_from_text_reports_the_bad_line() {
    let r = TodoList::from_text("[ ] 1 a\n[x] 2 b\nshopping\n");
    assert_eq!(r.err(), Some(TodoError::BadLine(3)));
}

#[test]
fn m4_ids_continue_after_the_largest() {
    let mut list = TodoList::from_text("[ ] 4 a\n[x] 9 b\n[ ] 2 c\n").unwrap();
    assert_eq!(list.add("d"), 10);
    let mut empty = TodoList::from_text("").unwrap();
    assert_eq!(empty.add("first"), 1);
}

// ---- Milestone 5: save to a file -------------------------------------------------------

#[test]
fn m5_save_then_load() {
    let path = "target/todo-m5-save-then-load.txt";
    let mut list = TodoList::new();
    list.add("Buy oat milk");
    list.add("Call mum");
    list.complete(2).unwrap();
    list.save(path).unwrap();
    assert_eq!(std::fs::read_to_string(path).unwrap(), "[ ] 1 Buy oat milk\n[x] 2 Call mum\n");
    let back = TodoList::load(path).unwrap();
    assert_eq!(back, list);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn m5_missing_file_is_an_empty_list() {
    let path = "target/todo-m5-no-such-file.txt";
    let _ = std::fs::remove_file(path);
    let mut list = TodoList::load(path).unwrap();
    assert!(list.tasks().is_empty());
    assert_eq!(list.add("first"), 1);
}

#[test]
fn m5_bad_file_is_an_error() {
    let path = "target/todo-m5-bad-file.txt";
    std::fs::write(path, "[ ] 1 fine\nnot a task\n").unwrap();
    assert_eq!(TodoList::load(path).err(), Some(TodoError::BadLine(2)));
    std::fs::remove_file(path).unwrap();
}

// ---- Milestone 6: read the command line ------------------------------------------------

#[test]
fn m6_list_is_the_default() {
    assert_eq!(parse_args(&args(&[])), Ok(Command::List));
    assert_eq!(parse_args(&args(&["list"])), Ok(Command::List));
}

#[test]
fn m6_add_joins_the_words() {
    assert_eq!(parse_args(&args(&["add", "Buy", "oat", "milk"])), Ok(Command::Add("Buy oat milk".to_string())));
}

#[test]
fn m6_done_and_rm_take_an_id() {
    assert_eq!(parse_args(&args(&["done", "2"])), Ok(Command::Done(2)));
    assert_eq!(parse_args(&args(&["rm", "14"])), Ok(Command::Remove(14)));
}

#[test]
fn m6_mistakes_are_usage_errors() {
    for bad in [&["add"][..], &["done"], &["done", "two"], &["rm", "-1"], &["remove", "1"], &["list", "all"]] {
        let r = parse_args(&args(bad));
        assert!(matches!(r, Err(TodoError::Usage(_))), "{bad:?} gave {r:?}");
    }
}

// ---- Milestone 7: run a command --------------------------------------------------------

#[test]
fn m7_run_add_and_list() {
    let mut list = TodoList::new();
    assert_eq!(run(&mut list, Command::List).unwrap(), "Nothing to do.");
    assert_eq!(run(&mut list, Command::Add("Buy oat milk".to_string())).unwrap(), "Added 1: Buy oat milk");
    assert_eq!(run(&mut list, Command::Add("Call mum".to_string())).unwrap(), "Added 2: Call mum");
    assert_eq!(run(&mut list, Command::List).unwrap(), "[ ] 1 Buy oat milk\n[ ] 2 Call mum");
}

#[test]
fn m7_run_done_and_remove() {
    let mut list = TodoList::new();
    list.add("Buy oat milk");
    list.add("Call mum");
    assert_eq!(run(&mut list, Command::Done(2)).unwrap(), "Done 2: Call mum");
    assert_eq!(run(&mut list, Command::Remove(1)).unwrap(), "Removed 1: Buy oat milk");
    assert_eq!(run(&mut list, Command::List).unwrap(), "[x] 2 Call mum");
}

#[test]
fn m7_run_passes_errors_on() {
    let mut list = TodoList::new();
    assert_eq!(run(&mut list, Command::Done(5)), Err(TodoError::NotFound(5)));
    assert_eq!(run(&mut list, Command::Remove(5)), Err(TodoError::NotFound(5)));
}
