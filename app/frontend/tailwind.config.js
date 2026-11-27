/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#F5F7FA",
          100: "#EAEFF5",
          200: "#D0DBE5",
          300: "#A6B8CB",
          400: "#7A91AB",
          500: "#536B88",
          600: "#3A506B",
          700: "#263859",
          800: "#1C2541",
          900: "#0B132B",
          950: "#070C1B",
        },
        coral: {
          50: "#FFF5F2",
          100: "#FFEAE6",
          200: "#FFD3C9",
          300: "#FFAF9F",
          400: "#FF8A77",
          500: "#FF6F59", // Primary Accent Coral
          600: "#E8533C",
          700: "#BF3622",
          800: "#9C2817",
          900: "#781D10",
        },
        warm: {
          50: "#FAF9F6", // Primary Warm White Canvas
          100: "#F5F3EF",
          200: "#EAE6DF",
          300: "#DDD7CD",
          400: "#C6BEB1",
          500: "#9E9688",
          600: "#766E61",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        warm: "0 2px 15px -3px rgba(28, 37, 65, 0.05), 0 4px 6px -2px rgba(28, 37, 65, 0.02)",
        "warm-md": "0 4px 20px -2px rgba(28, 37, 65, 0.08), 0 2px 8px -2px rgba(255, 111, 89, 0.06)",
        "warm-lg": "0 10px 30px -4px rgba(28, 37, 65, 0.1), 0 4px 12px -2px rgba(255, 111, 89, 0.08)",
        coral: "0 4px 14px 0 rgba(255, 111, 89, 0.35)",
      },
    },
  },
  plugins: [],
};
