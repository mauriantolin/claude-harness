---
name: ui-design-language
description: A complete, opinionated UI design language for product interfaces - an ink-derived neutral system, squircle surface anatomy, one small spring vocabulary, pixel-matched skeletons, and a plain-spoken copy voice, with type-checked component recipes. Use whenever you build or restyle a dashboard, SaaS app, analytics UI, settings screen, onboarding flow, or marketing/landing page, and whenever the user mentions clean SaaS design, cards, dropdowns, tab bars, empty states, skeletons, or UI animation quality - even if they never say the words "design system". Takes precedence over stock shadcn/ui defaults; pair with transitions-dev for motion.
---

# UI Design Language

A design language for product interfaces, written down so an agent can
reproduce it. Nothing here is aspirational: every value is lifted from a
shipped product — springs and hex codes included.

The look in one sentence: **white surfaces with continuous-curvature corners,
resting on a quiet grey stage, drawn in a single ink, moved by a single
spring.**

Derived from `oa-design` (MIT). See `ATTRIBUTION.md`.

## Precedence — read this before anything else

This system is **not** a brand. It is a complete default for projects that do
not have one, and a gap-filler for projects that do. Resolve conflicts in this
exact order:

1. **The user's explicit instruction.** Always wins. If they ask for a look,
   build that look.
2. **The project's own design system.** If the repo has tokens, a theme file,
   a component library with house conventions, or a `CLAUDE.md` describing its
   visual language — **theirs wins**. Read it first. Use this skill to fill
   what they left undefined, never to overwrite an identity they already have.
3. **This design language.** The default when the project has no opinion.
4. **Stock library defaults.** Last. See below.

### Over stock shadcn/ui

This system and shadcn/ui **share the same token contract** — `--background`,
`--foreground`, `--card`, `--primary`, `--muted`, `--border`, `--ring`,
`--radius`, `--chart-*`, `--destructive` are the same variables shadcn reads.
So this is not a replacement for shadcn; it is the **theme and the discipline
layered on top of it**.

That means, concretely:

- Install `_root.css` into the global stylesheet. shadcn components then
  inherit this language automatically, because they read those variables.
- Where a shadcn component's **stock look** disagrees with a rule below, the
  rule wins. A `rounded-lg` rectangle where this system calls for a squircle
  or a pill is the smell of an unstyled foreign component — fix it.
- Use shadcn for **behavior, structure and accessibility** (its primitives are
  well built); use this for **surface anatomy, radius, motion, and copy**.
- The component recipes here are not competing implementations of shadcn's
  parts. Reach for a recipe when this system has a specific opinion about that
  component; otherwise take shadcn's and re-skin it through the tokens.

### With transitions.dev

Motion has two sources and they do not overlap:

- **This skill owns the spring vocabulary** — the seven springs below are the
  physics of app chrome. Do not invent an eighth.
- **`transitions-dev` owns the catalogue** of specific, production-ready
  transitions (toasts, accordions, skeleton shimmer, streaming text, staggers,
  and so on). When a screen needs an animation, look there first rather than
  hand-rolling one.
- When both apply, take the *pattern* from `transitions-dev` and the *timing*
  from the spring table here, so everything in the product moves as one system.
- `transitions-polish` is the audit pass: use it to tune what already animates.

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
4. **One spring family.** Seven named springs cover the entire product (table
   below). Do not invent an eighth.
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
   errors name the cause and the way out, without blame. Read `_copy.md`.
10. **Quality floor, always.** Focus rings, `role="status"`, `aria-hidden`
    decorations, `prefers-reduced-motion`, no horizontal page scroll.

## The springs

| Name | Value | Used for |
| --- | --- | --- |
| PANEL | 550 / 38 | dropdowns, menus, boards, toggles |
| LAYOUT | 550 / 40 | measured height/width, traveling pills |
| POP | 400 / 26 | modal entrance |
| POP_EXIT | 380 / 28 | modal exit |
| BANNER | 400 / 30 | floating pills, page banners |
| FLICK | 900 / 50 | icon micro-moves |
| CHART | 300 / 28 | chart tooltips, crosshair |

Micro fades: 0.1s out, 0.16s in, easeOut; nothing in app chrome tweens past
0.2s.

## How to start

1. Read the project's existing design system, if any. Precedence rules above.
2. Drop `_root.css` into the global stylesheet — every recipe reads those
   token names, and shadcn reads most of them too.
3. Read the recipe for what you are building.
4. Build with **real content, never lorem**.

## Component recipes

Each recipe is self-contained: when to use it, the load-bearing details, and
the full type-checked source embedded.

| File | What |
| --- | --- |
| `01-squircle-card.md` | the surface system and the fixed-height mini card |
| `02-button.md` | pills that press, the bevel, honest loading |
| `03-dropdown.md` | menus, selects, switchers; one anchored-panel pattern |
| `04-tab-bar.md` | the traveling highlight and the label mask |
| `05-modal.md` | pop in, softer pop out |
| `06-multi-step-dialog.md` | the measured-height choreography |
| `07-skeleton.md` | pixel-matched waits and the blur arrival |
| `08-notice-strip.md` | explaining a standing state |
| `09-floating-pill.md` | the app chrome's one word |
| `10-toast.md` | success pulses, error shakes |
| `11-header-morph.md` | the landing glass pill |
| `12-reveal.md` | scroll reveals in 80ms beats |

## Guides

| File | What |
| --- | --- |
| `_tokens.md` | the full palette, dark theme, type, radius, shadows |
| `_layout.md` | plates, widths, page anatomy, settings screens |
| `_components.md` | the component patterns in prose, cross-referenced |
| `_motion.md` | the vocabulary and the signature moves, with rules |
| `_landing.md` | marketing pages: hero, reveals, furniture |
| `_copy.md` | voice, buttons, errors, states, numbers |
| `_root.css` | the installable token block every recipe reads from |

## Porting

Stack assumptions: React + Tailwind v4 + the `motion` package. But every value
is plain CSS numbers and spring constants, so port freely — the rules survive
the framework. The typefaces in `_tokens.md` are the original system's choice,
not a requirement: substitute the project's, and keep rule 6 (weight stops at
500) regardless.

## Red flags

- You are using a `rounded-lg` rectangle for a surface. → Squircle or pill.
- You introduced a second grey. → Mix `--ink` instead.
- You invented a spring value. → Use one of the seven.
- You are about to overwrite a project's existing tokens. → Theirs wins.
- You wrote lorem ipsum. → Real content, always.
- You hand-rolled an animation `transitions-dev` already has. → Take theirs,
  time it with the springs here.
