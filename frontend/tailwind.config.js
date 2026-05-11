/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sce: {
          dark: "#1a1f2e",
          darker: "#0f1219",
          blue: "#4a90a4",
          accent: "#2dd4bf",
          card: "#242937",
        },
      },
    },
  },
  plugins: [],
};
