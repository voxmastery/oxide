# Handoff: Oxide, a mobile app for learning Rust

## Overview

Oxide is an Android app for learning Rust on a phone. It combines three things:

- **The Rust Programming Language** ("the Book"), read inside the app.
- **Rustlings**, the official set of 95 small exercises, solved in an in-app code editor with compiler output, plain-English error explanations, hints and the official solutions.
- **A terminal** with `cargo`, `rustc` and `rustlings`, so learners can make and run real projects, including the Book's three project chapters.

A daily mission, built from the learner's place in the Book and Rustlings, ties these together. Streaks, XP and levels track progress. Everything is meant to work offline after the first download.

The handoff covers the whole production app: first run, the five tabs, every pushed screen, and all dialogs, bottom sheets and system messages.

## About the design files

The files in `prototype/` are **design references built in HTML**. They show the intended look and behavior and are not production code to copy. Rebuild these designs in the target codebase with its own patterns and libraries. If there is no codebase yet, pick the framework that fits best. For an Android-first app with this Material 3 structure, that's Jetpack Compose (Kotlin), or Flutter or React Native if iOS is also planned.

The prototype **simulates** the Rust toolchain. Compiler output, `cargo` runs and the file system are scripted in `oxide-lib.js` and `Terminal.dc.html`. The production app needs a real way to compile and run Rust, either an on-device toolchain or a build service. That choice is open. It decides whether the "works offline" promise in the copy can hold.

### Viewing the prototype

The screens load each other at runtime, so they must be served over HTTP:

```
cd prototype
npx serve .        # or: python3 -m http.server
```

Open `Oxide.dc.html` for the overview canvas. Every phone on it is live: tap through it, type in the Terminal, fix exercises, open popups. Each screen file also opens on its own.

## Fidelity

**High fidelity.** Colors, type, spacing, copy and interactions are final for the **dark theme**. Rebuild the UI to match pixel for pixel, at a 412 × 915 dp reference (Pixel-class phone).

Not designed:
- **The Paper (light) theme.** It appears as a setting only. Light colors exist only for code and terminal output (`SYN.light` and `TCL` in `oxide-lib.js`) and the editor keyboard.
- Tablet, landscape and foldable layouts.
- Content beyond the samples. Only Book sections 1.2 and 4.2 and the Rustlings exercises `intro1` and `move_semantics2`–`4` have full content. All other sections and exercises appear in lists only. Production should load all content from the source repositories (see Assets).

---

## App structure and navigation

### Frame (`OxidePhone.dc.html`)

| Area | Spec |
|---|---|
| Status bar | 36 dp, background `#0F0E0E`. Time "21:14" in Public Sans 14/500, tabular figures. Wi-Fi, signal and battery icons at 17 dp (filled); battery 24 × 12 outline, 1.5 dp stroke, 4 dp radius. |
| Offline banner | Shown under the status bar when offline. Background `#221E18`, bottom border 1 dp `rgba(242,194,91,0.16)`, padding 8 16 8 18. `cloud_off` 18 dp `#F2C25B`, 10 dp gap, text 13/1.35 `#E2DBD2`: "Offline. The Book, exercises and your local toolchain still work." The status-bar Wi-Fi icon becomes `wifi_off`. |
| Content | Fills the remaining height. Each screen scrolls on its own. |
| Navigation bar | 80 dp, background `#161514`, horizontal padding 4. Shown only on the five tab roots. |
| Gesture bar | 22 dp; handle 108 × 4, radius 2, `rgba(255,255,255,0.42)`. Background `#161514` when the nav bar or the exercise sheet sits above it, otherwise `#0F0E0E`. |

**Navigation bar items** (Material 3): five equal columns, each with a 60 × 32 indicator (radius 16) above a label, 4 dp gap.
- Active: indicator `rgba(247,76,0,0.2)`, icon 24 dp `#FF8A55` filled (`FILL 1`), label Public Sans 12/600 `#F1EDE8`, letter-spacing 0.01em.
- Inactive: no indicator, icon `#A8A19A` outlined, label 12/500 `#A8A19A`.
- Indicator background transitions over 200 ms.

| Tab | Icon | Root screen | Screens that keep this tab active |
|---|---|---|---|
| Home | `home` | Home | — |
| Learn | `menu_book` | Learn (the Book) | Reader, Search |
| Practice | `data_object` | Practice (Rustlings) | Exercise, Project |
| Terminal | `terminal` | Terminal | Editor |
| Profile | `person` | Profile | Settings, Account |

**Stack behavior.** Each tab is a stack. Tapping a tab resets to its root. Back pops one screen; from a stack of one it goes to that tab's root. Opening a screen closes any open popup.

### Overlay system

One overlay layer sits above the content:
- **Dialogs**: centered card, dimmed backdrop.
- **Bottom sheets**: anchored to the bottom, dimmed backdrop, tap outside to close.
- **Full-screen moments** (Mission complete, Level up): cover everything below the status bar.
- **Heads-up notification**: a card at the top that doesn't block touches elsewhere.
- **Snackbar**: 12 dp from each side, 114 dp from the bottom on tab roots (above the nav bar), 40 dp elsewhere. Disappears after 4 s; the action dismisses it immediately.

### Navigation map

- **Home**: mission steps open Reader, Exercise or Terminal. The primary button continues the next step. Streak chip → Streak sheet. Level/XP → XP sheet. Book/Rustlings cards → Learn/Practice. Finishing the mission → Mission complete.
- **Learn**: search icon → Search. Continue card → Reader. "Drill it in Rustlings" → Practice. Chapters expand; the current section opens the Reader.
- **Reader**: back; contents icon → Learn; text settings → Text settings sheet; "Try it" cards and the end-of-section button → Exercise; "Up next" → Learn.
- **Practice**: search → Search. Continue → Exercise. Topics expand into exercise rows → Exercise. Book projects → Project.
- **Exercise**: back; Book icon → Reader at the related section; overflow → Exercise menu. Locked Solution tab → "See the solution now?" dialog. Success → next exercise or "Compare with the official solution".
- **Terminal**: folder name → Terminal projects sheet. Tap a command → Command actions sheet. Error actions → `rustc --explain`, the exercise, or the related Book section.
- **Project**: Edit → Editor; terminal icon → Terminal in the project folder; delete → Delete project dialog, then an "Undo" snackbar.
- **Editor**: Run → Terminal, running `cd <project> && cargo run`.
- **Profile**: settings icon → Settings; streak → Streak sheet; level → XP sheet; progress rows → tabs; fixed errors → Terminal with `rustc --explain <code>`.
- **Settings**: account row → Account; rows open their dialogs; Sign out → dialog → Welcome.
- **Account**: Delete account → dialog.

---

## Screens

Shared patterns are under **Components** in Design tokens. Layout values are in dp. Exact values for any element are in the matching `prototype/*.dc.html` file as inline styles.

### First run (`Onboarding.dc.html`)

