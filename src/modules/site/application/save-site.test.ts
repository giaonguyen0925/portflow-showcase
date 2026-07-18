import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/api/app-error";
import { FakeObjectStore } from "@/test/fakes/fake-object-store";
import { createR2SiteRepository } from "@/modules/site/infrastructure/r2-site-repository";

import { saveSite } from "./save-site";

function setup() {
  const store = new FakeObjectStore();
  const sites = createR2SiteRepository(store);
  return { store, sites };
}

const VALID_INPUT = {
  title: "Studio Mai",
  bio: "A small design studio.",
  font: "manrope",
  socialLinks: [{ label: "Instagram", url: "https://instagram.com/studio" }],
  expectedRevision: 0,
};

describe("saveSite", () => {
  it("creates the first revision from the initial document", async () => {
    const { sites } = setup();

    const saved = await saveSite({ sites }, VALID_INPUT);

    expect(saved.revision).toBe(1);
    expect(saved.title).toBe("Studio Mai");
    expect(await sites.readDraft()).toEqual(saved);
  });

  it("rejects a stale revision with REVISION_CONFLICT", async () => {
    const { sites } = setup();
    await saveSite({ sites }, VALID_INPUT);

    try {
      await saveSite({ sites }, { ...VALID_INPUT, expectedRevision: 0 });
      expect.unreachable();
    } catch (error) {
      expect((error as AppError).code).toBe("REVISION_CONFLICT");
    }
  });

  it("writes a history snapshot before overwriting", async () => {
    const { store, sites } = setup();
    await saveSite({ sites }, VALID_INPUT);
    await saveSite(
      { sites },
      { ...VALID_INPUT, title: "Studio Mai v2", expectedRevision: 1 },
    );

    expect(store.has("private", "content/history/site/1.json")).toBe(true);
    expect((await sites.readDraft())?.revision).toBe(2);
  });

  it("rejects invalid payloads", async () => {
    const { sites } = setup();

    await expect(
      saveSite({ sites }, { ...VALID_INPUT, title: "" }),
    ).rejects.toThrow();
    await expect(
      saveSite({ sites }, { ...VALID_INPUT, font: "comic-sans" }),
    ).rejects.toThrow();
  });
});
