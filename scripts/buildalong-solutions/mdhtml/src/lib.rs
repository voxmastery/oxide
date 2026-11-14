//! A small Markdown to HTML converter: headings, paragraphs, emphasis, inline code, lists and
//! fenced code blocks.
//! Reference solution for the `mdhtml` build-along (not shipped in the app).

/// `&`, `<`, `>` and `"` as HTML entities.
pub fn escape(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            _ => out.push(c),
        }
    }
    out
}

/// `## Title` → `Some((2, "Title"))`.
pub fn heading(line: &str) -> Option<(usize, &str)> {
    let level = line.chars().take_while(|&c| c == '#').count();
    if level == 0 || level > 6 {
        return None;
    }
    let rest = line[level..].strip_prefix(' ')?;
    Some((level, rest.trim()))
}

/// Emphasis and code inside a line of text, with everything else escaped.
pub fn inline(text: &str) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(c) = rest.chars().next() {
        if c == '`' {
            if let Some(end) = rest[1..].find('`') {
                out.push_str("<code>");
                out.push_str(&escape(&rest[1..1 + end]));
                out.push_str("</code>");
                rest = &rest[end + 2..];
                continue;
            }
        } else if rest.starts_with("**") {
            if let Some(end) = rest[2..].find("**") {
                if end > 0 {
                    out.push_str("<strong>");
                    out.push_str(&inline(&rest[2..2 + end]));
                    out.push_str("</strong>");
                    rest = &rest[end + 4..];
                    continue;
                }
            }
        } else if c == '*' {
            if let Some(end) = rest[1..].find('*') {
                if end > 0 {
                    out.push_str("<em>");
                    out.push_str(&inline(&rest[1..1 + end]));
                    out.push_str("</em>");
                    rest = &rest[end + 2..];
                    continue;
                }
            }
        }
        let n = c.len_utf8();
        out.push_str(&escape(&rest[..n]));
        rest = &rest[n..];
    }
    out
}

#[derive(Debug, PartialEq)]
pub enum Block {
    Heading(usize, String),
    Paragraph(String),
    List(Vec<String>),
    Code { lang: Option<String>, code: String },
}

fn list_item(line: &str) -> Option<&str> {
    line.strip_prefix("- ").or_else(|| line.strip_prefix("* ")).map(str::trim)
}

/// Splits a document into blocks.
pub fn parse(src: &str) -> Vec<Block> {
    let mut blocks = Vec::new();
    let mut para: Vec<&str> = Vec::new();
    let mut items: Vec<String> = Vec::new();
    let mut code: Option<(Option<String>, Vec<&str>)> = None;

    fn flush(blocks: &mut Vec<Block>, para: &mut Vec<&str>, items: &mut Vec<String>) {
        if !para.is_empty() {
            blocks.push(Block::Paragraph(para.join(" ")));
            para.clear();
        }
        if !items.is_empty() {
            blocks.push(Block::List(std::mem::take(items)));
        }
    }

    for line in src.lines() {
        if let Some((lang, lines)) = &mut code {
            if line.starts_with("```") {
                blocks.push(Block::Code { lang: lang.take(), code: lines.join("\n") });
                code = None;
            } else {
                lines.push(line);
            }
            continue;
        }
        if let Some(info) = line.strip_prefix("```") {
            flush(&mut blocks, &mut para, &mut items);
            let lang = info.trim();
            code = Some(((!lang.is_empty()).then(|| lang.to_string()), Vec::new()));
        } else if line.trim().is_empty() {
            flush(&mut blocks, &mut para, &mut items);
        } else if let Some((level, text)) = heading(line) {
            flush(&mut blocks, &mut para, &mut items);
            blocks.push(Block::Heading(level, text.to_string()));
        } else if let Some(item) = list_item(line) {
            if !para.is_empty() {
                flush(&mut blocks, &mut para, &mut items);
            }
            items.push(item.to_string());
        } else {
            if !items.is_empty() {
                flush(&mut blocks, &mut para, &mut items);
            }
            para.push(line.trim());
        }
    }
    if let Some((lang, lines)) = code {
        blocks.push(Block::Code { lang, code: lines.join("\n") });
    }
    flush(&mut blocks, &mut para, &mut items);
    blocks
}

/// Blocks as HTML, one block after another, separated by `\n`.
pub fn render(blocks: &[Block]) -> String {
    blocks
        .iter()
        .map(|b| match b {
            Block::Heading(l, t) => format!("<h{l}>{}</h{l}>", inline(t)),
            Block::Paragraph(t) => format!("<p>{}</p>", inline(t)),
            Block::List(items) => {
                let lis: Vec<String> = items.iter().map(|i| format!("<li>{}</li>", inline(i))).collect();
                format!("<ul>\n{}\n</ul>", lis.join("\n"))
            }
            Block::Code { lang: Some(l), code } => {
                format!("<pre><code class=\"language-{}\">{}</code></pre>", escape(l), escape(code))
            }
            Block::Code { lang: None, code } => format!("<pre><code>{}</code></pre>", escape(code)),
        })
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn to_html(src: &str) -> String {
    render(&parse(src))
}
