# Routing: acme-invoices

Which skill owns each surface here. This table wins over any generic routing.

| Surface | Owner | Needs |
|---|---|---|
| Anything rendered under `web/` | `acme-ui` | — |
| Postgres migrations and queries (`db/`, SQL in `src/`) | `acme-db` | `psql` for the local check |

## Supersedes

| Skill | Superseded by | Why |
|---|---|---|
| `ui-design-language` | `acme-ui` | Acme has its own design system; a second visual language on top breaks it |
| `supabase-postgres-best-practices` | `acme-db` | `acme-db` carries the house migration rules |

```routes
web/* :: acme-ui
db/* :: acme-db
src/* :: acme-db
```
