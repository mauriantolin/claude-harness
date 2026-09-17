export function InvoicePage({ invoice }) {
	return (
		<main>
			<h1>Invoice {invoice.number}</h1>
			<p>Status: {invoice.status}</p>
			<p>Total: {invoice.subtotal + invoice.tax}</p>
		</main>
	);
}
