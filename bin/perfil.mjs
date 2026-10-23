#!/usr/bin/env node
// perfil: every CLI session lives in a named profile, never in the machine's global config.
//
//   perfil                              list this machine's profiles
//   perfil <name> estado                which service has a session or key in the profile
//   perfil <name> login <service>       log in inside the profile (the person runs it)
//   perfil <name> -- <command...>       run the command with the profile's sessions
//   perfil <name> git                   git in this clone authenticates with the profile's gh
//
// A profile is a directory under PERFILES_DIR (default ~/.perfiles) holding each CLI's config and
// a `claves.env` for the services used with a key. Nothing is stored in the global config, so two
// profiles (or two agent sessions on different profiles) share a machine without stepping on each
// other. Generalized from Nomenclator's `pnpm perfil`; the interface is the same.
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WIN = process.platform === "win32";
const SCRIPT = fileURLToPath(import.meta.url);
const RAIZ = process.env.PERFILES_DIR || join(homedir(), ".perfiles");
const NOMBRE = /^[a-z0-9][a-z0-9-]{0,39}$/;

/**
 * Each integration is isolated one of three ways: a directory flag added to the binary (`flag`),
 * an environment variable (`env`), or a key in `claves.env` (`clave`). `tokens` are the variables
 * that CLI authenticates with outside a session: the profile does not inherit them from the shell,
 * it only takes them from its `claves.env`. `instalar` and `clave_de` are what `estado` tells
 * someone who lacks the CLI or the key. A new integration goes in this table.
 */
const SEGUN_SO = (win, mac, linux) => ({ win32: win, darwin: mac })[process.platform] ?? linux;
export const SERVICIOS = {
	gh: {
		env: (dir) => ({ GH_CONFIG_DIR: join(dir, "gh") }),
		tokens: ["GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN"],
		// `--insecure-storage`: without it gh keeps the token in the system keyring per account, and
		// a profile and the global session with the same account share the entry. `workflow`: without
		// it GitHub rejects a push that changes `.github/workflows/`.
		login: ["gh", "auth", "login", "--hostname", "github.com", "--web", "--insecure-storage", "--scopes", "workflow"],
		aviso: "GitHub",
		estado: ["gh", "auth", "status", "--hostname", "github.com"],
		bin: "gh",
		instalar: SEGUN_SO("winget install GitHub.cli", "brew install gh", "sudo apt install gh (repo de cli.github.com)"),
	},
	vercel: {
		bins: ["vercel"],
		flag: (dir) => ["--global-config", join(dir, "vercel")],
		tokens: ["VERCEL_TOKEN"],
		login: ["vercel", "login"],
		aviso: "Vercel",
		estado: ["vercel", "whoami"],
		bin: "vercel",
		instalar: "npm install -g vercel@59.10.0",
	},
	neon: {
		bins: ["neon", "neonctl"],
		flag: (dir) => ["--config-dir", join(dir, "neon")],
		tokens: ["NEON_API_KEY"],
		login: ["neon", "auth"],
		aviso: "Neon",
		// `neon me` without a session opens the login in the browser: the state is read from the file.
		sesion: (dir) => existsSync(join(dir, "neon", "credentials.json")),
		bin: "neon",
		instalar: "npm install -g neonctl@4.13.0",
	},
	aws: {
		// AWS_PROFILE only picks a section: the files belong to the profile too, so a login does not
		// write to the machine's ~/.aws. The region, when a profile needs one, goes in its claves.env
		// (AWS_DEFAULT_REGION=...) or in its aws/config.
		env: (dir, nombre) => ({
			AWS_PROFILE: nombre,
			AWS_CONFIG_FILE: join(dir, "aws", "config"),
			AWS_SHARED_CREDENTIALS_FILE: join(dir, "aws", "credentials"),
			AWS_LOGIN_CACHE_DIRECTORY: join(dir, "aws", "login"),
		}),
		tokens: [
			"AWS_ACCESS_KEY_ID",
			"AWS_SECRET_ACCESS_KEY",
			"AWS_SESSION_TOKEN",
			"AWS_DEFAULT_PROFILE",
			"AWS_CONFIG_FILE",
			"AWS_SHARED_CREDENTIALS_FILE",
			"AWS_LOGIN_CACHE_DIRECTORY",
		],
		// Temporary console credentials through Identity Center, no long-lived keys.
		login: ["aws", "login"],
		aviso: "AWS",
		estado: ["aws", "sts", "get-caller-identity"],
		bin: "aws",
		instalar: SEGUN_SO(
			"winget install Amazon.AWSCLI",
			"brew install awscli",
			"https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html",
		),
	},
	// Without CLOUDSDK_CONFIG gcloud keeps the account in `%APPDATA%\gcloud` or `~/.config/gcloud`,
	// shared by the whole machine.
	gcloud: {
		env: (dir) => ({ CLOUDSDK_CONFIG: join(dir, "gcloud") }),
		tokens: [
			"CLOUDSDK_CONFIG",
			"CLOUDSDK_AUTH_ACCESS_TOKEN",
			"CLOUDSDK_AUTH_ACCESS_TOKEN_FILE",
			"CLOUDSDK_CORE_ACCOUNT",
			"GOOGLE_APPLICATION_CREDENTIALS",
		],
		login: ["gcloud", "auth", "login"],
		aviso: "Google",
		estado: ["gcloud", "auth", "print-access-token", "--quiet"],
		bin: "gcloud",
		instalar: SEGUN_SO(
			"winget install Google.CloudSDK",
			"brew install --cask google-cloud-sdk",
			"sudo apt install google-cloud-cli (repo de packages.cloud.google.com)",
		),
	},
	supabase: {
		clave: "SUPABASE_ACCESS_TOKEN",
		clave_de: "https://supabase.com/dashboard/account/tokens",
	},
	resend: {
		clave: "RESEND_API_KEY",
		clave_de: "el panel de Resend, API Keys",
	},
};

