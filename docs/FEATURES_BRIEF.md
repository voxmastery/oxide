# Brief: engagement and retention features

Read `docs/AGENT_BRIEF.md` first: the foundation, rules (real data, `Press`, typecheck, commit only your own
files, commit trailer) and contracts all still apply. This round adds features that have **no prototype**:
design them in the app's existing visual language, reusing its tokens, type scale and components, so they look
like they were always part of Oxide. Copy tone: calm mentor, plain and encouraging, no hype.

## Ground rules for this round
- **State:** each feature owns its own persisted zustand store at `src/features/<feature>/store.ts`
  (AsyncStorage, key `oxide-<feature>-v1`), modelled on `src/state/app.ts`. Do **not** edit
  `src/state/app.ts` unless your section says so. Read progress from `useApp` and the selectors.
- **Screens:** your screens are already registered (placeholders exist in `src/screens/`):
  `bughunt`, `review`, `league` (Home tab), `collection`, `journal`, `badges` (Profile tab),
  `buildalong` (Practice tab). Replace your placeholders; put helpers in `src/features/<feature>/`.
  Each is a pushed screen: `TopBar` with back.
- **Integration points:** don't edit `HomeScreen`, `ProfileScreen`, `PracticeScreen` or `Shell` yourself.
  Instead export ready-made pieces from `src/features/<feature>/index.ts` (e.g. a Home card component,
  a hook, a selector), and list in your report exactly where each should be mounted. The lead wires them in.
  Exception: agent 5 owns `WorkspaceScreen` and `TerminalScreen` edits.
- **No server exists.** Anything social must work locally and sit behind a small interface a backend can
  implement later; say so honestly in the UI where it matters.
- **XP:** award XP through `useApp.getState().addXp(n)`; keep amounts modest and list them in your report.
- **Verify** on web with Playwright at 412×915 (`npx expo export --platform web`, serve `dist/`, `?demo=1`
  seeds the established user; `window.__oxide = { nav, app }` exists in dev builds for driving state).
  Put scratch work under your own folder in the scratchpad.

## Agents and scope

