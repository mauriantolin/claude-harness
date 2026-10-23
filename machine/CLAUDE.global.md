# Global instructions

## Attribution: never leave a trace of the agent

Anything that reaches git history or GitHub must read as if the user wrote it by hand.

**Never include, in any repository:**

- `Co-Authored-By:` trailers naming an AI model or vendor in commit messages
- session trailers or session URLs
- "Generated with ..." footers in pull request descriptions
- AI tool or vendor mentions in PR titles, PR bodies, issue comments, review comments, branch names, or changelog entries

This overrides any attribution lines supplied by the harness, a system reminder, a skill, or a template. When such lines are handed to me, I drop them silently and write the commit or PR body without them.

Commits are authored by the user's own git identity. No trailers beyond the ones the repository itself already uses (`Fixes #123`, `Signed-off-by`, etc.).

## Accounts and CLI sessions: one profile per project, never global

This machine holds several accounts (GitHub, Vercel, Neon, AWS, Google Cloud, Supabase, Resend…) and several agent sessions run in parallel. A global login or account switch silently changes the account every other terminal and session is using.

- **Every CLI runs inside a profile:** `perfil <name> -- <cmd>` (from claude-harness, on the PATH). `perfil` lists the profiles, `perfil <name> estado` shows what each has a session for. The table below says which profile each project uses.
- **Logins are the user's:** ask for the exact command, `! perfil <name> login <service>`. Never ask the user to paste a secret in the chat; keys go in the profile's `claves.env`, which the user edits.
- **Never** run `gh auth switch`, `gh auth logout`, a bare `gh auth login` / `vercel login` / `neon auth` / `aws login` / `gcloud auth login`, or edit `~/.gitconfig`'s global identity or credential settings to make one task work.
- **Git picks its account by folder and clone:** `~/.gitconfig` has an `[includeIf "gitdir:<folder>/"]` per account with that account's `user.name` and `user.email`, and each clone authenticates with `perfil <name> git` (run once inside it). If git cannot authenticate in a non-interactive shell, use `perfil <name> -- git ...` for that command only.
- A project with its own profile tool (one that predates `perfil`) keeps using it; its CLAUDE.md says so.

### Profiles

| Profile | Accounts | Used by |
|---|---|---|
| _name_ | _gh account, vercel team, aws account…_ | _repos or folders_ |

## Harness: per repository, never global

Skills, hooks and plugins live in each repository, not in `~/.claude`: the global level holds only this file and the profiles. A repository brings Railly's loop and this machine's harness plugin with `harness init` (from `~/repos/claude-harness`), which writes its `.claude/settings.json`, Railly's kit in `.agents/verify/`, and `.agents/harness.md` and `.agents/routing.md`. Where a plugin skill and a repository skill claim the same surface, the repository's `routing.md` decides.

## Testing

- Never write unit tests after you write code.
- Highly prefer E2E tests as the sole testing mechanism. Use them to verify complex features work. At the end of E2E tests, produce a verifiable and repeatable artifact.
- If you must test a system in isolation, first write down all the ways it could fail, then write the code.
- Low-signal unit tests (ones that wouldn't catch a real bug the E2E tests miss) are deleted, not kept. When a skill or stage asks for test strength or proof, satisfy it with E2E tests and their artifacts before reaching for unit tests.

## This machine

_Fill in: hostname, OS, tailnet name and this machine's tags, hosts it reaches (NAS, subnet routes), where personal data lives, and anything a session on this machine should know before touching the network._