Steps: Welcome → Starting level → Daily goal (→ notification permission) → Setting up Rust → Save your progress (→ Email sign-in → Check your email) → Home on day 1. Steps 1–4 show a progress bar of four 4 dp segments (6 dp gaps, radius 2): done segments `#F74C00`, the rest `#2C2A28`. It sits in a 56 dp top bar after a 48 dp back button.

**1. Welcome**
- Top: logo row, 32 dp tall. A 12 × 12 `#F74C00` square (radius 3) and the word "oxide" in JetBrains Mono 17/600.
- Code card: margin 36 dp top and bottom, radius 24, `#171615`, inset 1 dp `rgba(255,255,255,0.05)`. The top shows `fn main() { println!("Hello, world!"); }` highlighted, JetBrains Mono 14/23. The bottom strip (`#121110`) shows `$ cargo run` with a `#FF8A55` "$", then "Hello, world!" in `#57D6C8` 600.
- H1, 34/1.1, weight 650, letter-spacing −0.03em, balanced wrap: "Learn Rust, one day at a time."
- Body, 16/1.55 `#A39C95`: "Read the Rust Book, fix Rustlings exercises and run real code in a terminal on your phone. All of it works offline."
- Footer, padding 20 20 16, gap 6:
  - Primary button, 56 tall: "Get started".
  - Text button, 48 tall: "I already have an account".
  - Note, 12/1.5 `#8C867F`, centered: "Built on The Rust Programming Language and Rustlings. Both are open source."

**2. Starting level**
- Title, 28/1.18/650, −0.025em: "How much have you programmed before?"
- Subtitle, 15/1.5 `#A39C95`: "This sets where you start and how fast the plan moves. You can change it later."
- Three selection cards (min 76 tall, 10 dp gap):
  - "I’m new to programming" / "We’ll go slower and open hints sooner."
  - "I know another language" / "Start at chapter 1 at a steady pace." (default)
  - "I’ve written some Rust" / "Pick the chapter you want to start from."
- Card title 16/600, description 13.5/1.4 `#A39C95`, radio on the right.
- Footer: primary button "Continue".

**3. Daily goal**
- Title "How much time a day?". Subtitle "Pick what you can keep up on a busy day. You can change it in Settings."
- 2 × 2 grid of goal cards (min 96 tall). Each has the minutes in JetBrains Mono 28/600 + "min a day" 14 `#A39C95`, and below it "≈ N weeks" 13 (`#FF8A55` when selected).
  - 10 min ≈ 36 weeks · 20 ≈ 18 · 30 ≈ 12 (default) · 45 ≈ 8.
- Note, 14.5/1.5 `#D9D3CC`: "At 30 minutes a day, you’ll finish the Book and all 95 Rustlings exercises in about 12 weeks."
- Reminder group (radius 18, `#171615`): row with a `notifications` icon, "Daily reminder" 15.5/600, the description "Every day at 20:30, if you haven’t practised yet" (or "Off"), and a switch.
  - When on, time chips appear: `08:00`, `12:30`, `20:30` (default). 44 tall, radius 12, JetBrains Mono 14/500.
- "Continue": opens the notification permission dialog if the reminder is on, otherwise goes to setup.

**4. Setting up Rust**
- Title "Setting up Rust". Subtitle "Oxide downloads the Rust toolchain, the Book and Rustlings so everything works offline."
- Download list (radius 18, `#171615`), divided by 1 dp `rgba(255,255,255,0.05)` lines. Rows:
  - `terminal` "Rust 1.99.1": "rustc, cargo, clippy, rustfmt · 286 MB"
  - `menu_book` "The Book": "Rust 2024 edition · 9 MB"
  - `data_object` "Rustlings": "95 exercises · 3 MB"
- Each row has a status on the right ("Waiting", "NN%" in `#FF8A55`, "Done" in `#57D6C8`) and a 4 dp progress bar (fill `#F74C00`, `#57D6C8` when done).
- Install log: 150 dp tall, `#121110`, radius 14, JetBrains Mono 11/17. Shows the last 8 lines of rustup-style output, bottom-aligned (`info: downloading component 'cargo'` … `stable installed - rustc 1.99.1 …`).
- Notes:
  - `check_circle` (filled, `#57D6C8`): "1.1 Installation is done for you. It’s checked off in the Book."
  - `wifi`: "On Wi-Fi · 298 MB in total"
- Button: "Continue while it downloads" until done, then "Continue".
- Paused state: progress stops at 34% and the "Download paused" dialog shows.

**5. Save your progress**
- Title "Save your progress". Subtitle "Sign in to keep your streak, XP and code in sync across devices. You can do this later."
- Outlined pill buttons, 56 tall: "Continue with GitHub", "Continue with Google", "Continue with email".
- Footer: text button "Not now"; legal note 12 `#8C867F`: "By continuing you agree to the Terms of Service and Privacy Policy."
- Coming from "I already have an account" instead: title "Welcome back", subtitle "Sign in to pick up where you left off.", no "Not now", and the step bar is hidden.

**6. Email sign-in / 7. Check your email**
- An email field (prefilled `sam@fastmail.com` in the sent state). Sends a magic link and shows a confirmation for that address.
- Exact copy and layout are in `Onboarding.dc.html` (variants `email` and `sent`).

### Home (`Home.dc.html`)

**Header**
- Greeting "Good evening, Sam" (day 1: "Welcome, Sam").
- Date line "Sat 14 Nov · Week 3, day 4" (day 1: "Week 1, day 1").
- Streak chip: `local_fire_department` in `#FF7A3D` + count. Opens the Streak sheet.
- Avatar: circle with "S".
- Level row: "Lv 7" badge, "1,840 / 2,400 XP", and goal progress "≈ 28 of 30 min".

**TODAY’S MISSION card** (hero card)
- Mission title, for example "Read 4.2, then 3 Rustlings exercises".
- Step rows, each a 36 dp status ring + title + subtitle + meta:
  - "4.2 References and Borrowing" / "The Book · 6 min left" / ring at 62% `#F74C00`, meta "62%"
  - `move_semantics2` (JetBrains Mono 14) / "Rustlings · keep both vectors usable" / "+40"
  - `move_semantics3` / "Rustlings · fix it without a new line" / "+40"
  - `move_semantics4` / "Rustlings · fix it by reordering lines" / "+50"
- Primary button with `arrow_forward`, continuing the next step.

**Two track cards** (2-column grid, 8 dp gap, radius 18, `#171615`)
- The Book: `menu_book`, big "4.2" (JetBrains Mono 24/600), "Ch 4 of 21", 4 dp bar at 13.3% `#F74C00`, "10 of 80 sections read".
- Rustlings: `data_object`, "26" "of 95", bar at 27.4% `#57D6C8`, "next: move_semantics2".

**ROADMAP**
- "Week 3 of 12 · Core Language", percent on the right, phase segments.

**ACTIVITY**
- Contribution-style heatmap: weekday labels M / W / F, a legend from "less" to "more", today's cell ringed.
- Tapping a cell shows its count ("N exercises · date" or "· no activity").

**Day 1**
- Mission "Write and run your first Rust program", ≈ 15 min. Steps:
  - "1.1 Installation" / "Done during setup" (done)
  - "1.2 Hello, World!" / "The Book · 8 min"
  - `cargo new hello_world` / "Terminal · make a project and run it"
