---
name: acme-ui
description: "Acme's design system for every screen under web/: which @acme/ui components to use, the filter-bar pattern, and the copy rules. Load before writing or changing any JSX in web/."
---

# Acme UI

- Filters use `<FilterBar>` from `@acme/ui` with `<FilterBar.Select>` per field; never a raw `<select>`.
- Every visible string lives in `web/copy.js`, never inline in JSX.
- Tables keep their sort order; a filter narrows rows, it never re-sorts.
