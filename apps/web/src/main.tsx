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

document.body.dataset.byeSettingsView = "settings";
document.addEventListener("click", event => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  if (target.closest(".profile-chip")) {
    document.body.dataset.byeSettingsView = "profile";
    window.dispatchEvent(new Event("bye-settings-view-changed"));
    return;
  }
  const nav = target.closest(".nav-item");
  if (nav && /الإعدادات|settings/i.test(nav.textContent ?? "")) {
    document.body.dataset.byeSettingsView = "settings";
    window.dispatchEvent(new Event("bye-settings-view-changed"));
  }
});

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
