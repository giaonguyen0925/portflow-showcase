import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/api/app-error";
import { createR2ProjectRepository } from "@/modules/project/infrastructure/r2-project-repository";
import { FakeObjectStore } from "@/test/fakes/fake-object-store";

import { createProject } from "./create-project";
import { reorderProjects } from "./reorder-projects";

function setup() {
  const store = new FakeObjectStore();
  const projects = createR2ProjectRepository(store);
  return { store, projects };
}

describe("reorderProjects", () => {
  it("applies new order and visibility to every project", async () => {
    const { projects } = setup();
    const a = await createProject({ projects });
    const b = await createProject({ projects });
    const index = await projects.readIndex();
    if (!index) throw new Error("expected index");

    const updated = await reorderProjects(
      { projects },
      {
        expectedIndexRevision: index.revision,
        projects: [
          { id: a.id, order: 5, isVisible: false },
          { id: b.id, order: 1, isVisible: true },
        ],
      },
    );

    expect(updated.projects.find((p) => p.id === a.id)?.order).toBe(5);
    expect(updated.projects.find((p) => p.id === a.id)?.isVisible).toBe(false);
    expect(updated.projects.find((p) => p.id === b.id)?.order).toBe(1);
    expect(updated.revision).toBe(index.revision + 1);
  });

  it("rejects a stale index revision", async () => {
    const { projects } = setup();
    const a = await createProject({ projects });

    try {
      await reorderProjects(
        { projects },
        { expectedIndexRevision: 99, projects: [{ id: a.id, order: 0, isVisible: true }] },
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("REVISION_CONFLICT");
    }
  });

  it("rejects a payload that is missing or adds projects", async () => {
    const { projects } = setup();
    await createProject({ projects });
    const b = await createProject({ projects });
    const index = await projects.readIndex();
    if (!index) throw new Error("expected index");

    // Missing the first project entirely.
    await expect(
      reorderProjects(
        { projects },
        {
          expectedIndexRevision: index.revision,
          projects: [{ id: b.id, order: 0, isVisible: true }],
        },
      ),
    ).rejects.toThrow(AppError);
  });
});