- The button reads "Start" → "Open the Terminal" (after 1.2 is read) → "Done for today" (after `hello_world` prints).
- The heatmap is empty, with "Your first square lights up when you finish today’s mission."
- When the mission completes: streak 1, 60 / 300 XP.

### Learn: the Book (`Book.dc.html`)

**Header** (64 dp)
- Title "The Book" (24/650, −0.02em), subtitle "The Rust Programming Language" 12.5 `#A39C95`, search icon button.

**Continue reading card** (hero)
- Label "CONTINUE READING", "62%" on the right.
- Title "4.2 References and Borrowing" (20/650), sub "Understanding Ownership · 6 min left".
- 4 dp bar.
- Link row (radius 14, `#211F1E`): `data_object` `#57D6C8` "Drill it in Rustlings: `move_semantics` · 1 of 5" with a chevron.
- Primary button "Resume reading".
- Day 1: "1.2 Hello, World!", "Getting Started · 8 min", link "Then run it in the Terminal: `hello_world`", button "Start reading".

**CONTENTS**
- Label with "10 of 80 sections" on the right.
- Strip bar, one segment per chapter, weighted by section count: done `#57D6C8`, current partly `#F74C00`, rest `#2C2A28`.

**Chapter list** (21 chapters + Appendix)
- Row, min 64 tall, with a 36 dp ring. The ring shows the chapter number in JetBrains Mono 11.5/600:
  - done: filled `#57D6C8` with `#06201C` text
  - in progress: conic `#F74C00` arc with `#FF8A55` number
  - todo: `#2C2A28` ring
- Title 15/600. Subtitle in JetBrains Mono 11.5: either "Rustlings · move_semantics 1/5 · …" (from Rustlings’ chapter map), "Project · minigrep" for project chapters, or "N sections".
- Expanding a chapter (row background `#171615`) lists its sections, 56 tall. Each has an icon (`check_circle` filled `#57D6C8` / `timelapse` `#FF8A55` / `radio_button_unchecked` `#5C5752`), the section number in mono, the title, and the related Rustlings topics.
- The current section is tinted `rgba(247,76,0,0.08)` and opens the Reader.

**Footer note**
- "The Rust Programming Language, from the Rust project, MIT or Apache-2.0. Rustlings links follow Rustlings’ own exercise-to-chapter map."

### Reader (`Reader.dc.html`)

**Top bar** (56 dp)
- Back, then the section title (15.5/600) and "Understanding Ownership · N min left" (updates while scrolling).
- Contents icon (`toc`) and a text settings action.
- A 3 dp reading-progress bar underneath (`#F74C00` on `#1E1C1B`).

**Body**
- Padding 24 22 44, 18 dp between blocks.
- Kicker: "CHAPTER 4 · UNDERSTANDING OWNERSHIP".
- H1 30/1.15/650 −0.025em.
- "14 min read" + chip "Rustlings: move_semantics" (or "Try it in the Terminal" on 1.2).
- Prose: 16.5/1.7 `#E2DDD7`. Inline code is JetBrains Mono 0.86em, `#F2CDB8` on `#2A2826`, radius 5, padding 1 5. Italics come from `_x_` / `*x*` in the source.
- H2: 21/1.25/650.
- NOTE box: `#171615`, radius 14.

**Code listing**
- Radius 16, `#171615`.
- Header: file label (12 mono `#8C867F`), a "doesn’t compile" tag for failing listings (`#FF8F98` on `rgba(255,107,118,0.14)`), and a Run button (34 tall, `#2A2826`, "Run" / "Run again").
- Code: 12.5/20 mono, ligatures off, horizontal scroll.
- Running shows "Compiling…" with a spinner, then the real rustc output in the output well (`#121110`, 11/17 mono).

**Inserted blocks**
- **"YOU LEFT OFF HERE"** marker: 10.5 mono `#FF8A55` between two hairlines. Resume scrolls here.
- **Quick check** quiz from Brown’s interactive edition:
  - Card radius 20, `#1A1918`, inset 1 dp `rgba(242,194,91,0.2)`, `quiz` icon `#F2C25B`, label "QUICK CHECK", source "Brown interactive edition".
  - Code, prompt (15.5/600), four options (min 52, radius 14, 1.5 dp outline `#2E2C2A`).
  - After answering: the correct option gets `#57D6C8`; a wrong pick gets `#FF6B76`; others fade to 50%.
  - Verdict "Correct · +10 XP" or "Not quite. The highlighted answer is right.", then an explanation.
- **Practice card**: inset 1 dp `rgba(87,214,200,0.22)`, label "PRACTICE IN RUSTLINGS · +40 XP", exercise name (mono 15/600), description, "Try it" button.
- **"IN OXIDE" tip** (1.2): `rgba(87,214,200,0.07)` box with a `smartphone` icon.

**End cards**
- 4.2: "THE RULES OF REFERENCES" (two bullets), "Rustlings drills this section in move_semantics2–5.", primary "Practice: `move_semantics2`", outlined "Up next: 4.3 The Slice Type".
- 1.2: "YOUR TURN", "Make a project and run it in the Terminal.", primary "Open the Terminal", outlined "Up next: 1.3 Hello, Cargo!".

**Behavior**
- Scrolling past 90% of 1.2 marks it read (updates the Home mission).

### Practice: Rustlings (`Practice.dc.html`)

**Header**
- "Practice" / "Rustlings, plus the Book’s projects", search icon.

**Hero card**
- "RUSTLINGS" with the % on the right.
- "26" (mono 36/600) "of 95 exercises".
- Segment bar, 8 dp, one segment per topic weighted by exercise count: done `#57D6C8`, quiz done `#F2C25B`, in progress `#F74C00`, rest `#2C2A28`.
- Legend: Done / In progress / Checkpoint quiz.
- Primary button "Continue: `move_semantics2`" (day 1: "Start: `intro1`").

**THE PATH** ("25 topics · 3 quizzes")
- Vertical list joined by a 2 dp `#24221F` line at x = 39.
- Topic node: 36 dp ring (done = `#57D6C8` with `check`; in progress = conic arc with "1/5"; todo = folder number "07").
- Quiz node: a 28 dp diamond (rotated square), `flag` icon, `#F2C25B` when passed.
- Row: topic name (mono 15/500), a Book tag (§4.1–2 etc., colored by reading state), and a description. Book tag colors and labels:
  - read: `#57D6C8` on `rgba(87,214,200,0.12)`, "read"
  - reading now: `#FF8A55` on `rgba(247,76,0,0.14)`, "reading now"
  - partly read: `#B3ACA5` on `#211F1E`, "partly read"
  - not read yet: `#B3ACA5` on `#211F1E`, "not read yet"
- Count on the right ("1/5", "+100" for quizzes, "passed").
- Expanded topics list their exercises: done / next (`play_circle` `#FF8A55`, tinted) / todo, with a description and "+XP".

