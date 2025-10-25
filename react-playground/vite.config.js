// react-playground/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ensuro/ethereum-store": path.resolve(__dirname, "../src/package-index.js"),
      "@ensuro/ethereum-store/src": path.resolve(__dirname, "../src"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "node_modules/react/jsx-runtime"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    fs: { allow: [path.resolve(__dirname, "..")] },
  },
});
