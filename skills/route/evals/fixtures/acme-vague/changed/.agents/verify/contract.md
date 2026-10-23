# Contract: request "filter invoices by status"
source: chat request @ 2026-10-23
intent: feature or behavioral change   class: normal

## Acceptance
- A1: the invoices page shows a status filter (draft, sent, paid) and the list shows only matching rows
  - observe: invoices-page
- A2: invoices have a status column, defaulting to draft for existing rows
  - observe: check
## Must not change
- M1: the list stays ordered by created_at descending
  - observe: invoices-page
## Change surface
- surface: web/*
- surface: db/migrations/*
- surface: src/*
## Non-goals
- N1: no bulk status edit
## Unknowns
- none