**PROJECTS FROM THE BOOK** ("1 of 3")
- `guessing_game` (Ch 2, "Done" `#57D6C8` tag), `minigrep` (Ch 12, "After Ch 12"), `hello` (Ch 21, "After Ch 21").

**Footer note**
- "Exercises, hints and solutions from Rustlings (MIT), in Rustlings’ order. The § tags come from its exercise-to-chapter map."

**Order rule**
- Exercises keep Rustlings’ own order. Book tags advise but never lock anything.

### Exercise (`Workspace.dc.html` + `CodeEditor.dc.html`)

**Top bar** (56 dp)
- Back; exercise name and topic ("move_semantics · 2 of 5").
- XP badge "+40 XP".
- Book icon (`menu_book`) → the related Book section.
- Overflow (`more_vert`) → Exercise menu.

**Editor** (`CodeEditor.dc.html`)
- JetBrains Mono 13/21, ligatures off, line-number gutter, current-line highlight.
- Error/warning/running line backgrounds and underlines: `#FF6B76` / `#F2C25B` / `#FFA14A`.
- Blinking caret `#F74C00`.
- Key row above the keyboard (44 dp keys): Tab (`keyboard_tab`), `{ } ( ) ; : & < > !`, `::`, `->`, undo, redo. Hide-keyboard button.
- Auto-indent on Enter. Bracket and quote auto-close (setting).

**Bottom sheet** (draggable, background `#161514`)
- Snap heights 76 (collapsed), 380 (half) and 700 (full).
- Actions:
  - primary **Check** (`task_alt`): compiles the file and runs its tests, like `cargo test`
  - **Run** (`play_arrow`): runs `main()` only
  - **Explain** (`school`)
- Tabs: **Output**, **Explain** (disabled with no error), **Hints n/3**, **Solution** (`lock` icon until unlocked).
  - **Output**:
    - The command line `$ cargo test --bin move_semantics2` and a **Wrap** toggle (`wrap_text`).
    - rustc output, **unedited**, with ANSI colors (Terminal colors under Design tokens).
    - Empty state: "No output yet", "Check compiles this file and runs its tests. rustc’s messages show up here, unedited."
  - **Explain**:
    - "WHAT HAPPENED": numbered steps with line chips (`L21`, `L23`, `L25`) and OK/error states.
    - "WAYS TO FIX": each fix has a label, code and a note, with "Apply to my file".
    - Links: "Read 4.2 References and Borrowing", "rustc --explain E0382".
    - Empty state: "Nothing to explain", "When Check hits an error or a panic, a plain-English walkthrough appears here."
  - **Hints**: three levels revealed in order, labeled "HINT 1 · NUDGE", "HINT 2 · FROM RUSTLINGS" (Rustlings’ official hint, verbatim), "HINT 3 · ANSWER".
    - Buttons: "Reveal hint N" / "Reveal hint N−1 first".
    - Note: "Every failed Check counts as an attempt. Hints don’t."
  - **Solution**:
    - Locked: "Unlocks after 3 attempts" + "See it now" (→ dialog).
    - Unlocked: the official Rustlings solution as a diff, with "Apply to my file", the note "Passing with the solution applied earns 10 XP instead of 40.", and "Undo".

**First-visit tour**
- Four tips with "TIP n OF 4" and "Skip":
  - "Edit right here"
  - "Check your work"
  - "Read the compiler"
  - Hints: "Hints come in three levels, from a nudge to the answer. The solution unlocks after 3 attempts."

**Success state**
- A colored burst (`ox-burst`), a `check` mark and "+40 XP" counting up.
- Level progress "Lv 7 · Borrow Checker Apprentice".
- "Rustlings 27 of 95" with its bar and "move_semantics 2/5".
- "12-day streak kept", "Today’s mission: 1 of 3 exercises done".
- Primary button "Next: `move_semantics3`"; secondary "Compare with the official solution", which opens the Solution tab.

**Check rules**
- The prototype checks code with patterns (`EX[id].check` in `oxide-lib.js`). Production should compile for real and use rustc’s actual output.

### Search (`Search.dc.html`)

- **Top bar**: back + search field (48 tall, radius 24, `#1E1C1B`), `search` icon, placeholder "The Book, Rustlings, errors", clear button. Focused on open.
- **Filter chips**: All / Book / Rustlings / Errors, each with a result count. Selected: `#FF8A55` text, `rgba(247,76,0,0.16)` fill, `rgba(247,76,0,0.5)` outline.
- **Idle**: "RECENT" chips (`history` icon), then "Search section titles in the Book, Rustlings exercises and the compiler’s error index."
- **Results** in groups: THE BOOK, RUSTLINGS, COMPILER ERRORS.
  - Rows 64 tall with an icon tile (or a red error code badge), the title with the match highlighted in `#FF8A55` 650, a subtitle and a chevron.
  - A section match also returns the Rustlings topics that drill that section.
- **No results**: `search_off` icon, "No matches for “q”", "Try a word from a section title, an exercise name or an error code like E0382."

### Terminal (`Terminal.dc.html`)

**Top bar** (64 dp)
- Optional back.
- Folder button: icon tile + folder name (mono 16/600) + `expand_more` + full path (mono 11.5 `#8C867F`). Opens the Terminal projects sheet.
- Clear button (`clear_all`).

**Mission card** (day 1 only)
- "TODAY’S MISSION · STEP 3 OF 3", "Make a Cargo project and run it", "Cargo is Rust’s build tool. It makes a project with a Hello, world! program already in it."
- Step chips: `cargo new hello_world`, `cd hello_world`, `cargo run`, each ticking off with `check_circle`.
- When done: "MISSION COMPLETE · +60 XP", "You ran your first Rust program.", "Tomorrow, 1.3 Hello, Cargo! explains what Cargo just did.", and a "Home" link.

**Session**
- A list of blocks separated by 1 dp `#1C1A19` lines, padding 12 16 14.
- Block header: `$` (`#FF8A55` mono 13.5/600), the command (mono 13.5/500), and on the right a spinner, "running", the duration ("0.48s"), or "exit 1" in `#FF8F98`.
- Output: mono 12/18, ANSI colors, horizontal scroll (prose lines wrap).
- Action buttons under a block (40 tall, radius 12, `#1E1C1B`, inset 1 dp `#2E2C2A`):
  - "Explain E0382" (`help` `#FF8F98`)
  - "Open move_semantics2" (`data_object` `#57D6C8`)
  - "Read 4.2" (`menu_book` `#FF8A55`)
  - "Open Practice"

**Input area** (`#141312`, 1 dp top line `#24221F`)
- **Process row** (when a program is running): pulsing `#57D6C8` dot, "guessing_game is waiting for input", "Stop ⌃C".
- **Suggestion chips** (36 tall in a 44 dp target, radius 10):
  - The next mission step comes first, filled `#F74C00` with `#1A0B04` text.
  - Then suggestions for the folder: `cargo run/build/check/test/clippy`, `cat src/main.rs`, `ls` in a project; `rustlings run/hint` in `~/rustlings`; `cd <project>` and `cargo new …` in `~/projects`.
