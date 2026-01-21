const KEY = "spendwise_categories";

export function getCategories() {
  const saved = localStorage.getItem(KEY);
  if (saved) return JSON.parse(saved);

  // default categories
  return [
    "Food",
    "Breakfast",
    "Lunch",
    "Dinner",
    "Snacks",
    "Petrol",
    "Shopping",
    "College",
    "Other",
  ];
}

export function saveCategory(newCategory) {
  const cat = newCategory.trim();
  if (!cat) return;

  const current = getCategories();
  const exists = current.some((x) => x.toLowerCase() === cat.toLowerCase());
  if (exists) return;

  const updated = [...current, cat];
  localStorage.setItem(KEY, JSON.stringify(updated));
}
