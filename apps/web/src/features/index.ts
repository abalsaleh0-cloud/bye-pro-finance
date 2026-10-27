import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

/**
 * Stable application-facing exports composed from individual feature modules.
 *
 * Feature screens are intentionally loaded on demand. The shell/navigation/auth
 * remain in the initial bundle while each finance screen becomes its own async
 * chunk. This keeps OCR and less frequently used finance modules out of the
 * first paint without changing the App.tsx public component API.
 */
function lazyFeature<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  fallback: ReactNode = null,
) {
  const Loaded = lazy(loader);
  return function LazyFeature(props: any) {
    return <Suspense fallback={fallback}><Loaded {...props} /></Suspense>;
  };
}

const screenFallback = <div className="screen-loading" role="status" aria-live="polite">جاري تحميل القسم…</div>;

export const AccountsView = lazyFeature(() => import("./accounts").then((m) => ({ default: m.AccountsView })), screenFallback);
export const TransactionsView = lazyFeature(() => import("./transactions").then((m) => ({ default: m.TransactionsView })), screenFallback);
export const DashboardView = lazyFeature(() => import("./dashboard").then((m) => ({ default: m.DashboardView })), screenFallback);
export const ReportsView = lazyFeature(() => import("./reports").then((m) => ({ default: m.ReportsView })), screenFallback);
export const AssetsView = lazyFeature(() => import("./assets").then((m) => ({ default: m.AssetsView })), screenFallback);
export const BillsView = lazyFeature(() => import("./bills").then((m) => ({ default: m.BillsView })), screenFallback);
export const BudgetsView = lazyFeature(() => import("./budgets").then((m) => ({ default: m.BudgetsView })), screenFallback);
export const DebtsView = lazyFeature(() => import("./debts").then((m) => ({ default: m.DebtsView })), screenFallback);
export const SavingsView = lazyFeature(() => import("./savings").then((m) => ({ default: m.SavingsView })), screenFallback);
export const DocumentsView = lazyFeature(() => import("./documents").then((m) => ({ default: m.DocumentsView })), screenFallback);
export const NotificationsView = lazyFeature(() => import("./notifications").then((m) => ({ default: m.NotificationsView })), screenFallback);
export const AssistantView = lazyFeature(() => import("./assistant").then((m) => ({ default: m.AssistantView })), screenFallback);
export const HouseholdView = lazyFeature(() => import("./household").then((m) => ({ default: m.HouseholdView })), screenFallback);
export const ImportExportView = lazyFeature(() => import("./import-export").then((m) => ({ default: m.ImportExportView })), screenFallback);
export const ProfileSettingsView = lazyFeature(() => import("./settings").then((m) => ({ default: m.ProfileSettingsView })), screenFallback);
export const SmartScanView = lazyFeature(() => import("./smart-scan").then((m) => ({ default: m.SmartScanView })), screenFallback);
export const TransfersView = lazyFeature(() => import("./transfers").then((m) => ({ default: m.TransfersView })), screenFallback);
export const AdminView = lazyFeature(() => import("./admin").then((m) => ({ default: m.AdminView })), screenFallback);