- **Command field**: 52 tall, radius 14, `#1E1C1B`, 1 dp `#2E2C2A` border (1.5 dp `#F74C00` focused).
  - Prompt "$" (`#FF8A55`), or "›" (`#57D6C8`) while a program waits for input.
  - Mono 15. Placeholder "Type a command" / "Type a number, then Enter".
  - Return button 40 × 40, radius 11, `#F74C00` when there is input.
- **Extra key row** while focused (44 dp keys): `Tab ⌃C ↑ ↓ ~ / - _ | .`

**Commands**
- `help`, `ls`, `cd`, `pwd`, `cat` (`.rs` files highlighted), `echo`, `history`, `clear`, `whoami`.
- `cargo new|build|run|check|test|clippy|fmt|--version|help`.
- `rustc --version|--explain EXXXX|<file>`, and running `./<binary>`.
- `rustlings run|hint [exercise]`.
- Tab completion, ↑/↓ history, ⌃C, ⌃L.
- Error messages follow real shell, cargo and rustc wording.
- Programs that read stdin (the chapter 2 guessing game) take input from the same field.

**File system**
- `~/projects/<name>` for Cargo projects. `~/rustlings/exercises/<NN_topic>/` holds all 95 exercises.

### Project (`Project.dc.html`)

One Book project: `guessing_game` (Ch 2), `minigrep` (Ch 12) or `hello` (web server, Ch 21).

**Top bar**
- Back, delete (`delete`), info.

**Body**
- Name and a description, for example "A command-line game. The program picks a number from 1 to 100 and you guess until you get it."
- Prerequisite note for `minigrep` and `hello`, for example "Uses modules, collections, error handling, traits and tests from chapters 7 to 11. You’re on chapter 4, so you may want those first."
- **IN THE BOOK**: the chapter’s sections as steps, each with what it teaches:
  - "Setting Up a New Project": `cargo new guessing_game`
  - "Processing a Guess": "Read input with io::stdin"
  - "Generating a Secret Number": "Add the rand crate"
  - "Comparing the Guess to the Secret Number": "match on Ordering"
  - "Allowing Multiple Guesses with Looping": "loop, continue and break"
- **FILES**: the project’s files, with "Edit" (→ Editor) and a terminal action (→ Terminal in the project folder).

### Editor (`Editor.dc.html`)

- **Top bar**: back, file tabs (`src/main.rs`, `Cargo.toml`), saved indicator, primary **Run** (`play_arrow`). Run saves and opens the Terminal running `cd <project> && cargo run`.
- **Body**: the shared CodeEditor with the key row.

### Profile (`Profile.dc.html`)

**Header**
- "Profile" + settings icon.

**Identity card** (hero)
- 56 dp avatar "S", "Sam" (20/650), "Learning Rust since July" (day 1: "Joined today").
- "Lv 7" badge + "Borrow Checker Apprentice".
- 6 dp XP bar, "1,840 / 2,400 XP" and "560 XP to Lv 8" (mono 12).

**Two stat cards**
- **Streak**: `local_fire_department` filled `#FF7A3D`, "12" days, "Best: 19 days".
  - Day 1: grey flame, 0, "Starts when you finish today’s mission".
- **Daily goal**: "30 min", plus a week row M–S of 14 dp dots: done `#57D6C8`, today ringed `#F74C00` with a partial conic fill, others outlined `#3A3735`.

**PROGRESS**
- The Book "10 of 80 sections", Rustlings "26 of 95 exercises", Book projects "1 of 3". Each has a 4 dp bar and links to its tab.

**ERRORS YOU’VE FIXED** ("25 fixes")
- Rows: red code badge, error title, "×9", chevron.
  - E0308 ×9, E0382 ×7, E0425 ×4, E0499 ×3, E0596 ×2
- Tapping a row → Terminal with `rustc --explain`.
- Empty state (day 1): "When you fix a compiler error, it shows up here. Tap one to read what it means."

### Settings (`Settings.dc.html`)

**Top bar** (56 dp)
- Back + "Settings" (20/600).

**Body** (padding 8 16 32): groups of rows (radius 20, `#171615`, 1 dp dividers), each group under a mono label.

**Account row**
- 40 dp avatar, "Sam", "Signed in with GitHub · synced 2 min ago" → Account.

**LEARNING**
- Daily goal: "About 12 weeks to finish the Book and Rustlings", value "30 min" → Daily goal dialog.
- Reminder: switch + "Every day at 20:30, …" → Reminder time dialog.
- Show the official solution: "After 3 failed checks" → Solution setting dialog.
- Quizzes from Brown’s edition: switch, "Questions inside Book sections".

**EDITOR AND TERMINAL**
- Code size stepper (11–20, default 14) with a live highlighted preview line.
- Theme segmented control: Dark / Paper / System.
- "Symbol row above the keyboard" (switch).
- "Close brackets and quotes" (switch), "Typing ( adds the matching )".

**OFFLINE**
- Rust 1.99.1 · 286 MB: tap "Check" → "Checking…" → "Up to date" (`#57D6C8`).
- The Book · 9 MB "Saved".
- Rustlings · 3 MB "Saved".
- Projects "guessing_game, hello_world · 41 MB".

**ABOUT**
- Content licenses (full text in the file).
- Version "1.0.0".

**Sign out**
- Outlined button, `#FF8F98` text → Sign out dialog.

### Account (`Account.dc.html`)

- Top bar "Account".
- Avatar, "Learning Rust since July".
- **Name** field (editable; focused outline `#F74C00`), helper "Shown on your profile."
- **Email** row (`mail`): `sam@fastmail.com`.
- **SIGN-IN**: GitHub "Connected as @samr"; Google "Not connected" (connect toggle).
- Sync status: "Last synced 2 min ago" → "Synced just now".
- **YOUR DATA**: "Export my data", "Progress and code as a .zip".
- **Delete account** → dialog.

---

## Popups (`Overlays.dc.html`, plus two in screen files)

### Dialogs

**Style**
- Card: `#2B2928`, radius 28, max-width 312, top padding 24, centered over `rgba(0,0,0,0.5–0.6)`.
- Title: 20–24, `#ECE8E3`.
- Body: 14–15/1.5 `#A39C95`.
- Actions: right-aligned text buttons, `#FF8A55` 600, 48 tall. Destructive actions use `#FF8F98`.
- Radio options use 20 dp radios with `#F74C00` when selected.

1. **Notification permission** (Android system dialog, in `Onboarding.dc.html`)
   - `notifications` icon `#FF8A55`.
   - "Allow **Oxide** to send you notifications?"
   - Stacked buttons: "Allow", "Don’t allow". Denying turns the reminder off.
2. **Daily goal** (radio)
   - "Pick what you can keep up on a busy day."
   - Options: "10 min a day · ≈ 36 weeks to finish", 20 (≈ 18), 30 (≈ 12), 45 (≈ 8).
   - Cancel / OK.
3. **Reminder time** (Material 3 time picker)
   - "Select time", hour : minute boxes, AM/PM toggle, clock dial (numbers on a 100 dp radius).
   - Turn off / Cancel / OK.
   - Snackbar "Reminder set for 8:30 PM" or "Daily reminder off".
