/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/package-index.js",
      formats: ["es"],
      fileName: () => "index.js",
    },
    outDir: "dist",
    sourcemap: true,
    target: "es2020",
    rollupOptions: {
      external: ["redux", "redux-saga", "reselect"],
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.js"],
    exclude: ["react-playground/**", "lib/**", "dist/**", "node_modules/**"],
    coverage: { provider: "v8", reporter: ["text", "lcov"] },
    globals: true,
    setupFiles: ["src/setupTests.js"],
  },
});
