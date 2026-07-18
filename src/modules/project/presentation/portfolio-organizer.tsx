"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { ProjectIndexEntry } from "@/modules/project/domain/project-document";

function sortedByOrder(projects: ProjectIndexEntry[]): ProjectIndexEntry[] {
  return [...projects].sort((a, b) => a.order - b.order);
}

export function PortfolioOrganizer({
  projects,
  indexRevision,
  coverUrls,
  onSelect,
  onCreate,
  onReordered,
}: {
  projects: ProjectIndexEntry[];
  indexRevision: number;
  coverUrls: Record<string, string>;
  onSelect: (projectId: string) => void;
  onCreate: () => void;
  onReordered: () => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ordered = sortedByOrder(projects);

  async function persist(next: ProjectIndexEntry[]) {
    setError(null);
    try {
      await apiFetch("/api/admin/projects/order", {
        method: "PUT",
        body: JSON.stringify({
          expectedIndexRevision: indexRevision,
          projects: next.map((p) => ({
            id: p.id,
            order: p.order,
            isVisible: p.isVisible,
          })),
        }),
      });
      onReordered();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the portfolio order");
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = { ...a, order: b.order };
    next[target] = { ...b, order: a.order };
    void persist(next);
  }

  function toggleVisible(index: number) {
    const entry = ordered[index];
    if (!entry) return;
    const next = ordered.map((p, i) =>
      i === index ? { ...p, isVisible: !p.isVisible } : p,
    );
    void persist(next);
  }

  async function handleCreate() {
    setIsCreating(true);
    setError(null);
    try {
      await onCreate();
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Portfolio</h2>
        <Button type="button" onClick={handleCreate} disabled={isCreating}>
          {isCreating ? "Creating…" : "New project"}
        </Button>
      </header>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No projects yet. Create your first one.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordered.map((project, index) => (
            <li
              key={project.id}
              className="flex items-center gap-3 rounded-lg border border-border p-2"
            >
              {coverUrls[project.id] ? (
                // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
                <img
                  src={coverUrls[project.id]}
                  alt=""
                  className="size-12 shrink-0 rounded-md bg-muted object-cover"
                />
              ) : (
                <div className="size-12 shrink-0 rounded-md bg-muted" />
              )}

              <button
                type="button"
                onClick={() => onSelect(project.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-medium">
                  {project.title ?? (
                    <span className="italic text-muted-foreground">
                      Untitled project
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {project.slug ? `/${project.slug}` : "No public URL yet"}
                  {project.summary ? ` — ${project.summary}` : ""}
                </span>
              </button>

              <Badge variant={project.status === "published" ? "default" : "secondary"}>
                {project.status}
              </Badge>

              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={project.isVisible}
                  onChange={() => toggleVisible(index)}
                />
                Visible
              </label>

              <div className="flex flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Move up"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={index === ordered.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Move down"
                >
                  ↓
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
