import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/api/app-error";
import type { ProjectRepository } from "@/modules/project/application/ports";
import { createR2ProjectRepository } from "@/modules/project/infrastructure/r2-project-repository";
import { FakeObjectStore } from "@/test/fakes/fake-object-store";
import { TEST_ASSET_BASE_URL } from "@/test/fixtures/assets";
import { makeImageRow } from "@/test/fixtures/rows";

import { archiveProject } from "./archive-project";
import { createProject } from "./create-project";
import { saveProject } from "./save-project";

function setup() {
  const store = new FakeObjectStore();
  const projects = createR2ProjectRepository(store);
  return { store, projects };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
  }
}

/** Creates an empty draft, then titles it in the same save that sets rows. */
async function createTitledProject(
  projects: ProjectRepository,
  title: string,
  overrides: { summary?: string; rows?: ReturnType<typeof makeImageRow>[] } = {},
) {
  const draft = await createProject({ projects });
  return saveProject({ projects, assetBaseUrl: TEST_ASSET_BASE_URL }, draft.id, {
    title,
    summary: overrides.summary ?? "",
    rows: overrides.rows ?? [],
    expectedRevision: draft.revision,
  });
}

describe("createProject", () => {
  it("creates an empty, untitled draft", async () => {
    const { projects } = setup();

    const project = await createProject({ projects });

    expect(project.title).toBeUndefined();
    expect(project.slug).toBeUndefined();
    expect(project.rows).toEqual([]);
    expect(project.revision).toBe(1);

    const index = await projects.readIndex();
    expect(index?.projects).toHaveLength(1);
    expect(index?.projects.at(0)?.status).toBe("draft");
    expect(index?.projects.at(0)?.isVisible).toBe(true);
  });

  it("allows several untitled drafts to coexist", async () => {
    const { projects } = setup();

    await createProject({ projects });
    await createProject({ projects });

    const index = await projects.readIndex();
    expect(index?.projects).toHaveLength(2);
  });

  it("assigns increasing portfolio order to new drafts", async () => {
    const { projects } = setup();

    const first = await createProject({ projects });
    const second = await createProject({ projects });

    const index = await projects.readIndex();
    const firstOrder = index?.projects.find((p) => p.id === first.id)?.order;
    const secondOrder = index?.projects.find((p) => p.id === second.id)?.order;
    expect(secondOrder).toBeGreaterThan(firstOrder ?? -1);
  });
});

