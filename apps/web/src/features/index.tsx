import { lazy, Suspense, type ComponentType, type ComponentProps } from "react";

type FeatureComponent = ComponentType<{ module: string }>;

/**
 * Feature views are loaded on demand so the authenticated shell does not
 * download every financial module before the user opens it.
 */
function lazyFeature(loader: () => Promise<{ default: FeatureComponent }>) {
  const Component = lazy(loader);
  return function LazyFeature(props: ComponentProps<FeatureComponent>) {
    return (
      <Suspense fallback={<div className="feature-loading" role="status" aria-live="polite">Loading…</div>}>
        <Component {...props} />
      </Suspense>
    );
  };
}

export const AccountsView = lazyFeature(() => import("./accounts").then((m) => ({ default: m.AccountsView })));
export const TransactionsView = lazyFeature(() => import("./transactions").then((m) => ({ default: m.TransactionsView })));
export const DashboardView = lazyFeature(() => import("./dashboard").then((m) => ({ default: m.DashboardView })));
export const ReportsView = lazyFeature(() => import("./reports").then((m) => ({ default: m.ReportsView })));
export const AssetsView = lazyFeature(() => import("./assets").then((m) => ({ default: m.AssetsView })));
export const BillsView = lazyFeature(() => import("./bills").then((m) => ({ default: m.BillsView })));
export const BudgetsView = lazyFeature(() => import("./budgets").then((m) => ({ default: m.BudgetsView })));
export const DebtsView = lazyFeature(() => import("./debts").then((m) => ({ default: m.DebtsView })));
export const SavingsView = lazyFeature(() => import("./savings").then((m) => ({ default: m.SavingsView })));
export const DocumentsView = lazyFeature(() => import("./documents").then((m) => ({ default: m.DocumentsView })));
export const NotificationsView = lazyFeature(() => import("./notifications").then((m) => ({ default: m.NotificationsView })));
export const AssistantView = lazyFeature(() => import("./assistant").then((m) => ({ default: m.AssistantView })));
export const HouseholdView = lazyFeature(() => import("./household").then((m) => ({ default: m.HouseholdView })));
export const ImportExportView = lazyFeature(() => import("./import-export").then((m) => ({ default: m.ImportExportView })));
export const ProfileSettingsView = lazyFeature(() => import("./settings").then((m) => ({ default: m.ProfileSettingsView })));
export const SmartScanView = lazyFeature(() => import("./smart-scan").then((m) => ({ default: m.SmartScanView })));
export const TransfersView = lazyFeature(() => import("./transfers").then((m) => ({ default: m.TransfersView })));
export const AdminView = lazyFeature(() => import("./admin").then((m) => ({ default: m.AdminView })));
