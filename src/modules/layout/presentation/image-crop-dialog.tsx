"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ImageAsset } from "@/modules/asset/domain/asset";
import {
  DEFAULT_IMAGE_CROP,
  MAX_IMAGE_CROP_ZOOM,
  MIN_IMAGE_CROP_ZOOM,
  normalizeImageCrop,
  resolveImageCropRect,
  type ImageCrop,
} from "@/modules/layout/domain/image-crop";

/**
 * Facebook-style avatar crop: fixed aspect window, drag to pan, slider to zoom.
 * Saves focal crop metadata; does not re-upload the asset (ADR-0004).
 */
export function ImageCropDialog({
  open,
  onOpenChange,
  asset,
  aspectRatio,
  initialCrop,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: ImageAsset;
  aspectRatio: number;
  initialCrop: ImageCrop | undefined;
  onSave: (crop: ImageCrop | undefined) => void;
}) {
  const [crop, setCrop] = useState<ImageCrop>(() =>
    normalizeImageCrop(initialCrop),
  );
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: ImageCrop;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setCrop(normalizeImageCrop(initialCrop));
    }
  }, [open, initialCrop]);

  function commitSave() {
    const normalized = normalizeImageCrop(crop);
    const isDefault =
      normalized.x === DEFAULT_IMAGE_CROP.x &&
      normalized.y === DEFAULT_IMAGE_CROP.y &&
      normalized.zoom === DEFAULT_IMAGE_CROP.zoom;
    onSave(isDefault ? undefined : normalized);
    onOpenChange(false);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: crop,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const viewport = viewportRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !viewport) return;

    const originRect = resolveImageCropRect(
      asset.width,
      asset.height,
      aspectRatio,
      drag.origin,
    );
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    if (viewportWidth <= 0 || viewportHeight <= 0) return;

    // Moving the image right reveals more of the left side → decrease focal x.
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const deltaX = -(dx / viewportWidth) * originRect.width;
    const deltaY = -(dy / viewportHeight) * originRect.height;

    const desired: ImageCrop = {
      x: drag.origin.x + deltaX,
      y: drag.origin.y + deltaY,
      zoom: drag.origin.zoom,
    };
    const clamped = resolveImageCropRect(
      asset.width,
      asset.height,
      aspectRatio,
      desired,
    );
    setCrop({
      x: clamped.left + clamped.width / 2,
      y: clamped.top + clamped.height / 2,
      zoom: drag.origin.zoom,
    });
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  const previewRect = resolveImageCropRect(
    asset.width,
    asset.height,
    aspectRatio,
    crop,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>Crop image</DialogTitle>
          <DialogDescription>
            Drag to reposition. Zoom in to tighten the frame. The frame matches
            the tallest media in this row.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={viewportRef}
          className="relative mx-auto w-full max-w-md cursor-grab touch-none overflow-hidden rounded-lg bg-black active:cursor-grabbing"
          style={{ aspectRatio: String(aspectRatio) }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- crop preview of R2 asset */}
          <img
            src={asset.url}
            alt=""
            draggable={false}
            className="absolute max-w-none select-none"
            style={{
              width: `${100 / previewRect.width}%`,
              height: `${100 / previewRect.height}%`,
              left: `${(-previewRect.left / previewRect.width) * 100}%`,
              top: `${(-previewRect.top / previewRect.height) * 100}%`,
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="image-crop-zoom">Zoom</Label>
            <span className="text-xs text-muted-foreground">
              {crop.zoom.toFixed(2)}×
            </span>
          </div>
          <input
            id="image-crop-zoom"
            type="range"
            min={MIN_IMAGE_CROP_ZOOM}
            max={MAX_IMAGE_CROP_ZOOM}
            step={0.01}
            value={crop.zoom}
            onChange={(event) => {
              const zoom = Number(event.target.value);
              setCrop((current) => {
                const desired = normalizeImageCrop({ ...current, zoom });
                const clamped = resolveImageCropRect(
                  asset.width,
                  asset.height,
                  aspectRatio,
                  desired,
                );
                return {
                  x: clamped.left + clamped.width / 2,
                  y: clamped.top + clamped.height / 2,
                  zoom: desired.zoom,
                };
              });
            }}
            className="w-full accent-primary"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCrop(DEFAULT_IMAGE_CROP)}
          >
            Reset
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={commitSave}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
