"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError, apiFetch, withResourceLock } from "@/lib/api/client";
import type { ProjectResponse, PublishResponse } from "@/lib/api/contracts";
import { MAX_SUMMARY_LENGTH } from "@/modules/project/domain/project-document";
import type { ProjectDocument } from "@/modules/project/domain/project-document";
import { MAX_PROJECT_NAME_LENGTH } from "@/modules/project/domain/project-name";
import { RowsCanvas, RowsView } from "@/modules/project/presentation/rows-renderer";
import type { RowBlock } from "@/modules/project/domain/blocks";
import { useAdminUiStore } from "@/stores/admin-ui-store";

const AUTOSAVE_DELAY_MS = 1_200;

type EditableState = {
  title: string;
  summary: string;
  rows: RowBlock[];
};

function toEditableState(project: ProjectDocument): EditableState {
  return {
    title: project.title ?? "",
    summary: project.summary,
    rows: project.rows,
  };
}

type SaveStatus = "saved" | "pending" | "saving" | "error";

export function ProjectCanvas({
  projectId,
  onBack,
  onChanged,
}: {
  projectId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<EditableState | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const setDirty = useAdminUiStore((s) => s.setDirty);

  const revisionRef = useRef<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<ProjectResponse>(`/api/admin/projects/${projectId}`)
      .then((response) => {
        if (cancelled) return;
        setProject(response.project);
        revisionRef.current = response.project.revision;
        const initial = toEditableState(response.project);
        setState(initial);
        savedSnapshotRef.current = JSON.stringify(initial);
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
  }, [projectId]);

  useEffect(() => {
    return () => setDirty(projectId, false);
  }, [projectId, setDirty]);

  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, [projectId]);

  function scheduleAutosave(next: EditableState) {
    setDirty(projectId, true);
    setSaveStatus("pending");
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      void runSave(next);
    }, AUTOSAVE_DELAY_MS);
  }

  async function runSave(next: EditableState) {
    if (revisionRef.current === null) return;
    const snapshot = JSON.stringify(next);
    if (snapshot === savedSnapshotRef.current) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("saving");
    setSaveError(null);
    try {
      const response = await withResourceLock(projectId, () =>
        apiFetch<ProjectResponse>(`/api/admin/projects/${projectId}`, {
          method: "PUT",
          body: JSON.stringify({
            title: next.title,
            summary: next.summary,
            rows: next.rows,
            expectedRevision: revisionRef.current,
          }),
        }),
      );
      setProject(response.project);
      revisionRef.current = response.project.revision;
      savedSnapshotRef.current = snapshot;
      setSaveStatus("saved");
      setDirty(projectId, false);
      onChanged();
    } catch (error) {
      setSaveStatus("error");
      if (error instanceof ApiClientError && error.code === "REVISION_CONFLICT") {
        setSaveError(
          "This project was changed elsewhere. Reload the page to continue.",
        );
      } else if (
        error instanceof ApiClientError &&
        error.code === "PROJECT_NAME_CONFLICT"
      ) {
        setSaveError("A project with this title already exists.");
      } else if (
        error instanceof ApiClientError &&
        error.code === "PROJECT_SLUG_CONFLICT"
      ) {
        setSaveError(
          "This title produces a URL that is already taken. Try another title.",
        );
      } else {
        setSaveError(
          error instanceof Error ? error.message : "Autosave failed",
        );
      }
    }
  }

  function patch(partial: Partial<EditableState>) {
    setState((current) => {
      if (!current) return current;
      const next = { ...current, ...partial };
      scheduleAutosave(next);
      return next;
    });
  }

  async function handleDelete() {
    if (!project) return;
    const requiredText = project.title ?? "";
    if (requiredText && deleteConfirmation !== requiredText) return;
    try {
      await apiFetch(`/api/admin/projects/${projectId}`, { method: "DELETE" });
      onChanged();
      onBack();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Delete failed");
      setIsDeleting(false);
    }
  }

  async function handlePublish() {
    setIsPublishing(true);
    setPublishMessage(null);
    try {
      const result = await apiFetch<PublishResponse>("/api/admin/publish", {
        method: "POST",
      });
      setPublishMessage(`Published (${result.projectCount} projects live).`);
      onChanged();
    } catch (error) {
      setPublishMessage(
        error instanceof Error ? `Publish failed: ${error.message}` : "Publish failed",
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

  return (
    <div className="flex min-h-screen flex-col">
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
        <span className="text-xs text-muted-foreground">
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "pending"
              ? "Unsaved changes"
              : saveStatus === "error"
                ? "Save failed"
                : "Saved"}
        </span>
        {project.slug ? (
          <span className="text-xs text-muted-foreground">/{project.slug}</span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewing((v) => !v)}
          >
            {isPreviewing ? "Edit" : "Preview"}
          </Button>
          <Button type="button" size="sm" onClick={handlePublish} disabled={isPublishing}>
            {isPublishing ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </header>

      {saveError ? (
        <p className="px-4 pt-2 text-sm text-destructive">{saveError}</p>
      ) : null}
      {publishMessage ? (
        <p className="px-4 pt-2 text-sm text-muted-foreground">{publishMessage}</p>
      ) : null}

      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <Input
          value={state.summary}
          maxLength={MAX_SUMMARY_LENGTH}
          placeholder="Short summary shown on the home page…"
          onChange={(event) => patch({ summary: event.target.value })}
        />

        {isPreviewing ? (
          <div className="rounded-xl border border-border bg-white p-6">
            <RowsView rows={state.rows} />
          </div>
        ) : (
          <RowsCanvas
            rows={state.rows}
            projectId={projectId}
            onRowsChange={(rows) => patch({ rows })}
          />
        )}
      </div>

      <footer className="border-t border-border px-4 py-4">
        {isDeleting ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {project.title
                ? (
                  <>Type <span className="font-medium">{project.title}</span> to confirm.</>
                )
                : "Confirm deleting this untitled draft."}{" "}
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
                disabled={Boolean(project.title) && deleteConfirmation !== project.title}
                onClick={handleDelete}
              >
                Delete
              </Button>
              <Button type="button" variant="ghost" onClick={() => setIsDeleting(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="destructive" size="sm" onClick={() => setIsDeleting(true)}>
            Delete project…
          </Button>
        )}
      </footer>
    </div>
  );
}
