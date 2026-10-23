#!/usr/bin/env bash
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
fail=0
need() { if command -v "$1" >/dev/null 2>&1; then echo "ok   $1"; else echo "MISS $1"; fail=1; fi; }
need git
need node
exit "$fail"
