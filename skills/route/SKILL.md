---
name: route
description: "Name the skill that owns each surface a change touches and load those skills before the first edit, so implementation follows the repository's own methods instead of improvising or loading everything. Reads the repository's routing table at .agents/routing.md, which wins, then checks every skill the session offers (repository, plugins, built in) against the change, and writes a Routing section into the contract. Use between contract and implementation in loop, when a subagent is about to be dispatched to implement, or when someone asks which skills apply to a change. Do not use to judge a finished diff (gate), to write the contract (contract), or to carry implementation guidance of its own."
compatibility: "Requires an accepted contract (.agents/verify/contract.md) or a stated change. Routed skills must be installed; an absent one is owed, never substituted. A search for owed coverage uses npx skills find; an install happens only on a human's named approval."
allowed-tools:
  - Skill
  - Read
  - Edit
---

# Route

Railly's `loop` says implement "the smallest change that satisfies the contract" and names no skill for it. That is the seam this step fills. It routes and loads; it never restates the methods it points at.

## 1. Name the surfaces from the contract

Read `.agents/verify/contract.md`: its acceptance items, must-not-change items and `surface:` globs. Name every surface the change crosses (a rendered screen, a route handler, a migration, a queue consumer, a CLI flag), from the behavior, not from file extensions. One file can cross several.

**Complete when:** every surface is named.

## 2. Read the repository's table, then this one

Precedence, highest first:

1. The user's explicit instruction in this session.
2. The repository's routing table, `.agents/routing.md`: surface to owner, the skills it supersedes, and what each owner needs (a CLI, a profile, a login). A skill the table lists as superseded is never loaded for that surface, whoever claims it.
3. The generic table below.
4. Stock library defaults.

| Surface | Owner |
|---|---|
| Anything a person sees or operates | the frontend index in [references/frontend.md](references/frontend.md); read it when the change has a rendered surface |
| Charts, dashboards, data visualization | `dataviz`, before any chart code |
| Postgres schema, RLS, migrations, queries | `supabase-postgres-best-practices` |

A repository skill (under `.claude/skills/`) that covers a surface wins over a plugin or global skill that also claims it, even when the table forgets to say so; record the gap so the table gets the row.

**The tables are a floor, not a ceiling.** Then read the list of skills this session offers (the ones the system prompt lists, from the repository, every enabled plugin and Claude Code itself) and hold each description against the contract: the technology, SDK, API, service or kind of work the change involves, not only its file paths. A skill whose description says it applies to this change is a candidate even when no table names it: an owner for a surface no row covers, or a complement to the owner of one that is covered. Load a complement only where it adds what the owner does not say, never against the owner or a "Supersedes" row.

**Complete when:** each surface has one owner and the precedence level that chose it, and every offered skill whose description matches the change is loaded or recorded as not applying.

## 3. One owner per surface

Two skills claiming one surface is a defect. Decide in this order:

1. A repository skill beats an external one.
2. The routing table's "Supersedes" names the winner.
3. Otherwise nothing decides: route the surface to neither, and ask the human which one stays.

Then fix it at the source: when the repository controls the install (its `skills-lock.json`, its enabled plugins), propose removing the loser; when a plugin bundles both, propose the "Supersedes" row. Never load both "to be thorough".

**Complete when:** no surface resolves to two skills, or the tie is the human's open question.

## 4. Load before the first edit

Load each owner with the Skill tool, in the order the repository's table or the frontend index gives, before any Write or Edit on that surface. When implementation is delegated to a subagent, its prompt lists those skills and tells it to load them first; the orchestrator does not load them on its behalf.

Where the table has a `routes` block, the route-guard hook enforces this per agent: an edit to a routed path is blocked until the agent making it has loaded every owner listed for it.

**Complete when:** every owner was loaded in this session (or named in the subagent's prompt) before the surface was edited.

## 5. Owed coverage

A surface whose owner is not installed, or that no row covers, is owed. Search read-only for that surface only: `npx skills find <query>`. Installing changes every later step, so it is the human's call: with a human in the session, end the turn with the candidates; dispatched, install nothing and return `pending-human`. A found skill is not coverage until it is installed and loaded.

**Complete when:** every owed surface has candidates, a recorded not-run search, or a human decision.

## 6. Record it in the contract

Append or replace `## Routing` in `.agents/verify/contract.md`:

```markdown
## Routing
- <surface>: <skill> (<precedence: user | repo | generic | catalog>) loaded
- <surface>: <skill> complements <owner> (catalog) loaded
- <surface>: owed (<reason>, candidates or pending-human)
- superseded: <skill> by <skill> (<where declared>)
```

A changed contract re-runs this step, since new surfaces need owners.

**Complete when:** the section lists every surface with its owner or owed state, and nothing else.

## Rules

- Route from the contract, never from memory of a previous change.
- A routed skill's guidance applies only to its surface.
- No implementation advice here: if you find yourself describing components, queries or styles, stop and load the owner.
