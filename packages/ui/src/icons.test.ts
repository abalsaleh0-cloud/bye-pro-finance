import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const registry = readFileSync("packages/ui/src/icons.tsx", "utf8");
const exports = readFileSync("packages/ui/src/index.tsx", "utf8");
const app = readFileSync("apps/web/src/App.tsx", "utf8");

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

  it("uses the shared icon component for every primary navigation item", () => {
    expect(app).toContain('import { Icon, type IconName } from "../../../packages/ui/src"');
    expect(app).toContain("icon: IconName");
    expect(app).toContain('<Icon name={item.icon} size={18} />');
    expect(app).not.toMatch(/icon: "[◈▤⇄↔▥↗□◇◆⌂▧⌕✦◉⇵⚙▣]"/u);
  });

  it("derives valid icon names from the registry instead of accepting arbitrary strings", () => {
    expect(registry).toContain("name: IconName");
    expect(registry).toContain("satisfies Record<string, ComponentType<LucideProps>>");
  });
});
