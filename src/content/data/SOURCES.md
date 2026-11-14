# Content sources

Generated 2026-11-14 by `scripts/build-content.mjs` (`npm run content`). Re-fetch the
sources with `scripts/fetch-content-sources.sh <dir>` and run with `OXIDE_SRC=<dir>`.

| Source | Repository | Commit | License | License files |
| --- | --- | --- | --- | --- |
| The Rust Programming Language | https://github.com/rust-lang/book | `2771df165f092a4fbb9f46b5b2e7450f19010adb` | MIT OR Apache-2.0 | licenses/book-LICENSE-MIT.txt, licenses/book-LICENSE-APACHE.txt, licenses/book-COPYRIGHT.txt |
| Rustlings | https://github.com/rust-lang/rustlings | `f7b9b3c5882a1a43275130b95142d94f847526f5` | MIT | licenses/rustlings-LICENSE.txt |
| Rust Book, Brown University interactive edition (quizzes) | https://github.com/cognitive-engineering-lab/rust-book | `88250e0392cef0622f318e35469108d68694c1f7` | MIT OR Apache-2.0 | licenses/brown-LICENSE-MIT.txt, licenses/brown-LICENSE-APACHE.txt, licenses/brown-COPYRIGHT.txt |
| rustc error code index (rust-lang/rust) | https://github.com/rust-lang/rust | `5f4effd579500175af844241eb179e756190f1e7` | MIT OR Apache-2.0 | licenses/rustc-LICENSE-MIT.txt, licenses/rustc-LICENSE-APACHE.txt, licenses/rustc-COPYRIGHT.txt |

Only `compiler/rustc_error_codes/src/error_codes/E*.md` is used from rust-lang/rust.

## What was generated

- Book: 22 chapters (21 + Appendix), 79 numbered sections in chapters 1–21 (+7 appendix sections), 108 pages (`book/<id>.json`).
- Rustlings 6.5.0: 95 exercises including 3 quizzes.
- Brown quizzes: 81 mapped onto official sections, 12 left out.
- Error index: 518 codes (132 no longer emitted).

## Conventions

- Internal Book links are rewritten to `book:<sectionId>[#anchor]`, error-index cross links to
  `error:EXXXX`; relative links to the std docs become `https://doc.rust-lang.org/...`.
- `code` blocks: `runnable` is only present when it differs from `code` (hidden `# ` lines, or
  a snippet without `fn main` that rustdoc would wrap). Use `runnable ?? code` to run.
- `ol` blocks may carry an optional `start` number when a list is split around a code block.
- Book images are copied to `assets/book/` and referenced by file name in `img.src`.
- Rustlings XP: intro 10; quizzes 100; otherwise 40 (Easy), or 50 (Medium) for the last
  exercise of a topic or any exercise whose index within its topic is 4 or more.

## Brown quiz → official section mapping

Brown pages are matched to official pages by identical file name, else by identical SUMMARY
title (Brown renumbered chapter 4 and kept old quiz file names such as `ch17-01-what-is-oo` for
what is now chapter 18; the page that embeds the quiz decides). A quiz is placed at the end of
the subsection whose heading matches the nearest heading above it on the Brown page, otherwise at
the end of the page. Brown-only pages have no official counterpart and their quizzes are dropped.

