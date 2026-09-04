import { resolveOption } from "../src/select.js";
import assert from "node:assert";

const options = [{ value: "C", text: "Capital\u00A0Federal" }];

// Exact value still wins, case-sensitively.
assert.equal(resolveOption(options, "C").value, "C");

// An ASCII-space spelling resolves a label carrying a non-breaking space.
assert.equal(resolveOption(options, "Capital Federal").value, "C");

// Normalized ambiguity is rejected, never guessed.
const ambiguous = [
  { value: "a", text: "Alpha Beta" },
  { value: "b", text: "Alpha\u00A0Beta" },
];
assert.equal(resolveOption(ambiguous, "Alpha  Beta"), null);

console.log("ok");
