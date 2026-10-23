import { Table } from "@acme/ui";

export function InvoicesPage({ invoices }) {
	return <Table rows={invoices} columns={["number", "customer", "total"]} />;
}