| Quiz | Brown page | Official section | Matched by |
| --- | --- | --- | --- |
| ch01-01-installation | ch01-01-installation.md | 1.1 | file name |
| ch01-02-hello-world | ch01-02-hello-world.md | 1.2 | file name |
| ch01-03-hello-cargo | ch01-03-hello-cargo.md | 1.3 | file name |
| ch03-01-variables-and-mutability-sec1-variables | ch03-01-variables-and-mutability.md | 3.1 | file name |
| ch03-01-variables-and-mutability-sec2-constants | ch03-01-variables-and-mutability.md | 3.1 | file name |
| ch03-01-variables-and-mutability-sec3-shadowing | ch03-01-variables-and-mutability.md | 3.1 | file name |
| ch03-02-data-types-sec1-scalar | ch03-02-data-types.md | 3.2 | file name |
| ch03-02-data-types-sec2-compound | ch03-02-data-types.md | 3.2 | file name |
| ch03-03-functions-sec1-parameters | ch03-03-how-functions-work.md | 3.3 | file name |
| ch03-03-functions-sec2-expressions | ch03-03-how-functions-work.md | 3.3 | file name |
| ch03-05-control-flow-sec1-if | ch03-05-control-flow.md | 3.5 | file name |
| ch03-05-control-flow-sec2-loops | ch03-05-control-flow.md | 3.5 | file name |
| ch04-01-ownership-sec1-stackheap | ch04-01-what-is-ownership.md | 4.1 | file name |
| ch04-01-ownership-sec2-moves | ch04-01-what-is-ownership.md | 4.1 | file name |
| ch04-02-references-sec1-basics | ch04-02-references-and-borrowing.md | 4.2 | file name |
| ch04-02-references-sec2-perms | ch04-02-references-and-borrowing.md | 4.2 | file name |
| ch04-02-references-sec3-safety | ch04-02-references-and-borrowing.md | 4.2 | file name |
| ch04-04-slices | ch04-04-slices.md | 4.3 | title |
| ch05-01-structs | ch05-01-defining-structs.md | 5.1 | file name |
| ch05-02-example-structs | ch05-02-example-structs.md | 5.2 | file name |
| ch05-03-method-syntax-sec1 | ch05-03-method-syntax.md | 5.3 | file name |
| ch05-03-method-syntax-sec2 | ch05-03-method-syntax.md | 5.3 | file name |
| ch06-01-defining-an-enum | ch06-01-defining-an-enum.md | 6.1 | file name |
| ch06-02-match | ch06-02-match.md | 6.2 | file name |
| ch06-03-if-let | ch06-03-if-let.md | 6.3 | file name |
| ch07-01-packages-and-crates | ch07-01-packages-and-crates.md | 7.1 | file name |
| ch07-02-modules | ch07-02-defining-modules-to-control-scope-and-privacy.md | 7.2 | file name |
| ch07-03-paths-sec1 | ch07-03-paths-for-referring-to-an-item-in-the-module-tree.md | 7.3 | file name |
| ch07-03-paths-sec2 | ch07-03-paths-for-referring-to-an-item-in-the-module-tree.md | 7.3 | file name |
| ch07-04-use | ch07-04-bringing-paths-into-scope-with-the-use-keyword.md | 7.4 | file name |
| ch07-05-files | ch07-05-separating-modules-into-different-files.md | 7.5 | file name |
| ch08-01-vec-sec1 | ch08-01-vectors.md | 8.1 | file name |
| ch08-01-vec-sec2 | ch08-01-vectors.md | 8.1 | file name |
| ch08-02-string-sec1 | ch08-02-strings.md | 8.2 | file name |
| ch08-02-string-sec2 | ch08-02-strings.md | 8.2 | file name |
| ch08-03-hashmap | ch08-03-hash-maps.md | 8.3 | file name |
| ch09-01-panic | ch09-01-unrecoverable-errors-with-panic.md | 9.1 | file name |
| ch09-02-recoverable-errors-sec1 | ch09-02-recoverable-errors-with-result.md | 9.2 | file name |
| ch09-02-recoverable-errors-sec2 | ch09-02-recoverable-errors-with-result.md | 9.2 | file name |
| ch09-03-panic-or-not | ch09-03-to-panic-or-not-to-panic.md | 9.3 | file name |
| ch10-01-generics | ch10-01-syntax.md | 10.1 | file name |
| ch10-02-traits-sec1 | ch10-02-traits.md | 10.2 | file name |
| ch10-02-traits-sec2 | ch10-02-traits.md | 10.2 | file name |
| ch10-03-lifetimes-sec1 | ch10-03-lifetime-syntax.md | 10.3 | file name |
| ch10-03-lifetimes-sec2 | ch10-03-lifetime-syntax.md | 10.3 | file name |
| ch11-01-writing-tests | ch11-01-writing-tests.md | 11.1 | file name |
| ch11-02-running-tests | ch11-02-running-tests.md | 11.2 | file name |
| ch11-03-test-organization | ch11-03-test-organization.md | 11.3 | file name |
| ch13-01-closures-sec1 | ch13-01-closures.md | 13.1 | file name |
| ch13-01-closures-sec2 | ch13-01-closures.md | 13.1 | file name |
| ch13-02-iterators | ch13-02-iterators.md | 13.2 | file name |
| ch14-01-release-profiles | ch14-01-release-profiles.md | 14.1 | file name |
| ch14-02-publishing-to-crates-io-sec1 | ch14-02-publishing-to-crates-io.md | 14.2 | file name |
| ch14-02-publishing-to-crates-io-sec2 | ch14-02-publishing-to-crates-io.md | 14.2 | file name |
| ch14-03-cargo-workspaces | ch14-03-cargo-workspaces.md | 14.3 | file name |
| ch15-01-box | ch15-01-box.md | 15.1 | file name |
| ch15-02-deref | ch15-02-deref.md | 15.2 | file name |
| ch15-03-drop | ch15-03-drop.md | 15.3 | file name |
| ch15-04-rc | ch15-04-rc.md | 15.4 | file name |
| ch15-05-interior-mutability | ch15-05-interior-mutability.md | 15.5 | file name |
| ch15-06-reference-cycles | ch15-06-reference-cycles.md | 15.6 | file name |
| ch16-01-threads | ch16-01-threads.md | 16.1 | file name |
| ch16-02-message-passing | ch16-02-message-passing.md | 16.2 | file name |
| ch16-03-shared-state | ch16-03-shared-state.md | 16.3 | file name |
| ch16-04-extensible-concurrency-send-and-sync | ch16-04-extensible-concurrency-sync-and-send.md | 16.4 | file name |
| async-01-futures-and-syntax | ch17-01-futures-and-syntax.md | 17.1 | file name |
| async-02-concurrency-with-async | ch17-02-concurrency-with-async.md | 17.2 | file name |
| async-03-more-futures | ch17-03-more-futures.md | 17.3 | file name |
| async-04-streams | ch17-04-streams.md | 17.4 | file name |
| async-05-traits-for-async | ch17-05-traits-for-async.md | 17.5 | file name |
| ch17-01-what-is-oo | ch18-01-what-is-oo.md | 18.1 | file name |
| ch17-02-trait-objects | ch18-02-trait-objects.md | 18.2 | file name |
| ch17-03-oo-design-patterns | ch18-03-oo-design-patterns.md | 18.3 | file name |
| ch18-01-all-the-places-for-patterns | ch19-01-all-the-places-for-patterns.md | 19.1 | file name |
| ch18-02-refutability | ch19-02-refutability.md | 19.2 | file name |
| ch18-03-pattern-syntax | ch19-03-pattern-syntax.md | 19.3 | file name |
| ch19-01-unsafe-rust | ch20-01-unsafe-rust.md | 20.1 | file name |
| ch19-03-advanced-traits | ch20-02-advanced-traits.md | 20.2 | file name |
| ch19-04-advanced-types | ch20-03-advanced-types.md | 20.3 | file name |
| ch19-05-advanced-functions-and-closures | ch20-04-advanced-functions-and-closures.md | 20.4 | file name |
| ch19-06-macros | ch20-05-macros.md | 20.5 | file name |

Dropped:

- ch04-03-fixing-ownership-errors-sec1-idioms (ch04-03-fixing-ownership-errors.md, “Fixing Ownership Errors”)
- ch04-03-fixing-ownership-errors-sec2-safety (ch04-03-fixing-ownership-errors.md, “Fixing Ownership Errors”)
- ch04-05-ownership-recap (ch04-05-ownership-recap.md, “Ownership Recap”)
- ch06-04-inventory (ch06-04-inventory.md, “Ownership Inventory #1”)
- ch08-04-inventory (ch08-04-inventory.md, “Ownership Inventory #2”)
- ch10-04-inventory (ch10-04-inventory.md, “Ownership Inventory #3”)
- ch17-04-inventory (ch18-04-inventory.md, “Ownership Inventory #4”)
- ch17-05-design-challenge-references (ch18-05-design-challenge.md, “Design Trade-offs”)
- ch17-05-design-challenge-trait-trees (ch18-05-design-challenge.md, “Design Trade-offs”)
- ch17-05-design-challenge-dispatch (ch18-05-design-challenge.md, “Design Trade-offs”)
- ch17-05-design-challenge-intermediates (ch18-05-design-challenge.md, “Design Trade-offs”)
- example-quiz (experiment-intro.md)
