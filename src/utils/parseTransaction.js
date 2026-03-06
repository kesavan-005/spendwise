// ─── parseTransaction ─────────────────────────────────────────────────────
// Converts a plain text string into a structured transaction object.
//
// Examples:
//   "petrol 150"            → { type:"debit",  category:"Petrol",             amount:150   }
//   "lunch 80"              → { type:"debit",  category:"Lunch",              amount:80    }
//   "salary 25000"          → { type:"credit", category:"Income (Credited)",  amount:25000 }
//   "cash in 500"           → { type:"cash",   cashDirection:"in",            amount:500   }
//   "cash out 200"          → { type:"cash",   cashDirection:"out",           amount:200   }
//   "rent 8000"             → { type:"debit",  category:"Rental Home Expenses",amount:8000 }
//   "netflix 199"           → { type:"debit",  category:"Subscriptions",      amount:199   }
//   "dinner 450 yesterday"  → { type:"debit",  category:"Dinner",             amount:450, date: yesterday }
// ──────────────────────────────────────────────────────────────────────────

const KEYWORD_MAP = [
  // ── Income / Credit ──────────────────────────────────────────────────
  {
    words: ["salary","income","credited","credit","received","got paid","earning","stipend","bonus","commission","refund","reimbursement"],
    type: "credit", category: "Income (Credited)", description: "AMOUNT CREDITED TO ACCOUNT",
  },

  // ── Petrol / Transport ───────────────────────────────────────────────
  {
    words: ["petrol","fuel","diesel","gas bunk","filling","bunk"],
    type: "debit", category: "Petrol", description: "PETROL",
  },
  {
    words: ["bus","auto","cab","ola","uber","rapido","metro","train","ticket","travel fare","fare","toll"],
    type: "debit", category: "Petrol", description: "TRAVEL",
  },

  // ── Bike ─────────────────────────────────────────────────────────────
  {
    words: ["bike service","bike repair","mechanic","tyre","puncture","engine oil","bike"],
    type: "debit", category: "Bike Service", description: "BIKE SERVICE",
  },

  // ── Food ─────────────────────────────────────────────────────────────
  {
    words: ["breakfast","tiffin","idli","dosa","pongal","upma","poha","paratha","chai","tea","coffee morning"],
    type: "debit", category: "Breakfast", description: "BREAKFAST",
  },
  {
    words: ["lunch","meals","rice","biryani","thali","meals","kothu","parotta","biriyani"],
    type: "debit", category: "Lunch", description: "LUNCH",
  },
  {
    words: ["dinner","supper","night food","night meal","roti","chapati"],
    type: "debit", category: "Dinner", description: "DINNER",
  },
  {
    words: ["snack","snacks","biscuit","chips","juice","cold drink","soda","milk","sweets","bakery","cake"],
    type: "debit", category: "Breakfast", description: "SNACKS",
  },
  {
    words: ["fruits","vegetables","veggie","veg","market","grocery","groceries","provisions","kirana","supermarket","tomato","onion"],
    type: "debit", category: "Fruits", description: "FRUITS",
  },

  // ── Rent / Home ──────────────────────────────────────────────────────
  {
    words: ["rent","room rent","house rent","pg","hostel","rental","accommodation"],
    type: "debit", category: "Rental Home Expenses", description: "RENTAL HOME NEEDS",
  },
  {
    words: ["family","home expenses","house expenses","parents","amma","appa","mom","dad","siblings","send home","home"],
    type: "debit", category: "Family Home Expenses", description: "FAMILY EXPENSES",
  },

  // ── Subscriptions / Bills ────────────────────────────────────────────
  {
    words: ["netflix","hotstar","prime","youtube premium","spotify","apple music","subscription","sub","zee5","sonyliv","jiocinema"],
    type: "debit", category: "Subscriptions", description: "SUBSCRIPTION PAYMENT",
  },
  {
    words: ["phone bill","mobile bill","recharge","sim","jio","airtel","vi","bsnl","wifi","broadband","internet bill","electricity","eb bill","water bill","gas bill","utility"],
    type: "debit", category: "Subscriptions", description: "BILL PAYMENT",
  },

  // ── Laundry ───────────────────────────────────────────────────────────
  {
    words: ["laundry","wash","ironing","iron clothes","dry clean","dhobi"],
    type: "debit", category: "Laundry / Ironing", description: "LAUNDRY / IRONING",
  },

  // ── Studies ───────────────────────────────────────────────────────────
  {
    words: ["book","course","exam fee","study","coaching","tuition","college fee","school fee","udemy","certificate","exam prep"],
    type: "debit", category: "Studies / Exam Prep", description: "STUDY MATERIAL / COURSE",
  },

  // ── Personal Care ─────────────────────────────────────────────────────
  {
    words: ["haircut","salon","barber","trim","medicine","tablet","pharmacy","doctor","hospital","health","gym","protein","personal care","cosmetic","deodorant","shampoo","soap"],
    type: "debit", category: "Personal Care", description: "PERSONAL CARE",
  },

  // ── Cash ──────────────────────────────────────────────────────────────
  {
    words: ["cash in","cash received","received cash","got cash","cash credited"],
    type: "cash", cashDirection: "in", category: "Other", description: "CASH IN",
  },
  {
    words: ["cash out","cash spent","spent cash","withdraw","atm","withdrawn"],
    type: "cash", cashDirection: "out", category: "Other", description: "CASH OUT",
  },
];

