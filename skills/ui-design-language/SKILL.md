---
name: ui-design-language
description: A complete, opinionated UI design language for product interfaces - an ink-derived neutral system, squircle surface anatomy, one small spring vocabulary, pixel-matched skeletons, and a plain-spoken copy voice, with type-checked component recipes. Use whenever you build or restyle a dashboard, SaaS app, analytics UI, settings screen, onboarding flow, or marketing/landing page, and whenever the user mentions clean SaaS design, cards, dropdowns, tab bars, empty states, skeletons, or UI animation quality - even if they never say the words "design system". Takes precedence over stock shadcn/ui defaults; pair with transitions-dev for motion.
---

# UI Design Language

A design language for product interfaces, written down so an agent can
reproduce it. Nothing here is aspirational: every value is lifted from a
shipped product, springs and hex codes included.

The look in one sentence: **white surfaces with continuous-curvature corners,
resting on a quiet grey stage, drawn in a single ink, moved by a single
spring.**

Derived from `oa-design` (MIT). See [ATTRIBUTION.md](ATTRIBUTION.md).

## Precedence, read this before anything else

This system is **not** a brand. It is a complete default for projects that do
not have one, and a gap-filler for projects that do. Resolve conflicts in this
exact order:

1. **The user's explicit instruction.** Always wins. If they ask for a look,
   build that look.
2. **The project's own design system.** If the repo has tokens, a theme file,
   a component library with house conventions, or a `CLAUDE.md` describing its
   visual language, **theirs wins**. Read it first. Use this skill to fill
   what they left undefined, never to overwrite an identity they already have.
3. **This design language.** The default when the project has no opinion.
4. **Stock library defaults.** Last.

This system shares shadcn/ui's token contract and splits motion with
`transitions-dev`. Read [how it sits on shadcn and transitions.dev](references/integration.md)
before touching either.

## The ten rules

1. **One ink, everything derived.** The entire neutral system is one color,
   `--ink`, mixed into transparency at fixed percentages: borders 12%, hover
   washes 5%, inputs 14%. Never introduce a second grey; when you need a new
   neutral, mix ink.
2. **Two layers, and the gap is the page.** Surfaces are a white frame
   holding a recessed grey inset; sections are plates and the page background
   between them is the only divider. No horizontal rules.
3. **Squircles for surfaces, pills for actions.** Cards get
   continuous-curvature corners; everything clickable that is not a card is a
   pill. A `rounded-lg` rectangle is the smell of a foreign component.
4. **One spring family.** Seven named springs cover the entire product. Do
   not invent an eighth. The table is in [the catalog](references/catalog.md).
5. **Chrome never waits.** Layout and titles render instantly; only data
   swaps from a pixel-matched skeleton, arriving by blur, not by pop.
6. **Weight stops at 500.** 300 to 500; no bold anywhere. Hierarchy comes
   from size, color and spacing. Data aligns with `tabular-nums`.
7. **One accent, spent in one place.** A single accent for primary actions and
   the primary chart line; semantic colors are text tints, never fills.
8. **States get pills, events end themselves.** Standing conditions render
   non-dismissable strips or pills that live exactly as long as the state;
   one-off outcomes are toasts that retire alone.
9. **Copy is part of the design.** Sentence case; buttons say what happens;
   errors name the cause and the way out, without blame. Read
   [the copy guide](references/_copy.md) before writing any user-facing string.
10. **Quality floor, always.** Focus rings, `role="status"`, `aria-hidden`
    decorations, `prefers-reduced-motion`, no horizontal page scroll.

## How to start

1. Read the project's existing design system, if any. Precedence rules above.
2. Drop [`_root.css`](references/_root.css) into the global stylesheet when
   the project has no token block of its own. Every recipe reads those token
   names, and shadcn reads most of them too.
3. Read the guide for the surface and the recipe for the component you are
   building, from the table below. Each recipe is self-contained: when to use
   it, the load-bearing details, and the full type-checked source.
4. Build with **real content, never lorem**.

## When to read what

| Read | When |
| --- | --- |
| [the catalog](references/catalog.md) | read when you need the spring table, or when porting off React, Tailwind v4 or `motion` |
| [`_tokens.md`](references/_tokens.md) | read when choosing any color, type size, radius or shadow |
| [`_layout.md`](references/_layout.md) | read when laying out a page, a settings screen, or plates |
| [`_components.md`](references/_components.md) | read when you need the component patterns in prose before picking a recipe |
| [`_motion.md`](references/_motion.md) | read when anything moves, before choosing a spring |
| [`_landing.md`](references/_landing.md) | read when the surface is a marketing or landing page |
| [`01-squircle-card.md`](references/01-squircle-card.md) | read when building a card or any surface |
| [`02-button.md`](references/02-button.md) | read when building a button or a loading action |
| [`03-dropdown.md`](references/03-dropdown.md) | read when building a menu, select or switcher |
| [`04-tab-bar.md`](references/04-tab-bar.md) | read when building tabs or a segmented control |
| [`05-modal.md`](references/05-modal.md) | read when building a modal or dialog |
| [`06-multi-step-dialog.md`](references/06-multi-step-dialog.md) | read when the dialog has steps whose height changes |
| [`07-skeleton.md`](references/07-skeleton.md) | read when data loads after the chrome |
| [`08-notice-strip.md`](references/08-notice-strip.md) | read when a standing condition needs explaining |
| [`09-floating-pill.md`](references/09-floating-pill.md) | read when the app chrome needs one floating word |
| [`10-toast.md`](references/10-toast.md) | read when reporting a one-off success or error |
| [`11-header-morph.md`](references/11-header-morph.md) | read when a landing header that becomes a glass pill |
| [`12-reveal.md`](references/12-reveal.md) | read when content reveals on scroll |

## Red flags

- You are using a `rounded-lg` rectangle for a surface. Use a squircle or pill.
- You introduced a second grey. Mix `--ink` instead.
- You invented a spring value. Use one of the seven.
- You are about to overwrite a project's existing tokens. Theirs wins.
- You wrote lorem ipsum. Real content, always.
- You hand-rolled an animation `transitions-dev` already has. Take theirs and
  time it with the springs here.
