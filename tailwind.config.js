/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16140f",
        paper: "#f6f3ea",
        card: "#ffffff",
        amber: { DEFAULT: "#ffc933", deep: "#f5a623" },
        run: { DEFAULT: "#1f9d55", soft: "#e3f5e8" },
        line: "#e7e2d4",
        muted: "#8a8475",
      },
      fontFamily: {
        sans: ["Archivo", "system-ui", "sans-serif"],
        black: ["'Archivo Black'", "sans-serif"],
        mono: ["'Spline Sans Mono'", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(22,20,15,.05),0 8px 22px rgba(22,20,15,.07)",
      },
    },
  },
  plugins: [],
};
