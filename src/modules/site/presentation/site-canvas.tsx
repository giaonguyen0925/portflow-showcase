"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FullscreenLoading } from "@/components/fullscreen-loading";
import { Button } from "@/components/ui/button";
import { siteFontClassName } from "@/app/fonts";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type {
  AdminContentResponse,
  PublishResponse,
  SaveSiteResponse,
} from "@/lib/api/contracts";
import { updateBlockById } from "@/modules/layout/application/layout-mutations";
import {
  createProfileBlock,
  createProjectGridBlock,
  createRowWithBlock,
} from "@/modules/layout/domain/block-factories";
import {
  findBlocksOfType,
  type RowBlock,
} from "@/modules/layout/domain/blocks";
import {
  pageThemeStyle,
  type PageTheme,
} from "@/modules/layout/domain/page-theme";
import { RowsCanvas } from "@/modules/layout/presentation/rows-canvas";
import { RowsView } from "@/modules/layout/presentation/rows-view";
import { ThemeControls } from "@/modules/layout/presentation/theme-controls";
import { useAutosaveFeedback } from "@/modules/layout/presentation/use-autosave-feedback";
import { useDocumentAutosave } from "@/modules/layout/presentation/use-document-autosave";
import type { ReleaseProjectCard } from "@/modules/publishing/domain/release";
import { ProfileBlockView } from "@/modules/site/presentation/profile-block-view";
import { ProjectGridBlockView } from "@/modules/site/presentation/project-grid-block-view";
import {
  SiteSetupPanel,
  type SiteProfileFields,
} from "@/modules/site/presentation/site-setup-panel";
import {
  ProfileBlockEditor,
  ProjectGridBlockEditor,
} from "@/modules/site/presentation/system-block-editors";

type EditableState = SiteProfileFields & {
  theme: PageTheme;
  rows: RowBlock[];
};

function mapSaveError(error: unknown): string {
  if (error instanceof ApiClientError && error.code === "REVISION_CONFLICT") {
    return "The homepage was changed elsewhere. Reload the page to continue.";
  }
  return error instanceof Error ? error.message : "Autosave failed";
}

/** Cards the editor preview feeds the grid — what the next publish will show. */
function previewCards(content: AdminContentResponse): ReleaseProjectCard[] {
  return content.projectIndex.projects
    .filter((p) => p.isVisible && p.slug !== undefined && p.title !== undefined)
    .sort((a, b) => a.order - b.order)
    .map((p) => ({
      id: p.id,
      slug: p.slug ?? "",
      title: p.title ?? "",
      summary: p.summary,
      ...(content.projectCoverUrls[p.id] === undefined
        ? {}
        : { coverUrl: content.projectCoverUrls[p.id] }),
    }));
}

