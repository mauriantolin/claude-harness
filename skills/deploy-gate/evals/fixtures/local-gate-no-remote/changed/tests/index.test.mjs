import { test } from "node:test";
import assert from "node:assert/strict";
import { ping, pong } from "../src/index.mjs";

test("pong", () => {
  assert.equal(pong("x"), "pong x");
});

test("ping", () => {
  assert.equal(ping("x"), "ping x");
});