4. **Solution setting** (radio)
   - "Show the official solution": "After 3 failed checks" / "Only after you pass" / "Never".
5. **See the solution early**
   - "See the solution now?"
   - "You’ve checked N times. The solution unlocks after 3 failed checks. If you open it before you pass, this exercise gives no XP."
   - Cancel / Show solution.
6. **Download paused**
   - "Download paused", "Rust still needs 186 MB. Connect to Wi-Fi to finish, or continue on mobile data."
   - Wait for Wi-Fi / Use mobile data.
7. **Delete project**
   - "Delete guessing_game?", "This deletes ~/projects/guessing_game and every file in it from this phone. Your Book and Rustlings progress stays."
   - Cancel / Delete. Then a snackbar "guessing_game deleted" with "Undo".
8. **Sign out**
   - "Sign out of Oxide?", "Your progress is saved to your account. Projects in ~/projects stay on this phone."
   - Cancel / Sign out → Welcome.
9. **Delete account**
   - "Delete your account?", "This permanently deletes your progress, streak and synced code from Oxide. Projects stored on this phone are not deleted."
   - Cancel / Delete account.

### Bottom sheets

**Style**
- Background `#1C1B1A`, top radius 28.
- 28 dp handle row with a 32 × 4 `#4A4643` handle.
- Scrim `rgba(10,9,9,0.62)`, max height 86%.
- Rows 56–64 tall with 22 dp icons.

1. **Terminal projects** (in `Terminal.dc.html`)
   - "Projects" title + "New project" tonal button.
   - Rows for each `~/projects/*`, `rustlings` ("26 of 95 exercises done") and `~`. The current folder is tinted and checked.
   - "FROM THE BOOK" rows for projects not made yet, which prefill `cargo new <name>`.
2. **Exercise menu**
   - "Reset to the original file"
   - "Run in the Terminal" (`cd ~/rustlings && rustlings run move_semantics2`)
   - "Read 4.2 References and Borrowing"
   - "Report a problem"
3. **Command actions**
   - The command and its metadata, "Copy command", "Copy output", "Report a problem".
   - Snackbars "Command copied" / "Output copied".
4. **Text settings** (Reader)
   - Text size A− / A+ (default 16.5 px).
   - Line spacing options (default 1.7).
   - Live preview: "We call the action of creating a reference borrowing."
5. **Streak**
   - "12-day streak", "Best: 19 days".
   - Month calendar "November 2026": goal-reached days filled, today ringed. Legend "Goal reached", "Today".
   - "A day counts when you reach your 30-minute goal. Today: 28 of 30 minutes."
   - Day 1: "No streak yet", "Reach today’s goal to start one", "… Today’s mission takes about 15 minutes."
6. **XP and levels**
   - Level badge, title, XP bar, "560 XP to Lv 8".
   - "HOW YOU EARN XP": Rustlings exercise (+40–50), Checkpoint quiz (+100), Quick check in the Book (+10), Daily mission (+60).
   - "Hints are free. If you open a solution before you pass, that exercise gives no XP."
7. **Report a problem**
   - Radio reasons: "The instructions are unclear", "My fix should pass", "A hint is wrong or unhelpful", "Something else".
   - "Include my code" switch, "Attach the file as it is now".
   - "Send report" (disabled until a reason is picked). Then the snackbar "Report sent. Thank you."

### Moments and messages

1. **Mission complete** (full screen, below the status bar)
   - "WEEK 3 · DAY 4 · MISSION COMPLETE", "You read 4.2 and fixed 3 exercises."
   - TODAY checklist with `check_circle`.
   - TOMORROW: "4.3 The Slice Type, then move_semantics5."
   - Buttons "Done" and "See your progress".
   - Day-1 version: "WEEK 1 · DAY 1 · MISSION COMPLETE", "You wrote and ran your first Rust program." Items 1.1 Installation, 1.2 Hello, World!, `cargo new hello_world`. Tomorrow: "1.3 Hello, Cargo!, then your first Rustlings exercise, intro1."
2. **Level up** (full screen)
   - Expanding rings (`ox-ring`) and a burst, "LEVEL UP", big "8", title "Struct Builder".
   - "You passed 2,400 XP. Chapter 5 is next: structs, methods and grouping related data."
   - "Next: Lv 9 at 3,100 XP", "Continue".
3. **Reminder notification** (heads-up, top of screen)
   - "Oxide · now", "Your 12-day streak ends at midnight", "2 minutes left on today’s goal. Pick up at move_semantics2."
   - Actions open the exercise or "Later".
4. **Snackbar**
   - `#ECE8E3` background, radius 6, min height 48.
   - Text 14/1.4 `#1F1D1B`. Optional action in `#A8360A` 650 14.
   - Shadow `0 4px 14px rgba(0,0,0,0.4)`.
5. **Offline banner**: see Frame.

---

## Interactions and behavior

- **Touch targets**: at least 44 dp. Visual chips are 34–36 dp inside 44 dp hit areas.
- **Press and hover**:
  - Rows and icon buttons: `rgba(255,255,255,0.03–0.06)` overlay.
  - Primary buttons: `#F74C00` → `#FF5A10`.
  - Tonal buttons: `#2A2826` → `#34312E`.
- **Motion**:
  - Nav indicator: `background 200ms`.
  - Bottom sheets and the exercise sheet: `transform 460ms cubic-bezier(.2,.9,.25,1.04)`. Drag between snap points.
  - Progress fills: `width 600ms cubic-bezier(.2,.8,.2,1)`.
  - Spinner: `ox-spin`, 360° rotation.
  - Caret: `ox-blink`, opacity 0 at 50%.
  - Waiting dot: `ox-pulse`, opacity 1 → 0.3 over 1.2 s.
  - Indeterminate bar: `ox-indet`, translateX −110% → 260%.
  - Success: `ox-burst`, particles flying out and fading. Level up: `ox-ring`, scale .7 → 1.8 while fading.
- **Exercise attempts**: every failed Check is an attempt; hints aren’t.
  - The solution unlocks after 3 failed attempts, or once passed (set in Settings).
  - Opening it early sets the exercise’s XP to 0. Passing with the solution applied gives 10 XP.
- **XP**:
  - Rustlings exercises 40 (easy) / 50 (medium); quizzes 100; Book quick checks 10; daily mission 60.
  - Levels: Lv 1 0–300 "Hello, World"; Lv 7 "Borrow Checker Apprentice" up to 2,400; Lv 8 "Struct Builder" up to 3,100. Define the remaining titles and thresholds.
- **Streak**: a day counts when the daily goal (minutes of activity) is reached.
- **Mission progress marks**:
  - Book sections are marked read past 90% scroll.
  - Rustlings exercises when Check passes.
  - The day-1 terminal step when `cargo run` prints "Hello, world!".
- **Reader resume**: stores the scroll position per section and scrolls to the "YOU LEFT OFF HERE" marker.
- **Terminal output**: show rustc and cargo output verbatim, colored per Terminal colors. Errors with a known code get action buttons.

## State management

