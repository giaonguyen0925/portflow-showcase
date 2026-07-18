import { createAdminRoute, jsonResponse } from "@/lib/api/admin-route";
import { getServerEnv } from "@/lib/env/server";
import { getR2ObjectStore } from "@/lib/r2/r2-object-store";
import { warmUpUpload } from "@/modules/asset/application/warm-up-upload";
import { createR2AssetStorage } from "@/modules/asset/infrastructure/r2-asset-storage";

export const POST = createAdminRoute(
  "admin.upload.warm-up",
  async ({ request }) => {
    const body: unknown = await request.json();
    const result = await warmUpUpload(
      {
        storage: createR2AssetStorage(getR2ObjectStore()),
        uploadTokenSecret: getServerEnv().UPLOAD_TOKEN_SECRET,
      },
      body,
    );
    return jsonResponse(result);
  },
  { rateLimit: { limit: 60, windowMs: 60_000 } },
);
