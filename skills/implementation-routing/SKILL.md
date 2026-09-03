---
name: implementation-routing
description: "This skill should be used at Software Factory's implementation stage, to decide which skills own the surfaces a change touches. It carries the routing and precedence that hold across every repository, and defers to a repository's own conventions for anything specific to it. Use when an admitted change is about to be implemented and the stage tooling has not been named yet. Do not use to judge a finished diff, to choose a solution shape, or to carry guidance of its own."
compatibility: Requires the routed skills to be installed. A routed skill that is absent is `unavailable` and its coverage is owed, never silently substituted.
allowed-tools:
  - Skill(frontend-stack)
  - Skill(supabase-postgres-best-practices)
  - Skill(dataviz)
---
# Implementation routing

`software-factory` declares that *"stage tooling is repository-specific and must
be discovered, never assumed"*, and its stage 1 names no delegate. That is the
seam this skill fills, without modifying anything upstream.

Two layers meet here, and confusing them is the failure this skill exists to
prevent:

| Layer | Lives in | Holds |
|---|---|---|
| **Global** | this skill | Routing and precedence that hold in every repository |
| **Repository** | `.claude/knowledge/cases/<repo>/conventions.md` | Only what is true of that repository: its surface map, house norms, oracles, and the lessons its review rounds produced |

A repository's conventions **override** this skill; they never restate it. A
routing rule copied into a repository is a rule that goes stale the day this one
changes, and nothing will tell you it did.

## 1. Name the surfaces before naming the skills

Derive the surfaces from the accepted contract, not from the file extensions in
the diff. A change that edits one file may still cross rendering, persistence
and accessibility.

**Complete when:** every surface the change touches is named.

## 2. Resolve precedence

1. **The user's explicit instruction.** Always wins.
2. **The repository's own conventions**, and its existing design system,
   tokens, or component library. If the repository has an identity, the routed
   skills fill gaps and never overwrite it.
3. **This skill's routing**, per §3.
4. **Stock library defaults.** Last.

**Complete when:** the level that supplied each contested answer is recorded.

## 3. Global routing

| Surface | Owner |
|---|---|
| Anything a person sees or operates | `frontend-stack`, which owns the frontend index and its load order |
| Charts, dashboards, any data visualization | `dataviz`, **before** any chart code and ahead of the frontend index |
| Postgres schema, RLS, migrations, queries, or a slow query | `supabase-postgres-best-practices` |

The table is deliberately short. A row belongs here only when it holds in every
repository; anything else belongs to a repository's conventions.

**Complete when:** every surface has one owner, or is recorded as having no
coverage.

## 4. One skill per surface

Where two installed skills would claim the same surface, resolve it by removing
one, not by declaring a winner a reader must honour. A declaration holds only
while every reader honours it; a removal holds always.

Loading both copies of the same skill is a defect, not thoroughness.

**Complete when:** no surface resolves to two skills.

## 5. Record applied and owed

Emit, for the factory's stage receipt: surfaces named and their owners, the
precedence level behind each contested answer, skills recorded `unavailable`
with the coverage now owed, and surfaces with no covering skill at all.

An owed item is a result. A surface silently left uncovered is what a green
build will never reveal.

**Complete when:** the receipt distinguishes applied from owed, and names every
uncovered surface.
