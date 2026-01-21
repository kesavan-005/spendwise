export function exportTransactionsCSV(transactions, filename = "spendwise-report.csv") {
  const headers = ["date", "description", "category", "type", "amount"];
  const rows = transactions.map((t) => [
    t.date,
    (t.description || "").replaceAll(",", " "),
    (t.category || "").replaceAll(",", " "),
    t.type,
    t.amount,
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}
