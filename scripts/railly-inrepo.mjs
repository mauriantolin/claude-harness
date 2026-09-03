#!/usr/bin/env node
// Railly Skills — parche in-repo (idempotente).
//
// Redirige la raíz canónica de las skills de Railly al proyecto en el que se
// trabaja, para que los contratos, casos y runs se versionen con el código en
// vez de vivir en un checkout global.
//
// Hace dos cosas:
//   1. `scaffold <proyecto>` crea .claude/knowledge/ con los marcadores que
//      resolve-source-root.mjs exige, más un shim de scripts/ que reexporta el
//      clon canónico.
//   2. `patch` reescribe todas las copias de resolve-source-root.mjs en disco
//      para que antepongan la raíz del proyecto (buscándola hacia arriba desde
//      cwd) a la lista de candidatos.
//
// Re-aplicable tras cada `claude plugin update`: `node railly-inrepo.mjs patch`.

import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const PLUGIN_ROOT = join(homedir(), ".claude", "plugins");
const CANONICAL = join(PLUGIN_ROOT, "marketplaces", "railly-skills");
const MARKER = "// [in-repo-patch]";

// ---------------------------------------------------------------- scaffold

const KNOWLEDGE_DIRS = [
	"foundry/missions",
	"foundry/knowledge/patterns",
	"foundry/knowledge/skills",
	"foundry/runs/solution-gate",
	"foundry/runs/review-gate",
	"foundry/runs/spec",
	"cases",
	"contracts",
	".claude-plugin",
	"scripts",
];

function scaffold(projectRoot) {
	const root = resolve(projectRoot);
	const base = join(root, ".claude", "knowledge");

	// git no versiona directorios vacíos, y estos tienen que sobrevivir un clone
	// limpio para que las skills escriban donde corresponde sin re-scaffold.
	for (const d of KNOWLEDGE_DIRS) {
		mkdirSync(join(base, d), { recursive: true });
		const keep = join(base, d, ".gitkeep");
		if (!existsSync(keep)) writeFileSync(keep, "");
	}

	// Marcadores que resolve-source-root.mjs verifica.
	// Sin rutas absolutas: este archivo se versiona con el repo y tiene que
	// resolver igual en cualquier máquina.
	const maturity = join(base, "foundry", "maturity.json");
	if (!existsSync(maturity)) {
		writeFileSync(
			maturity,
			`${JSON.stringify({ source: "railly-skills", mode: "in-repo" }, null, 2)}\n`,
		);
	}

	const marketplace = join(base, ".claude-plugin", "marketplace.json");
	if (!existsSync(marketplace)) {
		writeFileSync(
			marketplace,
			`${JSON.stringify({ name: "railly-skills-inrepo", owner: { name: "local" }, plugins: [] }, null, 2)}\n`,
		);
	}

	// Shim: las skills buscan <root>/scripts/work-item.mjs. Reexportamos el
	// canónico en vez de copiarlo, para no forkear la lógica.
	// El shim resuelve el clon canónico en tiempo de ejecución desde el home del
	// usuario. Hornear la ruta absoluta rompería el repo en otra máquina.
	for (const script of ["work-item.mjs", "resolve-source-root.mjs"]) {
		writeFileSync(
			join(base, "scripts", script),
			[
				"#!/usr/bin/env node",
				`${MARKER} shim -> clon canónico de railly-skills`,
				`import { spawnSync } from "node:child_process";`,
				`import { homedir } from "node:os";`,
				`import { join } from "node:path";`,
				`const target = join(homedir(), ".claude", "plugins", "marketplaces", "railly-skills", "scripts", ${JSON.stringify(script)});`,
				`const r = spawnSync(process.execPath, [target, ...process.argv.slice(2)], { stdio: "inherit" });`,
				"process.exit(r.status ?? 1);",
				"",
			].join("\n"),
		);
	}

	// Sin conventions, la pasada de implementación de software-factory no tiene
	// tabla que leer y improvisa. Sembramos los defaults globales; los overrides
	// del repo los escribe quien conoce el repo.
	const repoName = root.split(/[\\/]/).filter(Boolean).pop() || "project";
	const conventions = join(base, "cases", repoName, "conventions.md");
	if (!existsSync(conventions)) {
		mkdirSync(dirname(conventions), { recursive: true });
		writeFileSync(conventions, conventionsTemplate(repoName));
		console.log(`conventions sembradas: ${conventions}`);
	}

	console.log(`scaffold ok: ${base}`);
	return base;
}

