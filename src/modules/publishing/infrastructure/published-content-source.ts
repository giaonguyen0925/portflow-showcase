import "server-only";

import { cache } from "react";

import { getR2ObjectStore } from "@/lib/r2/r2-object-store";
import {
  getPublishedContent,
  getPublishedProject,
  type PublishedContent,
} from "@/modules/publishing/application/get-published-content";
import type { ReleaseProject } from "@/modules/publishing/domain/release";

import { createR2ReleaseRepository } from "./r2-release-repository";

/** Request-deduped loaders for the public pages (page + generateMetadata). */

export const loadPublishedContent = cache(
  async (): Promise<PublishedContent | null> =>
    getPublishedContent({
      releases: createR2ReleaseRepository(getR2ObjectStore()),
    }),
);

export const loadPublishedProject = cache(
  async (slug: string): Promise<ReleaseProject | null> =>
    getPublishedProject(
      { releases: createR2ReleaseRepository(getR2ObjectStore()) },
      slug,
    ),
);
