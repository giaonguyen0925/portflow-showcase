import { describe, expect, it } from "vitest";

import { normalizeProjectName } from "./project-name";

describe("normalizeProjectName", () => {
  it("treats case, extra whitespace, and padding as the same name", () => {
    expect(normalizeProjectName("Brand Identity")).toBe("brand identity");
    expect(normalizeProjectName(" brand   identity ")).toBe("brand identity");
    expect(normalizeProjectName("BRAND IDENTITY")).toBe("brand identity");
  });

  it("normalizes Unicode representations (NFKC)", () => {
    // "e" + combining acute vs precomposed "é"
    expect(normalizeProjectName("Café")).toBe(
      normalizeProjectName("Café"),
    );
  });

  it("lowercases Vietnamese characters", () => {
    expect(normalizeProjectName("DỰ ÁN MỚI")).toBe("dự án mới");
  });
});
