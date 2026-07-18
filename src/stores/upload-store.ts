import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type UploadStatus =
  | "queued"
  | "preprocessing"
  | "warming-up"
  | "uploading"
  | "finalizing"
  | "completed"
  | "failed"
  | "cancelled";

export type UploadItem = {
  id: string;
  scope: string;
  fileName: string;
  previewUrl: string;
  status: UploadStatus;
  progress: number;
  error?: string | undefined;
  assetId?: string | undefined;
};

type UploadState = {
  items: UploadItem[];
  enqueue: (item: UploadItem) => void;
  update: (id: string, patch: Partial<UploadItem>) => void;
  remove: (id: string) => void;
  clearFinished: (scope: string) => void;
};

const FINISHED: UploadStatus[] = ["completed", "cancelled"];

/** Queue state only — Files, XHRs, and signed URLs stay out of the store. */
export const useUploadStore = create<UploadState>()(
  devtools(
    (set) => ({
      items: [],
      enqueue: (item) =>
        set(
          (state) => ({ items: [...state.items, item] }),
          false,
          "upload/enqueue",
        ),
      update: (id, patch) =>
        set(
          (state) => ({
            items: state.items.map((item) =>
              item.id === id ? { ...item, ...patch } : item,
            ),
          }),
          false,
          "upload/update",
        ),
      remove: (id) =>
        set(
          (state) => ({ items: state.items.filter((item) => item.id !== id) }),
          false,
          "upload/remove",
        ),
      clearFinished: (scope) =>
        set(
          (state) => ({
            items: state.items.filter(
              (item) => item.scope !== scope || !FINISHED.includes(item.status),
            ),
          }),
          false,
          "upload/clear-finished",
        ),
    }),
    { name: "upload-store", enabled: process.env.NODE_ENV === "development" },
  ),
);
