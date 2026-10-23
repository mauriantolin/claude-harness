import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/index.js";

test("slugifies", () => {
  assert.equal(slugify("Hello, World!"), "hello-world");
  assert.equal(slugify("--a--b--"), "a-b");
});
