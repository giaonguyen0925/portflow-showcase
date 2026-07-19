"use client";

import { Button } from "@/components/ui/button";
import type { Asset } from "@/modules/asset/domain/asset";
import { UploadDropzone } from "@/modules/asset/presentation/upload-dropzone";
import {
  MAX_COLUMNS,
  MIN_COLUMNS,
  type RowBlock,
} from "@/modules/layout/domain/blocks";
import {
  ColumnEditor,
  type RenderBlockEditor,
} from "@/modules/layout/presentation/column-editor";
import { columnGridClass } from "@/modules/layout/presentation/rows-view";
import type { RichTextDocument } from "@/modules/rich-text/domain/rich-text-document";

export function RowEditor({
  row,
  scopeId,
  onColumnCountChange,
  onUploadAsset,
  onAddText,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddTextToColumn,
  onUploadToColumn,
  onUpdateRichText,
  onRemoveBlock,
  renderBlockEditor,
}: {
  row: RowBlock;
  scopeId: string;
  onColumnCountChange: (count: number) => void;
  onUploadAsset: (asset: Asset) => void;
  onAddText: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: (() => void) | undefined;
  onMoveDown: (() => void) | undefined;
  onAddTextToColumn: (columnId: string) => void;
  onUploadToColumn: (columnId: string, asset: Asset) => void;
  onUpdateRichText: (
    columnId: string,
    blockId: string,
    content: RichTextDocument,
  ) => void;
  onRemoveBlock: (columnId: string, blockId: string) => void;
  renderBlockEditor?: RenderBlockEditor | undefined;
}) {
  return (
    <div className="group rounded-xl border border-transparent p-2 hover:border-border">
      <div className="mb-2 flex flex-wrap items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <div className="flex items-center rounded-md border border-border">
          {Array.from({ length: MAX_COLUMNS - MIN_COLUMNS + 1 }, (_, i) => i + MIN_COLUMNS).map(
            (count) => (
              <button
                key={count}
                type="button"
                aria-label={`${count} column${count > 1 ? "s" : ""}`}
                aria-pressed={row.columns.length === count}
                onClick={() => onColumnCountChange(count)}
                className={`px-2 py-1 text-xs ${
                  row.columns.length === count
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                {count}
              </button>
            ),
          )}
        </div>
        <UploadDropzone
          scope={`row:${scopeId}:${row.id}`}
          label="Upload media"
          onAsset={onUploadAsset}
        />
        <Button type="button" variant="outline" size="xs" onClick={onAddText}>
          Add text
        </Button>
        <Button type="button" variant="outline" size="xs" onClick={onDuplicate}>
          Duplicate row
        </Button>
        {onMoveUp ? (
          <Button type="button" variant="ghost" size="xs" aria-label="Move row up" onClick={onMoveUp}>
            ↑
          </Button>
        ) : null}
        {onMoveDown ? (
          <Button type="button" variant="ghost" size="xs" aria-label="Move row down" onClick={onMoveDown}>
            ↓
          </Button>
        ) : null}
        <Button
          type="button"
          variant="destructive"
          size="xs"
          onClick={onDelete}
        >
          Delete row
        </Button>
      </div>

      <div className={`grid items-start gap-3 ${columnGridClass(row.columns.length)}`}>
        {row.columns.map((column) => (
          <ColumnEditor
            key={column.id}
            column={column}
            scopeId={scopeId}
            rowId={row.id}
            onAddText={() => onAddTextToColumn(column.id)}
            onUpload={(asset) => onUploadToColumn(column.id, asset)}
            onUpdateRichText={(blockId, content) =>
              onUpdateRichText(column.id, blockId, content)
            }
            onRemoveBlock={(blockId) => onRemoveBlock(column.id, blockId)}
            renderBlockEditor={renderBlockEditor}
          />
        ))}
      </div>
    </div>
  );
}
