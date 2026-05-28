/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        serif: ["DM Serif Display", "serif"],
      },
      colors: {
        brand: { 50: "#f0f4ff", 500: "#3b5bdb", 600: "#2f4ac9", 700: "#2640b0" },
      },
    },
  },
  plugins: [],
}