function conventionsTemplate(repoName) {
	return `# ${repoName} review conventions

Project overlay for the review-gate skill. Seeded by \`railly-inrepo.mjs\` with
the defaults that hold everywhere; everything repo-specific below is a stub for
whoever knows this repository.

**Every entry added from here on names the case or review round that produced
it.** An entry without provenance carries no authority.

## Implementation-pass skills

\`software-factory\` discovers stage tooling per repository and never assumes it.
This table is what its implementation pass reads.

| Change surface | Skills the implementation pass loads |
|---|---|
| Anything a person sees or operates | \`frontend-stack\`, which owns the index and load order for the frontend skills |
| Postgres schema, RLS, migrations, queries | \`supabase-postgres-best-practices\` |
| _(add this repository's own surfaces)_ | |

\`frontend-stack\` routes; it never substitutes for the skills it indexes. Do not
load \`ui-design-language\`, \`vercel:shadcn\` or \`transitions-dev\` directly from this
table.

A skill loaded by the implementation pass is not a gate and never satisfies one.

### Duplicate resolution

Where two installed skills claim the same surface, resolve it by removing one,
not by declaring a winner a reader must honour. \`shadcn\`,
\`next-cache-components\`, \`ai-sdk\` and \`vercel-cli\` once shipped twice; the
Vercel plugin copy proved substantially more complete in every case, so the
agents-directory copies were removed. Check for reappearance after any install.

Provenance: seeded default, measured 2026-09-03.

## Surface map

_A behavior change is not done until every surface that advertises it agrees.
List the source-to-surface pairs this repository has, as they are discovered._

Provenance: empty until a review round fills it.

## House norms

_This repository's own conventions. Empty until something is learned._

Provenance: empty until a review round fills it.
`;
}

// ------------------------------------------------------------------- patch

const PATCH_BODY = `${MARKER}
// Antepone la raíz del proyecto: sube desde cwd buscando .claude/knowledge.
function inRepoRoot() {
	let dir = process.cwd();
	for (;;) {
		const candidate = join(dir, ".claude", "knowledge");
		if (existsSync(join(candidate, "foundry", "maturity.json"))) return candidate;
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}
`;

function findCopies(dir, acc = []) {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return acc;
	}
	for (const e of entries) {
		const full = join(dir, e.name);
		if (e.isDirectory()) findCopies(full, acc);
		else if (e.name === "resolve-source-root.mjs") acc.push(full);
	}
	return acc;
}

function patchFile(file) {
	const src = readFileSync(file, "utf8");
	// El parche está completo solo si el helper Y el candidato están puestos.
	if (src.includes(MARKER) && src.includes("inRepoRoot(),")) return "ya-parcheado";

	if (!src.includes("const candidates = [")) return "formato-inesperado";

	let out = src;

	// Asegura los imports que el parche usa.
	if (!/from "node:path"/.test(out)) return "formato-inesperado";
	out = out.replace(
		/import \{([^}]*)\} from "node:path";/,
		(m, names) => {
			const set = new Set(
				names
					.split(",")
					.map((n) => n.trim())
					.filter(Boolean),
			);
			set.add("dirname");
			set.add("join");
			set.add("resolve");
			return `import { ${[...set].sort().join(", ")} } from "node:path";`;
		},
	);

	// Inserta el helper antes de la lista de candidatos (solo si falta).
	if (!out.includes(MARKER)) {
		out = out.replace("const candidates = [", `${PATCH_BODY}\nconst candidates = [`);
	}

	// Antepone la raíz in-repo a los candidatos. Tolera CRLF y LF.
	out = out.replace(
		/const candidates = \[(\r?\n)/,
		(_m, eol) => `const candidates = [${eol}\tinRepoRoot(),${eol}`,
	);
	if (!out.includes("inRepoRoot(),")) return "formato-inesperado";

	writeFileSync(file, out);
	return "parcheado";
}

// -------------------------------------------------------------------- main

const [cmd, arg] = process.argv.slice(2);

if (cmd === "scaffold") {
	scaffold(arg || process.cwd());
} else if (cmd === "patch") {
	const copies = findCopies(PLUGIN_ROOT);
	const tally = {};
	for (const f of copies) {
		const r = patchFile(f);
		tally[r] = (tally[r] || 0) + 1;
	}
	console.log(`copias encontradas: ${copies.length}`);
	for (const [k, v] of Object.entries(tally)) console.log(`  ${k}: ${v}`);
} else {
	console.error("uso: railly-inrepo.mjs scaffold [proyecto] | patch");
	process.exit(1);
}
