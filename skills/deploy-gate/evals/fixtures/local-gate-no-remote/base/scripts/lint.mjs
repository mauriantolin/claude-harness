// Refuses a source file that still carries a debugging console.log.
import { readdirSync, readFileSync } from "node:fs";
let bad = 0;
for (const f of readdirSync("src")) {
  const text = readFileSync(`src/${f}`, "utf8");
  if (/console\.log\(/.test(text)) {
    console.error(`src/${f}: stray console.log`);
    bad++;
  }
}
process.exit(bad ? 1 : 0);
