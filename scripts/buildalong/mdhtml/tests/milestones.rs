// Milestone tests for the mdhtml build-along. Run one milestone with
// `cargo test --test milestones m3_`. Oxide puts this file back the way it was before each
// "Check milestone", so add your own tests in another file.

use mdhtml::{Block, escape, heading, inline, parse, render, to_html};

fn para(s: &str) -> Block {
    Block::Paragraph(s.to_string())
}

fn h(level: usize, s: &str) -> Block {
    Block::Heading(level, s.to_string())
}

fn list(items: &[&str]) -> Block {
    Block::List(items.iter().map(|s| s.to_string()).collect())
}

fn code(lang: Option<&str>, s: &str) -> Block {
    Block::Code { lang: lang.map(str::to_string), code: s.to_string() }
}

// ---- Milestone 1: escape ---------------------------------------------------------------

#[test]
fn m1_escapes_html_characters() {
    assert_eq!(escape("Tom & Jerry"), "Tom &amp; Jerry");
    assert_eq!(escape("<b>bold</b>"), "&lt;b&gt;bold&lt;/b&gt;");
    assert_eq!(escape(r#"say "hi""#), "say &quot;hi&quot;");
}

#[test]
fn m1_leaves_other_text_alone() {
    assert_eq!(escape("Plain text, ünïcödé and 'quotes'"), "Plain text, ünïcödé and 'quotes'");
    assert_eq!(escape(""), "");
}

#[test]
fn m1_escapes_ampersands_once() {
    assert_eq!(escape("&lt;"), "&amp;lt;");
}

// ---- Milestone 2: headings -------------------------------------------------------------

#[test]
fn m2_heading_levels() {
    assert_eq!(heading("# Oxide"), Some((1, "Oxide")));
    assert_eq!(heading("## Getting started "), Some((2, "Getting started")));
    assert_eq!(heading("###### Six"), Some((6, "Six")));
}

#[test]
fn m2_not_headings() {
    assert_eq!(heading("#hashtag"), None);
    assert_eq!(heading("####### seven"), None);
    assert_eq!(heading("Plain text"), None);
    assert_eq!(heading(""), None);
}

// ---- Milestone 3: inline formatting ----------------------------------------------------

#[test]
fn m3_strong_and_em() {
    assert_eq!(inline("a **b** c *d* e"), "a <strong>b</strong> c <em>d</em> e");
}

#[test]
fn m3_code_is_escaped_not_formatted() {
    assert_eq!(inline("Use `Vec<T>` here"), "Use <code>Vec&lt;T&gt;</code> here");
    assert_eq!(inline("`*not em*`"), "<code>*not em*</code>");
}

#[test]
fn m3_nesting() {
    assert_eq!(inline("**strong with *em* inside**"), "<strong>strong with <em>em</em> inside</strong>");
    assert_eq!(inline("*em with `code`*"), "<em>em with <code>code</code></em>");
}

#[test]
fn m3_unclosed_markers_stay() {
    assert_eq!(inline("2 * 3 = 6"), "2 * 3 = 6");
    assert_eq!(inline("a ` b"), "a ` b");
    assert_eq!(inline("a ** b"), "a ** b");
}

#[test]
fn m3_text_is_escaped() {
    assert_eq!(inline("Tom & *Jerry* <3"), "Tom &amp; <em>Jerry</em> &lt;3");
}

// ---- Milestone 4: paragraphs and headings ----------------------------------------------

#[test]
fn m4_paragraphs_join_lines() {
    assert_eq!(parse("one\ntwo\n\nthree"), vec![para("one two"), para("three")]);
}

#[test]
fn m4_lines_are_trimmed() {
    assert_eq!(parse("  one  \n   two\n"), vec![para("one two")]);
}

#[test]
fn m4_headings_are_their_own_blocks() {
    assert_eq!(
        parse("# Title\nIntro text\n## Part\nMore"),
        vec![h(1, "Title"), para("Intro text"), h(2, "Part"), para("More")]
    );
}

#[test]
fn m4_blank_lines_do_not_make_blocks() {
    assert_eq!(parse("\n\n   \n# Hi\n\n\n"), vec![h(1, "Hi")]);
    assert!(parse("").is_empty());
}

// ---- Milestone 5: lists ----------------------------------------------------------------

#[test]
fn m5_list_items() {
    assert_eq!(parse("- one\n- two\n*  three "), vec![list(&["one", "two", "three"])]);
}

#[test]
fn m5_lists_between_paragraphs() {
    assert_eq!(
        parse("Shopping:\n- oats\n- milk\nThat's all."),
        vec![para("Shopping:"), list(&["oats", "milk"]), para("That's all.")]
    );
}

#[test]
fn m5_blank_line_splits_lists() {
    assert_eq!(parse("- a\n\n- b"), vec![list(&["a"]), list(&["b"])]);
}

#[test]
fn m5_emphasis_is_not_a_list() {
    assert_eq!(parse("*so* important"), vec![para("*so* important")]);
}

// ---- Milestone 6: code blocks ----------------------------------------------------------

#[test]
fn m6_fenced_code() {
    assert_eq!(
        parse("Look:\n```rust\nfn main() {\n    println!(\"hi\");\n}\n```\nDone."),
        vec![para("Look:"), code(Some("rust"), "fn main() {\n    println!(\"hi\");\n}"), para("Done.")]
    );
}

#[test]
fn m6_code_keeps_everything() {
    assert_eq!(parse("```\n# not a heading\n\n- not a list\n```"), vec![code(None, "# not a heading\n\n- not a list")]);
}

#[test]
fn m6_unclosed_fence_runs_to_the_end() {
    assert_eq!(parse("```toml\n[package]\nname = \"x\""), vec![code(Some("toml"), "[package]\nname = \"x\"")]);
}

// ---- Milestone 7: HTML -----------------------------------------------------------------

#[test]
fn m7_render_each_block() {
    let blocks = vec![h(2, "Hello *you*"), para("A & B"), list(&["one", "**two**"]), code(Some("rust"), "let v: Vec<u8> = vec![];")];
    assert_eq!(
        render(&blocks),
        "<h2>Hello <em>you</em></h2>\n<p>A &amp; B</p>\n<ul>\n<li>one</li>\n<li><strong>two</strong></li>\n</ul>\n<pre><code class=\"language-rust\">let v: Vec&lt;u8&gt; = vec![];</code></pre>"
    );
}

#[test]
fn m7_code_without_language() {
    assert_eq!(render(&[code(None, "*a*\n<b>")]), "<pre><code>*a*\n&lt;b&gt;</code></pre>");
}

#[test]
fn m7_to_html() {
    let src = "# Notes\n\nRust has *ownership*.\nIt matters.\n\n- move\n- borrow\n\n```\nlet s = 1;\n```\n";
    assert_eq!(
        to_html(src),
        "<h1>Notes</h1>\n<p>Rust has <em>ownership</em>. It matters.</p>\n<ul>\n<li>move</li>\n<li>borrow</li>\n</ul>\n<pre><code>let s = 1;</code></pre>"
    );
    assert_eq!(to_html(""), "");
}