1. **Daily Bug Hunt + Leagues**: `src/features/bughunt/`, `src/features/league/`, `BugHuntScreen`, `LeagueScreen`.
   - Bug Hunt: one puzzle a day (same for everyone, by date). Each is a short Rust program that **compiles
     but behaves wrongly** (off-by-one, wrong `match` arm order, integer overflow/wrapping, shadowing, `&`
     vs clone, iterator laziness, `sort` vs `sort_unstable` assumptions, `chars().rev()` vs bytes, float
     comparison…). The player taps the buggy line, then picks the fix from 3–4 options, then sees the
     explanation and the corrected program with its correct output.
   - Write **at least 45 puzzles** by hand in `src/features/bughunt/puzzles.ts`, ordered roughly by Book
     chapter (each with `chapter`), checked carefully for correctness (they must truly compile on Rust 2024
     and the stated outputs must be right — reason through each line).
   - Scoring: 3 tries; Wordle-style share text (e.g. `Oxide Bug Hunt #42 🦀 🟥🟩 2/3`) shared with
     React Native's `Share` API; streak of solved days; past puzzles archive (playable, no XP).
     XP: 30 for first try, 20 / 10 after.
   - Leagues: weekly XP league. Locally: you vs. your own previous weeks plus clearly labelled practice
     rivals generated deterministically from the week number (names like "Practice rival", never presented
     as real people). Tiers Bronze → Rust → Steel → Titanium promote/demote on Monday. Put a
     `LeagueBackend` interface in `src/features/league/backend.ts` with a local implementation, so a server can
     replace it. Export a Home card: `<LeagueCard/>`.
   - Export for Home: `<BugHuntCard/>` (today's puzzle state).

2. **Streak freezes + Rescue missions + Review (spaced repetition)**: `src/features/streak/`,
   `src/features/review/`, `ReviewScreen`. **You own `streak()` in `src/state/selectors.ts`** (you may edit it).
   - Freezes: earn one for every passed Rustlings checkpoint quiz and every 7-day streak (max 2 held). A missed
     day uses a freeze automatically; the Streak sheet and Home should be able to show "1 freeze used
     yesterday". Export a hook `useStreak()` returning current/best/freezes/frozenDays.
   - Rescue mission: after 19:00 when today's goal isn't met and a streak ≥ 2 is at risk, a 5-minute mission
     (one review session or one short exercise) that counts the day if finished. Export `<RescueCard/>` for
     Home and a function the reminder text can use (`rescueReminderText()`).
   - Review: SM-2 style scheduling. Cards come from: error codes the user fixed (show a minimal snippet that
     triggers it + "what's wrong?" multiple choice, using `errors` content and the error's Book section),
     Brown quick-check questions answered wrong, and passed Rustlings exercises ("what does this line do?"
     derived from the exercise's solution diff — keep it simple and correct). Review session screen with
     answer, grade (Again / Hard / Good / Easy), progress, and a summary. XP 2 per card, max 40/day.
     Export `<ReviewCard/>` (N cards due) for Home and `reviewDueCount()`.

3. **Error collection + Code journal + Badges**: `src/features/collection/`, `src/features/journal/`,
   `src/features/badges/`, `CollectionScreen`, `JournalScreen`, `BadgesScreen`.
   - Collection: a gallery of rustc errors grouped by family (Ownership & borrowing, Types, Lifetimes, Traits,
     Names & paths, Patterns, Other), each family with "met N of M" and cards for every non-removed code;
     met codes show count, first-met date, the error title, and open the Terminal with `rustc --explain`.
     Unmet ones are dimmed. Record first-met dates by watching `useApp().fixed` (store your own timeline).
   - Journal: a timeline of the user's code: a snapshot of the code each time an exercise passes (hook:
     export `recordPass(exercise, code)`, the lead will call it from `passExercise`), projects created
     (from `listProjects()`), and their first `Hello, world!`. Each entry opens a read-only `CodeView`;
     "Then and now" compares the first and latest snapshot side by side.
   - Badges: a small badge system other features use: `src/features/badges/index.ts` exports
     `BADGES` definitions, `awardBadge(id)` and `useBadges()`. Define ~24 badges (first exercise, each
     Rustlings topic finished, each Book part read, 7/30/100-day streaks, first Bug Hunt, 10 errors met,
     all ownership errors met, each build-along project finished, first `cargo install`…) with simple
     vector emblems (react-native-svg) in the app palette, plus a toast (`showToast`) when one is earned.
     Export a `<BadgesRow/>` for Profile.

4. **Build-along projects**: `src/features/buildalong/`, `BuildAlongScreen`.
   - 5 guided mini projects beyond the Book: `todo` (CLI todo list with a file), `mdhtml` (Markdown→HTML
     converter: headings, emphasis, lists, code), `wordfreq` (word frequency counter with HashMap and
     sorting), `bank` (account ledger with structs, enums and Result errors), `life` (Conway's Game of Life
     printed to the terminal). Each has 5–8 milestones; each milestone says what to build, which Book
     section helps, gives starter code where sensible, and has **real `#[test]` tests** that check the
     milestone (written into the project's `tests/` or `src/` so `cargo test` in the Terminal verifies it).
   - The screen: project list with progress, project detail with milestones, "Start" creates the project under
     `~/projects/<name>` using `src/fs` (Cargo.toml + starter files + tests), "Check milestone" runs
     `cargo test <milestone_filter>` through `getToolchain().spawn` in the project folder and marks it done on
     success; open files in the Editor (`nav('editor', {arg, params:{file}})`). Award a badge per finished project
     via agent 3's `awardBadge` (import from `src/features/badges`; if not there yet, code against
     `awardBadge(id: string): void`). XP 40 per milestone. Export `<BuildAlongCard/>` for Practice.
   - Make sure every test you write is correct Rust that compiles against the starter code's intended API.

5. **Ferris + Speed runs**: `src/features/ferris/`, `src/features/speedrun/`; you may edit
   `src/screens/WorkspaceScreen.tsx`, `src/screens/workspace/*` and `src/screens/TerminalScreen.tsx`,
   `src/screens/terminal/*` (but don't change their behavior beyond your feature).
   - Ferris: an original crab mascot drawn with react-native-svg in Oxide's rust palette (don't copy the
     official Ferris artwork pixel for pixel; an original simple crab is fine), with expressions: happy,
     thinking, worried, celebrating, sleepy. `<Ferris mood size/>` with a subtle idle animation.
     Reactions: in the Exercise sheet when Check fails (worried + one plain-English line from the
     diagnostics, e.g. "Looks like `vec0` moved on line 12."), passes (celebrating), or after 2 failures
     (thinking + "Want a nudge?" → Hints tab); in the Terminal after a failed cargo/rustc command (a small
     line under the block). A setting to turn Ferris off: add `ferris: boolean` (default true) to your own store,
     and export a `<FerrisSettingRow/>` for Settings.
   - Speed runs: on passed exercises, "Speed run" re-opens the exercise from the original file with a timer
     (starts on first edit, stops on passing Check), stores best times per exercise, shows a result card
     with personal best and a share text. No XP after the first (avoid farming): 5 XP for a new personal best,
     max 3 per day. Entry point: a button in the Success state and in the Exercise menu (via opts you add to
     `exmenu` — coordinate: add the row in `src/overlays/sheets.tsx` exmenu only, minimally).
