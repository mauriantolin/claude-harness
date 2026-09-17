// A fixture run gets Bash with permissions skipped, and a deny rule matches a
// command prefix, not an intent: `bash -c "npx skills add ..."` is not
// `npx skills add`. So the runner also looks. It lists the directories a
// skill install writes to before and after each run, and a difference is
// reported with the run instead of being discovered in the next session.

import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const SKILL_INSTALL_DIRS = [join(homedir(), ".claude", "skills"), join(homedir(), ".agents", "skills")];

export function snapshotDirs(dirs = SKILL_INSTALL_DIRS) {
	return Object.fromEntries(dirs.map((d) => [d, existsSync(d) ? readdirSync(d).sort() : null]));
}

// Entries added to or removed from each directory; empty when nothing moved.
export function diffSnapshots(before, after) {
	const changes = [];
	for (const dir of new Set([...Object.keys(before), ...Object.keys(after)])) {
		const was = new Set(before[dir] ?? []);
		const now = new Set(after[dir] ?? []);
		const added = [...now].filter((n) => !was.has(n));
		const removed = [...was].filter((n) => !now.has(n));
		if (added.length || removed.length) changes.push({ dir, added, removed });
	}
	return changes;
}
