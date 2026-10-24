import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("apps/web/src/styles.css", "utf8");
const advanced = readFileSync("apps/web/src/advanced-finance.css", "utf8");
const app = readFileSync("apps/web/src/App.tsx", "utf8");
const main = readFileSync("apps/web/src/main.tsx", "utf8");

describe("responsive layout regression checks", () => {
  it("loads both the application and finance-module stylesheets", () => {
    expect(main).toContain('import "./styles.css"');
    expect(app).toContain('import "./advanced-finance.css"');
  });

  it("defines phone, tablet, and desktop breakpoints", () => {
    for (const breakpoint of [360, 480, 640, 768, 1024, 1281]) {
      expect(styles).toMatch(new RegExp(`max-width:\\s*${breakpoint}px|min-width:\\s*${breakpoint}px`));
    }
    expect(advanced).toContain("@media(max-width:900px)");
    expect(advanced).toContain("@media(max-width:560px)");
  });

  it("protects layouts from common horizontal overflow sources", () => {
    expect(styles).toContain("overflow-x: clip");
    expect(styles).toContain("min-width: 0");
    expect(styles).toContain(".table-card, .ui-scroll-x");
    expect(styles).toContain("-webkit-overflow-scrolling: touch");
    expect(styles).toContain("overflow-wrap: anywhere");
  });

  it("keeps mobile navigation horizontally scrollable without a fixed two-column grid", () => {
    const mobileNavigation = styles.match(/@media \(max-width: 768px\) \{([\\s\\S]*?)\n\}/)?.[1] ?? "";
    expect(mobileNavigation).toContain(".main-nav");
    expect(mobileNavigation).toContain("grid-template-columns: none");
    expect(mobileNavigation).toContain("grid-auto-flow: column");
    expect(mobileNavigation).toContain("overflow-x: auto");
  });

  it("provides reduced-motion support and touch-friendly controls", () => {
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain("min-height: 44px");
  });

  it("uses minmax(0, 1fr) in primary responsive grids", () => {
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(advanced).toContain("grid-template-columns:repeat(4,minmax(0,1fr))");
  });
});
