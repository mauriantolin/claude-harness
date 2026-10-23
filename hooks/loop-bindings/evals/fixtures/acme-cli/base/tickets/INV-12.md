# INV-12: filter the list by status

Support wants `node src/cli.js list --status paid` (also `draft`, `sent`) to print only invoices in that status. Invoices with no status are drafts. Production needs the column too: invoices get a `status` column, default `draft`.

Acceptance:
- INV-12/a: `list --status <s>` prints only invoices in status <s>, newest first.
- INV-12/b: an invoice without a status counts as `draft`.
- INV-12/c: the schema gains a status column defaulting to draft.
