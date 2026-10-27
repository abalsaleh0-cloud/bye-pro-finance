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

          // OCR is intentionally isolated so the main application bundle does not
          // ship the multi-megabyte Tesseract runtime on every initial load.
          if (id.includes("/node_modules/tesseract.js/")) return "ocr";
          if (id.includes("/node_modules/@tesseract.js/")) return "ocr";
        },
      },
    },
  },
});
