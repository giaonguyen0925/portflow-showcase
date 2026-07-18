import { AppError } from "@/lib/api/app-error";
import { createAdminRoute, jsonResponse } from "@/lib/api/admin-route";
import { getServerEnv } from "@/lib/env/server";
import { getR2ObjectStore } from "@/lib/r2/r2-object-store";
import { archiveProject } from "@/modules/project/application/archive-project";
import { saveProject } from "@/modules/project/application/save-project";
import { createR2ProjectRepository } from "@/modules/project/infrastructure/r2-project-repository";

type Params = { projectId: string };

export const GET = createAdminRoute<Params>(
  "admin.project.read",
  async ({ params }) => {
    const project = await createR2ProjectRepository(
      getR2ObjectStore(),
    ).readDraft(params.projectId);

    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", "Project does not exist");
    }

    return jsonResponse({ project });
  },
  { rateLimit: { limit: 120, windowMs: 60_000 } },
);

export const PUT = createAdminRoute<Params>(
  "admin.project.save",
  async ({ request, params }) => {
    const body: unknown = await request.json();
    const project = await saveProject(
      {
        projects: createR2ProjectRepository(getR2ObjectStore()),
        assetBaseUrl: getServerEnv().R2_PUBLIC_BASE_URL,
      },
      params.projectId,
      body,
    );
    return jsonResponse({ project });
  },
  { rateLimit: { limit: 30, windowMs: 60_000 } },
);

export const DELETE = createAdminRoute<Params>(
  "admin.project.archive",
  async ({ params }) => {
    const result = await archiveProject(
      { projects: createR2ProjectRepository(getR2ObjectStore()) },
      params.projectId,
    );
    return jsonResponse(result);
  },
  { rateLimit: { limit: 10, windowMs: 60_000 } },
);