- **User**: name, avatar, email, linked providers (GitHub, Google), sync status.
- **Plan**: starting level (0–2), daily goal minutes (10/20/30/45), reminder on/off and time, notification permission.
- **Preferences**: solution policy, Brown quizzes on/off, code size (11–20), theme (dark/paper/system), symbol row, auto-close brackets.
- **Progress**:
  - Book: read sections, current section and scroll %.
  - Rustlings, per exercise: status, attempts, hints revealed, solution viewed, current code.
  - Quizzes passed, projects made.
  - XP, level, streak (current, best, day history), today’s minutes.
  - Fixed error codes with counts.
- **Daily mission**: built each day from the Book position and Rustlings’ chapter map. Its steps reference Book sections, exercises or terminal commands.
- **Toolchain and content**: download state per package (toolchain, Book, Rustlings), version checks.
- **Terminal**: per-session cwd, blocks (command, output lines, status, exit code, duration), history, running process and stdin.
- **Projects**: files under `~/projects`.

## Design tokens

### Color

**Rust (brand)**
| Token | Value | Use |
|---|---|---|
| rust | `#F74C00` | Primary buttons, progress fills, focus rings, the logo |
| rust-pressed | `#FF5A10` | Primary hover/pressed |
| rust-light | `#FF8A55` | Accent text, active nav icon, links, dialog actions, "$" prompt |
| rust-hover-text | `#FFA070` | Link hover |
| rust-tint | `rgba(247,76,0,0.16)` (also 0.08, 0.14, 0.2) | Selected rows and chips, level badge, nav indicator (0.2) |
| on-rust | `#1A0B04` | Text and icons on rust (5.5:1) |
| flame | `#FF7A3D` | Streak icon |
| on-rust-thumb | `#FFF1EA` | Switch thumb when on |

**Surfaces** (darkest to lightest)
| Token | Value | Use |
|---|---|---|
| ground | `#0F0E0E` | App background, editor |
| well | `#121110` | Program output under code |
| input-bar | `#141312` | Terminal input area |
| bar | `#161514` | Nav bar, exercise sheet |
| surface-1 | `#171615` | Cards, list groups, code blocks |
| surface-2 | `#1A1918` | Hero cards (with inset 1 dp `rgba(255,255,255,0.05)`) |
| sheet | `#1C1B1A` | Bottom sheets |
| surface-3 | `#1E1C1B` | Inputs, chips, icon tiles |
| surface-4 | `#211F1E` | Chips, link rows, switch track when off |
| raised | `#2A2826` (hover `#34312E`) | Tonal buttons, inline code |
| dialog | `#2B2928` | Dialogs, notifications |
| track | `#2C2A28` | Empty progress |
| border | `#2E2C2A` | Chip and input outlines |
| outline | `#3A3735` | Outlined buttons, empty rings |
| handle | `#4A4643` | Sheet handles |
| snackbar | `#ECE8E3` | Snackbar background (text `#1F1D1B`, action `#A8360A`) |

**Text** (contrast on ground)
| Token | Value | Ratio | Use |
|---|---|---|---|
| text-primary | `#ECE8E3` | 15.8:1 | Titles, labels, code |
| text-reading | `#E2DDD7` | 14.3:1 | Book prose |
| text-strong-2 | `#D9D3CC` | — | Secondary emphasis, icons |
| text-muted-hi | `#C9C2BA`, `#B3ACA5` | — | Unread rows, tags |
| text-secondary | `#A39C95` | 7.1:1 | Descriptions, section labels |
| text-tertiary | `#8C867F` | 5.4:1 | Metadata, counts, paths |
| text-disabled | `#6E6862` | 3.5:1 | Placeholders and disabled only, never body text |
| icon-off | `#5C5752` | — | Unchecked status icons |

**Status**
| Token | Value | Use |
|---|---|---|
| done | `#57D6C8` (on `#06201C`; tint `rgba(87,214,200,0.12)`) | Passed, read, Rustlings, success |
| error | `#FF6B76` (tint `rgba(255,107,118,0.12)`) | Underlines, wrong answers |
| error-text | `#FF8F98` | Error codes, exit codes, destructive actions |
| checkpoint | `#F2C25B` (on `#10100F`) | Quizzes, offline, warnings |
| running | `#FFA14A` | Line marker while code runs |

**Rust syntax** (dark): keyword `#E8946A` · type and format args `#E6C072` · function `#8DB6FF` · string `#A9D59B` · macro `#6CD0D6` · number `#C9A3F2` · lifetime `#F291B0` · comment `#7D766F` · attribute `#A0988F` · punctuation `#A9A29B` · identifier `#E9E5E0` · inline code `#F2CDB8` on `#2A2826`.
Light versions are in `SYN.light`.

**Terminal colors** (dark; capital letters in the `§X` markup mean bold): default `#E4E0DB` · bright `#F5F2EF` · dim `#8C867F` · red `#FF6B76` · yellow `#F2C25B` · green `#7FD99A` · cyan `#62D0E0` · blue `#7FA9FF` · aqua `#57D6C8` · orange `#FF7A3D` · magenta `#D39CFF`.
Light versions are in `TCL`.

### Typography

Fonts: **Public Sans** (UI, variable 300–800), **JetBrains Mono** (code, numbers, labels; always `font-variant-ligatures: none` for code), **Material Symbols Outlined** (icons; variable `FILL` 0/1, `wght` 300–500).

| Role | Spec |
|---|---|
| Display | Public Sans 34/1.1, 650, −0.03em (Welcome) |
| Headline | 28/1.18, 650, −0.025em (onboarding steps) |
| Reader H1 | 30/1.15, 650, −0.025em |
| Screen title | 24, 650, −0.02em (tab roots) · 20/600 (pushed screens) |
| Card title | 20/1.25, 650, −0.01em |
| Reader H2 | 21/1.25, 650, −0.015em |
| Body large | 16.5/1.7 (Book prose) · 16/1.55 |
| Row title | 15–15.5, 600 |
| Body | 14.5–15/1.5 |
| Secondary | 13–13.5/1.4–1.45, `#A39C95` |
| Caption | 12–12.5, `#8C867F` |
| Section label | JetBrains Mono 11, 500, letter-spacing 0.09em, uppercase, `#A39C95` |
| Small label | JetBrains Mono 10.5, 500, 0.08em |
| Code (editor) | JetBrains Mono 13/21 (12/21 compact) |
| Code (listing) | JetBrains Mono 12.5/20 |
| Terminal | JetBrains Mono 12/18 · output well 11/17 |
| Big numbers | JetBrains Mono 600, 24–36, −0.02em |
| Buttons | Public Sans 650, 15.5–17 (primary) · 600, 13–15 (others) |

### Spacing

4 dp base. Common gaps: 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28. Screen edge: 16 dp for cards, 20–24 dp for text. Sections inside a scroll view: 14 dp gap.

### Sizes

