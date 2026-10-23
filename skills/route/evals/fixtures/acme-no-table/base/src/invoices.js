export function listInvoices(db) {
	return db.query("select * from invoices order by created_at desc");
}
