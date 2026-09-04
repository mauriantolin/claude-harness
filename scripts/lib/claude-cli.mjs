// Runs the `claude` CLI headlessly. One place for the Windows quirks so the
// eval and trigger runners do not each carry a copy.

import { spawn } from "node:child_process";

// Windows needs a shell: `claude` resolves to a .cmd, and since CVE-2024-27980
// Node refuses to spawn one directly (EINVAL). With a shell the command is one
// string, so anything with whitespace or quotes is quoted. Free-form text (the
// prompt) never travels as an argument; it goes on stdin.
const NEEDS_SHELL = process.platform === "win32";

export function quoteForShell(arg) {
	return /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

function spawnClaude(argv, options) {
	if (NEEDS_SHELL) {
		return spawn(["claude", ...argv.map(quoteForShell)].join(" "), [], { ...options, shell: true });
	}
	return spawn("claude", argv, options);
}

export function runClaude({ prompt, args, cwd, timeoutMs = 10 * 60 * 1000, env }) {
	const argv = ["-p", ...args];
	return new Promise((resolve) => {
		const child = spawnClaude(argv, {
			cwd: cwd || undefined,
			env: env ? { ...process.env, ...env } : process.env,
			stdio: ["pipe", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, timeoutMs);
		child.stdout.on("data", (d) => (stdout += d));
		child.stderr.on("data", (d) => (stderr += d));
		// `ok` is exit 0. A caller reading a stream-json transcript may still
		// find a complete run in `stdout` after a non-zero exit: hitting
		// --max-turns ends the session with exit 1 and a `result` event.
		child.on("error", (e) => {
			clearTimeout(timer);
			resolve({ ok: false, status: null, stdout, stderr, text: `spawn failed: ${e.message}` });
		});
		child.on("close", (status) => {
			clearTimeout(timer);
			if (timedOut) resolve({ ok: false, status, stdout, stderr, text: `timed out after ${timeoutMs} ms\n${stdout}` });
			else if (status !== 0) resolve({ ok: false, status, stdout, stderr, text: `exit ${status}\n${stderr}${stdout}` });
			else resolve({ ok: true, status, stdout, stderr, text: stdout.trim() });
		});
		child.stdin.end(prompt);
	});
}

// Runs async `tasks` with at most `limit` in flight, preserving result order.
export async function runWithLimit(tasks, limit) {
	const results = new Array(tasks.length);
	let next = 0;
	async function worker() {
		while (next < tasks.length) {
			const i = next++;
			results[i] = await tasks[i]();
		}
	}
	await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, worker));
	return results;
}
