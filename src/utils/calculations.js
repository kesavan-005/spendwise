// ─── calcTotals ────────────────────────────────────────────────────────────
// Cash direction stored on each transaction as:
//   type: "cash"  +  cashDirection: "in"   → cash received
//   type: "cash"  +  cashDirection: "out"  → cash spent
//
// Legacy records (type:"cash", no cashDirection) default to "out"
// so existing data is unaffected.
// ──────────────────────────────────────────────────────────────────────────
export function calcTotals(txns = []) {
  let credit  = 0;
  let debit   = 0;
  let cashIn  = 0;
  let cashOut = 0;

  for (const t of txns) {
    const amt = Number(t.amount || 0);
    if (t.type === "credit") {
      credit += amt;
    } else if (t.type === "debit") {
      debit += amt;
    } else if (t.type === "cash") {
      if (t.cashDirection === "in") cashIn  += amt;
      else                          cashOut += amt; // default legacy → out
    }
  }

  const netCash = cashIn - cashOut;
  const balance = credit + cashIn - debit - cashOut;

  return {
    credit,
    debit,
    cashIn,
    cashOut,
    netCash,
    cash: cashOut, // legacy compat — older code reads totals.cash
    balance,
  };
}

// ─── groupByDate ───────────────────────────────────────────────────────────
export function groupByDate(txns = []) {
  const map = {};
  for (const t of txns) {
    const d = t.date || "unknown";
    map[d] = (map[d] || 0) + Number(t.amount || 0);
  }
  return map;
}

// ─── groupByCategory ──────────────────────────────────────────────────────
export function groupByCategory(txns = []) {
  const map = {};
  for (const t of txns) {
    const cat = t.category || "Other";
    map[cat] = (map[cat] || 0) + Number(t.amount || 0);
  }
  return map;
}