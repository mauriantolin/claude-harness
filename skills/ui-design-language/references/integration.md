# How this language sits on shadcn/ui and transitions.dev

## Over stock shadcn/ui

This system and shadcn/ui **share the same token contract**: `--background`,
`--foreground`, `--card`, `--primary`, `--muted`, `--border`, `--ring`,
`--radius`, `--chart-*`, `--destructive` are the same variables shadcn reads.
So this is not a replacement for shadcn; it is the **theme and the discipline
layered on top of it**.

That means, concretely:

- Install `_root.css` into the global stylesheet. shadcn components then
  inherit this language automatically, because they read those variables.
- Where a shadcn component's **stock look** disagrees with a rule in
  `SKILL.md`, the rule wins. A `rounded-lg` rectangle where this system calls
  for a squircle or a pill is the smell of an unstyled foreign component; fix
  it.
- Use shadcn for **behavior, structure and accessibility** (its primitives are
  well built); use this for **surface anatomy, radius, motion, and copy**.
- The component recipes here are not competing implementations of shadcn's
  parts. Reach for a recipe when this system has a specific opinion about that
  component; otherwise take shadcn's and re-skin it through the tokens.

## With transitions.dev

Motion has two sources and they do not overlap:

- **This skill owns the spring vocabulary.** The seven springs in
  `catalog.md` are the physics of app chrome. Do not invent an eighth.
- **`transitions-dev` owns the catalogue** of specific, production-ready
  transitions (toasts, accordions, skeleton shimmer, streaming text, staggers,
  and so on). When a screen needs an animation, look there first rather than
  hand-rolling one.
- When both apply, take the *pattern* from `transitions-dev` and the *timing*
  from the spring table here, so everything in the product moves as one system.
- `transitions-polish` is the audit pass: use it to tune what already animates.
