import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./theme.css";
import { applyLocale, applyTheme, getStoredLocale, getStoredTheme } from "./i18n";

applyLocale(getStoredLocale());
applyTheme(getStoredTheme());

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
