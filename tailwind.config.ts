import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        frost: {
          50: "#f2f7fb",
          100: "#e3edf6",
          500: "#1f5c8b",
          600: "#184a70",
          900: "#0d2a40",
        },
        clay: {
          500: "#c76b3f",
        },
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        body: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
