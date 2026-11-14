# Mobile app design brief

_Started 2026-11-14 01:51 UTC_

---

## User

<artifact-content-authored-by-others/>
Design a mobile app for

## User

Design a mobile app for

## User

<artifact-content-authored-by-others/>
Answered — Asked for follow-up questions; presentation: Canvas board: all screens laid out by flow, each interactive; variations: 2–3 directions for Home + Exercise workspace first, then build out the winner; interactions: Bottom tab navigation, Onboarding choices → generated roadmap, Typing in the editor + accessory keys, Run/Check → compiling → error → fix → success, Draggable compiler output sheet, Progressive hints…; tone: Calm mentor: plain, encouraging, no hype

## Assistant



## Assistant

_[tool: ask_user]_

_[tool: run_script]_

_[tool: web_search]_

_[tool: write_file]_

_[tool: dc_write]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: str_replace_edit]_

_[tool: dc_js_str_replace]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: show_html]_

_[tool: show_html]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: run_script]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: ask_user]_

_[tool: ask_user]_

I added three more questions to the form: how different the Home and Workspace directions should be, where compiler errors should appear, and what Home should open with.

One direction of both screens is already built, along with the live editor, the draggable compiler sheet, hints and the success screen. Once you answer, I'll add the other directions next to it, then build the remaining screens in whichever one you choose.

## User

<artifact-content-authored-by-others/>
Answered — Asked for follow-up questions; divergence: Different layouts and interaction models; errors_home: Draggable bottom sheet (as in the brief), Inline under the failing line, expandable, Fixed split: editor above, output below, Output as a second full screen you flip to; home_lead: Today's mission (as in the brief), Resume exactly where I left off (code or page), Progress as the hero: roadmap + heatmap, Terminal-style daily log; open_questions: 1. light or crea rust color thee

## Assistant



## Assistant

_[tool: ask_user]_

I've added two more questions to the form. You chose all four options for both Home and Workspace, so I'm asking how you want them grouped into directions. I'm also asking where the cream theme with rust accents should apply. I'll start building once you answer.

## User

<artifact-content-authored-by-others/>
Answered — Asked for follow-up questions; structure: 4 full directions, each pairing one Home with one Workspace; cream_theme: One direction fully on cream paper with rust accents

## Assistant



## Assistant

_[tool: ask_user]_

I added a final round to the form with three questions:

- **Pairings:** I suggest A Mission + bottom sheet, B Resume + inline errors, C Progress hero + fixed split, D Daily log + flip-to-output.
- **Cream theme:** which of the four directions gets cream paper with rust accents.
- **Depth:** how many Workspace states to build for each direction.

Once you answer, I'll build all four next to each other.

## User

<artifact-content-authored-by-others/>
Answered — pairing: A Mission + bottom sheet · B Resume + inline errors · C Progress hero + fixed split · D Daily log + flip-to-output; depth: Home + full Workspace flow (tips, typing, compiling, error, panic, pass, success)

## Assistant

Building four directions for Home and Workspace, each with seven Workspace states. First the shared engine and theming.

_[tool: run_script]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: run_script]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: snip]_

_[tool: snip]_

_[tool: dc_write]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: run_script]_

_[tool: delete_file]_

_[tool: ready_for_verification]_

I've built the four directions as rows on the canvas, 1a to 1d. Each row has Home followed by seven exercise states: first-run tips, typing, compiling, compile error, panic, tests passing and success. Every phone is live, and a check is still running in the background.

- **1a Mission + bottom sheet (dark):** closest to your brief. Home leads with today's mission and one Continue button; compiler output sits in a draggable sheet over the editor.
- **1b Paper (cream with rust accents):** this is the cream theme you asked about. Home reopens the exact line of code or paragraph you left off on. Errors and hints print as notes under the line they refer to; tap the code to edit.
- **1c Progress + fixed split (dark):** Home leads with the 12-week plan and an activity heatmap, with the mission pinned above the tab bar. The workspace is a resizable split: code on top, and a Problems list below where each line reference jumps to that line in the code.
- **1d Daily log + flip (terminal style):** Home reads like shell output you can tap. The workspace flips between a code face and an output face. Hint, explain and solution are commands whose answers print into the output.

To try the full loop on any row, fix the borrow error in `ownership3` and tap Check; the success screen follows.

Only Home and the workspace are built in this round. The other tabs show a placeholder until you pick a direction, or a mix such as "1c workspace with 1b's Home". Then I'll build onboarding, the Book, the terminal, projects, the profile and the tablet layout in that style.

## User

1a is the best and also i want to be able to integrate rust book and rustling learning game research it

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: github_read_files]_

_[tool: github_read_files]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: github_get_tree]_

_[tool: github_get_tree]_

_[tool: github_get_tree]_

_[tool: github_get_tree]_