const directorio = (nombre) => join(RAIZ, nombre);

// What a new profile's `claves.env` starts with: the key names, commented out.
const CLAVES_INICIALES = `# Claves del perfil: CLAVE=valor, una por linea. No se commitea ni se pega en un chat.
# Ids que no son secretos (proyecto de Neon, team de Vercel, region de AWS) tambien van aca.
# Claves, solo si las vas a usar (perfil <nombre> estado dice de donde sale cada una):
# RESEND_API_KEY=
# SUPABASE_ACCESS_TOKEN=
# VERCEL_TOKEN=
`;

/** The `KEY=value` lines of `claves.env`. Values are never printed. */
function claves(dir) {
	const archivo = join(dir, "claves.env");
	if (!existsSync(archivo)) return {};
	const out = {};
	for (const linea of readFileSync(archivo, "utf8").split(/\r?\n/)) {
		const m = linea.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
		if (m && m[2]) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
	}
	return out;
}

const EXTS = WIN ? (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";") : [""];

/** The first executable `bin` on the PATH that is not in `excluir`. */
function buscar(bin, path, excluir, exts = EXTS) {
	for (const d of path.split(delimiter)) {
		if (!d || d === excluir) continue;
		for (const e of extname(bin) ? [""] : exts) {
			const p = join(d, bin + e.toLowerCase());
			if (existsSync(p)) return p;
		}
	}
	return null;
}

/**
 * Shims in `<profile>/bin` that call the real binary with the profile's flag. They go first on the
 * PATH, so any child script uses them too. If the real binary is missing no shim is written: one
 * that found itself would call itself in a loop.
 */
