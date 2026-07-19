import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        hebrew: ["Noto Serif Hebrew", "serif"],
      },
      colors: {
        leket: {
          navy:      "#1b3358",
          navyDark:  "#122540",
          gold:      "#c9962a",
          goldLight: "#e8b84b",
          cream:     "#faf8f3",
          parchment: "#f0e8d4",
          border:    "#ddd0b0",
          text:      "#2c2416",
          muted:     "#8a7f6e",
          card:      "#ffffff",
        },
      },
    },
  },
  plugins: [],
};
export default config;
