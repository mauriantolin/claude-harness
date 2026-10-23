import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * `perfil` runs the real command, with fake binaries on the PATH that print what they receive.
 * What has to break if the script is wrong:
 * - a child script that calls `vercel` or `neon` outside the profile uses the global session;
 * - two profiles share a directory, or a profile falls into the global config;
 * - a profile key leaks through the script's output, or a shell token leaks into the profile;
 * - a name with `..` or `/` writes outside the profiles root;
 * - a shim finds itself as the real binary and calls itself in a loop;
 * - an argument with spaces arrives split;
 * - git in a clone keeps using the machine's credential helper instead of the profile's gh.
 */
const SCRIPT = fileURLToPath(new URL("./perfil.mjs", import.meta.url));
const WIN = process.platform === "win32";
let base, raiz, bin;

/** A fake binary that prints its name, its arguments and the profile variables. */
function falso(nombre, dir = bin) {
	const js = join(dir, `${nombre}.js`);
	writeFileSync(
		js,
		`const e = process.env;
const a = process.argv.slice(2);
if (a[0] === "auth" && a[1] === "git-credential") {
  process.stdout.write("username=" + e.PERFIL + "\\npassword=falsa\\n");
  process.exit(0);
}
if (a[0] === "auth" && a[1] === "print-access-token") {
  const cfg = e.CLOUDSDK_CONFIG;
  process.exit(cfg && require("node:fs").existsSync(cfg + "/credentials.db") ? 0 : 1);
}
console.log(JSON.stringify({ bin: ${JSON.stringify(nombre)}, args: a,
  gh: e.GH_CONFIG_DIR ?? null, aws: e.AWS_PROFILE ?? null, perfil: e.PERFIL ?? null,
  resend: e.RESEND_API_KEY ?? null, gcloud: e.CLOUDSDK_CONFIG ?? null,
  gtoken: e.CLOUDSDK_AUTH_ACCESS_TOKEN ?? null, gcred: e.GOOGLE_APPLICATION_CREDENTIALS ?? null,
  awscfg: e.AWS_CONFIG_FILE ?? null, awscred: e.AWS_SHARED_CREDENTIALS_FILE ?? null }));`,
	);
	if (WIN) writeFileSync(join(dir, `${nombre}.cmd`), `@node "${js}" %*\r\n`);
	else {
		writeFileSync(join(dir, nombre), `#!/bin/sh\nexec node "${js}" "$@"\n`);
		chmodSync(join(dir, nombre), 0o755);
	}
}

/** The test's environment with a single PATH: on Windows `process.env` carries `Path`, not `PATH`. */
function entornoCon(path) {
	const env = Object.fromEntries(
		Object.entries(process.env).filter(([k]) => !/^(path|gh_config_dir|perfil|perfil_dir)$/i.test(k)),
	);
	return { ...env, PERFILES_DIR: raiz, PATH: path };
}

function perfil(args, extra = {}, path = `${bin}${delimiter}${process.env.PATH}`) {
	const r = spawnSync(process.execPath, [SCRIPT, ...args], {
		encoding: "utf8",
		timeout: 20_000,
		env: { ...entornoCon(path), ...extra },
	});
	return { code: r.status, out: r.stdout, err: r.stderr, error: r.error };
}

const json = (out) =>
	out
		.split(/\r?\n/)
		.filter((l) => l.startsWith("{"))
		.map((l) => JSON.parse(l));

before(() => {
	base = mkdtempSync(join(tmpdir(), "perfil-"));
	raiz = join(base, "perfiles");
	bin = join(base, "bin");
	mkdirSync(bin);
	for (const b of ["vercel", "neon", "gh", "gcloud"]) falso(b);
});
after(() => rmSync(base, { recursive: true, force: true }));

