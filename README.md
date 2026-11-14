# Oxide

An Android app for learning Rust on a phone. It covers the whole of *The Rust Programming Language* (the Book), all 95 Rustlings exercises, quick checks from Brown University's interactive edition, the rustc error index, and a terminal with a real on-device `rustc` and `cargo`.

It is built with Expo SDK 58, React Native 0.88 and TypeScript. The design comes from the Claude Design handoff in `design/`: `design/SPEC.md` is the spec and `design/project/*.dc.html` are the HTML prototypes.

## Run it

```bash
npm install
npx expo start --web            # web preview; compiling is unavailable on web
# open http://localhost:8081/?demo=1 to load the prototype's sample user ("Sam", week 3 day 4)
# ?reset=1 clears local state
npx tsc --noEmit                # typecheck
```

On Android, a development build is needed because the app includes a native module:

```bash
npx expo prebuild --platform android --clean
npx expo run:android --device   # arm64 phone, Android 10+
```

Without the toolchain payload (see below), the app still builds and every screen works. Compile and run commands then explain that this build has no toolchain.

## Layout

| Path | What |
|---|---|
| `src/app/` | Expo Router entry: one route that hosts the phone shell |
| `src/shell/` | Frame: system bars, offline banner, nav bar, snackbar, popup layer |
| `src/nav/store.ts` | Navigation: one stack with tab roots, popups and toasts, the same model as `OxidePhone.dc.html` |
| `src/screens/` | The 13 screens (Onboarding, Home, Learn, Reader, Search, Practice, Exercise, Project, Editor, Terminal, Profile, Settings, Account) |
| `src/overlays/` | 17 popups: dialogs, the time picker, sheets, Mission complete, Level up, and the heads-up reminder |
| `src/ui/` | UI kit, including `CodeEditor` |
| `src/theme/` | Design tokens, fonts, and Material Symbols icons (static outlined and filled fonts) |
| `src/state/` | Persisted app state, selectors (levels, streak, daily mission), reminders, and an auth stub |
| `src/content/` | Generated Book, Rustlings, quiz and error-index data (`npm run content`); see `src/content/data/SOURCES.md` |
| `src/fs/` | Sandbox file system with shell paths (`~/projects`, `~/rustlings`) |
| `src/toolchain/` | `Toolchain` interface: native implementation, unavailable fallback, cargo and test harness, diagnostics |
| `modules/oxide-toolchain/` | Local Expo module (Kotlin/Java) that runs rustc and cargo and executes WebAssembly with Chicory |
| `plugins/withOxideToolchain.js` | Config plugin that packages the toolchain as native libraries, arm64-v8a only |
| `toolchain/` | Scripts that build the toolchain payload; `toolchain/README.md` describes the architecture |
| `scripts/` | Content pipeline (`build-content.mjs`, `fetch-content-sources.sh`) |

## How the on-device toolchain works

On Android 10 and later, an app may only execute files from its APK's native library directory. The setup is:

- `rustc`, `cargo` and `rust-lld` ship as `lib*.so` files in that directory.
- The standard library and vendored crates (rand, tokio) are downloaded during first-run setup.
- Programs and tests are compiled to `wasm32-wasip1-threads` and run inside the app with Chicory, a pure-JVM WebAssembly runtime. stdin is streamed and ⌃C works.

`toolchain/README.md` covers how to build the payload, the APK size, the production route through Play Feature Delivery, Play policy notes, and what has and hasn't been verified.

## Status

**Built and typechecked:**
- Every screen and popup in the spec.
- The full Book, all Rustlings exercises, 81 mapped quizzes and 518 error codes.

**Checked against the prototypes:**
- On web with Playwright at 412×915, using both a new user and the demo state.

**Not verified on a device yet:**
- The Kotlin module and the native toolchain. Neither has been compiled or run on Android, because there was no SDK or device in the build environment.
- The code editor and keyboard behavior on Android.

**Not part of this repo:**
- An auth or sync backend. Sign-in and sync are clearly marked stubs (`src/state/auth.ts`).
- Problem reports open a prefilled Rustlings GitHub issue.

**Not designed, so not built:**
- The Paper (light) theme. It is stored as a setting only.
- Tablet layouts.
