/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#111111",
          soft: "#374151",
          muted: "#6b7280",
          line: "#e5e7eb",
        },
      },
    },
  },
  plugins: [],
};
