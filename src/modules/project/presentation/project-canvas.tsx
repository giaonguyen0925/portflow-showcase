"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FullscreenLoading } from "@/components/fullscreen-loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { ProjectResponse, PublishResponse } from "@/lib/api/contracts";
import type { RowBlock } from "@/modules/layout/domain/blocks";
import {
  pageThemeStyle,
  type PageTheme,
} from "@/modules/layout/domain/page-theme";
import { RowsCanvas } from "@/modules/layout/presentation/rows-canvas";
import { RowsView } from "@/modules/layout/presentation/rows-view";
import { ThemeControls } from "@/modules/layout/presentation/theme-controls";
import { useAutosaveFeedback } from "@/modules/layout/presentation/use-autosave-feedback";
import { useDocumentAutosave } from "@/modules/layout/presentation/use-document-autosave";
import {
  MAX_SUMMARY_LENGTH,
  type ProjectDocument,
  type ProjectStatus,
} from "@/modules/project/domain/project-document";
import { MAX_PROJECT_NAME_LENGTH } from "@/modules/project/domain/project-name";

type EditableState = {
  title: string;
  summary: string;
  theme: PageTheme;
  rows: RowBlock[];
};

function toEditableState(project: ProjectDocument): EditableState {
  return {
    title: project.title ?? "",
    summary: project.summary,
    theme: project.theme,
    rows: project.rows,
  };
}

function mapSaveError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "REVISION_CONFLICT") {
      return "This project was changed elsewhere. Reload the page to continue.";
    }
    if (error.code === "PROJECT_NAME_CONFLICT") {
      return "A project with this title already exists.";
    }
    if (error.code === "PROJECT_SLUG_CONFLICT") {
      return "This title produces a URL that is already taken. Try another title.";
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Autosave failed";
}

export function ProjectCanvas({
  projectId,
  indexStatus,
  onBack,
  onChanged,
}: {
  projectId: string;
  /** Live index status (draft/published/archived); separate from draft.json. */
  indexStatus?: ProjectStatus | undefined;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<EditableState | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteBusy, setIsDeleteBusy] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const revisionRef = useRef<number | null>(null);

  const autosave = useDocumentAutosave<EditableState>({
    resourceId: projectId,
    mapError: mapSaveError,
    save: async (next) => {
      if (revisionRef.current === null) {
        return;
      }
      const response = await apiFetch<ProjectResponse>(
        `/api/admin/projects/${projectId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            title: next.title,
            summary: next.summary,
            theme: next.theme,
            rows: next.rows,
            expectedRevision: revisionRef.current,
          }),
        },
      );
      setProject(response.project);
      revisionRef.current = response.project.revision;
      onChanged();
    },
  });
  const { markBaseline } = autosave;
  useAutosaveFeedback(autosave.status, autosave.errorMessage);

  useEffect(() => {
    let cancelled = false;
    apiFetch<ProjectResponse>(`/api/admin/projects/${projectId}`)
      .then((response) => {
        if (cancelled) return;
        setProject(response.project);
        revisionRef.current = response.project.revision;
        const initial = toEditableState(response.project);
        setState(initial);
        markBaseline(initial);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to load project",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, markBaseline]);

  function patch(partial: Partial<EditableState>) {
    setState((current) => {
      if (!current) return current;
      const next = { ...current, ...partial };
      autosave.schedule(next);
      return next;
    });
  }

  async function handleDelete() {
    if (!project) return;
    const requiredText = project.title ?? "";
    if (requiredText && deleteConfirmation !== requiredText) return;
    setIsDeleteBusy(true);
    try {
      await apiFetch(`/api/admin/projects/${projectId}`, { method: "DELETE" });
      toast.success("Project archived");
      onChanged();
      onBack();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
      setIsDeleting(false);
    } finally {
      setIsDeleteBusy(false);
    }
  }

  async function handlePublish() {
    if (!state) return;
    setIsPublishing(true);
    try {
      // Force-save the visible canvas so titled projects are in draft.json
      // before the release snapshot is built.
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

  if (!project || !state) {
    return <div className="p-6 text-sm text-muted-foreground">Loading project…</div>;
  }

  const isBlocking = isPublishing || isDeleteBusy;
  const blockingLabel = isPublishing
    ? "Publishing…"
    : isDeleteBusy
      ? "Deleting…"
      : "Working…";

  return (
    <div className="flex min-h-screen flex-col">
      <FullscreenLoading show={isBlocking} label={blockingLabel} />

      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Input
          value={state.title}
          maxLength={MAX_PROJECT_NAME_LENGTH}
          placeholder="Untitled project"
          onChange={(event) => patch({ title: event.target.value })}
          className="max-w-xs font-medium"
        />
        {project.slug ? (
          <span className="text-xs text-muted-foreground">/{project.slug}</span>
        ) : null}
        {indexStatus ? (
          <Badge
            variant={indexStatus === "published" ? "default" : "secondary"}
          >
            {indexStatus}
          </Badge>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <ThemeControls
            theme={state.theme}
            onChange={(theme) => patch({ theme })}
          />
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
            disabled={isBlocking}
          >
            Publish
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <Input
          value={state.summary}
          maxLength={MAX_SUMMARY_LENGTH}
          placeholder="Short summary shown on the home page…"
          onChange={(event) => patch({ summary: event.target.value })}
        />

        {isPreviewing ? (
          <div
            className="rounded-xl border border-border p-6"
            style={pageThemeStyle(state.theme)}
          >
            <RowsView rows={state.rows} />
          </div>
        ) : (
          <div
            className="mx-auto w-5xl rounded-xl border border-border p-3"
            style={pageThemeStyle(state.theme)}
          >
            <RowsCanvas
              rows={state.rows}
              scopeId={projectId}
              onRowsChange={(rows) => patch({ rows })}
            />
          </div>
        )}
      </div>

      <footer className="border-t border-border px-4 py-4">
        {isDeleting ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {project.title ? (
                <>
                  Type <span className="font-medium">{project.title}</span> to
                  confirm.
                </>
              ) : (
                "Confirm deleting this untitled draft."
              )}{" "}
              The project is archived and disappears from the site on the next
              publish.
            </p>
            <div className="flex gap-2">
              {project.title ? (
                <Input
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  className="max-w-xs"
                />
              ) : null}
              <Button
                type="button"
                variant="destructive"
                disabled={
                  isBlocking ||
                  (Boolean(project.title) &&
                    deleteConfirmation !== project.title)
                }
                onClick={handleDelete}
              >
                Delete
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDeleting(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleting(true)}
          >
            Delete project…
          </Button>
        )}
      </footer>
    </div>
  );
}