_[tool: web_search]_

_[tool: github_read_files]_

_[tool: grep]_

_[tool: github_search_code]_

_[tool: github_read_files]_

_[tool: github_read_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: github_read_files]_

_[tool: github_search_code]_

_[tool: github_get_tree]_

_[tool: github_read_files]_

_[tool: github_search_code]_

_[tool: web_fetch]_

_[tool: web_fetch]_

_[tool: github_search_code]_

_[tool: github_read_files]_

_[tool: github_search_code]_

## User

<artifact-content-authored-by-others/>
Re-running the check

## User

Re-running the check

## Assistant

Building the Book + Rustlings integration into 1a now: shared data first, then the Learn, Reader and Practice screens.

_[tool: write_file]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: run_script]_

_[tool: snip]_

_[tool: delete_file]_

_[tool: ready_for_verification]_

_[tool: write_file]_

I've added a new section, 2a, at the top of the canvas. It builds the Rust Book and Rustlings into 1a as seven live phones. A background check is still running; your turn 1 rows are unchanged.

**What the research found**
- **The Book** (rust-lang/book) can be shipped offline inside the app: it's licensed MIT or Apache-2.0. It has 21 chapters plus appendices. Chapters 2, 12 and 21 are projects (a guessing game, a command-line search tool called minigrep, and a web server).
- **Rustlings** (rust-lang/rustlings) is MIT licensed. It has 95 exercises in 25 topic folders, with quiz1–3 as checkpoints along the way. Each exercise comes with one official hint and an official solution.
- **The link between them:** Rustlings publishes a map from each exercise topic to the Book chapters it practises. That map ties Learn, Practice and Home together.
- **Brown University's interactive edition** of the Book is a fork under the same license. It adds quizzes after each section, but it adds and renumbers sections in chapter 4. Its quizzes would need matching to the official sections before they can go everywhere.

**What's in 2a**
- **Home:** today's mission is "Read 4.2, then 3 Rustlings exercises", with progress cards for the Book and for Rustlings.
- **Learn:** the full Book contents with your reading progress. Each chapter lists the Rustlings topics that drill it.
- **Reader (4.2 References and Borrowing):** the real text from the Book, code listings you can run, one quiz question from Brown's edition, and cards that open the matching Rustlings exercises.
- **Practice:** the Rustlings exercises in their own order, with quiz1–3 as checkpoints and a tag on each topic showing which Book section it covers. The Book's three projects sit at the bottom.
- **Exercise screen:** the real `move_semantics2`, `move_semantics3` and `move_semantics4` files from Rustlings. Hints go from a short nudge, to Rustlings' official hint, to the answer. After you pass, you can compare your fix with the official solution.

**Choices I made that you may want to change**
- Exercises stay in Rustlings' own order. The Book tags point you to what to read first but never lock anything.
- Brown's quizzes appear only in section 4.2 for now.

Only section 4.2 and `move_semantics2`–`4` actually open. Other sections and exercises appear in the lists but don't open yet.

I also added a `github.md` file that records which repositories and files these screens came from.

## User

Re-running the check

## Assistant

_[tool: ready_for_verification]_

The check on 2a is running in the background, and nothing has come back from it yet. I'll fix anything it reports.

## User

lock in with 2a and also design the terminal and check which other screens are missing to make the app complete ready for user to fully start using and create those in a flow

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: github_read_files]_

_[tool: web_search]_

_[tool: github_read_files]_

_[tool: github_search_code]_

_[tool: grep]_

_[tool: read_file]_

## User

Re-running the check

## Assistant

## User

lock in with 2a and also design the terminal and check which other screens are missing to make the app complete ready for user to fully start using and create those in a flow

## Assistant

_[tool: write_file]_

_[tool: run_script]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

Now the edits to existing screens, the shell and the canvas.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: write_file]_

_[tool: delete_file]_

_[tool: snip]_

_[tool: ready_for_verification]_

I've locked in 2a and added section 3 at the top of the canvas. It has three flows of live phones, including the new Terminal. A background check is still running, and turns 1 and 2 are unchanged.

**3a, first run:** Welcome, then starting level, daily goal with a reminder, the Android notification prompt, a toolchain download and sign-in. It then shows day 1:
- Home's mission is "1.1 is done during setup, read 1.2, then make a project".
- The reader shows 1.2 Hello, World!, using the Book's own text.
- The Terminal walks you through `cargo new hello_world` and `cargo run`, then ticks off the mission on Home.

**3b, Terminal:**
- Each command and its output sit together as one block.
- Suggestions above the input change with the folder you're in, and the guessing game from chapter 2 reads its guesses from the same input.
- Tapping the folder name switches between your projects, Rustlings and the Book's own projects.
- A failing `rustlings run` gets buttons that explain the error code, open the exercise or open section 4.2.

