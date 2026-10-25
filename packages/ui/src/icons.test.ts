import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const registry = readFileSync("packages/ui/src/icons.tsx", "utf8");
const exports = readFileSync("packages/ui/src/index.tsx", "utf8");
const app = readFileSync("apps/web/src/App.tsx", "utf8");
const accountView = readFileSync("apps/web/src/components/AccountsView.tsx", "utf8");
const transactionsView = readFileSync("apps/web/src/components/TransactionsView.tsx", "utf8");
const financeViews = readFileSync("apps/web/src/components/FinanceViews.tsx", "utf8");
const advancedFinanceViews = readFileSync("apps/web/src/components/AdvancedFinanceViews.tsx", "utf8");
const normalizeJsx = (source: string) => source.replace(/\s+/g, " ").replace(/\s*\/>/g, "/>");

describe("shared icon library contract", () => {
  it("exports the shared icon component and registry from the UI package", () => {
    expect(exports).toContain('export * from "./icons"');
    expect(registry).toContain("export const iconRegistry");
    expect(registry).toContain("export type IconName = keyof typeof iconRegistry");
  });

  it("uses Lucide React as the single icon implementation", () => {
    expect(registry).toContain('from "lucide-react"');
    expect(registry).not.toMatch(/from\s+["']react-icons/);
    expect(registry).not.toMatch(/from\s+["']@fortawesome/);
  });

  it("has stable semantic names for core finance and navigation actions", () => {
    for (const name of [
      '"layout-dashboard"', '"credit-card"', '"hand-coins"', '"trending-up"',
      '"trending-down"', '"arrow-left-right"', '"calendar-days"', '"file-text"',
      '"shield-check"', '"log-in"', '"log-out"', '"chevron-left"', '"chevron-right"',
      '"circle-help"', '"alert-triangle"', '"check-circle"'
    ]) {
      expect(registry).toContain(name);
    }
  });

  it("uses a consistent 20px default and hides decorative icons from assistive technology", () => {
    expect(registry).toContain("size = 20");
    expect(registry).toContain("aria-hidden={label ? undefined : true}");
    expect(registry).toContain('role={label ? "img" : undefined}');
    expect(registry).toContain("aria-label={label}");
  });

  it("registers every semantic icon used by the primary navigation", () => {
    const names = [...app.matchAll(/icon: "([^"]+)"/g)].map((match) => match[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(registry).toMatch(new RegExp(`(?:^|\\\\s)(?:"${name}"|${name}):`, "m"));
    }
  });

  it("uses the shared icon component for every primary navigation item", () => {
    expect(app).toContain('import { Icon, type IconName } from "../../../packages/ui/src"');
    expect(app).toContain("icon: IconName");
    expect(app).toContain('<Icon name={item.icon} size={18} />');
    expect(app).not.toMatch(/icon: "[◈▤⇄↔▥↗□◇◆⌂▧⌕✦◉⇵⚙▣]"/u);
  });

  it("uses shared semantic icons in core empty states rather than text glyphs", () => {
    expect(normalizeJsx(accountView)).toContain('<Icon name="wallet" size={28}/>');
    expect(normalizeJsx(transactionsView)).toContain('<Icon name="arrow-left-right" size={28}/>');
    expect(normalizeJsx(financeViews)).toContain('<Icon name="folder" size={28}/>');
    expect(normalizeJsx(advancedFinanceViews)).toContain('<Icon name="folder" size={28}/>');
    expect(normalizeJsx(advancedFinanceViews)).toContain('<Icon name="bell" size={28}/>');
  });

  it("derives valid icon names from the registry instead of accepting arbitrary strings", () => {
    expect(registry).toContain("name: IconName");
    expect(registry).toContain("satisfies Record<string, ComponentType<LucideProps>>");
  });
});
