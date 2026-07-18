import { privateKeys } from "@/lib/r2/keys";
import type { ObjectStore } from "@/lib/r2/object-store";
import type { SiteRepository } from "@/modules/site/application/ports";
import {
  siteDocumentSchema,
  type SiteDocument,
} from "@/modules/site/domain/site-document";

export function createR2SiteRepository(store: ObjectStore): SiteRepository {
  return {
    async readDraft(): Promise<SiteDocument | null> {
      const raw = await store.getJson("private", privateKeys.siteDraft());
      return raw === null ? null : siteDocumentSchema.parse(raw);
    },

    async writeDraft(document: SiteDocument): Promise<void> {
      await store.putJson("private", privateKeys.siteDraft(), document, {
        cacheControl: "no-store",
      });
    },

    async writeHistory(document: SiteDocument): Promise<void> {
      await store.putJson(
        "private",
        privateKeys.siteHistory(document.revision),
        document,
        { cacheControl: "no-store" },
      );
    },
  };
}
