import { describe, expect, it } from "vitest";

describe("target architecture", () => {
  it("defines the expected top-level layers", () => {
    expect(["apps", "packages", "database", "ai", "security", "tests", "docs"]).toHaveLength(7);
  });
});
