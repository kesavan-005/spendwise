export function calcTotals(transactions = []) {
  let debit = 0;
  let credit = 0;
  let cash = 0;

  for (const t of transactions) {
    if (t.type === "debit") debit += t.amount;
    if (t.type === "credit") credit += t.amount;
    if (t.type === "cash") cash += t.amount;
  }

  const balance = credit - debit;

  return {
    debit,
    credit,
    cash,
    balance,
  };
}

export function groupByCategory(transactions = []) {
  const map = {};
  for (const t of transactions) {
    const cat = t.category || "Other";
    map[cat] = (map[cat] || 0) + t.amount;
  }
  return map;
}

export function groupByDate(transactions = []) {
  const map = {};
  for (const t of transactions) {
    const d = t.date;
    map[d] = (map[d] || 0) + t.amount;
  }
  return map;
}
