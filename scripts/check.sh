#!/usr/bin/env bash
# Copyright (c) 2026 MohammadReza Tayebi. MIT License.
# Fails if the built pages are out of date with src/, or if personal data or secrets slipped in.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/build.py
if ! git diff --quiet -- index.html apps-script/Index.html; then
  echo "Built files are out of date. Run: python3 scripts/build.py and commit the result."; git diff --stat; exit 1
fi
if git grep -nIiE '@gmail|@outlook|@yahoo|ghp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|BEGIN (RSA|PRIVATE) KEY|api[_-]?key *[:=] *["'"'"'][A-Za-z0-9]{16,}' -- . ':!scripts/check.sh' ':!*.png'; then
  echo "Possible personal data or secret found above."; exit 1
fi
python3 - <<'PY'
import re
a = open('apps-script/Code.gs').read(); b = open('relay/Code.gs').read()
ids = lambda t: sorted(re.findall(r"id: '([a-z]+)'", t[t.index('var INSTRUMENTS'):]))
mods = sorted(re.findall(r"(\w+): \{ sep:", b))
assert ids(a) == mods, ('instrument ids differ between apps-script/Code.gs and relay/Code.gs', ids(a), mods)
PY
echo "OK: builds are current and no secrets/emails found."
