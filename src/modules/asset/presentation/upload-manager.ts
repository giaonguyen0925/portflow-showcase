"use client";

import { apiFetch } from "@/lib/api/client";
import type {
  Asset,
  AssetContentType,
  VideoContentType,
} from "@/modules/asset/domain/asset";
import {
  IMAGE_CONTENT_TYPE,
  isVideoContentType,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_FILE_SIZE_BYTES,
  MAX_VIDEO_FILE_SIZE_BYTES,
} from "@/modules/asset/domain/asset";
import type { WarmUpResponse } from "@/modules/asset/application/warm-up-upload";
import { useUploadStore, type UploadItem } from "@/stores/upload-store";

const MAX_CONCURRENT_UPLOADS = 3;

class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelledError";
  }
}

type UploadTask = {
  file: File;
  scope: string;
  onAsset: (asset: Asset) => void;
  xhr?: XMLHttpRequest;
  cancelled?: boolean;
};

const tasks = new Map<string, UploadTask>();
const pendingIds: string[] = [];
let activeCount = 0;

export function enqueueUploads(
  files: File[],
  scope: string,
  onAsset: (asset: Asset) => void,
): void {
  const store = useUploadStore.getState();

  for (const file of files) {
    const id = crypto.randomUUID();
    tasks.set(id, { file, scope, onAsset });
    store.enqueue({
      id,
      scope,
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      previewKind: file.type.startsWith("video/") ? "video" : "image",
      status: "queued",
      progress: 0,
    });
    pendingIds.push(id);
  }

  pump();
}

export function retryUpload(id: string): void {
  const task = tasks.get(id);
  if (!task) {
    return;
  }
  task.cancelled = false;
  useUploadStore.getState().update(id, {
    status: "queued",
    progress: 0,
    error: undefined,
  });
  pendingIds.push(id);
  pump();
}

export function cancelUpload(id: string): void {
  const task = tasks.get(id);
  if (!task) {
    return;
  }
  task.cancelled = true;
  task.xhr?.abort();

  const queuedAt = pendingIds.indexOf(id);
  if (queuedAt >= 0) {
    pendingIds.splice(queuedAt, 1);
  }

  useUploadStore.getState().update(id, { status: "cancelled" });
}

function pump(): void {
  while (activeCount < MAX_CONCURRENT_UPLOADS && pendingIds.length > 0) {
    const id = pendingIds.shift();
    if (id !== undefined) {
      void runUpload(id);
    }
  }
}

async function runUpload(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task || task.cancelled) {
    return;
  }

  const update = (patch: Partial<UploadItem>) =>
    useUploadStore.getState().update(id, patch);

  activeCount += 1;

  try {
    update({ status: "preprocessing" });
    const processed = await preprocessFile(task.file);
    throwIfCancelled(task);

    const checksum = await sha256Base64(processed.blob);
    throwIfCancelled(task);

    update({ status: "warming-up" });
    const warm = await apiFetch<WarmUpResponse>("/api/admin/uploads/warm-up", {
      method: "POST",
      body: JSON.stringify({
        fileName: task.file.name,
        contentType: processed.contentType,
        size: processed.blob.size,
        checksum,
        width: processed.width,
        height: processed.height,
      }),
    });
    throwIfCancelled(task);

    update({ status: "uploading", progress: 0 });
    await putWithProgress(
      task,
      warm.uploadUrl,
      processed.blob,
      processed.contentType,
      (p) => update({ progress: p }),
    );

    update({ status: "finalizing", progress: 100 });
    const { asset } = await apiFetch<{ asset: Asset }>(
      "/api/admin/uploads/complete",
      {
        method: "POST",
        body: JSON.stringify({
          uploadId: warm.uploadId,
          finalizeToken: warm.finalizeToken,
        }),
      },
    );

    update({ status: "completed", assetId: asset.id });
    task.onAsset(asset);
  } catch (error) {
    if (error instanceof UploadCancelledError || task.cancelled) {
      update({ status: "cancelled" });
    } else {
      update({
        status: "failed",
        error: error instanceof Error ? error.message : "Upload failed",
      });
    }
  } finally {
    activeCount -= 1;
    pump();
  }
}

function throwIfCancelled(task: UploadTask): void {
  if (task.cancelled) {
    throw new UploadCancelledError();
  }
}

type ProcessedUpload = {
  blob: Blob;
  width: number;
  height: number;
  contentType: AssetContentType;
};

async function preprocessFile(file: File): Promise<ProcessedUpload> {
  if (file.type.startsWith("image/")) {
    const image = await preprocessImage(file);
    return { ...image, contentType: IMAGE_CONTENT_TYPE };
  }
  if (isVideoContentType(file.type)) {
    return preprocessVideo(file, file.type);
  }
  throw new Error("Only image and video (MP4/WebM) files can be uploaded");
}

async function preprocessImage(
  file: File,
): Promise<{ blob: Blob; width: number; height: number }> {
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    throw new Error("File is larger than 20 MiB");
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    bitmap.close();
    throw new Error("Image exceeds the 12,000px dimension limit");
  }

  // Already WebP: upload as-is; otherwise re-encode via canvas.
  if (file.type === "image/webp") {
    bitmap.close();
    return { blob: file, width, height };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Canvas is not available for image conversion");
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9),
  );

  if (!blob || blob.type !== "image/webp") {
    throw new Error("This browser cannot convert images to WebP");
  }
  if (blob.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    throw new Error("Converted image is larger than 20 MiB");
  }

  return { blob, width, height };
}

async function preprocessVideo(
  file: File,
  contentType: VideoContentType,
): Promise<ProcessedUpload> {
  if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
    throw new Error("Video is larger than 25 MiB");
  }

  const { width, height } = await readVideoDimensions(file);
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new Error("Video exceeds the 12,000px dimension limit");
  }

  return { blob: file, width, height, contentType };
}

function readVideoDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const { videoWidth: width, videoHeight: height } = video;
      URL.revokeObjectURL(url);
      if (!width || !height) {
        reject(new Error("Could not read video dimensions"));
        return;
      }
      resolve({ width, height });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load video metadata"));
    };
    video.src = url;
  });
}

async function sha256Base64(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  let binary = "";
  for (const byte of new Uint8Array(digest)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function putWithProgress(
  task: UploadTask,
  url: string,
  blob: Blob,
  contentType: AssetContentType,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    task.xhr = xhr;

    xhr.open("PUT", url);
    // The checksum is already embedded in the presigned URL's query string
    // (the server passes ChecksumSHA256 into the PutObjectCommand before
    // signing) and R2 validates it against the uploaded body itself.
    // Resending it as an `x-amz-*` header here is unsigned and makes R2
    // reject the request with SignatureDoesNotMatch — verified against the
    // real bucket, do not re-add it.
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Storage rejected the upload (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new UploadCancelledError());

    xhr.send(blob);
  });
}
