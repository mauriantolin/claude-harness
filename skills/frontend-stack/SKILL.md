---
name: frontend-stack
description: "Index and order the frontend skills a user-interface change actually needs, so the implementation pass loads the right ones in the right precedence instead of guessing or loading all of them. Use as Software Factory's stage-1 delegate whenever an admitted change touches rendered UI, styling, motion, components, routing, rendering strategy, or client performance. Do not use to judge a finished diff, to choose a solution shape, or as a substitute for the skills it indexes."
compatibility: Requires the indexed skills to be installed; each is independently versioned and upstream-managed. A skill that is absent is `unavailable` and its coverage is owed, never silently substituted.
allowed-tools:
  - Skill(ui-design-language)
  - Skill(transitions-dev)
  - Skill(transitions-polish)
  - Skill(vercel:shadcn)
  - Skill(building-components)
  - Skill(vercel-composition-patterns)
  - Skill(vercel-react-best-practices)
  - Skill(next-best-practices)
  - Skill(vercel:next-cache-components)
  - Skill(web-design-guidelines)
  - Skill(ai-elements)
  - Skill(streamdown)
  - Skill(migrate-radix-to-base)
---
# Frontend stack

[Software Factory](https://github.com/Railly/skills/blob/main/skills/.experimental/software-factory/SKILL.md)
stage 1 owns the behavior change. When that change is a user interface, the
methods live across thirteen independently versioned skills totalling roughly
46,000 lines. Loading all of them wastes the pass; loading none of them makes
the pass improvise a design system.

This skill is the index between those two failures. **It routes and orders. It
does not restate the methods it points at**, and it never contains design
guidance of its own — a rule it inherits from the factory's own delegation
contract.

It is a protocol, not a runtime.

## 0. Decide whether this fires

Fires when the admitted change renders something a person sees or operates:
styling, layout, components, motion, routing, rendering strategy, accessibility,
or client-side performance.

Does not fire for backend-only work, schema or migration work, CLI output, or a
change whose only visible effect is a string edit. A `mechanical` change that
touches one existing component without introducing a new surface loads the
project's own conventions and nothing else.

**Complete when:** the trigger or the skip reason is named.

## 1. Establish the surface contract

Before loading anything, name which surfaces this change actually touches.
Derive them from the accepted contract, not from the file extensions in the
diff — a change that edits one `.tsx` file may still cross rendering strategy,
motion, and accessibility.

Record each indexed skill as `available` or `unavailable`. An absent skill does
not block the pass; its coverage is **owed**, and the pass records the gap so
Spec Gate and Review Gate can see what was never applied.

**Complete when:** every touched surface is named and every skill it maps to is
`available` or `unavailable` with its reason.

## 2. Resolve precedence before resolving content

Design skills conflict by construction, because each is complete on its own.
Resolve in this order, and record which level supplied the answer:

1. **The user's explicit instruction.** Always wins.
2. **The project's own design system.** Tokens, theme file, component library,
   `CLAUDE.md`, or the repository's `conventions.md`. If the project has an
   identity, this skill fills gaps and never overwrites it.
3. **The indexed skill for that surface**, per §3.
4. **Stock library defaults.** Last.

Where two installed skills would claim the same surface, only one is installed.
`shadcn`, `next-cache-components`, `ai-sdk` and `vercel-cli` once shipped twice,
from the agents directory and from the Vercel plugin; the plugin copy is
substantially more complete in every case, so the agents-directory copies were
removed rather than left to compete. If a duplicate reappears after an install,
resolve it by removing one, not by declaring a winner a reader must honour.

**Complete when:** the precedence level and the duplicate resolution are
recorded for every surface in conflict.

## 3. The index

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

**Complete when:** every named surface has exactly one skill, or is recorded as
having no coverage.

## 4. Load in dependency order, not all at once

Order matters because the later skills read what the earlier ones establish:

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

Load only the levels the surface contract named. A skill loaded for a surface
this change does not touch is context spent against the pass, and its advice
will be applied to code it was never about.

**Complete when:** the loaded set equals the surface contract's set, in order.

## 5. Record what was applied and what was owed

The pass emits, for the factory's stage receipt:

- surfaces named, and the skill each resolved to;
- the precedence level that supplied each contested answer;
- skills recorded `unavailable`, with the coverage now owed;
- surfaces with no covering skill at all.

An owed item is a result. A surface silently left uncovered is the failure this
index exists to prevent, and it is the one thing a green build will never
reveal.

**Complete when:** the receipt distinguishes applied from owed, and names every
uncovered surface.
