# Harness: acme-invoices

## Contract

Acceptance items come from the ticket under `tickets/` and keep its IDs: write `A1: INV-12/a ...`, never invent new ones. A change to `db/migrations/` is at least `normal`.

## Verify kit

- `list`: drives `node src/cli.js list` with the arguments the contract needs and asserts on the printed rows. Pass the status to check as the driver's first argument: `observe.sh list paid`.
- `check`: `npm test`.

## Routing

`.agents/routing.md`.

## Delivery

Nothing is committed, pushed or opened as a PR without a human yes that names the action. Branches are `feat-<ticket>-<slug>`.

## Lessons

A lesson goes into `tickets/LESSONS.md` as one line with the ticket ID.
