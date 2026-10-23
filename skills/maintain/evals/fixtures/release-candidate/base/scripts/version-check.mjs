// Fails when any artifact that declares the version disagrees with package.json.
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8")).version;
const places = {
  VERSION: readFileSync("VERSION", "utf8").trim(),
  "README.md": readFileSync("README.md", "utf8").match(/Current version: \*\*([^*]+)\*\*/)?.[1],
  "README.md install": readFileSync("README.md", "utf8").match(/slugkit@([0-9.]+)/)?.[1],
};
let bad = 0;
for (const [place, v] of Object.entries(places)) {
  if (v !== pkg) {
    console.error(`${place}: ${v} != package.json ${pkg}`);
    bad++;
  }
}
if (bad) process.exit(1);
console.log(`version ${pkg} agrees in ${Object.keys(places).length + 1} places`);
