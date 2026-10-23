# Frontend index and load order

Read when the change has a rendered surface and the repository's `.agents/routing.md` does not already name its owners. A repository design system (its own UI skill, tokens or component library) comes first and replaces every row it covers.

## Surface to skill

| Surface the change touches | Skill |
|---|---|
| Tokens, surfaces, color, typography, spacing, the visual system, when the repository has no design system of its own | `ui-design-language` (design plugin) |
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
repository design system   (or ui-design-language when there is none)
  → vercel:shadcn           (consumes those tokens)
  → building-components     (component API and a11y)
  → composition / performance
  → next-best-practices     (routing and rendering)
  → transitions-dev         (motion, last: it moves what already exists)
  → web-design-guidelines   (review of the result)
```

## Duplicates

Where two installed skills claim the same surface, route §3 applies: remove one when the repository controls the install, otherwise the repository's table names the winner.
