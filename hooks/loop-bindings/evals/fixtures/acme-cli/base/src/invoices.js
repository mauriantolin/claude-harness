import { readFileSync } from "node:fs";

export function loadInvoices(path = new URL("../data/invoices.json", import.meta.url)) {
	return JSON.parse(readFileSync(path, "utf8"));
}

export function listInvoices(rows) {
	return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