describe("perfil <name> -- <command>", () => {
	test("gives vercel and neon the profile's directory, and gh and aws their own files", () => {
		const r = perfil(["trabajo", "--", "vercel", "whoami"]);
		assert.equal(r.code, 0);
		const [v] = json(r.out);
		assert.deepEqual(v.args, ["--global-config", join(raiz, "trabajo", "vercel"), "whoami"]);
		assert.equal(v.gh, join(raiz, "trabajo", "gh"));
		assert.equal(v.perfil, "trabajo");
		assert.equal(v.aws, "trabajo");
		assert.equal(v.awscfg, join(raiz, "trabajo", "aws", "config"));
		assert.equal(v.awscred, join(raiz, "trabajo", "aws", "credentials"));
		const [n] = json(perfil(["trabajo", "--", "neon", "me"]).out);
		assert.deepEqual(n.args, ["--config-dir", join(raiz, "trabajo", "neon"), "me"]);
	});

	test("reaches child processes: a script that calls vercel uses the profile too", () => {
		const hijo = join(base, "hijo.mjs");
		writeFileSync(
			hijo,
			`import { execSync } from "node:child_process";
process.stdout.write(execSync("vercel env ls", { encoding: "utf8" }));`,
		);
		const [v] = json(perfil(["trabajo", "--", "node", hijo]).out);
		assert.deepEqual(v.args, ["--global-config", join(raiz, "trabajo", "vercel"), "env", "ls"]);
	});

	test("two profiles share nothing", () => {
		const [a] = json(perfil(["uno", "--", "vercel", "x"]).out);
		const [b] = json(perfil(["dos", "--", "vercel", "x"]).out);
		assert.notEqual(a.args[1], b.args[1]);
		assert.notEqual(a.gh, b.gh);
	});

	test("loads the profile's keys and never prints them", () => {
		mkdirSync(join(raiz, "claves"), { recursive: true });
		writeFileSync(join(raiz, "claves", "claves.env"), "RESEND_API_KEY=re_secreto_123\n# nota\n");
		const [g] = json(perfil(["claves", "--", "gh", "api", "user"]).out);
		assert.equal(g.resend, "re_secreto_123");
		const e = perfil(["claves", "estado"]);
		assert.doesNotMatch(e.out + e.err, /re_secreto_123/);
		assert.match(e.out, /resend\s+.*RESEND_API_KEY/);
	});

	test("does not inherit a token from the shell", () => {
		const [g] = json(
			perfil(["limpio", "--", "gcloud", "config", "list"], {
				RESEND_API_KEY: "re_global",
				CLOUDSDK_CONFIG: join(base, "global-gcloud"),
				CLOUDSDK_AUTH_ACCESS_TOKEN: "ya29.global",
				GOOGLE_APPLICATION_CREDENTIALS: join(base, "global.json"),
			}).out,
		);
		assert.equal(g.resend, null);
		assert.equal(g.gcloud, join(raiz, "limpio", "gcloud"));
		assert.equal(g.gtoken, null);
		assert.equal(g.gcred, null);
	});

	test("without the CLI, estado and login say how to install it and how to log in", () => {
		const soloFalsos = `${bin}${delimiter}${dirname(process.execPath)}`;
		const e = perfil(["nuevo", "estado"], {}, soloFalsos);
		assert.match(e.out, /aws\s+CLI no instalada\s+-> instalar: \S+.*perfil nuevo login aws/);
		assert.match(e.out, /resend\s+sin RESEND_API_KEY\s+-> perfil nuevo login resend/);
		assert.match(e.out, /gcloud\s+sin sesion\s+-> perfil nuevo login gcloud/);
		const l = perfil(["nuevo", "login", "aws"], {}, soloFalsos);
		assert.equal(l.code, 127);
		assert.match(l.err, /falta la CLI de aws\. Instalar: \S+/);
	});

	test("an argument with spaces arrives whole", () => {
		const [v] = json(perfil(["trabajo", "--", "vercel", "env", "add", "dos palabras"]).out);
		assert.equal(v.args.at(-1), "dos palabras");
	});

	test("refuses a name that would leave the root", () => {
		for (const malo of ["..", "../x", "a/b", "A", ""]) {
			const r = perfil([malo, "--", "vercel", "x"]);
			assert.equal(r.code, 2);
			assert.deepEqual(json(r.out), []);
		}
	});

	test("without the real binary, the shim fails instead of calling itself", () => {
		const r = perfil(["trabajo", "--", "neonctl", "me"], {}, bin);
		assert.equal(r.error, undefined);
		assert.notEqual(r.code, 0);
	});
});

describe("perfil <name> login", () => {
	test("gh keeps the session in the profile, asks for workflow, and warns about the browser account", () => {
		const r = perfil(["trabajo", "login", "gh"]);
		const [g] = json(r.out);
		assert.ok(["auth", "login", "--insecure-storage"].every((a) => g.args.includes(a)));
		assert.match(g.args.join(" "), /--scopes workflow/);
		assert.match(r.out + r.err, /navegador/);
	});

	test("a new profile starts with a claves.env that holds no key", () => {
		perfil(["recien", "--", "gh", "api", "user"]);
		const claves = readFileSync(join(raiz, "recien", "claves.env"), "utf8");
		assert.doesNotMatch(claves, /^(RESEND_API_KEY|SUPABASE_ACCESS_TOKEN|VERCEL_TOKEN)=\S/m);
	});
});

describe("perfil <name> git", () => {
	test("git in this clone authenticates with the profile's gh", () => {
		const repo = join(base, "clon");
		mkdirSync(repo);
		const vacio = join(base, "gitconfig-vacio");
		writeFileSync(vacio, "");
		const env = {
			...entornoCon(`${bin}${delimiter}${process.env.PATH}`),
			GIT_CONFIG_GLOBAL: vacio,
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_TERMINAL_PROMPT: "0",
		};
		spawnSync("git", ["init", "-q"], { cwd: repo, env });
		const r = spawnSync(process.execPath, [SCRIPT, "trabajo", "git"], { cwd: repo, env, encoding: "utf8" });
		assert.equal(r.status, 0);
		const c = spawnSync("git", ["credential", "fill"], {
			cwd: repo,
			env,
			encoding: "utf8",
			input: "protocol=https\nhost=github.com\n\n",
		});
		assert.match(c.stdout, /^username=trabajo$/m);
		assert.match(c.stdout, /^password=falsa$/m);
	});
});
