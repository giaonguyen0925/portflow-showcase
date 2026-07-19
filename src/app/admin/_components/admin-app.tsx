"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FullscreenLoading } from "@/components/fullscreen-loading";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { AdminContentResponse, ProjectResponse } from "@/lib/api/contracts";
import { getPublicAppUrl } from "@/lib/env/public";
import { PortfolioOrganizer } from "@/modules/project/presentation/portfolio-organizer";
import { ProjectCanvas } from "@/modules/project/presentation/project-canvas";
import { StatusBar } from "@/modules/publishing/presentation/status-bar";
import { SiteCanvas } from "@/modules/site/presentation/site-canvas";
import {
  selectHasUnsavedChanges,
  useAdminUiStore,
} from "@/stores/admin-ui-store";

export function AdminApp({
  initialProjectId,
  initialPage,
  showLogout = false,
}: {
  initialProjectId: string | null;
  initialPage: "home" | null;
  showLogout?: boolean;
}) {
  const router = useRouter();
  const [content, setContent] = useState<AdminContentResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const selectedProjectId = useAdminUiStore((state) => state.selectedProjectId);
  const selectProject = useAdminUiStore((state) => state.selectProject);
  const isEditingHomepage = useAdminUiStore((state) => state.isEditingHomepage);
  const setEditingHomepage = useAdminUiStore((state) => state.setEditingHomepage);
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
    } else if (initialPage === "home") {
      setEditingHomepage(true);
    }
  }, [initialProjectId, initialPage, selectProject, setEditingHomepage]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const url = selectedProjectId
      ? `/admin?project=${selectedProjectId}`
      : isEditingHomepage
        ? "/admin?page=home"
        : "/admin";
    router.replace(url, { scroll: false });
  }, [selectedProjectId, isEditingHomepage, router]);

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
    setIsCreating(true);
    try {
      const response = await apiFetch<ProjectResponse>("/api/admin/projects", {
        method: "POST",
      });
      await refresh();
      selectProject(response.project.id);
      toast.success("Draft project created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create project",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await apiFetch<{ ok: true }>("/api/admin/logout", { method: "POST" });
      // Hard navigate so the login form appears immediately; soft
      // router.refresh() can hang on a slow RSC refetch.
      window.location.assign("/admin");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logout failed");
      setIsLoggingOut(false);
    }
  }

  if (selectedProjectId) {
    const indexEntry = content?.projectIndex.projects.find(
      (p) => p.id === selectedProjectId,
    );
    return (
      <ProjectCanvas
        projectId={selectedProjectId}
        indexStatus={indexEntry?.status}
        onBack={() => selectProject(null)}
        onChanged={() => void refresh()}
      />
    );
  }

  if (isEditingHomepage) {
    return (
      <SiteCanvas
        onBack={() => setEditingHomepage(false)}
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
      <FullscreenLoading show={isCreating} label="Creating project…" />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Portflow admin
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage projects and publish. Edit homepage setup from the button on
            the right.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showLogout ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? "Signing out…" : "Sign out"}
            </Button>
          ) : null}
          <Button type="button" onClick={() => setEditingHomepage(true)}>
            Edit homepage
          </Button>
        </div>
      </header>

      <StatusBar
        currentRelease={content.currentRelease}
        publicUrl={getPublicAppUrl()}
        onPublished={() => void refresh()}
      />

      <PortfolioOrganizer
        projects={content.projectIndex.projects}
        indexRevision={content.projectIndex.revision}
        coverUrls={content.projectCoverUrls}
        onSelect={selectProject}
        onCreate={handleCreate}
        onReordered={() => void refresh()}
      />
    </main>
  );
}
