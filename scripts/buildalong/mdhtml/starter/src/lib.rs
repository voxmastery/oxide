//! A small Markdown to HTML converter: headings, paragraphs, emphasis, inline code, lists and
//! fenced code blocks.
//!
//! Each `todo!()` is yours to replace. Build one milestone at a time and check it with
//! `cargo test --test milestones m1_` (then `m2_`, `m3_`…).

// The stubs don't use their arguments, imports or fields yet. Delete this line once every todo!() is gone.
#![allow(unused_variables, unused_imports, dead_code)]

/// Milestone 1: replaces `&`, `<`, `>` and `"` with `&amp;`, `&lt;`, `&gt;` and `&quot;`, so
/// text can't be mistaken for HTML tags. Everything else stays as it is.
pub fn escape(text: &str) -> String {
    todo!()
}

/// Milestone 2: a heading line is 1 to 6 `#`s, a space, then the heading text.
/// `"## Getting started "` → `Some((2, "Getting started"))` (text trimmed).
/// `"#hashtag"`, `"####### seven"` and `"Plain text"` → `None`.
///
/// The `&str` you return borrows from `line` (the Book's lifetime elision rules say so).
pub fn heading(line: &str) -> Option<(usize, &str)> {
    todo!()
}

/// Milestone 3: the inline parts of a line, as HTML:
/// - `` `code` `` → `<code>code</code>` (nothing inside code is formatted, only escaped)
/// - `**strong**` → `<strong>strong</strong>`
/// - `*em*` → `<em>em</em>`
/// - everything else is escaped with `escape`
///
/// Strong and em can contain other formatting: `**a *b* c**`. A marker with no closing
/// marker after it, like the `*` in `2 * 3`, stays as it is.
pub fn inline(text: &str) -> String {
    todo!()
}

/// A piece of a document.
#[derive(Debug, PartialEq)]
pub enum Block {
    /// Level 1–6 and the heading text.
    Heading(usize, String),
    /// Consecutive lines of text, trimmed and joined with single spaces.
    Paragraph(String),
    /// Consecutive `- item` or `* item` lines (item text trimmed).
    List(Vec<String>),
    /// The lines between two ```` ``` ```` fences, joined with `\n`. The text after the
    /// opening fence, if any, is the language: ```` ```rust ````.
    Code { lang: Option<String>, code: String },
}

/// Splits a document into blocks, line by line.
///
/// - Milestone 4: blank lines end a paragraph; a heading line is a block of its own.
/// - Milestone 5: `- ` or `* ` lines make a list. A text line after a list ends the list.
/// - Milestone 6: ```` ``` ```` starts and ends a code block. Lines inside are kept exactly
///   as they are, blank lines and `#`s included. A block with no closing fence runs to the
///   end of the document.
pub fn parse(src: &str) -> Vec<Block> {
    todo!()
}

/// Milestone 7: blocks as HTML, separated by `\n`:
/// - `<h2>…</h2>` and `<p>…</p>`, with `inline` applied to the text
/// - `<ul>`, then one `<li>…</li>` per item, then `</ul>`, each on its own line
/// - `<pre><code class="language-rust">…</code></pre>`, or `<pre><code>…</code></pre>`
///   with no language; code is escaped, never formatted
pub fn render(blocks: &[Block]) -> String {
    todo!()
}

/// Milestone 7: `render(&parse(src))`.
pub fn to_html(src: &str) -> String {
    todo!()
}