- Icon buttons 48 × 48.
- List rows min 64 (compact 56).
- Primary buttons 52 (56 in onboarding).
- Outlined and text buttons 48. Tonal buttons 34–44.
- Inputs 48–56.
- Chips 34–36 (44 dp target). Keys 44.
- Status bar 36; top bars 56 (pushed) / 64 (tab roots); nav bar 80; gesture bar 22.
- Rings 36 (inner 30). Progress bars 3 (reader), 4 (default), 6 (hero), 8 (Rustlings segments).
- Icons 16, 18, 20, 22, 24; 26–36 for empty and celebration states.

### Radius

| Value | Use |
|---|---|
| 2–3 | Progress bars, small squares |
| 5–8 | Badges, tags, inline code |
| 10–12 | Chips, keys, icon tiles, action buttons |
| 14 | Inputs, code wells, quiz options, NOTE boxes |
| 16–18 | Code listings, list groups, selection cards |
| 20 | Settings groups, quiz card |
| 24 | Hero cards, search field, 48 dp buttons |
| 26–28 | Pill buttons (height ÷ 2), dialogs, sheet tops |

### Elevation and borders

The UI is mostly flat; depth comes from surface color steps and 1 dp inset hairlines:
- `inset 0 0 0 1px rgba(255,255,255,0.05)`: hero cards.
- `inset 0 0 0 1px #3A3735`: outlined buttons.
- `inset 0 0 0 1px #2E2C2A`: chips and inputs.
- `inset 0 1px 0 rgba(255,255,255,0.05)`: dividers.

Drop shadows only on the snackbar (`0 4px 14px rgba(0,0,0,0.4)`) and the success badge (`0 6px 18px rgba(247,76,0,0.22)`).

### Components

- **Switch** (M3): 52 × 32, radius 16.
  - On: track `#F74C00`, thumb 24 dp `#FFF1EA` at x 24.
  - Off: track `#211F1E` with a 2 dp `#6E6862` border, thumb 16 dp `#8C867F` at x 8.
- **Radio**: 22 dp, 2 dp ring; selected `#F74C00` with a 10 dp dot.
- **Progress ring**: a 36 dp conic gradient (`#F74C00` arc over `#3A3735`), with an inner 30 dp disc in the row background.
  - Done: solid `#57D6C8` with `#06201C` text.
  - Quiz node: the same ring as a 28 dp rotated square.
- **Badges**:
  - Level: 24 tall, radius 6, `rgba(247,76,0,0.16)`, `#FF8A55`, mono 12.5/600.
  - Error code: 24 tall, radius 6, `rgba(255,107,118,0.12)`, `#FF8F98`, mono 12/600.
- **Selection card**: radius 18, `#171615` with 1 dp `rgba(255,255,255,0.05)`. Selected: `rgba(247,76,0,0.08)` with an inset 2 dp `#F74C00`.

## Assets

- **No images.** All visuals are type, color and icons.
- **Icons**: Material Symbols Outlined (Google Fonts, Apache-2.0). Names used:
  - `home` `menu_book` `data_object` `terminal` `person` `search` `arrow_back` `arrow_forward` `chevron_right` `expand_more` `expand_less`
  - `more_vert` `settings` `toc` `check` `check_circle` `timelapse` `radio_button_unchecked` `play_arrow` `play_circle` `task_alt` `school` `lock`
  - `help` `quiz` `flag` `folder` `folder_open` `folder_code` `notifications` `wifi` `wifi_off` `cloud_off` `signal_cellular_alt` `local_fire_department` `timer`
  - `clear_all` `keyboard_return` `keyboard_tab` `keyboard_hide` `undo` `redo` `wrap_text` `visibility` `delete` `info` `mail` `history` `close` `search_off`
  - `smartphone` `add` `remove` `input`
- **Fonts**: Public Sans and JetBrains Mono (Google Fonts, SIL OFL).
- **Content** (all open source; keep the license notices shown in Settings → About):
  - *The Rust Programming Language*, `rust-lang/book` (MIT or Apache-2.0): `src/SUMMARY.md` for the table of contents (21 chapters + appendices, 80 numbered sections), plus chapter Markdown and listings. Sample text in the prototype is from `src/ch01-02-hello-world.md` and `src/ch04-02-references-and-borrowing.md`.
  - *Rustlings*, `rust-lang/rustlings` (MIT): exercises in `exercises/` (95 in 25 topics + `quizzes/quiz1–3.rs`), solutions in `solutions/`, official hints in `rustlings-macros/info.toml`. The topic-to-chapter map is the table in `exercises/README.md`.
  - *Brown University’s interactive edition*, `cognitive-engineering-lab/rust-book` (MIT or Apache-2.0): quizzes in `quizzes/*.toml`. Its chapter 4 numbering differs from the official Book, so quizzes need mapping to official sections.
  - *rustc error index*, `rust-lang/rust` `compiler/rustc_error_codes/src/error_codes/EXXXX.md` (MIT or Apache-2.0). **The explanations in `oxide-lib.js` (`ERRS`) are shortened from memory. Replace them with the real text.**
- **Placeholders to replace**: download sizes (286 / 9 / 3 MB), the Rust version line and commit hashes ("rustc 1.99.1 (f0e3b1c27 2026-10-15)"), user data (Sam, @samr, sam@fastmail.com), level titles beyond those listed.

## Files

All in `prototype/`. Open `Oxide.dc.html` over HTTP for the overview.

| File | Contents |
|---|---|
| `Oxide.dc.html` | Overview canvas: color palette (5a), first run (5b), tabs (5c), screens (5d), key states (5e), dialogs (5f), sheets (5g), moments and messages (5h) |
| `OxidePhone.dc.html` | Device frame, status bar, offline banner, nav bar, gesture bar, navigation stack, popup layer, snackbar |
| `Onboarding.dc.html` | Welcome, level, goal, notification permission, setup and download, account, email sign-in |
| `Home.dc.html` | Home, established and day 1 |
| `Book.dc.html` | Learn tab: continue card, contents strip, chapter and section list |
| `Reader.dc.html` | Book reader (sections 1.2 and 4.2), runnable listings, quiz, practice cards |
| `Practice.dc.html` | Practice tab: Rustlings path, quizzes, Book projects |
| `Workspace.dc.html` | Exercise screen: editor, Check/Run, output, explain, hints, solution, tour, success |
| `CodeEditor.dc.html` | Shared code editor: highlighting, caret, marks, key row, on-screen keyboard |
| `Terminal.dc.html` | Terminal: shell, cargo/rustc/rustlings simulation, projects sheet, day-1 mission |
| `Project.dc.html` | Book project detail |
| `Editor.dc.html` | Project file editor |
| `Profile.dc.html` | Profile tab |
| `Settings.dc.html` | Settings |
| `Account.dc.html` | Account |
| `Search.dc.html` | Search across the Book, Rustlings and error codes |
| `Overlays.dc.html` | All dialogs, sheets, Mission complete, Level up, heads-up notification |
| `oxide-lib.js` | Shared data and logic: Rust lexer and highlighter, ANSI renderer, syntax and terminal palettes, exercises (code, checks, compiler output, hints, solutions), Book table of contents, Rustlings path and chapter map, error index samples, guessing game source |
| `support.js` | Runtime for the prototype files only. Not part of the design. |
