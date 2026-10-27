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
          // Keep large optional runtimes away from the initial application chunk.
          if (id.includes("node_modules/tesseract.js") || id.includes("node_modules/@tesseract.js")) {
            return "ocr";
          }
          if (id.includes("node_modules/@mlc-ai/web-llm")) return "local-ai";
          if (id.includes("node_modules/@supabase")) return "supabase";
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) return "react";
        },
      },
    },
  },
});
