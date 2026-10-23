#!/usr/bin/env node
// Brings ~/.claude/settings.json up to what this harness expects on a new machine: every hook in
// hooks/events.json registered on its event, the plugin marketplaces and plugins, and the model.
// Re-runnable. It only adds: a hook already registered, a plugin already set (enabled or not) and
// any other key already there are left as they are, so Orca's own hooks and a person's choices
// survive.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
const FILE = join(CLAUDE_DIR, "settings.json");

const MARKETPLACES = {
	"railly-skills": { source: { source: "github", repo: "Railly/skills" } },
	"typesafe-ai": { source: { source: "github", repo: "typesafe-ai/skills" } },
};
const PLUGINS = [
	"skill-creator@claude-plugins-official",
	"vercel@claude-plugins-official",
	"plugin-dev@claude-plugins-official",
	"stable@railly-skills",
	"candidates@railly-skills",
	"experimental@railly-skills",
	"typesafe@typesafe-ai",
];

const settings = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
const added = [];

settings.model ??= "opus";
settings.autoUpdatesChannel ??= "latest";
settings.extraKnownMarketplaces ??= {};
for (const [name, value] of Object.entries(MARKETPLACES)) {
	if (settings.extraKnownMarketplaces[name]) continue;
	settings.extraKnownMarketplaces[name] = value;
	added.push(`marketplace ${name}`);
}
settings.enabledPlugins ??= {};
for (const id of PLUGINS) {
	if (id in settings.enabledPlugins) continue;
	settings.enabledPlugins[id] = true;
	added.push(`plugin ${id}`);
}

const events = JSON.parse(readFileSync(join(REPO, "hooks", "events.json"), "utf8"));
settings.hooks ??= {};
for (const [name, { event, matcher }] of Object.entries(events)) {
	const ext = existsSync(join(REPO, "hooks", name, "hook.mjs")) ? "mjs" : "sh";
	const file = join(CLAUDE_DIR, "hooks", `${name}.${ext}`).replaceAll("\\", "/");
	const groups = (settings.hooks[event] ??= []);
	const there = groups.some((g) => (g.hooks ?? []).some((h) => typeof h.command === "string" && h.command.includes(`${name}.${ext}`)));
	if (there) continue;
	const group = { hooks: [{ type: "command", command: `${ext === "mjs" ? "node" : "bash"} "${file}"`, timeout: 30 }] };
	if (matcher) group.matcher = matcher;
	groups.push(group);
	added.push(`hook ${name} → ${event}${matcher ? `(${matcher})` : ""}`);
}

mkdirSync(CLAUDE_DIR, { recursive: true });
writeFileSync(FILE, `${JSON.stringify(settings, null, 2)}\n`);
console.log(added.length ? `settings.json: ${added.join(", ")}` : "settings.json: nothing to add");
