#!/usr/bin/env node
// Brings ~/.claude/settings.json to what a machine with this harness keeps globally: the model,
// the update channel and the known marketplaces, and nothing that acts. Skills, hooks and plugins
// are a repository's choice: `harness init` writes them into its .claude/settings.json, so two
// repositories never share a hook or compete with each other's skills.
//
// Re-runnable. It removes what earlier versions of this harness registered globally (the hooks
// that pointed at ~/.claude/hooks/<harness hook>, the plugins it enabled) and leaves every other
// key, Orca's hooks and a person's own choices included, as they are.
//
//   node machine/settings.mjs            apply
//   node machine/settings.mjs --dry-run  print what would change
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
const FILE = join(CLAUDE_DIR, "settings.json");
const DRY = process.argv.includes("--dry-run");

// Known, not enabled: a repository that enables one of their plugins resolves it without asking.
const MARKETPLACES = {
	"railly-skills": { source: { source: "github", repo: "Railly/skills" } },
	"mauri-harness": { source: { source: "github", repo: "mauriantolin/claude-harness" } },
};
// Hook entry names every earlier version registered globally.
const RETIRED_HOOKS = [
	"factory-loop-checkpoints",
	"railly-root-worktree",
	"restore-repo-skills",
	"scan-secrets-pre",
	"scan-secrets",
	"guard-immutable-docs",
	"format-touched",
];
// Plugins earlier versions enabled for every repository.
const RETIRED_PLUGINS = [
	"skill-creator@claude-plugins-official",
	"vercel@claude-plugins-official",
	"plugin-dev@claude-plugins-official",
	"stable@railly-skills",
	"experimental@railly-skills",
	"typesafe@typesafe-ai",
];

const settings = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
const changes = [];

settings.model ??= "opus";
settings.autoUpdatesChannel ??= "latest";
settings.extraKnownMarketplaces ??= {};
for (const [name, value] of Object.entries(MARKETPLACES)) {
	if (settings.extraKnownMarketplaces[name]) continue;
	settings.extraKnownMarketplaces[name] = value;
	changes.push(`+ marketplace ${name}`);
}

for (const id of RETIRED_PLUGINS) {
	if (!(id in (settings.enabledPlugins ?? {}))) continue;
	delete settings.enabledPlugins[id];
	changes.push(`- plugin ${id}`);
}

const retired = (command) =>
	typeof command === "string" &&
	RETIRED_HOOKS.some((name) => command.includes(`/hooks/${name}.mjs`) || command.includes(`/hooks/${name}.sh`));
for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
	const kept = [];
	for (const group of groups) {
		const hooks = (group.hooks ?? []).filter((h) => {
			if (!retired(h.command)) return true;
			changes.push(`- hook ${event}${group.matcher ? `(${group.matcher})` : ""} ${h.command.match(/hooks\/([\w-]+)\./)?.[1]}`);
			return false;
		});
		if (hooks.length) kept.push({ ...group, hooks });
	}
	if (kept.length) settings.hooks[event] = kept;
	else delete settings.hooks[event];
}

if (DRY) {
	console.log(changes.length ? changes.join("\n") : "settings.json: nothing to change");
	process.exit(0);
}
mkdirSync(CLAUDE_DIR, { recursive: true });
writeFileSync(FILE, `${JSON.stringify(settings, null, 2)}\n`);
console.log(changes.length ? `settings.json (${FILE}):\n${changes.join("\n")}` : "settings.json: nothing to change");
