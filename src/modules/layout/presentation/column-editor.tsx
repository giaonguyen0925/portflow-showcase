"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { Asset } from "@/modules/asset/domain/asset";
import { UploadDropzone } from "@/modules/asset/presentation/upload-dropzone";
import type { Block, ColumnBlock, ImageBlock } from "@/modules/layout/domain/blocks";
import type { ImageCrop } from "@/modules/layout/domain/image-crop";
import { ImageCropDialog } from "@/modules/layout/presentation/image-crop-dialog";
import {
  ImageMediaView,
  VideoMediaView,
} from "@/modules/layout/presentation/image-media-view";
import { RichTextEditor } from "@/modules/rich-text/presentation/rich-text-editor";
import type { RichTextDocument } from "@/modules/rich-text/domain/rich-text-document";

/** Editor-side counterpart of RowsView's `renderBlock`, for system blocks. */
export type RenderBlockEditor = (block: Block) => ReactNode | undefined;

export function ColumnEditor({
  column,
  scopeId,
  rowId,
  mediaAspect,
  onAddText,
  onUpload,
  onUpdateRichText,
  onUpdateImageCrop,
  onRemoveBlock,
  renderBlockEditor,
}: {
  column: ColumnBlock;
  scopeId: string;
  rowId: string;
  /** Shared row media frame (width/height); undefined until the row has media. */
  mediaAspect: number | undefined;
  onAddText: () => void;
  onUpload: (asset: Asset) => void;
  onUpdateRichText: (blockId: string, content: RichTextDocument) => void;
  onUpdateImageCrop: (blockId: string, crop: ImageCrop | undefined) => void;
  onRemoveBlock: (blockId: string) => void;
  renderBlockEditor?: RenderBlockEditor | undefined;
}) {
  if (column.blocks.length === 0) {
    return (
      <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3">
        <UploadDropzone
          scope={`column:${scopeId}:${rowId}:${column.id}`}
          multiple={false}
          label="Upload image or video"
          onAsset={onUpload}
        />
        <Button type="button" variant="ghost" size="xs" onClick={onAddText}>
          Add text
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {column.blocks.map((block) => (
        <div key={block.id} className="group/block relative">
          <BlockEditor
            block={block}
            mediaAspect={mediaAspect}
            onUpdateRichText={onUpdateRichText}
            renderBlockEditor={renderBlockEditor}
          />
          <div className="absolute top-1 right-1 z-10 flex gap-1 opacity-0 transition-opacity group-hover/block:opacity-100 focus-within:opacity-100">
            {block.type === "image" ? (
              <ImageCropButton
                block={block}
                mediaAspect={mediaAspect}
                onSave={(crop) => onUpdateImageCrop(block.id, crop)}
              />
            ) : null}
            <Button
              type="button"
              variant="destructive"
              size="xs"
              onClick={() => onRemoveBlock(block.id)}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ImageCropButton({
  block,
  mediaAspect,
  onSave,
}: {
  block: ImageBlock;
  mediaAspect: number | undefined;
  onSave: (crop: ImageCrop | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const aspectRatio = mediaAspect ?? block.asset.width / block.asset.height;

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="xs"
        onClick={() => setOpen(true)}
      >
        Crop
      </Button>
      <ImageCropDialog
        open={open}
        onOpenChange={setOpen}
        asset={block.asset}
        aspectRatio={aspectRatio}
        initialCrop={block.crop}
        onSave={onSave}
      />
    </>
  );
}

function BlockEditor({
  block,
  mediaAspect,
  onUpdateRichText,
  renderBlockEditor,
}: {
  block: Block;
  mediaAspect: number | undefined;
  onUpdateRichText: (blockId: string, content: RichTextDocument) => void;
  renderBlockEditor?: RenderBlockEditor | undefined;
}) {
  if (block.type === "image") {
    return (
      <ImageMediaView
        asset={block.asset}
        crop={block.crop}
        aspectRatio={mediaAspect}
        className="rounded-md bg-muted"
      />
    );
  }
  if (block.type === "video") {
    return (
      <VideoMediaView
        asset={block.asset}
        aspectRatio={mediaAspect}
        className="rounded-md bg-muted"
      />
    );
  }
  if (block.type === "rich-text") {
    return (
      <RichTextEditor
        content={block.content}
        onChange={(content) => onUpdateRichText(block.id, content)}
      />
    );
  }
  return (
    renderBlockEditor?.(block) ?? (
      <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        Unsupported block
      </div>
    )
  );
}
