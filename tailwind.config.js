/** @type {import('tailwindcss').Config} */
export default {
  // ✅ CRITICAL: dark mode uses the .dark class on <html>
  // Navbar.jsx toggles this via document.documentElement.classList
  darkMode: "class",

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {},
  },

  plugins: [],
};
