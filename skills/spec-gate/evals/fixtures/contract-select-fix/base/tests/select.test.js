import { resolveOption } from "../src/select.js";
import assert from "node:assert";

const options = [{ value: "C", text: "Capital\u00A0Federal" }];
assert.equal(resolveOption(options, "C").value, "C");
console.log("ok");
