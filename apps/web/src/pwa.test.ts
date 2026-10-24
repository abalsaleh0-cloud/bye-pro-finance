import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("PWA contract", () => {
  it("ships a valid install manifest", () => {
    const manifest = JSON.parse(read("apps/web/public/manifest.webmanifest"));

    expect(manifest.name).toBe("BYE PRO FINANCE");
    expect(manifest.short_name).toBe("BYE FINANCE");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThan(0);
    expect(manifest.icons.some((icon: { src: string; type: string }) =>
      icon.src === "/icons/icon.svg" && icon.type === "image/svg+xml",
    )).toBe(true);
  });

  it("ships the service worker and offline fallback", () => {
    const worker = read("apps/web/public/sw.js");

    expect(existsSync(resolve(root, "apps/web/public/offline.html"))).toBe(true);
    expect(existsSync(resolve(root, "apps/web/public/icons/icon.svg"))).toBe(true);
    expect(worker).toContain("self.addEventListener(\"install\"");
    expect(worker).toContain("self.addEventListener(\"activate\"");
    expect(worker).toContain("self.addEventListener(\"fetch\"");
    expect(worker).toContain("/offline.html");
    expect(worker).toContain("self.skipWaiting()");
    expect(worker).toContain("self.clients.claim()");
  });

  it("registers the worker only for production builds", () => {
    const main = read("apps/web/src/main.tsx");

    expect(main).toContain('"serviceWorker" in navigator');
    expect(main).toContain("import.meta.env.PROD");
    expect(main).toContain('navigator.serviceWorker.register("/sw.js", { scope: "/" })');
  });

  it("exposes manifest and mobile metadata from the HTML shell", () => {
    const html = read("apps/web/index.html");

    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('name="mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('rel="apple-touch-icon" href="/icons/icon.svg"');
  });
});
