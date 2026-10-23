---
name: acme-cli
description: "Acme's rules for the invoices CLI in src/: how flags are parsed, how output is printed, and where filtering lives. Load before changing src/."
---

# Acme CLI

- Flags are parsed with `node:util` `parseArgs`, never by hand-indexing argv.
- Filtering lives in `src/invoices.js` as a pure function; `cli.js` only parses and prints.
- An unknown status value exits 2 with a usage line on stderr.
