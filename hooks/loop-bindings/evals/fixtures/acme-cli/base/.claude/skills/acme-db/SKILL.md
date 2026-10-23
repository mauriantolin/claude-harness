---
name: acme-db
description: "Acme's Postgres rules for db/migrations: numbering and defaults. Load before writing a migration."
---

# Acme DB

- Migrations are `NNN_slug.sql`, never edited once merged.
- Status columns are `text not null default '<value>'` with a `check` constraint, never an enum.