function atajos(dir, path) {
	const destino = join(dir, "bin");
	mkdirSync(destino, { recursive: true });
	for (const s of Object.values(SERVICIOS)) {
		if (!s.flag) continue;
		const flag = s.flag(dir);
		for (const b of s.bins) {
			// Windows gets two shims: the .cmd for cmd.exe and PowerShell, and one without extension
			// for Git Bash, which does not resolve a .cmd and would reach npm's extensionless script.
			const real = buscar(b, path, destino);
			if (real && WIN) {
				const q = flag.map((a) => `"${a}"`).join(" ");
				writeFileSync(join(destino, `${b}.cmd`), `@"${real}" ${q} %*\r\n`);
			}
			const sh = WIN ? buscar(b, path, destino, [""]) : real;
			if (sh) {
				const q = [sh, ...flag].map((a) => `'${a.replaceAll("\\", "/").replaceAll("'", "'\\''")}'`);
				writeFileSync(join(destino, b), `#!/bin/sh\nexec ${q.join(" ")} "$@"\n`);
				chmodSync(join(destino, b), 0o755);
			}
		}
	}
	return destino;
}

/** The environment of a process that runs in the profile. */
export function entorno(nombre, base = process.env) {
	const dir = directorio(nombre);
	mkdirSync(dir, { recursive: true });
	const archivo = join(dir, "claves.env");
	if (!existsSync(archivo)) writeFileSync(archivo, CLAVES_INICIALES, { mode: 0o600 });
	const path = base.PATH ?? base.Path ?? "";
	const fuera = new Set(["Path"]);
	for (const s of Object.values(SERVICIOS))
		for (const t of [...(s.tokens ?? []), ...(s.clave ? [s.clave] : [])]) fuera.add(t);
	const env = Object.fromEntries(Object.entries(base).filter(([k]) => !fuera.has(k)));
	Object.assign(env, claves(dir));
	for (const s of Object.values(SERVICIOS)) if (s.env) Object.assign(env, s.env(dir, nombre));
	env.PERFIL = nombre;
	env.PERFIL_DIR = dir;
	env.PATH = `${atajos(dir, path)}${delimiter}${path}`;
	return env;
}

// cmd.exe expands %VAR% and counts quotes on its own; an argument with % or " is refused rather
// than corrupted.
const comillasWin = (a) => {
	if (/[%"\r\n]/.test(a)) throw new Error(`argumento no admisible en Windows: ${a}`);
	return /[\s^&|<>()!]/.test(a) || a === "" ? `"${a}"` : a;
};

/** Runs `comando` with its output visible. Returns the exit code. */
function correr(nombre, [bin, ...args], { silencioso = false } = {}) {
	const env = entorno(nombre);
	const real = buscar(bin, env.PATH, null);
	if (!real) {
		if (!silencioso) process.stderr.write(`perfil: ${bin} no esta en el PATH\n`);
		return silencioso ? { code: 127, out: "" } : 127;
	}
	const stdio = silencioso ? ["ignore", "pipe", "pipe"] : "inherit";
	// A .cmd does not run without a shell (CVE-2024-27980); the cmd.exe line is built by hand.
	const r = /\.(cmd|bat)$/i.test(real)
		? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `"${[real, ...args].map(comillasWin).join(" ")}"`], {
				env,
				stdio,
				windowsVerbatimArguments: true,
				encoding: "utf8",
			})
		: spawnSync(real, args, { env, stdio, encoding: "utf8" });
	if (r.error) throw r.error;
	return silencioso ? { code: r.status, out: r.stdout ?? "" } : (r.status ?? 1);
}

function estado(nombre) {
	const dir = directorio(nombre);
	const cl = claves(dir);
	console.log(`perfil ${nombre}  (${dir})`);
	const path = process.env.PATH ?? "";
	for (const [id, s] of Object.entries(SERVICIOS)) {
		let detalle, paso;
		if (s.clave) {
			detalle = cl[s.clave] ? `clave ${s.clave} cargada` : `sin ${s.clave}`;
			if (!cl[s.clave]) paso = `perfil ${nombre} login ${id}  (la clave: ${s.clave_de})`;
		} else if (!buscar(s.bin, path, join(dir, "bin"))) {
			detalle = "CLI no instalada";
			paso = `instalar: ${s.instalar}; despues: perfil ${nombre} login ${id}`;
		} else {
			const con = s.sesion ? s.sesion(dir) : correr(nombre, s.estado, { silencioso: true }).code === 0;
			detalle = con ? "con sesion" : "sin sesion";
			if (!con) paso = `perfil ${nombre} login ${id}`;
		}
		console.log(`  ${id.padEnd(9)} ${detalle}`);
		if (paso) console.log(`  ${"".padEnd(9)} -> ${paso}`);
	}
	return 0;
}

