import { z } from "zod";

import { AppError } from "@/lib/api/app-error";
import {
  createInitialSiteDocument,
  siteInputSchema,
  type SiteDocument,
} from "@/modules/site/domain/site-document";

import type { SiteRepository } from "./ports";

const saveSiteRequestSchema = siteInputSchema.extend({
  expectedRevision: z.number().int().min(0),
});

export async function saveSite(
  deps: { sites: SiteRepository },
  input: unknown,
): Promise<SiteDocument> {
  const parsed = saveSiteRequestSchema.parse(input);
  const current = (await deps.sites.readDraft()) ?? createInitialSiteDocument();

  if (current.revision !== parsed.expectedRevision) {
    throw new AppError(
      "REVISION_CONFLICT",
      "The site settings were changed elsewhere. Reload and try again.",
      { currentRevision: current.revision },
    );
  }

  if (current.revision > 0) {
    await deps.sites.writeHistory(current);
  }

  // Built field-by-field (not spread over `current`) so clearing an
  // optional field like the avatar actually removes it.
  const next: SiteDocument = {
    schemaVersion: 1,
    title: parsed.title,
    bio: parsed.bio,
    ...(parsed.avatarAssetId === undefined
      ? {}
      : { avatarAssetId: parsed.avatarAssetId }),
    font: parsed.font,
    socialLinks: parsed.socialLinks,
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
  };

  await deps.sites.writeDraft(next);
  return next;
}