describe("saveProject", () => {
  it("titles an untitled draft, generating a normalized title and stable slug", async () => {
    const { projects } = setup();

    const saved = await createTitledProject(projects, "Brand Identity");

    expect(saved.title).toBe("Brand Identity");
    expect(saved.normalizedTitle).toBe("brand identity");
    expect(saved.slug).toBe("brand-identity");
    expect(saved.revision).toBe(2);

    const index = await projects.readIndex();
    expect(index?.projects.at(0)?.slug).toBe("brand-identity");
  });

  it("keeps the slug stable when the title changes later", async () => {
    const { projects } = setup();
    const titled = await createTitledProject(projects, "Brand Identity");

    const renamed = await saveProject(
      { projects, assetBaseUrl: TEST_ASSET_BASE_URL },
      titled.id,
      {
        title: "Brand Identity 2024",
        summary: "Refreshed",
        rows: [],
        expectedRevision: titled.revision,
      },
    );

    expect(renamed.slug).toBe("brand-identity");
    expect(renamed.title).toBe("Brand Identity 2024");
  });

  it("rejects clearing the title once the project has a public URL", async () => {
    const { projects } = setup();
    const titled = await createTitledProject(projects, "Brand Identity");

    await expectCode(
      saveProject({ projects, assetBaseUrl: TEST_ASSET_BASE_URL }, titled.id, {
        title: "",
        summary: "",
        rows: [],
        expectedRevision: titled.revision,
      }),
      "VALIDATION_ERROR",
    );
  });

  it("leaves a draft untitled when saved with an empty title", async () => {
    const { projects } = setup();
    const draft = await createProject({ projects });

    const saved = await saveProject(
      { projects, assetBaseUrl: TEST_ASSET_BASE_URL },
      draft.id,
      { title: "", summary: "Still deciding", rows: [], expectedRevision: draft.revision },
    );

    expect(saved.title).toBeUndefined();
    expect(saved.slug).toBeUndefined();
    expect(saved.summary).toBe("Still deciding");
  });

  it("rejects duplicate titles regardless of case and whitespace", async () => {
    const { projects } = setup();
    await createTitledProject(projects, "Brand Identity");
    const other = await createProject({ projects });

    await expectCode(
      saveProject({ projects, assetBaseUrl: TEST_ASSET_BASE_URL }, other.id, {
        title: " BRAND   identity ",
        summary: "",
        rows: [],
        expectedRevision: other.revision,
      }),
      "PROJECT_NAME_CONFLICT",
    );
  });

  it("rejects duplicate slugs from different titles", async () => {
    const { projects } = setup();
    await createTitledProject(projects, "Cafe");
    const other = await createProject({ projects });

    // Different normalized title, same slug after diacritic stripping.
    await expectCode(
      saveProject({ projects, assetBaseUrl: TEST_ASSET_BASE_URL }, other.id, {
        title: "Café",
        summary: "",
        rows: [],
        expectedRevision: other.revision,
      }),
      "PROJECT_SLUG_CONFLICT",
    );
  });

  it("saves rows, bumps revision, and derives the cover from the first image", async () => {
    const { projects } = setup();
    const draft = await createProject({ projects });
    const firstRow = makeImageRow(0);
    const firstBlock = firstRow.columns[0]?.blocks[0];
    if (!firstBlock || firstBlock.type !== "image") {
      throw new Error("test fixture did not produce an image block");
    }
    const rows = [firstRow, makeImageRow(1)];

    const saved = await saveProject(
      { projects, assetBaseUrl: TEST_ASSET_BASE_URL },
      draft.id,
      { title: "Brand Identity", summary: "Logos", rows, expectedRevision: draft.revision },
    );

    expect(saved.rows).toHaveLength(2);

    const index = await projects.readIndex();
    const entry = index?.projects.at(0);
    expect(entry?.title).toBe("Brand Identity");
    expect(entry?.coverAssetId).toBe(firstBlock.asset.id);
  });

  it("rejects a stale revision", async () => {
    const { projects } = setup();
    const draft = await createProject({ projects });

    await expectCode(
      saveProject({ projects, assetBaseUrl: TEST_ASSET_BASE_URL }, draft.id, {
        title: "Brand",
        summary: "",
        rows: [],
        expectedRevision: 99,
      }),
      "REVISION_CONFLICT",
    );
  });

  it("rejects images outside the public asset domain", async () => {
    const { projects } = setup();
    const draft = await createProject({ projects });
    const evilRow = makeImageRow(0, {
      url: "https://evil.example.com/assets/asset_x/original.webp",
    });

    await expectCode(
      saveProject({ projects, assetBaseUrl: TEST_ASSET_BASE_URL }, draft.id, {
        title: "Brand",
        summary: "",
        rows: [evilRow],
        expectedRevision: draft.revision,
      }),
      "INVALID_ASSET",
    );
  });

  it("returns PROJECT_NOT_FOUND for unknown projects", async () => {
    const { projects } = setup();

    await expectCode(
      saveProject(
        { projects, assetBaseUrl: TEST_ASSET_BASE_URL },
        `project_${"0".repeat(32)}`,
        { title: "Ghost", summary: "", rows: [], expectedRevision: 1 },
      ),
      "PROJECT_NOT_FOUND",
    );
  });
});

describe("archiveProject", () => {
  it("moves the draft to the archive prefix and removes it from the index", async () => {
    const { store, projects } = setup();
    const project = await createTitledProject(projects, "Old Work");

    await archiveProject({ projects }, project.id);

    expect(await projects.readDraft(project.id)).toBeNull();
    expect((await projects.readIndex())?.projects).toHaveLength(0);

    const archived = [...store.objects.keys()].find((key) =>
      key.startsWith(`private:archive/projects/${project.id}/`),
    );
    expect(archived).toBeDefined();
  });

  it("frees the title and slug for new projects", async () => {
    const { projects } = setup();
    const project = await createTitledProject(projects, "Old Work");
    await archiveProject({ projects }, project.id);

    const recreated = await createTitledProject(projects, "Old Work");
    expect(recreated.slug).toBe("old-work");
  });
});
