import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("apps/web/src/App.tsx", "utf8");
const styles = readFileSync("apps/web/src/styles.css", "utf8");
const api = readFileSync("apps/api/src/server.ts", "utf8");
const platformViews = readFileSync("apps/web/src/components/PlatformViews.tsx", "utf8");
const localModel = readFileSync("apps/web/src/ai/localModel.ts", "utf8");
const auth = readFileSync("apps/api/src/security/auth.ts", "utf8");
const response = readFileSync("apps/api/src/security/response.ts", "utf8");

describe("phase 6 quality and security contracts", () => {
  it("keeps authenticated API routes behind bearer authentication", () => {
    for (const route of ["/api/v1/accounts", "/api/v1/budgets", "/api/v1/transfers", "/api/v1/transactions"]) {
      expect(api).toContain(`url.pathname === "${route}"`);
    }
    expect(api.match(/authenticate\(request, response\)/g)?.length ?? 0).toBeGreaterThanOrEqual(7);
    expect(api).toContain("AUTH_REQUIRED");
    expect(api).toContain("INVALID_SESSION");
  });

  it("limits API list queries and rejects invalid transaction filters", () => {
    expect(api).toContain("Math.min(parsedLimit, 100)");
    expect(api).toContain("INVALID_TRANSACTION_TYPE");
    expect(api).toContain("Math.max(1, Math.min(parsedLimit, 100))");
  });

  it("prevents trusting client-supplied user ownership", () => {
    expect(api).toContain("user_id: auth.identity.id");
    expect(api).toContain("verifyAccessToken");
    expect(auth).toContain("readBearerToken");
  });

  it("uses secure response headers for API output", () => {
    expect(response).toContain('Cache-Control", "no-store"');
    expect(response).toContain('X-Content-Type-Options", "nosniff"');
    expect(response).toContain('X-Frame-Options", "DENY"');
    expect(response).toContain('Referrer-Policy", "no-referrer"');
  });

  it("keeps keyboard focus, reduced motion, and mobile touch protections", () => {
    expect(styles).toContain(":focus-visible");
    expect(styles).toContain("prefers-reduced-motion: reduce");
    expect(styles).toContain("min-height: 44px");
    expect(styles).toContain("overflow-wrap: anywhere");
  });

  it("routes transfers through the authenticated validation API instead of direct table inserts", () => {
    expect(platformViews).toContain('fetch("/api/v1/transfers"');
    expect(platformViews).not.toContain('supabase.from("transfers").insert');
    expect(platformViews).toContain('"idempotency-key":crypto.randomUUID()');
  });

  it("keeps the generative model on-device and checks WebGPU support", () => {
    expect(localModel).toContain("Qwen3-1.7B-q4f16_1-MLC");
    expect(localModel).toContain("if (!browser.gpu)");
    expect(localModel).toContain("engine.chat.completions.create");
    expect(localModel).not.toContain("openai.com");
  });

  it("keeps both application shells accessible to language and theme controls", () => {
    expect(app).toContain('aria-label={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}');
    expect(app).toContain("className=\"appearance-button\"");
    expect(app).toContain("moduleTitles[locale][item.title]");
  });
});