// ── date resolution ────────────────────────────────────────────────────────
function resolveDate(input) {
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);

  if (/\byesterday\b/i.test(input)) {
    const d = new Date(today); d.setDate(d.getDate() - 1); return fmt(d);
  }
  if (/\b2\s*days?\s*ago\b/i.test(input)) {
    const d = new Date(today); d.setDate(d.getDate() - 2); return fmt(d);
  }
  if (/\b3\s*days?\s*ago\b/i.test(input)) {
    const d = new Date(today); d.setDate(d.getDate() - 3); return fmt(d);
  }
  if (/\btoday\b/i.test(input)) return fmt(today);

  // explicit dd/mm or dd-mm or dd/mm/yy
  const m = input.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (m) {
    const day = parseInt(m[1]), month = parseInt(m[2]) - 1;
    const year = m[3] ? (parseInt(m[3]) < 100 ? 2000 + parseInt(m[3]) : parseInt(m[3])) : today.getFullYear();
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return fmt(d);
  }

  return fmt(today);
}

// ── amount extraction ─────────────────────────────────────────────────────
function extractAmount(input) {
  // "1.5k" or "2k"
  const kMatch = input.match(/(\d[\d,]*\.?\d*)\s*k\b/i);
  if (kMatch) return Math.round(parseFloat(kMatch[1].replace(/,/g, "")) * 1000);
  // plain number, possibly with commas: 1,500 or 25000
  const match = input.match(/(\d[\d,]*\.?\d*)/);
  if (match) return parseFloat(match[1].replace(/,/g, ""));
  return null;
}

// ── strip known parts to get custom description ────────────────────────────
function extractCustomDesc(input, matchedWord) {
  return input
    .replace(/(\d[\d,]*\.?\d*)\s*k?\b/gi, "")           // numbers
    .replace(/\byesterday\b|\btoday\b/gi, "")
    .replace(/\b\d\s*days?\s*ago\b/gi, "")
    .replace(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/g, "")
    .replace(new RegExp(`\\b${matchedWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// ── main parser ────────────────────────────────────────────────────────────
export function parseTransaction(raw) {
  if (!raw?.trim()) return null;

  const input  = raw.trim();
  const lower  = input.toLowerCase();
  const amount = extractAmount(input);
  const date   = resolveDate(input);

  if (!amount || amount <= 0) return null;

  // find best match — longest keyword wins (prevents "cash" beating "cash in")
  let best = null;
  let bestLen = 0;
  let bestWord = "";

  for (const entry of KEYWORD_MAP) {
    for (const word of entry.words) {
      if (lower.includes(word) && word.length > bestLen) {
        best     = entry;
        bestLen  = word.length;
        bestWord = word;
      }
    }
  }

  if (best) {
    const custom = extractCustomDesc(input, bestWord);
    return {
      type:          best.type,
      cashDirection: best.cashDirection,
      category:      best.category,
      amount,
      date,
      description:   custom.length > 1 ? custom : best.description,
      confidence:    "high",
    };
  }

  // fallback — debit / Other, use input words as description
  const fallbackDesc = input
    .replace(/(\d[\d,]*\.?\d*)\s*k?\b/gi, "")
    .replace(/\byesterday\b|\btoday\b/gi, "")
    .replace(/\b\d\s*days?\s*ago\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase() || "EXPENSE";

  return {
    type:        "debit",
    cashDirection: undefined,
    category:    "Other",
    amount,
    date,
    description: fallbackDesc,
    confidence:  "low",   // UI can show a "guessed" indicator
  };
}