function login(nombre, servicio) {
	const s = SERVICIOS[servicio];
	if (!s) {
		process.stderr.write(`perfil: servicio desconocido. Son: ${Object.keys(SERVICIOS).join(", ")}\n`);
		return 2;
	}
	if (s.login && !buscar(s.bin, process.env.PATH ?? "", null)) {
		process.stderr.write(`perfil: falta la CLI de ${servicio}. Instalar: ${s.instalar}\n`);
		return 127;
	}
	if (s.login) {
		console.log(
			`Antes de autorizar, fijate en el navegador con que cuenta de ${s.aviso} estas logueado: ` +
				`tiene que ser la que va en el perfil ${nombre}.`,
		);
		return correr(nombre, s.login);
	}
	const archivo = join(entorno(nombre).PERFIL_DIR, "claves.env");
	console.log(
		`${servicio} se usa con una clave: abri ${archivo} en un editor y agrega la linea\n` +
			`  ${s.clave}=<valor>\nNo la pegues en un chat.`,
	);
	return 0;
}

/**
 * Lets `git` in this clone (and its worktrees, which share `.git/config`) authenticate to GitHub
 * with the profile's gh session instead of the machine's credential helper. The helper points at
 * this script, which lives outside every project, so deleting a worktree never breaks it.
 */
function git(nombre) {
	const sale = (args) => spawnSync("git", args, { encoding: "utf8" });
	const comun = sale(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
	if (comun.status !== 0) {
		process.stderr.write("perfil git: correlo dentro de un clon\n");
		return 2;
	}
	const raiz = resolve(comun.stdout.trim(), "..");
	const clave = "credential.https://github.com.helper";
	sale(["config", "--local", "--unset-all", clave]);
	// The empty value cuts the chain of inherited helpers (the system's credential manager).
	sale(["config", "--local", "--add", clave, ""]);
	sale(["config", "--local", "--add", clave, `!node "${SCRIPT.replaceAll("\\", "/")}" ${nombre} -- gh auth git-credential`]);
	console.log(`git de ${raiz} se autentica en GitHub con el gh del perfil ${nombre}.`);
	if (!sale(["config", "user.email"]).stdout.trim())
		console.log("git no tiene user.email: commiteá con un email verificado en la cuenta de GitHub del perfil.");
	return 0;
}

function listar() {
	const nombres = existsSync(RAIZ)
		? readdirSync(RAIZ, { withFileTypes: true }).filter((d) => d.isDirectory() && NOMBRE.test(d.name))
		: [];
	if (nombres.length === 0) console.log(`sin perfiles en ${RAIZ}. Crear uno: perfil <nombre> login gh`);
	for (const d of nombres) console.log(d.name);
	return 0;
}

function principal(argv) {
	const [nombre, ...resto] = argv;
	if (nombre === undefined) return listar();
	if (!NOMBRE.test(nombre)) {
		process.stderr.write("perfil: el nombre es minusculas, digitos y guiones (p. ej. nomenclator)\n");
		return 2;
	}
	const [accion, ...args] = resto;
	if (accion === "--" && args.length) return correr(nombre, args);
	if (accion === "estado") return estado(nombre);
	if (accion === "login" && args.length === 1) return login(nombre, args[0]);
	if (accion === "git") return git(nombre);
	process.stderr.write("uso: perfil [<nombre> estado | <nombre> login <servicio> | <nombre> git | <nombre> -- <comando...>]\n");
	return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT) {
	process.exit(principal(process.argv.slice(2)));
}