**3c:**
- **Profile:** streak, daily goal, progress, and the compiler errors you've fixed. Tapping one shows its explanation in the Terminal.
- **Settings and Search:** Search covers the Book, Rustlings and compiler errors. The Learn and Practice search buttons now open it.
- **Day-1 versions** of Learn, Practice and Profile.

Things that aren't real yet:
- The compiler-error explanations are shortened and written from memory. Check them against the official Rust error index before shipping.
- The download sizes and the commit hashes in the version lines are placeholders. Rust 1.99.1 is the version the Book currently targets; I couldn't confirm the latest stable release.
- The Paper theme in Settings is only a setting. The 2a screens are dark only.
- Only Book sections 1.2 and 4.2, and the Rustlings exercises `intro1` and `move_semantics2` to `4`, open.

Still missing:
- Guided builds for the Book's other projects (minigrep and the web server).
- A "mission complete" moment on Home.
- The rest of the Book's sections and Rustlings exercises.

## User

create all screens ui and popups

## Assistant

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

## User

Re-running the check

## Assistant

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: run_script]_

_[tool: snip]_

_[tool: ready_for_verification]_

Yes, they're all built. They're in section 4 at the top of the canvas, with a list of every screen and popup and 27 live phones that show them in context. I haven't looked at these phones myself yet, and a background check is still running.

The app now has 19 screens and 21 popups. This round added:

**5 new screens**
- **Project:** one for each of the Book's three projects. It shows the chapter's steps, the project files, and a button to create or open the project in the Terminal.
- **Editor:** opens `src/main.rs` and `Cargo.toml`. Run takes you to the Terminal and runs `cargo run` with your changes. Typing `edit src/main.rs` in the Terminal opens it too.
- **Account:** name, sign-in methods, sync, data export and delete account.
- **Email sign-in** and **Check your email:** sign-in by emailed link, with no password.

**18 new popups**
- **8 dialogs:** daily goal, reminder time (a clock-style picker), when to show the solution, see the solution early, download paused, delete project, sign out, delete account.
- **6 bottom sheets:** exercise menu, Terminal command actions, reader text size, streak calendar, XP and levels, report a problem.
- **4 full-screen moments and messages:** mission complete, level up, a reminder notification, and snackbars.

They also open from inside the app:
- On Home or Profile, tap the streak or the level.
- In the reader, tap the new text-size button next to the contents button.
- Tap ⋮ on an exercise or a Terminal command.
- Tap a row in Settings.

Two things are made up and need your decision:
- **XP rule:** opening a solution before you pass gives no XP for that exercise. The "see it early" dialog and the XP sheet both say this, but scoring doesn't apply it yet.
- **Placeholder copy:** "Struct Builder" as the level 8 title, and the 186 MB left in the paused download.

## User

keep only a screen needed for producyion app remove past screens

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: grep]_

_[tool: dc_write]_

_[tool: delete_file]_

_[tool: snip]_

_[tool: ready_for_verification]_

The canvas now shows only the production app, with the color palette at the top. A background check is still running.

- **Removed:** the earlier sections 1 to 4 and the other three directions' screens, plus seven screen files nothing used anymore.
- **What's left:** 19 screens and 21 popups, each shown once, plus 5 key states (Home on day 1, an exercise with hints and once solved, a Terminal program waiting for input, and `rustc --explain`). Every phone is still live and tappable.
- **Palette (5a):** the brand rust colors, backgrounds from darkest to lightest, text colors, and colors for done, error and warnings. Each has its hex code and where it's used. Text colors also show their contrast against the app background; all body text passes. It also covers the code highlighting colors and the Terminal output colors, each with a sample.

The palette is for the dark theme only, since the Paper theme was never designed.

## User

<artifact-content-authored-by-others/>
Found issues — fixing…

## User

Found issues — fixing…

## User

i will send it to claude code now

## Assistant

_[tool: read_skill_prompt]_

_[tool: snip]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: copy_files]_

_[tool: write_file]_

_[tool: present_fs_item_for_download]_

_[tool: snip]_

The handoff package for Claude Code is ready to download above. It has a detailed `README.md` and every design file. The README covers each screen and popup, how you move between them, all copy, the color palette and other design values, behavior and app state, and where the content comes from.

Three things Claude Code needs to know, all stated in the README:
- **Running code is faked.** The prototype scripts all compiler and terminal output. The real app needs a way to compile Rust, either on the phone or on a server. That choice decides whether "works offline" can stay true.
- **Placeholders to replace:** the compiler-error explanations (written from memory and shortened), download sizes, version numbers and the sample user data.
- **Not designed:** the Paper (light) theme and tablet layouts.

To open the design files, run them through a local web server (`npx serve prototype`); they don't work when opened straight from disk.

Do you want screenshots of each screen added to the package?

