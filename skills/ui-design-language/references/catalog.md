# Catalog: springs, recipes, guides, porting

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

## Component recipes

Each recipe is self-contained: when to use it, the load-bearing details, and
the full type-checked source embedded.

| File | What |
| --- | --- |
| [`01-squircle-card.md`](01-squircle-card.md) | the surface system and the fixed-height mini card |
| [`02-button.md`](02-button.md) | pills that press, the bevel, honest loading |
| [`03-dropdown.md`](03-dropdown.md) | menus, selects, switchers; one anchored-panel pattern |
| [`04-tab-bar.md`](04-tab-bar.md) | the traveling highlight and the label mask |
| [`05-modal.md`](05-modal.md) | pop in, softer pop out |
| [`06-multi-step-dialog.md`](06-multi-step-dialog.md) | the measured-height choreography |
| [`07-skeleton.md`](07-skeleton.md) | pixel-matched waits and the blur arrival |
| [`08-notice-strip.md`](08-notice-strip.md) | explaining a standing state |
| [`09-floating-pill.md`](09-floating-pill.md) | the app chrome's one word |
| [`10-toast.md`](10-toast.md) | success pulses, error shakes |
| [`11-header-morph.md`](11-header-morph.md) | the landing glass pill |
| [`12-reveal.md`](12-reveal.md) | scroll reveals in 80ms beats |

## Guides

| File | What |
| --- | --- |
| [`_tokens.md`](_tokens.md) | the full palette, dark theme, type, radius, shadows |
| [`_layout.md`](_layout.md) | plates, widths, page anatomy, settings screens |
| [`_components.md`](_components.md) | the component patterns in prose, cross-referenced |
| [`_motion.md`](_motion.md) | the vocabulary and the signature moves, with rules |
| [`_landing.md`](_landing.md) | marketing pages: hero, reveals, furniture |
| [`_copy.md`](_copy.md) | voice, buttons, errors, states, numbers |
| [`_root.css`](_root.css) | the installable token block every recipe reads from |

## Porting

Stack assumptions: React + Tailwind v4 + the `motion` package. But every value
is plain CSS numbers and spring constants, so port freely; the rules survive
the framework. The typefaces in `_tokens.md` are the original system's choice,
not a requirement: substitute the project's, and keep rule 6 (weight stops at
500) regardless.
