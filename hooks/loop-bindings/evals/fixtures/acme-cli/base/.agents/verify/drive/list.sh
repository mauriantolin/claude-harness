#!/usr/bin/env bash
# Drives the real CLI: list, optionally filtered by status ($1), and asserts
# that every printed row is in that status and the order is newest first.
set -euo pipefail
status="${1:-}"
args=(list)
[ -n "$status" ] && args+=(--status "$status")
node src/cli.js "${args[@]}" | tee "$EVIDENCE_DIR/stdout.txt"
node -e '
const rows = require("fs").readFileSync(process.argv[1], "utf8").trim().split("\n").filter(Boolean).map((l) => l.split("\t")[0]);
const data = JSON.parse(require("fs").readFileSync("data/invoices.json", "utf8"));
const want = data.filter((i) => !process.argv[2] || (i.status ?? "draft") === process.argv[2]).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((i) => i.number);
if (JSON.stringify(rows) !== JSON.stringify(want)) { console.error(`expected ${want.join(",")} got ${rows.join(",")}`); process.exit(1); }
' "$EVIDENCE_DIR/stdout.txt" "$status"
