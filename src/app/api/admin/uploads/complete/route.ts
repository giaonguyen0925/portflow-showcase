import { createAdminRoute, jsonResponse } from "@/lib/api/admin-route";
import { getServerEnv } from "@/lib/env/server";
import { getR2ObjectStore } from "@/lib/r2/r2-object-store";
import { completeUpload } from "@/modules/asset/application/complete-upload";
import { createR2AssetStorage } from "@/modules/asset/infrastructure/r2-asset-storage";

export const POST = createAdminRoute(
  "admin.upload.complete",
  async ({ request }) => {
    const env = getServerEnv();
    const body: unknown = await request.json();
    const asset = await completeUpload(
      {
        storage: createR2AssetStorage(getR2ObjectStore()),
        uploadTokenSecret: env.UPLOAD_TOKEN_SECRET,
        assetBaseUrl: env.R2_PUBLIC_BASE_URL,
      },
      body,
    );
    return jsonResponse({ asset });
  },
  { rateLimit: { limit: 60, windowMs: 60_000 } },
);
