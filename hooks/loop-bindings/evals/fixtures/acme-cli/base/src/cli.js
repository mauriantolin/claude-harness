import { listInvoices, loadInvoices } from "./invoices.js";

const [cmd] = process.argv.slice(2);
if (cmd !== "list") {
	process.stderr.write("usage: cli.js list\n");
	process.exit(2);
}
for (const i of listInvoices(loadInvoices())) process.stdout.write(`${i.number}\t${i.customer}\t${i.total}\n`);
