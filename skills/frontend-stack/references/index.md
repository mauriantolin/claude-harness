# The index, and the load order

## Surface to skill

| Surface the change touches | Skill |
|---|---|
| Tokens, surfaces, color, typography, spacing, the visual system | `ui-design-language` |
| Motion: new transitions, animation, open/close, stagger | `transitions-dev` |
| Motion already present that needs tuning against the token scale | `transitions-polish` |
| shadcn components, registries, `components.json`, presets | `vercel:shadcn` |
| Building a new reusable component, its API, its accessibility, publishing it | `building-components` |
| Component architecture: compound components, render props, boolean-prop sprawl | `vercel-composition-patterns` |
| React or Next performance: re-renders, bundle size, data fetching cost | `vercel-react-best-practices` |
| App Router: file conventions, RSC boundaries, metadata, route handlers | `next-best-practices` |
| Caching, PPR, `use cache`, `cacheLife`, `cacheTag` | `vercel:next-cache-components` |
| Accessibility and interface-guideline review of existing UI | `web-design-guidelines` |
| AI chat surfaces: conversations, messages, tool displays, prompt inputs | `ai-elements` |
| Streaming markdown rendering | `streamdown` |
| Migrating Radix primitives to Base UI | `migrate-radix-to-base` |

Charts, dashboards, and any data visualization load `dataviz` before the first
line of chart code, ahead of everything in this table.

## Load order

Later skills read what the earlier ones establish:

```text
project conventions
  → ui-design-language      (establishes the token contract)
  → vercel:shadcn           (consumes those tokens)
  → building-components     (component API and a11y)
  → composition / performance
  → next-best-practices     (routing and rendering)
  → transitions-dev         (motion, last: it moves what already exists)
  → web-design-guidelines   (review of the result)
```

## Duplicates

Where two installed skills would claim the same surface, only one is
installed. `shadcn`, `next-cache-components`, `ai-sdk` and `vercel-cli` once
shipped twice, from the agents directory and from the Vercel plugin; the
plugin copy is substantially more complete in every case, so the
agents-directory copies were removed rather than left to compete. If a
duplicate reappears after an install, resolve it by removing one, not by
declaring a winner a reader must honour.
