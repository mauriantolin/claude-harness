---
name: acme-ui
description: "House conventions of the Acme team."
---

# Acme UI

- Filters use `<FilterBar>` from `@acme/ui` with `<FilterBar.Select>` per field; never a raw `<select>`.
- Every visible string lives in `web/copy.js`, never inline in JSX.
- Tables keep their sort order; a filter narrows rows, it never re-sorts.
