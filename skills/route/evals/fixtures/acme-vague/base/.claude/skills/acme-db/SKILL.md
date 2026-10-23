---
name: acme-db
description: "House conventions of the Acme team."
---

# Acme DB

- Migrations are numbered `NNN_slug.sql`, never edited once merged.
- A new column with a default is added in one statement: `alter table ... add column ... not null default ...`.
- Status columns are `text` with a `check` constraint, never a Postgres enum.
