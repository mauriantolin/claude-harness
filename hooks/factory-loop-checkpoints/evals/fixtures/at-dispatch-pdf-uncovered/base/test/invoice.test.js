import assert from "node:assert/strict";
import { test } from "node:test";
import { finalize, totals } from "../src/invoice.js";

test("totals add tax to the subtotal", () => {
	assert.deepEqual(totals([{ quantity: 2, unitPrice: 50 }]), { subtotal: 100, tax: 21 });
});

test("finalize stores the finalized invoice", async () => {
	const stored = {};
	const storage = { put: async (k, v) => { stored[k] = v; } };
	await finalize({ id: "42", status: "draft", lines: [] }, { storage });
	assert.ok(stored["invoices/42.json"]);
});
