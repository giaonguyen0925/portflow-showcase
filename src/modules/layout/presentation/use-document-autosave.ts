"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { withResourceLock } from "@/lib/api/client";
import { useAdminUiStore } from "@/stores/admin-ui-store";

export type AutosaveStatus = "saved" | "pending" | "saving" | "error";

/**
 * Debounced document autosave shared by the project and homepage canvases.
 * Domain-agnostic: the caller serializes nothing and owns the actual save
 * call (revision bookkeeping included); the hook owns debounce, no-op
 * detection via snapshot comparison, dirty-state wiring, Web Locks, and
 * error surfacing.
 */
export function useDocumentAutosave<TState>({
  resourceId,
  save,
  mapError,
  delayMs = 1_200,
}: {
  resourceId: string;
  save: (state: TState) => Promise<void>;
  mapError?: (error: unknown) => string;
  delayMs?: number;
}): {
  status: AutosaveStatus;
  errorMessage: string | null;
  /** Call with the full next state after every edit. */
  schedule: (next: TState) => void;
  /** Marks the given state as persisted (call after the initial load). */
  markBaseline: (state: TState) => void;
  /**
   * Immediately persists any pending debounce (no-op if already saved).
   * Pass `state` to force-save the visible UI even when the debounce
   * queue was cleared (e.g. Publish right after typing a title).
   */
  flush: (state?: TState) => Promise<void>;
} {
  const [status, setStatus] = useState<AutosaveStatus>("saved");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const setDirty = useAdminUiStore((state) => state.setDirty);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotRef = useRef<string | null>(null);
  const pendingRef = useRef<TState | null>(null);
  const saveRef = useRef(save);
  const mapErrorRef = useRef(mapError);
  const inFlightRef = useRef<Promise<void> | null>(null);

  // Keep the latest callbacks without retriggering scheduled saves.
  useEffect(() => {
    saveRef.current = save;
    mapErrorRef.current = mapError;
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setDirty(resourceId, false);
    };
  }, [resourceId, setDirty]);

  const markBaseline = useCallback(
    (state: TState) => {
      snapshotRef.current = JSON.stringify(state);
      pendingRef.current = null;
      setStatus("saved");
      setErrorMessage(null);
      setDirty(resourceId, false);
    },
    [resourceId, setDirty],
  );

  const runSave = useCallback(
    async (next: TState) => {
      const snapshot = JSON.stringify(next);
      if (snapshot === snapshotRef.current) {
        pendingRef.current = null;
        setStatus("saved");
        setDirty(resourceId, false);
        return;
      }

      setStatus("saving");
      setErrorMessage(null);
      try {
        await withResourceLock(resourceId, () => saveRef.current(next));
        snapshotRef.current = snapshot;
        if (pendingRef.current !== null) {
          const stillPending = JSON.stringify(pendingRef.current);
          if (stillPending === snapshot) {
            pendingRef.current = null;
          }
        }
        setStatus(pendingRef.current ? "pending" : "saved");
        setDirty(resourceId, pendingRef.current !== null);
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          mapErrorRef.current?.(error) ??
            (error instanceof Error ? error.message : "Autosave failed"),
        );
        throw error;
      }
    },
    [resourceId, setDirty],
  );

  const schedule = useCallback(
    (next: TState) => {
      pendingRef.current = next;
      setDirty(resourceId, true);
      setStatus("pending");
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        const toSave = pendingRef.current;
        if (toSave === null) return;
        const promise = runSave(toSave).catch(() => {
          // Error already mirrored into status/errorMessage.
        });
        inFlightRef.current = promise;
        void promise.finally(() => {
          if (inFlightRef.current === promise) {
            inFlightRef.current = null;
          }
        });
      }, delayMs);
    },
    [resourceId, delayMs, runSave, setDirty],
  );

  const flush = useCallback(async (state?: TState) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (state !== undefined) {
      pendingRef.current = state;
    }
    if (inFlightRef.current) {
      try {
        await inFlightRef.current;
      } catch {
        // Surface via status; caller decides whether to proceed.
      }
    }
    const pending = pendingRef.current;
    if (pending === null) {
      return;
    }
    const promise = runSave(pending);
    inFlightRef.current = promise;
    try {
      await promise;
    } finally {
      if (inFlightRef.current === promise) {
        inFlightRef.current = null;
      }
    }
  }, [runSave]);

  return { status, errorMessage, schedule, markBaseline, flush };
}
