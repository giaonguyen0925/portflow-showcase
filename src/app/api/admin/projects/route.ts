import { createAdminRoute, jsonResponse } from "@/lib/api/admin-route";
import { getR2ObjectStore } from "@/lib/r2/r2-object-store";
import { createProject } from "@/modules/project/application/create-project";
import { createR2ProjectRepository } from "@/modules/project/infrastructure/r2-project-repository";

export const POST = createAdminRoute(
  "admin.project.create",
  async () => {
    const project = await createProject({
      projects: createR2ProjectRepository(getR2ObjectStore()),
    });
    return jsonResponse({ project }, 201);
  },
  { rateLimit: { limit: 20, windowMs: 60_000 } },
);
