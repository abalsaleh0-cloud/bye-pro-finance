import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "apps/web",
  plugins: [react()],
  server: { host: "0.0.0.0" },
  preview: { host: "0.0.0.0" },
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // The optional WebGPU/on-device inference engine is several megabytes.
          // Keep it in a named async chunk so the normal finance app never loads it
          // unless the user explicitly invokes local AI from the assistant.
          if (id.includes("/node_modules/@mlc-ai/web-llm/")) return "local-ai-engine";

          // Leave Tesseract's async import to Rollup's native chunking. Forcing
          // the package into a manual chunk can move shared preload helpers into
          // that chunk and make the generated HTML preload OCR on initial load.
        },
      },
    },
  },
});
