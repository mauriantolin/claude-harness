import { resolveOption } from "../src/select.js";
import assert from "node:assert";

const options = [{ value: "C", text: "Capital\u00A0Federal" }];

// A2: exact value still wins.
assert.equal(resolveOption(options, "C").value, "C");

// A1: an ASCII-space spelling resolves a label carrying a non-breaking space.
assert.equal(resolveOption(options, "Capital Federal").value, "C");

console.log("ok");
