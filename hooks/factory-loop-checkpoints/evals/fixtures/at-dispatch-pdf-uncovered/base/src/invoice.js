export function totals(lines) {
	const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
	return { subtotal, tax: Math.round(subtotal * 0.21 * 100) / 100 };
}

export async function finalize(invoice, { storage }) {
	if (invoice.status !== "draft") throw new Error("only a draft can be finalized");
	const finalized = { ...invoice, status: "final", ...totals(invoice.lines) };
	await storage.put(`invoices/${invoice.id}.json`, JSON.stringify(finalized));
	return finalized;
}
