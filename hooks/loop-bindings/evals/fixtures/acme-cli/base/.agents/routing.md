# Routing: acme-invoices

| Surface | Owner | Needs |
|---|---|---|
| The CLI and the invoice logic (`src/`) | `acme-cli` | — |
| Schema and migrations (`db/`) | `acme-db` | — |

## Supersedes

| Skill | Superseded by | Why |
|---|---|---|
| `supabase-postgres-best-practices` | `acme-db` | house migration rules |

```routes
src/* :: acme-cli
db/* :: acme-db
```
