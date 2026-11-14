# Oxide implementation plan

Source of truth for the design: `design/SPEC.md` (handoff README) and `design/project/*.dc.html`.

## Decisions (from the user)
- Expo / React Native (SDK 58, TypeScript), app at the repo root, design files in `design/`.
- Real on-device Rust toolchain (not simulated).
- All 19 screens + 21 popups, plus full content from rust-lang/book, rust-lang/rustlings,
  cognitive-engineering-lab/rust-book (quizzes) and the rustc error index.

## Architecture
- `src/app/` — Expo Router. One route (`index.tsx`) hosts the phone shell. The shell owns
  a single screen stack exactly like `OxidePhone.dc.html` (nav/back/tab/pop/toast).
- `src/theme/` — tokens (colors, type, radius), fonts, `Icon` (Material Symbols static TTFs:
  outlined + filled).
- `src/ui/` — shared components (Button, Switch, Radio, Ring, Bar, Badge, TopBar, Sheet, Dialog…).
- `src/state/` — zustand stores persisted with AsyncStorage: user, plan, prefs, progress,
  terminal sessions, projects, nav.
- `src/content/` — generated JSON (`npm run content`) from the cloned repos, plus loaders.
- `src/rust/` — lexer/highlighter, ANSI renderer, rustc diagnostic → Explain mapping.
- `src/toolchain/` — `Toolchain` interface. `native.ts` (Expo module, Android) and
  `unavailable.ts` (web / not installed: explains that compiling needs the Android toolchain).
- `modules/oxide-toolchain/` — local Expo module (Kotlin):
  - runs `rustc`/`cargo` shipped as executables in the APK's `nativeLibraryDir`
    (the only app location Android 10+ lets an app execute from);
  - user programs and tests are compiled to `wasm32-wasip1` and run in-process with
    Chicory (pure-JVM WebAssembly + WASI), so no compiled output ever needs exec permission;
  - streams stdout/stderr as events, accepts stdin, supports kill.
- `toolchain/` — scripts to produce the Android toolchain payload (rustc + cargo + rust-lld
  for host aarch64-linux-android, std for wasm32-wasip1, vendored crates e.g. rand).
- `plugins/withOxideToolchain.js` — config plugin: `extractNativeLibs`, jniLibs copy.

## Order of work
1. Scaffold + theme + UI kit + shell/nav/overlay system. Commit.
2. Content pipeline (book, rustlings, quizzes, error index). Commit.
3. Toolchain interface + Kotlin module + scripts. Commit.
4. Screens (parallel): Onboarding, Home, Book, Reader, Practice, Workspace+CodeEditor,
   Terminal, Project, Editor, Profile, Settings, Account, Search, Overlays. Commit each.
5. Web build + screenshots vs prototype; typecheck; fix.
