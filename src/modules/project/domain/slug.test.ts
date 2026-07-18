import { describe, expect, it } from "vitest";

import { generateSlugFromName, isValidSlug, RESERVED_SLUGS } from "./slug";

describe("generateSlugFromName", () => {
  it("slugifies simple names", () => {
    expect(generateSlugFromName("Brand Identity")).toBe("brand-identity");
  });

  it("strips Vietnamese diacritics including đ", () => {
    expect(generateSlugFromName("Dự án Đặc biệt")).toBe("du-an-dac-biet");
  });

  it("collapses punctuation and trims hyphens", () => {
    expect(generateSlugFromName("  Hello --- World!! ")).toBe("hello-world");
  });

  it("avoids reserved slugs", () => {
    const slug = generateSlugFromName("Admin");
    expect(RESERVED_SLUGS.has(slug)).toBe(false);
    expect(isValidSlug(slug)).toBe(true);
  });

  it("handles names with no latin characters", () => {
    const slug = generateSlugFromName("日本語");
    expect(isValidSlug(slug)).toBe(true);
  });
});

describe("isValidSlug", () => {
  it("accepts well-formed slugs", () => {
    expect(isValidSlug("my-project-01")).toBe(true);
  });

  it("rejects reserved, malformed, and out-of-range slugs", () => {
    expect(isValidSlug("admin")).toBe(false);
    expect(isValidSlug("api")).toBe(false);
    expect(isValidSlug("-leading")).toBe(false);
    expect(isValidSlug("trailing-")).toBe(false);
    expect(isValidSlug("UPPER")).toBe(false);
    expect(isValidSlug("a")).toBe(false);
    expect(isValidSlug("a".repeat(81))).toBe(false);
    expect(isValidSlug("with space")).toBe(false);
    expect(isValidSlug("dots.are.not.allowed")).toBe(false);
  });
});
