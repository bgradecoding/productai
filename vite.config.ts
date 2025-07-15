import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({
    babel: {
      plugins: [["@babel/plugin-proposal-optional-chaining-assign", { version: "2023-07" }]],
    },
  }), tailwindcss()],
});
