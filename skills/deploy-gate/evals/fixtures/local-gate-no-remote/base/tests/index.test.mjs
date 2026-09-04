import { test } from "node:test";
import assert from "node:assert/strict";
import { pong } from "../src/index.mjs";

test("pong", () => {
  assert.equal(pong("x"), "pong x");
});
