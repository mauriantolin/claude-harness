# Routing: <repository>

Which skill owns each surface here. `route` reads this table between contract and implementation, and it wins over the generic routing. A repository skill under `.claude/skills/` wins over a plugin skill for the same surface.

| Surface | Owner | Needs |
|---|---|---|
| <surface, by path or behavior> | `<skill>` | <CLI, profile or login it needs, or —> |

## Routes

The same table as paths, for the route-guard hook: an edit to a path is blocked until the agent making it has loaded every skill listed for it. Glob as `gate.sh surfaces` reads it (`*` crosses directories).

```routes
<glob> :: <skill>[, <skill>]
```

## Supersedes

Skills installed here (by a plugin or the lockfile) that must not be loaded for a surface another owner covers.

| Skill | Superseded by | Why |
|---|---|---|
