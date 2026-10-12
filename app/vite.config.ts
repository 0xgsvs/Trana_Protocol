import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Anchor / web3.js expect a Node-ish environment; provide the globals they need.
export default defineConfig({
  plugins: [react()],
  define: {
    "process.env": {},
    global: "globalThis",
  },
});
