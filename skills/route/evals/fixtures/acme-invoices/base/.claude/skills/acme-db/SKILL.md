---
name: acme-db
description: "Acme's Postgres rules for migrations in db/migrations and SQL in src/: numbering, defaults, backfills, and how queries filter. Load before writing a migration or changing a query."
---

# Acme DB

- Migrations are numbered `NNN_slug.sql`, never edited once merged.
- A new column with a default is added in one statement: `alter table ... add column ... not null default ...`.
- Status columns are `text` with a `check` constraint, never a Postgres enum.
