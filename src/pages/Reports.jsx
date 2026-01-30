import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { exportSpendWisePDF } from "../utils/exportPDF";

import ConfirmModal from "../components/ConfirmModal";
import Toast from "../components/Toast";
import { useToast } from "../utils/useToast";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/firebase";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

import {
  calcTotals,
  groupByCategory,
  groupByDate,
} from "../utils/calculations";

// -------------------------------
// Helpers
// -------------------------------
function formatINR(n) {
  return `Rs. ${Number(n || 0).toFixed(0)}`;
}

function cleanDateLabel(dateStr) {
  try {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}`;
  } catch {
    return dateStr;
  }
}

function sortTxns(list, sortBy) {
  const arr = [...list];

  switch (sortBy) {
    case "entry":
      return arr; // Firestore already gives OLD → NEW

    case "date_desc":
      return arr.sort((a, b) => (a.date < b.date ? 1 : -1));

    case "az":
      return arr.sort((a, b) =>
        (a.description || "").localeCompare(b.description || "")
      );

    case "za":
      return arr.sort((a, b) =>
        (b.description || "").localeCompare(a.description || "")
      );

    default:
      return arr;
  }
}


export default function Reports({ username }) {
  const [txns, setTxns] = useState([]);

  const [editing, setEditing] = useState(null);
const [deleteTxn, setDeleteTxn] = useState(null);

const { toast, showToast, clearToast } = useToast();


  const [loading, setLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Sort
const [sortBy, setSortBy] = useState("date_desc");

  // Export UI
  const [openExportOptions, setOpenExportOptions] = useState(false);
  const [includeGraphs, setIncludeGraphs] = useState(true);
  const [includeGraphValues, setIncludeGraphValues] = useState(true);

  // Refs for charts (html2canvas)
  const dailyRef = useRef(null);
  const categoryRef = useRef(null);
  const balanceRef = useRef(null);

  // -------------------------------
  // Load transactions
  // -------------------------------
  async function load() {
    setLoading(true);
   const q = query(
  collection(db, "users", username, "transactions"),
  orderBy("date", "asc"),
  orderBy("createdAt", "asc")
);


    const snap = await getDocs(q);
    setTxns(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  // ✅ Category list for dropdown
  const categoryList = useMemo(() => {
    const set = new Set(txns.map((t) => t.category || "Other"));
    return ["all", ...Array.from(set).sort()];
  }, [txns]);

  

  // -------------------------------
  // Apply filters + sort
  // -------------------------------
  const filtered = useMemo(() => {
    let list = [...txns];

    if (typeFilter !== "all") {
      list = list.filter((t) => t.type === typeFilter);
    }

    if (categoryFilter !== "all") {
      list = list.filter((t) => (t.category || "Other") === categoryFilter);
    }

    if (fromDate) list = list.filter((t) => t.date >= fromDate);
    if (toDate) list = list.filter((t) => t.date <= toDate);

    return sortTxns(list, sortBy);
  }, [txns, typeFilter, categoryFilter, fromDate, toDate, sortBy]);

  const totals = useMemo(() => calcTotals(filtered), [filtered]);

  // ✅ Auto select highlighted transactions (from Add page)
useEffect(() => {
  const auto = new Set();

  filtered.forEach((t) => {
    if (t.highlighted) auto.add(t.id);
  });

  setSelectedTxns(auto);
}, [filtered]);


  // -------------------------------
  // Graph datasets
  // -------------------------------
  const dailyData = useMemo(() => {
    const onlyDebit = filtered.filter((t) => t.type === "debit");
    const m = groupByDate(onlyDebit);
    return Object.keys(m)
      .sort()
      .map((date) => ({
        date,
        label: cleanDateLabel(date),
        amount: m[date],
      }))
      .slice(-15);
  }, [filtered]);

  const categoryData = useMemo(() => {
    const onlyDebit = filtered.filter((t) => t.type === "debit");
    const m = groupByCategory(onlyDebit);
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
      .slice(0, 10);
  }, [filtered]);

  const balanceTrend = useMemo(() => {
  // keep SAME order as filtered (already entry order)
  let bal = 0;
  const arr = [];

  for (const t of filtered) {
    if (t.type === "credit") bal += Number(t.amount || 0);
    if (t.type === "debit") bal -= Number(t.amount || 0);

    arr.push({
      date: t.date,
      label: cleanDateLabel(t.date),
      balance: bal,
    });
  }

  return arr.slice(-20);
}, [filtered]);

const [selectedTxns, setSelectedTxns] = useState(new Set());


  // -------------------------------
  // Export PDF
  // -------------------------------
  // async function exportPDF() {
  //   const pdf = new jsPDF("p", "mm", "a4");

  //   // Arial-like
  //   pdf.setFont("helvetica", "normal");

  //   // Title
  //   pdf.setFontSize(18);
  //   pdf.setFont("helvetica", "bold");
  //   pdf.text("SpendWise Report", 14, 18);

  //   pdf.setFont("helvetica", "normal");
  //   pdf.setFontSize(11);
  //   pdf.text(`Generated for: ${username}`, 14, 26);
  //   pdf.text(`Generated on: ${new Date().toLocaleString()}`, 14, 32);

  //   // Summary cards in one row
  //   const startY = 42;
  //   const cardH = 18;
  //   const cardW = 60;
  //   const gap = 6;

  //   function summaryCard(x, title, value, fillRGB) {
  //     pdf.setFillColor(...fillRGB);
  //     pdf.roundedRect(x, startY, cardW, cardH, 4, 4, "F");

  //     pdf.setTextColor(255, 255, 255);

  //     pdf.setFont("helvetica", "bold");
  //     pdf.setFontSize(11);
  //     pdf.text(title, x + 4, startY + 7);

  //     pdf.setFontSize(12);
  //     pdf.text(value, x + 4, startY + 15);

  //     pdf.setTextColor(0, 0, 0);
  //     pdf.setFont("helvetica", "normal");
  //   }

  //   summaryCard(14, "Total Credit", formatINR(totals.credit), [16, 185, 129]);
  //   summaryCard(
  //     14 + cardW + gap,
  //     "Total Debit",
  //     formatINR(totals.debit),
  //     [244, 63, 94]
  //   );
  //   summaryCard(
  //     14 + (cardW + gap) * 2,
  //     "Balance",
  //     formatINR(totals.balance),
  //     [59, 130, 246]
  //   );

  //   let y = startY + cardH + 14;

  //   // Graphs optional
  //   if (includeGraphs) {
  //     pdf.setFont("helvetica", "bold");
  //     pdf.setFontSize(13);
  //     pdf.text("Graphs", 14, y);
  //     y += 6;

  //     async function addChart(ref, title) {
  //       if (!ref?.current) return;

  //       pdf.setFont("helvetica", "bold");
  //       pdf.setFontSize(12);
  //       pdf.text(title, 14, y);
  //       y += 4;

  //       const canvas = await html2canvas(ref.current, {
  //         scale: 2,
  //         backgroundColor: "#ffffff",
  //       });
  //       const imgData = canvas.toDataURL("image/png");

  //       const imgW = 180;
  //       const imgH = (canvas.height * imgW) / canvas.width;

  //       if (y + imgH > 280) {
  //         pdf.addPage();
  //         y = 18;
  //       }

  //       pdf.addImage(imgData, "PNG", 14, y, imgW, imgH);
  //       y += imgH + 8;
  //     }

  //     await addChart(dailyRef, "Daily Spend");
  //     await addChart(categoryRef, "Category");
  //     await addChart(balanceRef, "Balance Trend");

  //     // Values tables
  //     if (includeGraphValues) {
  //       // Daily values
  //       if (dailyData.length > 0) {
  //         if (y > 250) {
  //           pdf.addPage();
  //           y = 18;
  //         }

  //         pdf.setFont("helvetica", "bold");
  //         pdf.setFontSize(12);
  //         pdf.text("Daily Spend Values", 14, y);
  //         y += 4;

  //         autoTable(pdf, {
  //           startY: y,
  //           head: [["Date", "Debit Amount"]],
  //           body: dailyData.map((d) => [d.date, formatINR(d.amount)]),
  //           styles: { font: "helvetica", fontSize: 10 },
  //           headStyles: { fontStyle: "bold" },
  //         });

  //         y = pdf.lastAutoTable.finalY + 8;
  //       }

  //       // Category values
  //       if (categoryData.length > 0) {
  //         if (y > 250) {
  //           pdf.addPage();
  //           y = 18;
  //         }

  //         pdf.setFont("helvetica", "bold");
  //         pdf.setFontSize(12);
  //         pdf.text("Category Values", 14, y);
  //         y += 4;

  //         autoTable(pdf, {
  //           startY: y,
  //           head: [["Category", "Amount"]],
  //           body: categoryData.map((c) => [c.name, formatINR(c.value)]),
  //           styles: { font: "helvetica", fontSize: 10 },
  //           headStyles: { fontStyle: "bold" },
  //         });

  //         y = pdf.lastAutoTable.finalY + 8;
  //       }

  //       // Balance values
  //       if (balanceTrend.length > 0) {
  //         if (y > 250) {
  //           pdf.addPage();
  //           y = 18;
  //         }

  //         pdf.setFont("helvetica", "bold");
  //         pdf.setFontSize(12);
  //         pdf.text("Balance Trend Values", 14, y);
  //         y += 4;

  //         autoTable(pdf, {
  //           startY: y,
  //           head: [["Date", "Balance"]],
  //           body: balanceTrend.map((b) => [b.date, formatINR(b.balance)]),
  //           styles: { font: "helvetica", fontSize: 10 },
  //           headStyles: { fontStyle: "bold" },
  //         });

  //         y = pdf.lastAutoTable.finalY + 8;
  //       }
  //     }
  //   }

  //   // Transactions Table
  //   if (y > 240) {
  //     pdf.addPage();
  //     y = 18;
  //   }

  //   pdf.setFont("helvetica", "bold");
  //   pdf.setFontSize(13);
  //   pdf.text("Transactions", 14, y);
  //   y += 4;

  //   autoTable(pdf, {
  //     startY: y,
  //     head: [["Date", "Type", "Category", "Description", "Amount"]],
  //     body: filtered.map((t) => [
  //       t.date,
  //       (t.type || "").toUpperCase(),
  //       t.category || "Other",
  //       t.description || "",
  //       formatINR(t.amount),
  //     ]),
  //     styles: { font: "helvetica", fontSize: 9 },
  //     headStyles: { fontStyle: "bold" },
  //     columnStyles: {
  //       0: { cellWidth: 22 },
  //       1: { cellWidth: 20 },
  //       2: { cellWidth: 34 },
  //       3: { cellWidth: 74 },
  //       4: { cellWidth: 26 },
  //     },
  //   });

  //   pdf.save(`SpendWise_Report_${username}.pdf`);
  // }

  const PIE_COLORS = [
    "#10b981",
    "#3b82f6",
    "#f59e0b",
    "#f43f5e",
    "#a855f7",
    "#0ea5e9",
    "#64748b",
  ];

  const inputClass =
    "w-full p-3 rounded-xl outline-none border bg-white border-slate-200 text-slate-900 " +
    "dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100";

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            Reports
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Filter, sort and export PDF.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpenExportOptions((v) => !v)}
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold hover:opacity-90"
          >
            Export Options
          </button>

         <button
            onClick={() =>
             exportSpendWisePDF({
              username,
              totals,
              transactions: filtered,
              highlighted: Array.from(selectedTxns),
              dailyRef,
              categoryRef,
              balanceRef,
              includeGraphs,
            })

            }
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold shadow-[0_0_20px_rgba(16,185,129,0.35)]"
          >
            Export PDF
          </button>

        </div>
      </div>

      {/* Export Options Panel */}
      {openExportOptions && (
        <div className="mt-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow">
          <p className="font-extrabold text-slate-900 dark:text-slate-100">
            Export Settings
          </p>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={includeGraphs}
                onChange={(e) => setIncludeGraphs(e.target.checked)}
              />
              <span className="font-bold text-slate-900 dark:text-slate-100">
                Include Graphs in PDF
              </span>
            </label>

            <label className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={includeGraphValues}
                disabled={!includeGraphs}
                onChange={(e) => setIncludeGraphValues(e.target.checked)}
              />
              <span
                className={`font-bold ${
                  includeGraphs
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-slate-400 dark:text-slate-600"
                }`}
              >
                Show Graph Values (Tables)
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Type Filter */}
          <div>
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300">
              Type Filter
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">All</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          {/* ✅ Category Filter */}
          <div>
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={inputClass}
            >
              {categoryList.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All" : c}
                </option>
              ))}
            </select>
          </div>

          {/* From */}
          <div>
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300">
              From
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* To */}
          <div>
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300">
              To
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Sort */}
          <div>
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300">
              Sort
            </label>
           <select
  value={sortBy}
  onChange={(e) => setSortBy(e.target.value)}
  className={inputClass}
>
  <option value="entry">Entry Order (Old → New)</option>
  <option value="date_desc">Date (Newest)</option>
  <option value="az">Description (A → Z)</option>
  <option value="za">Description (Z → A)</option>
</select>

          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl p-4 shadow border border-slate-200 dark:border-slate-800 bg-emerald-500 text-black">
          <p className="font-extrabold">Total Credit</p>
          <p className="text-2xl font-black">{formatINR(totals.credit)}</p>
        </div>

        <div className="rounded-2xl p-4 shadow border border-slate-200 dark:border-slate-800 bg-rose-500 text-black">
          <p className="font-extrabold">Total Debit</p>
          <p className="text-2xl font-black">{formatINR(totals.debit)}</p>
        </div>

        <div className="rounded-2xl p-4 shadow border border-slate-200 dark:border-slate-800 bg-blue-500 text-black">
          <p className="font-extrabold">Balance</p>
          <p className="text-2xl font-black">{formatINR(totals.balance)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily spend */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow p-4">
          <p className="font-extrabold text-slate-900 dark:text-slate-100">
            Daily Spend
          </p>
          <div ref={dailyRef} className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Bar
  dataKey="amount"
  fill="#3b82f6"
  radius={[8, 8, 0, 0]}
  label={{ position: "top", formatter: (v) => `Rs.${v}` }}
/>

              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow p-4">
          <p className="font-extrabold text-slate-900 dark:text-slate-100">
            Category
          </p>
            <div ref={categoryRef} className="mt-3 h-[260px] text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                labelLine={true}   // ✅ arrows / lines
                label={({ name, value }) => `${name} (${value})`}

              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>

              <Tooltip formatter={(v) => formatINR(v)} />

              {/* ✅ REMOVE LEGEND (this was the old format) */}
              {/* <Legend /> */}
            </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Balance */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow p-4">
          <p className="font-extrabold text-slate-900 dark:text-slate-100">
            Balance Trend
          </p>
          <div ref={balanceRef} className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={balanceTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow p-4">
        <p className="font-extrabold text-slate-900 dark:text-slate-100">
          Transactions ({filtered.length})
        </p>

        {loading ? (
  <p className="text-slate-500 dark:text-slate-400 mt-3">Loading...</p>
) : filtered.length === 0 ? (
  <p className="text-slate-500 dark:text-slate-400 mt-3">
    No transactions found.
  </p>
) : (
  <div className="mt-3 overflow-auto">
    <table className="w-full text-sm border-collapse">
      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
        <tr className="text-left text-slate-700 dark:text-slate-200">
          <th className="py-3 px-3 border">Date</th>
          <th className="py-3 px-3 border">Type</th>
          <th className="py-3 px-3 border">Category</th>
          <th className="py-3 px-3 border">Description</th>
          <th className="py-3 px-3 border">Amount</th>
          <th className="py-3 px-3 border">Actions</th>
          <th className="py-3 px-3 border">✓</th>
        </tr>
      </thead>  


      <tbody>
          {filtered.map((t, i) => {
            const prev = filtered[i - 1];
            const newDay = !prev || prev.date !== t.date;

            return (
              <tr
                key={t.id}
                className={`
                  hover:bg-slate-100 dark:hover:bg-slate-800 transition
                  ${newDay ? "bg-slate-50 dark:bg-slate-900 border-t-4 border-slate-300 dark:border-slate-700" : ""}
                `}
              >
                <td className="py-2 px-3 border">{t.date}</td>

                <td className="py-2 px-3 border font-bold uppercase">{t.type}</td>

                <td className="py-2 px-3 border">{t.category || "Other"}</td>

                <td className="py-2 px-3 border">{t.description}</td>

                <td
                  className={`py-2 px-3 border font-extrabold ${
                    t.type === "credit" ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  {formatINR(t.amount)}
                </td>

                <td className="py-2 px-3 border">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing({ ...t })}
                      className="px-3 py-1 rounded bg-blue-500 text-black font-bold text-xs"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => setDeleteTxn(t)}
                      className="px-3 py-1 rounded bg-rose-500 text-black font-bold text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </td>
                <td className="py-2 px-3 border text-center">
                  <input
                    type="checkbox"
                    checked={selectedTxns.has(t.id)}
                    onChange={() => {
                      const copy = new Set(selectedTxns);
                      copy.has(t.id) ? copy.delete(t.id) : copy.add(t.id);
                      setSelectedTxns(copy);
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>


    </table>
  </div>
)}
</div>

      {/* Delete Confirm Modal */}

      <ConfirmModal
        open={!!deleteTxn}
        title="Delete Transaction"
        message={`Delete "${deleteTxn?.description}" ?`}
        confirmText="Delete"
        cancelText="Cancel"
        danger={true}
        onCancel={() => setDeleteTxn(null)}
        onConfirm={async () => {
          if (!deleteTxn) return;

          try {
            await deleteDoc(
              doc(db, "users", username, "transactions", deleteTxn.id)
            );

            showToast("Transaction deleted", "success");
            setDeleteTxn(null);
            load();
          } catch (err) {
            console.error(err);
            showToast("Failed to delete", "error");
          }
        }}
      />


            {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-[9998] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xl">
            <h2 className="text-xl font-extrabold">Edit Transaction</h2>

            <div className="mt-4 space-y-3">
              <input
                type="date"
                value={editing.date}
                onChange={(e) =>
                  setEditing({ ...editing, date: e.target.value })
                }
                className="w-full p-3 rounded-xl border"
              />

              <select
                value={editing.type}
                onChange={(e) =>
                  setEditing({ ...editing, type: e.target.value })
                }
                className="w-full p-3 rounded-xl border"
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
                <option value="cash">Cash</option>
              </select>

              <input
                type="number"
                value={editing.amount}
                onChange={(e) =>
                  setEditing({ ...editing, amount: e.target.value })
                }
                className="w-full p-3 rounded-xl border"
              />

              <input
                value={editing.category || ""}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value })
                }
                className="w-full p-3 rounded-xl border"
              />

              <input
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
                className="w-full p-3 rounded-xl border"
              />

            </div>

            {/* Highlight permanent */}
<div className="flex items-center gap-3 mt-2">
  <input
    type="checkbox"
    checked={editing.highlighted || false}
    onChange={(e) =>
      setEditing({
        ...editing,
        highlighted: e.target.checked,
      })
    }
    className="w-5 h-5 accent-emerald-500"
  />

  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
    Highlight this transaction (permanent)
  </span>
</div>


            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-xl bg-slate-300 font-bold"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  try {
                    await updateDoc(
                      doc(db, "users", username, "transactions", editing.id),
                      {
                        date: editing.date,
                        description: editing.description.toUpperCase(),
                        amount: Number(editing.amount),
                        type: editing.type,
                        category: editing.category,
                        highlighted: editing.highlighted || false,
                      }
                    );

                    showToast("Transaction updated", "success");
                    setEditing(null);
                    load();
                  } catch (err) {
                    console.error(err);
                    showToast("Failed to update", "error");
                  }
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500 font-extrabold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

          <Toast message={toast.message} type={toast.type} onClose={clearToast} />
    </div>
  );
}