export function SiteCanvas({
  onBack,
  onChanged,
}: {
  onBack: () => void;
  onChanged: () => void;
}) {
  const [content, setContent] = useState<AdminContentResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<EditableState | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const revisionRef = useRef<number | null>(null);

  const autosave = useDocumentAutosave<EditableState>({
    resourceId: "site",
    mapError: mapSaveError,
    save: async (next) => {
      if (revisionRef.current === null) {
        return;
      }
      const response = await apiFetch<SaveSiteResponse>("/api/admin/site", {
        method: "PUT",
        body: JSON.stringify({
          title: next.title,
          bio: next.bio,
          ...(next.avatarAssetId === undefined
            ? {}
            : { avatarAssetId: next.avatarAssetId }),
          font: next.font,
          socialLinks: next.socialLinks,
          theme: next.theme,
          rows: next.rows,
          expectedRevision: revisionRef.current,
        }),
      });
      revisionRef.current = response.site.revision;
      onChanged();
    },
  });
  const { markBaseline } = autosave;
  useAutosaveFeedback(autosave.status, autosave.errorMessage);

  useEffect(() => {
    let cancelled = false;
    apiFetch<AdminContentResponse>("/api/admin/content")
      .then((response) => {
        if (cancelled) return;
        setContent(response);
        revisionRef.current = response.site.revision;
        setAvatarPreview(response.avatarUrl);
        const initial: EditableState = {
          title: response.site.title,
          bio: response.site.bio,
          avatarAssetId: response.site.avatarAssetId,
          font: response.site.font,
          socialLinks: response.site.socialLinks.map((link) => ({ ...link })),
          theme: response.site.theme,
          rows: response.site.rows,
        };
        setState(initial);
        markBaseline(initial);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to load the homepage",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [markBaseline]);

  function patch(partial: Partial<EditableState>) {
    setState((current) => {
      if (!current) return current;
      const next = { ...current, ...partial };
      autosave.schedule(next);
      return next;
    });
  }

  function patchProfile(fields: SiteProfileFields) {
    patch(fields);
  }

  async function handlePublish() {
    if (!state) return;
    setIsPublishing(true);
    try {
      await autosave.flush(state);
      const result = await apiFetch<PublishResponse>("/api/admin/publish", {
        method: "POST",
      });
      if (result.projectCount === 0) {
        toast.warning(
          "Published site only — no titled projects yet. Save a title on each project, then publish again.",
        );
      } else {
        toast.success(`Published (${result.projectCount} projects live).`);
      }
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Publish failed",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <p className="text-sm text-destructive">{loadError}</p>
        <Button type="button" variant="outline" onClick={onBack} className="self-start">
          ← Back
        </Button>
      </div>
    );
  }

  if (!content || !state) {
    return <div className="p-6 text-sm text-muted-foreground">Loading homepage…</div>;
  }

  const hasProfile = findBlocksOfType(state.rows, "profile").length > 0;
  const hasGrid = findBlocksOfType(state.rows, "project-grid").length > 0;
  const cards = previewCards(content);
  const profileData = {
    title: state.title,
    bio: state.bio,
    avatarUrl: avatarPreview,
    socialLinks: state.socialLinks,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <FullscreenLoading show={isPublishing} label="Publishing…" />

      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <span className="text-sm font-medium">Edit homepage</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={hasProfile}
            onClick={() =>
              patch({
                rows: [...state.rows, createRowWithBlock(createProfileBlock())],
              })
            }
          >
            + Profile
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={hasGrid}
            onClick={() =>
              patch({
                rows: [...state.rows, createRowWithBlock(createProjectGridBlock())],
              })
            }
          >
            + Project grid
          </Button>
          <ThemeControls theme={state.theme} onChange={(theme) => patch({ theme })} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewing((v) => !v)}
          >
            {isPreviewing ? "Edit" : "Preview"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handlePublish}
            disabled={isPublishing}
          >
            Publish
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        {!isPreviewing ? (
          <SiteSetupPanel
            value={{
              title: state.title,
              bio: state.bio,
              avatarAssetId: state.avatarAssetId,
              font: state.font,
              socialLinks: state.socialLinks,
            }}
            avatarPreview={avatarPreview}
            onChange={patchProfile}
            onAvatarChange={(assetId, previewUrl) => {
              setAvatarPreview(previewUrl);
              patch({ avatarAssetId: assetId });
            }}
          />
        ) : null}

        {isPreviewing ? (
          <div
            className={`rounded-xl border border-border p-6 ${siteFontClassName(state.font)}`}
            style={pageThemeStyle(state.theme)}
          >
            <RowsView
              rows={state.rows}
              renderBlock={(block) => {
                if (block.type === "profile") {
                  return <ProfileBlockView block={block} profile={profileData} />;
                }
                if (block.type === "project-grid") {
                  return <ProjectGridBlockView block={block} projects={cards} />;
                }
                return undefined;
              }}
            />
          </div>
        ) : (
          <div
            className={`mx-auto w-5xl rounded-xl border border-border p-3 ${siteFontClassName(state.font)}`}
            style={pageThemeStyle(state.theme)}
          >
            <RowsCanvas
              rows={state.rows}
              scopeId="site"
              onRowsChange={(rows) => patch({ rows })}
              renderBlockEditor={(block) => {
                if (block.type === "profile") {
                  return (
                    <ProfileBlockEditor
                      block={block}
                      onChange={(nextBlock) =>
                        patch({
                          rows: updateBlockById(state.rows, block.id, () => nextBlock),
                        })
                      }
                    />
                  );
                }
                if (block.type === "project-grid") {
                  return (
                    <ProjectGridBlockEditor
                      block={block}
                      onChange={(nextBlock) =>
                        patch({
                          rows: updateBlockById(state.rows, block.id, () => nextBlock),
                        })
                      }
                    />
                  );
                }
                return undefined;
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
