import assert from "node:assert/strict";
import { test } from "node:test";
import { listInvoices } from "../src/invoices.js";

test("lists newest first", () => {
	const rows = listInvoices([{ created_at: "2026-01-01" }, { created_at: "2026-02-01" }]);
	assert.equal(rows[0].created_at, "2026-02-01");
});
