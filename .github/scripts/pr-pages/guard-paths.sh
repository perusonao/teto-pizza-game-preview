#!/usr/bin/env bash
# Fails unless EVERY staged (or, with --range, committed) change is inside pr/<slug>/ .
# usage: guard-paths.sh <slug>            checks the index  (git diff --cached)
#        guard-paths.sh <slug> --range A  checks A..HEAD    (git diff A HEAD)
# Also refuses symlinks / non-regular files and oversized pages. Root site/, README, workflows,
# scripts and every OTHER pr/<slug>/ are therefore untouchable by this tooling.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
slug="${1:?slug}"; valid_slug "$slug" || die "bad slug"
prefix="${PR_PAGES_DIR}/${slug}/"

if [[ "${2:-}" == "--range" ]]; then
  diff_args=(diff --no-renames "${3:?base ref}" HEAD)
else
  diff_args=(diff --cached --no-renames)
fi

n=0
while IFS= read -r -d '' path; do
  n=$((n + 1))
  [[ "$path" == "$prefix"* && "$path" != *".."* ]] || die "guard: '$path' is outside ${prefix} -- refusing"
done < <(git "${diff_args[@]}" --name-only -z)

# modes of added/modified files: only regular files (100644/100755), deletions allowed
while read -r _oldmode newmode _oldsha _newsha status _rest; do
  [[ "$status" == D* ]] && continue
  [[ "$newmode" == "100644" || "$newmode" == "100755" ]] || die "guard: non-regular file mode ${newmode} (symlink/submodule?)"
done < <(git "${diff_args[@]}" --raw)

if [[ -d "$prefix" ]]; then
  size="$(du -sb "$prefix" | cut -f1)"
  ((size <= PR_PAGES_MAX_BYTES)) || die "guard: ${prefix} is ${size} bytes (> ${PR_PAGES_MAX_BYTES})"
fi
echo "guard OK: ${n} changed path(s), all under ${prefix}"
