import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./unified-ui.css";
import "./global-controls.css";
import "./responsive-stage.css";
import "./final-ui-contract.css";
import "./final-ui-overrides.css";
import { applyLocale, getStoredLocale } from "./i18n";

applyLocale(getStoredLocale());

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  });
}
