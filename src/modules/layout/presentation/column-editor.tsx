"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { Asset } from "@/modules/asset/domain/asset";
import { UploadDropzone } from "@/modules/asset/presentation/upload-dropzone";
import type { Block, ColumnBlock } from "@/modules/layout/domain/blocks";
import { RichTextEditor } from "@/modules/rich-text/presentation/rich-text-editor";
import type { RichTextDocument } from "@/modules/rich-text/domain/rich-text-document";

/** Editor-side counterpart of RowsView's `renderBlock`, for system blocks. */
export type RenderBlockEditor = (block: Block) => ReactNode | undefined;

export function ColumnEditor({
  column,
  scopeId,
  rowId,
  onAddText,
  onUpload,
  onUpdateRichText,
  onRemoveBlock,
  renderBlockEditor,
}: {
  column: ColumnBlock;
  scopeId: string;
  rowId: string;
  onAddText: () => void;
  onUpload: (asset: Asset) => void;
  onUpdateRichText: (blockId: string, content: RichTextDocument) => void;
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
            onUpdateRichText={onUpdateRichText}
            renderBlockEditor={renderBlockEditor}
          />
          <Button
            type="button"
            variant="destructive"
            size="xs"
            className="absolute top-1 right-1 z-10 opacity-0 group-hover/block:opacity-100"
            onClick={() => onRemoveBlock(block.id)}
          >
            Remove
          </Button>
        </div>
      ))}
    </div>
  );
}

function BlockEditor({
  block,
  onUpdateRichText,
  renderBlockEditor,
}: {
  block: Block;
  onUpdateRichText: (blockId: string, content: RichTextDocument) => void;
  renderBlockEditor?: RenderBlockEditor | undefined;
}) {
  if (block.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- R2 asset preview, kept at intrinsic ratio (ARD §10)
      <img
        src={block.asset.url}
        alt={block.asset.alt}
        width={block.asset.width}
        height={block.asset.height}
        className="h-auto w-full rounded-md bg-muted"
      />
    );
  }
  if (block.type === "video") {
    return (
      <video
        src={block.asset.url}
        width={block.asset.width}
        height={block.asset.height}
        controls
        playsInline
        preload="metadata"
        className="h-auto w-full rounded-md bg-muted"
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
