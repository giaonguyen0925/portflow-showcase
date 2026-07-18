import { createAdminRoute, jsonResponse } from "@/lib/api/admin-route";
import { getR2ObjectStore } from "@/lib/r2/r2-object-store";
import { reorderProjects } from "@/modules/project/application/reorder-projects";
import { createR2ProjectRepository } from "@/modules/project/infrastructure/r2-project-repository";

export const PUT = createAdminRoute(
  "admin.project.reorder",
  async ({ request }) => {
    const body: unknown = await request.json();
    const projectIndex = await reorderProjects(
      { projects: createR2ProjectRepository(getR2ObjectStore()) },
      body,
    );
    return jsonResponse({ projectIndex });
  },
  { rateLimit: { limit: 30, windowMs: 60_000 } },
);
