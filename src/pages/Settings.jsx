import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

import ConfirmModal from "../components/ConfirmModal";
import Toast from "../components/Toast";
import { useToast } from "../utils/useToast";

export default function Settings({ username }) {
  const { toast, showToast, clearToast } = useToast();

  // Danger Zone delete all
  const [loadingDeleteAll, setLoadingDeleteAll] = useState(false);
  const [openDeleteAll, setOpenDeleteAll] = useState(false);

  // Categories
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categories, setCategories] = useState([]);

  const [newCategory, setNewCategory] = useState("");

  // Rename
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  // Delete category
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState(null);
  const [loadingDeleteCategory, setLoadingDeleteCategory] = useState(false);

  // Load Hari Categories
  const [loadingHariCategories, setLoadingHariCategories] = useState(false);

  const categoriesRef = useMemo(
    () => collection(db, "users", username, "categories"),
    [username]
  );

  const txnsRef = useMemo(
    () => collection(db, "users", username, "transactions"),
    [username]
  );

  const HARI_DEFAULT_CATEGORIES = useMemo(
    () => [
      "Income (Credited)",
      "Rental Home Expenses",
      "Family Home Expenses",
      "Subscriptions",
      "Breakfast",
      "Lunch",
      "Dinner",
      "Fruits",
      "Bike Service",
      "Petrol",
      "Laundry / Ironing",
      "Studies / Exam Prep",
      "Personal Care",
      "Other",
    ],
    []
  );

  async function loadCategories() {
    setLoadingCategories(true);
    try {
      const snap = await getDocs(categoriesRef);
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((x) => x?.name && x.name.trim())
        .sort((a, b) => (a.name > b.name ? 1 : -1));

      setCategories(data);
    } catch (err) {
      console.error(err);
      showToast("Failed to load categories", "error");
      setCategories([]);
    }
    setLoadingCategories(false);
  }

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line
  }, []);

  // ---------------------------
  // Delete ALL transactions
  // ---------------------------
  async function deleteAllTransactions() {
    setLoadingDeleteAll(true);
    try {
      const snap = await getDocs(txnsRef);

      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();

      showToast("All transactions deleted", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete transactions", "error");
    }
    setLoadingDeleteAll(false);
    setOpenDeleteAll(false);
  }

  // ---------------------------
  // Add Category
  // ---------------------------
  async function addCategory() {
    const name = newCategory.trim();
    if (!name) return showToast("Enter category name", "error");

    const exists = categories.some(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) return showToast("Category already exists", "error");

    try {
      await addDoc(categoriesRef, {
        name,
        createdAt: serverTimestamp(),
      });

      setNewCategory("");
      showToast("Category added", "success");
      loadCategories();
    } catch (err) {
      console.error(err);
      showToast("Failed to add category", "error");
    }
  }

  // ---------------------------
  // Load Hari Categories
  // ---------------------------
  async function loadHariCategories() {
    setLoadingHariCategories(true);

    try {
      const snap = await getDocs(categoriesRef);
      const existingNames = snap.docs
        .map((d) => (d.data()?.name || "").toLowerCase().trim())
        .filter(Boolean);

      const batch = writeBatch(db);
      let addedCount = 0;

      for (const cat of HARI_DEFAULT_CATEGORIES) {
        const lower = cat.toLowerCase().trim();
        if (existingNames.includes(lower)) continue;

        const newDocRef = doc(categoriesRef);
        batch.set(newDocRef, { name: cat, createdAt: serverTimestamp() });
        addedCount++;
      }

      if (addedCount === 0) {
        showToast("Hari categories already loaded", "success");
      } else {
        await batch.commit();
        showToast(`Loaded ${addedCount} categories`, "success");
      }

      await loadCategories();
    } catch (err) {
      console.error(err);
      showToast("Failed to load default categories", "error");
    }

    setLoadingHariCategories(false);
  }

  // ---------------------------
  // Rename Category
  // ---------------------------
  async function confirmRenameCategory() {
    if (!renameTarget) return;

    const newName = renameValue.trim();
    if (!newName) return showToast("Enter new name", "error");

    const exists = categories.some(
      (c) =>
        c.name.toLowerCase() === newName.toLowerCase() &&
        c.id !== renameTarget.id
    );
    if (exists) return showToast("Category name already exists", "error");

    try {
      await updateDoc(doc(categoriesRef, renameTarget.id), { name: newName });

      const qTxn = query(txnsRef, where("category", "==", renameTarget.name));
      const snap = await getDocs(qTxn);

      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, { category: newName }));
      await batch.commit();

      showToast("Category renamed", "success");
      setRenameTarget(null);
      setRenameValue("");
      loadCategories();
    } catch (err) {
      console.error(err);
      showToast("Failed to rename category", "error");
    }
  }

  // ---------------------------
  // Delete Category
  // ---------------------------
  async function confirmDeleteCategory() {
    if (!deleteCategoryTarget) return;

    setLoadingDeleteCategory(true);

    try {
      const qTxn = query(
        txnsRef,
        where("category", "==", deleteCategoryTarget.name)
      );
      const snap = await getDocs(qTxn);

      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, { category: "Other" }));

      batch.delete(doc(categoriesRef, deleteCategoryTarget.id));
      await batch.commit();

      showToast("Category deleted (txns moved to Other)", "success");
      setDeleteCategoryTarget(null);
      loadCategories();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete category", "error");
    }

    setLoadingDeleteCategory(false);
  }

  const inputClass =
    "w-full p-3 rounded-xl outline-none border " +
    "bg-white border-slate-200 text-slate-900 " +
    "dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100";

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
        Settings
      </h1>

      {/* ✅ COLLAPSIBLE MANAGE CATEGORIES */}
      <details className="mt-4 bg-white dark:bg-slate-900 rounded-2xl shadow border border-slate-200 dark:border-slate-800 p-5">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              Manage Categories
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Click to open / close category settings
            </p>
          </div>

          <span className="text-slate-500 dark:text-slate-400 font-bold">
            ({categories.length})
          </span>
        </summary>

        {/* content */}
        <div className="mt-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <button
              type="button"
              disabled={loadingHariCategories}
              onClick={loadHariCategories}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold disabled:opacity-50 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
            >
              {loadingHariCategories ? "Loading..." : "Load Hari Categories"}
            </button>

            <button
              type="button"
              onClick={loadCategories}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold hover:opacity-90"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="New category name"
              className={inputClass}
            />
            <button
              type="button"
              onClick={addCategory}
              className="px-4 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-black font-extrabold hover:opacity-90"
            >
              Add
            </button>
          </div>

          <div className="mt-4">
            {loadingCategories ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Loading categories...
              </p>
            ) : categories.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                No categories found.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[260px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 flex items-center justify-between gap-3"
                  >
                    <p className="font-bold text-slate-900 dark:text-slate-100">
                      {c.name}
                    </p>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setRenameTarget(c);
                          setRenameValue(c.name);
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-sm"
                      >
                        Rename
                      </button>

                      <button
                        onClick={() => setDeleteCategoryTarget(c)}
                        className="px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-black font-extrabold text-sm shadow-[0_0_18px_rgba(244,63,94,0.35)]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </details>

      {/* ------------------------ */}
      {/* DANGER ZONE */}
      {/* ------------------------ */}
      <div className="mt-4 bg-white dark:bg-slate-900 rounded-2xl shadow border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="font-extrabold text-rose-500 text-lg">Danger Zone</h2>

        <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
          Clear all transactions after sending report.
        </p>

        <button
          onClick={() => setOpenDeleteAll(true)}
          disabled={loadingDeleteAll}
          className="mt-4 px-4 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-black font-extrabold disabled:opacity-50 shadow-[0_0_25px_rgba(244,63,94,0.35)]"
        >
          Delete ALL Transactions
        </button>
      </div>

      {/* ✅ Rename Modal */}
      <ConfirmModal
        open={!!renameTarget}
        title="Rename Category"
        message={
          renameTarget
            ? `Rename "${renameTarget.name}" to "${renameValue}" ? This updates all linked transactions.`
            : ""
        }
        confirmText="Rename"
        cancelText="Cancel"
        danger={false}
        onCancel={() => {
          setRenameTarget(null);
          setRenameValue("");
        }}
        onConfirm={confirmRenameCategory}
      />

      {/* Rename input overlay */}
      {renameTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
          <div className="w-full max-w-md pointer-events-auto -mt-28">
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* ✅ Delete Category Modal */}
      <ConfirmModal
        open={!!deleteCategoryTarget}
        title="Delete Category"
        message={
          deleteCategoryTarget
            ? `Delete "${deleteCategoryTarget.name}" ? All linked transactions will move to "Other".`
            : ""
        }
        confirmText={loadingDeleteCategory ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        danger={true}
        onCancel={() => setDeleteCategoryTarget(null)}
        onConfirm={confirmDeleteCategory}
      />

      {/* ✅ Delete All Modal */}
      <ConfirmModal
        open={openDeleteAll}
        title="Delete ALL Transactions"
        message="This will permanently delete all transactions. This action cannot be undone."
        confirmText={loadingDeleteAll ? "Deleting..." : "Delete All"}
        cancelText="Cancel"
        danger={true}
        onCancel={() => setOpenDeleteAll(false)}
        onConfirm={deleteAllTransactions}
      />

      <Toast message={toast.message} type={toast.type} onClose={clearToast} />
    </div>
  );
}
