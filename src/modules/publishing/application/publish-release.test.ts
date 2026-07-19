import { describe, expect, it } from "vitest";

import { DEFAULT_PAGE_THEME } from "@/modules/layout/domain/page-theme";
import { createProject } from "@/modules/project/application/create-project";
import { reorderProjects } from "@/modules/project/application/reorder-projects";
import { saveProject } from "@/modules/project/application/save-project";
import { createR2ProjectRepository } from "@/modules/project/infrastructure/r2-project-repository";
import { createR2ReleaseRepository } from "@/modules/publishing/infrastructure/r2-release-repository";
import { saveSite } from "@/modules/site/application/save-site";
import { createR2SiteRepository } from "@/modules/site/infrastructure/r2-site-repository";
import { FakeObjectStore } from "@/test/fakes/fake-object-store";
import { TEST_ASSET_BASE_URL } from "@/test/fixtures/assets";
import { makeImageRow } from "@/test/fixtures/rows";

import {
  getPublishedContent,
  getPublishedProject,
} from "./get-published-content";
import { publishRelease } from "./publish-release";

function setup() {
  const store = new FakeObjectStore();
  const deps = {
    sites: createR2SiteRepository(store),
    projects: createR2ProjectRepository(store),
    releases: createR2ReleaseRepository(store),
    assetBaseUrl: TEST_ASSET_BASE_URL,
  };
  return { store, deps };
}

async function seedContent(deps: ReturnType<typeof setup>["deps"]) {
  await saveSite(
    { sites: deps.sites },
    {
      title: "Studio Mai",
      bio: "Design studio",
      font: "inter",
      socialLinks: [],
      theme: DEFAULT_PAGE_THEME,
      expectedRevision: 0,
    },
  );

  const draft = await createProject({ projects: deps.projects });
  return saveProject(
    { projects: deps.projects, assetBaseUrl: TEST_ASSET_BASE_URL },
    draft.id,
    {
      title: "Brand Identity",
      summary: "Logos",
      rows: [makeImageRow(0), makeImageRow(1)],
      theme: DEFAULT_PAGE_THEME,
      expectedRevision: draft.revision,
    },
  );
}

describe("publishRelease", () => {
  it("publishes an immutable snapshot readable by the public getters", async () => {
    const { deps } = setup();
    const project = await seedContent(deps);

    const result = await publishRelease(deps);

    expect(result.projectCount).toBe(1);

    const published = await getPublishedContent({ releases: deps.releases });
    expect(published?.releaseId).toBe(result.releaseId);
    expect(published?.site.title).toBe("Studio Mai");
    expect(published?.manifest.projects.at(0)?.slug).toBe("brand-identity");
    expect(published?.manifest.projects.at(0)?.title).toBe("Brand Identity");
    expect(published?.manifest.projects.at(0)?.coverUrl).toContain(
      TEST_ASSET_BASE_URL,
    );

    const publicProject = await getPublishedProject(
      { releases: deps.releases },
      "brand-identity",
    );
    expect(publicProject?.id).toBe(project.id);
    expect(publicProject?.rows).toHaveLength(2);
    expect(publicProject).not.toHaveProperty("normalizedTitle");
  });

  it("writes current.json only after every snapshot object", async () => {
    const { store, deps } = setup();
    await seedContent(deps);

    await publishRelease(deps);

    const writes = store.writeLog.filter(
      (key) =>
        key.includes("content/releases/") || key.includes("content/current"),
    );
    expect(writes.at(-1)).toBe("private:content/current.json");
  });

  it("leaves the previous release active when a snapshot write fails", async () => {
    const { store, deps } = setup();
    await seedContent(deps);
    const first = await publishRelease(deps);

    store.failOnKey = (_bucket, key) => key.includes("/manifest.json");

    await expect(publishRelease(deps)).rejects.toThrow();

    store.failOnKey = undefined;
    const published = await getPublishedContent({ releases: deps.releases });
    expect(published?.releaseId).toBe(first.releaseId);
  });

  it("marks published projects in the index", async () => {
    const { deps } = setup();
    await seedContent(deps);

    await publishRelease(deps);

    const index = await deps.projects.readIndex();
    expect(index?.projects.at(0)?.status).toBe("published");
  });

  it("publishes an empty site when nothing exists yet", async () => {
    const { deps } = setup();

    const result = await publishRelease(deps);

    expect(result.projectCount).toBe(0);
    const published = await getPublishedContent({ releases: deps.releases });
    expect(published?.manifest.projects).toEqual([]);
  });

  it("skips untitled drafts without failing the release", async () => {
    const { deps } = setup();
    await seedContent(deps);
    await createProject({ projects: deps.projects }); // untitled, no slug

    const result = await publishRelease(deps);

    expect(result.projectCount).toBe(1);
    const index = await deps.projects.readIndex();
    expect(index?.projects.find((p) => p.slug === undefined)?.status).toBe(
      "draft",
    );
  });

  it("publishes titled drafts even when the index entry is missing a slug", async () => {
    const { deps } = setup();
    const project = await seedContent(deps);

    const index = await deps.projects.readIndex();
    if (!index) throw new Error("expected index");
    // Simulate a lost index slug update (concurrent autosave race).
    await deps.projects.writeIndex({
      ...index,
      revision: index.revision + 1,
      projects: index.projects.map((p) => {
        if (p.id !== project.id) return p;
        const { slug: _slug, title: _title, normalizedTitle: _n, ...rest } = p;
        return rest;
      }),
    });

    const result = await publishRelease(deps);

    expect(result.projectCount).toBe(1);
    const repaired = await deps.projects.readIndex();
    expect(repaired?.projects.at(0)?.slug).toBe("brand-identity");
    expect(repaired?.projects.at(0)?.status).toBe("published");
  });

  it("orders manifest cards by portfolio order", async () => {
    const { deps } = setup();
    await seedContent(deps); // "Brand Identity"

    const secondDraft = await createProject({ projects: deps.projects });
    await saveProject(
      { projects: deps.projects, assetBaseUrl: TEST_ASSET_BASE_URL },
      secondDraft.id,
      {
        title: "Second Project",
        summary: "",
        rows: [],
        theme: DEFAULT_PAGE_THEME,
        expectedRevision: secondDraft.revision,
      },
    );

    const index = await deps.projects.readIndex();
    if (!index) throw new Error("expected index");
    await reorderProjects(
      { projects: deps.projects },
      {
        expectedIndexRevision: index.revision,
        projects: index.projects.map((p) => ({
          id: p.id,
          isVisible: true,
          order: p.slug === "second-project" ? 0 : 1,
        })),
      },
    );

    const result = await publishRelease(deps);
    const published = await getPublishedContent({ releases: deps.releases });

    expect(result.projectCount).toBe(2);
    expect(published?.manifest.projects.map((p) => p.slug)).toEqual([
      "second-project",
      "brand-identity",
    ]);
  });

  it("hides isVisible:false projects from the manifest but still publishes their page", async () => {
    const { deps } = setup();
    const project = await seedContent(deps);

    const index = await deps.projects.readIndex();
    if (!index) throw new Error("expected index");
    await reorderProjects(
      { projects: deps.projects },
      {
        expectedIndexRevision: index.revision,
        projects: index.projects.map((p) => ({
          id: p.id,
          order: p.order,
          isVisible: false,
        })),
      },
    );

    await publishRelease(deps);
    const published = await getPublishedContent({ releases: deps.releases });
    const publicProject = await getPublishedProject(
      { releases: deps.releases },
      "brand-identity",
    );

    expect(published?.manifest.projects).toEqual([]);
    expect(publicProject?.id).toBe(project.id);
  });
});
