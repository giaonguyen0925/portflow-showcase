"use client";

import { useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import type { Asset } from "@/modules/asset/domain/asset";
import {
  cancelUpload,
  enqueueUploads,
  retryUpload,
} from "@/modules/asset/presentation/upload-manager";
import { useUploadStore, type UploadItem } from "@/stores/upload-store";

const ACTIVE_STATUSES = new Set([
  "queued",
  "preprocessing",
  "warming-up",
  "uploading",
  "finalizing",
]);

function UploadRow({ item }: { item: UploadItem }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border p-2 text-sm">
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
      <img
        src={item.previewUrl}
        alt=""
        className="size-10 rounded-md bg-muted object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.fileName}</p>
        {item.status === "uploading" ? (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {item.status === "failed" ? (item.error ?? "Failed") : item.status}
          </p>
        )}
      </div>
      {item.status === "failed" ? (
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => retryUpload(item.id)}
        >
          Retry
        </Button>
      ) : null}
      {ACTIVE_STATUSES.has(item.status) ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => cancelUpload(item.id)}
        >
          Cancel
        </Button>
      ) : null}
    </li>
  );
}

export function UploadDropzone({
  scope,
  multiple = true,
  label = "Add images",
  onAsset,
}: {
  scope: string;
  multiple?: boolean;
  label?: string;
  onAsset: (asset: Asset) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Plain selector would return a brand-new array every render (`.filter()`),
  // which loops forever with useSyncExternalStore; useShallow memoizes by
  // shallow-comparing the previous result.
  const items = useUploadStore(
    useShallow((state) => state.items.filter((item) => item.scope === scope)),
  );
  const visible = items.filter((item) => item.status !== "completed");

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) {
            enqueueUploads(files, scope, onAsset);
          }
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
      {visible.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {visible.map((item) => (
            <UploadRow key={item.id} item={item} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
