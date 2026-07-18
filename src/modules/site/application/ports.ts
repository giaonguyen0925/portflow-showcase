import type { SiteDocument } from "@/modules/site/domain/site-document";

export interface SiteRepository {
  readDraft(): Promise<SiteDocument | null>;
  writeDraft(document: SiteDocument): Promise<void>;
  writeHistory(document: SiteDocument): Promise<void>;
}
