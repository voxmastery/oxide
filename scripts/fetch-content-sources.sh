#!/usr/bin/env bash
# Clone the upstream content sources (depth 1) used by scripts/build-content.mjs.
#
#   scripts/fetch-content-sources.sh <dir>
#   OXIDE_SRC=<dir> npm run content
#
# rust-lang/rust is large; only compiler/rustc_error_codes is needed, so it is fetched
# with a sparse, blobless checkout.
set -euo pipefail

DEST="${1:-${OXIDE_SRC:-}}"
if [ -z "$DEST" ]; then
  echo "usage: $0 <dir>" >&2
  exit 1
fi
mkdir -p "$DEST"
cd "$DEST"

clone() { # <url> <dir>
  if [ -d "$2/.git" ]; then
    echo "$2 already present, skipping"
  else
    git clone --depth 1 "$1" "$2"
  fi
}

clone https://github.com/rust-lang/book.git book
clone https://github.com/rust-lang/rustlings.git rustlings
clone https://github.com/cognitive-engineering-lab/rust-book.git brown

if [ -d rustc-src/.git ]; then
  echo "rustc-src already present, skipping"
else
  git clone --depth 1 --filter=blob:none --sparse https://github.com/rust-lang/rust.git rustc-src
  git -C rustc-src sparse-checkout set compiler/rustc_error_codes
fi

for r in book rustlings brown rustc-src; do
  printf '%-10s %s\n' "$r" "$(git -C "$r" rev-parse HEAD)"
done
echo "Now run: OXIDE_SRC=$PWD npm run content"
