"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api/client";
import type { AdminContentResponse, ProjectResponse } from "@/lib/api/contracts";
import { getPublicAppUrl } from "@/lib/env/public";
import { PortfolioOrganizer } from "@/modules/project/presentation/portfolio-organizer";
import { ProjectCanvas } from "@/modules/project/presentation/project-canvas";
import { StatusBar } from "@/modules/publishing/presentation/status-bar";
import { SiteSettingsForm } from "@/modules/site/presentation/site-settings-form";
import {
  selectHasUnsavedChanges,
  useAdminUiStore,
} from "@/stores/admin-ui-store";

export function AdminApp({ initialProjectId }: { initialProjectId: string | null }) {
  const router = useRouter();
  const [content, setContent] = useState<AdminContentResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const selectedProjectId = useAdminUiStore((state) => state.selectedProjectId);
  const selectProject = useAdminUiStore((state) => state.selectProject);
  const hasUnsavedChanges = useAdminUiStore(selectHasUnsavedChanges);
  const isFirstRender = useRef(true);

  const refresh = useCallback(async () => {
    try {
      setContent(await apiFetch<AdminContentResponse>("/api/admin/content"));
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load admin data",
      );
    }
  }, []);

  useEffect(() => {
    // State updates land after an await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (initialProjectId) {
      selectProject(initialProjectId);
    }
  }, [initialProjectId, selectProject]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const url = selectedProjectId ? `/admin?project=${selectedProjectId}` : "/admin";
    router.replace(url, { scroll: false });
  }, [selectedProjectId, router]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  async function handleCreate() {
    const response = await apiFetch<ProjectResponse>("/api/admin/projects", {
      method: "POST",
    });
    await refresh();
    selectProject(response.project.id);
  }

  if (selectedProjectId) {
    return (
      <ProjectCanvas
        projectId={selectedProjectId}
        onBack={() => selectProject(null)}
        onChanged={() => void refresh()}
      />
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-16">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="text-sm text-destructive">{loadError}</p>
      </main>
    );
  }

  if (!content) {
    return (
      <main className="mx-auto flex w-full max-w-3xl px-6 py-16">
        <p className="text-sm text-muted-foreground">Loading admin…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">
          Portflow admin
        </h1>
      </header>

      <StatusBar
        currentRelease={content.currentRelease}
        publicUrl={getPublicAppUrl()}
        onPublished={() => void refresh()}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SiteSettingsForm
          key={content.site.revision}
          site={content.site}
          avatarUrl={content.avatarUrl}
          onSaved={() => void refresh()}
        />
        <PortfolioOrganizer
          projects={content.projectIndex.projects}
          indexRevision={content.projectIndex.revision}
          coverUrls={content.projectCoverUrls}
          onSelect={selectProject}
          onCreate={handleCreate}
          onReordered={() => void refresh()}
        />
      </div>
    </main>
  );
}
