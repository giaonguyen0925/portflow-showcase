"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Asset } from "@/modules/asset/domain/asset";
import {
  addBlockToColumn,
  deleteRowAt,
  duplicateRowAt,
  insertRowAfter,
  moveRowBy,
  placeBlockInRow,
  removeBlockFromColumn,
  setRowColumnCount,
  updateBlockInColumn,
} from "@/modules/layout/application/layout-mutations";
import {
  createMediaBlockFromAsset,
  createRichTextBlock,
} from "@/modules/layout/domain/block-factories";
import type { RowBlock } from "@/modules/layout/domain/blocks";
import {
  RowEditor,
} from "@/modules/layout/presentation/row-editor";
import type { RenderBlockEditor } from "@/modules/layout/presentation/column-editor";

export function RowsCanvas({
  rows,
  scopeId,
  onRowsChange,
  renderBlockEditor,
}: {
  rows: RowBlock[];
  /** Distinguishes upload queues between documents (e.g. the project id). */
  scopeId: string;
  onRowsChange: (rows: RowBlock[]) => void;
  renderBlockEditor?: RenderBlockEditor | undefined;
}) {
  /**
   * Multi-file "Upload media" for a whole row: fills this row's empty
   * columns left to right; once full, each further completed upload creates
   * its own new row with the same column count. Uploads complete out of
   * order, so with more overflow files than one row can hold you may get
   * several mostly-empty continuation rows instead of one fully packed
   * one — simpler and race-free, at the cost of some tidiness.
   */
  function handleRowUploadAsset(rowId: string, asset: Asset) {
    const index = rows.findIndex((r) => r.id === rowId);
    if (index === -1) return;
    onRowsChange(placeBlockInRow(rows, index, createMediaBlockFromAsset(asset)));
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
        <Button type="button" onClick={() => onRowsChange(insertRowAfter(rows, -1))}>
          + Add first row
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <div key={row.id}>
          <RowEditor
            row={row}
            scopeId={scopeId}
            onColumnCountChange={(count) =>
              onRowsChange(setRowColumnCount(rows, index, count))
            }
            onUploadAsset={(asset) => handleRowUploadAsset(row.id, asset)}
            onAddText={() =>
              onRowsChange(placeBlockInRow(rows, index, createRichTextBlock()))
            }
            onDuplicate={() => onRowsChange(duplicateRowAt(rows, index))}
            onDelete={() => onRowsChange(deleteRowAt(rows, index))}
            onMoveUp={
              index > 0 ? () => onRowsChange(moveRowBy(rows, index, -1)) : undefined
            }
            onMoveDown={
              index < rows.length - 1
                ? () => onRowsChange(moveRowBy(rows, index, 1))
                : undefined
            }
            onAddTextToColumn={(columnId) =>
              onRowsChange(addBlockToColumn(rows, index, columnId, createRichTextBlock()))
            }
            onUploadToColumn={(columnId, asset) =>
              onRowsChange(
                addBlockToColumn(rows, index, columnId, createMediaBlockFromAsset(asset)),
              )
            }
            onUpdateRichText={(columnId, blockId, content) =>
              onRowsChange(
                updateBlockInColumn(rows, index, columnId, blockId, (block) =>
                  block.type === "rich-text" ? { ...block, content } : block,
                ),
              )
            }
            onRemoveBlock={(columnId, blockId) =>
              onRowsChange(removeBlockFromColumn(rows, index, columnId, blockId))
            }
            renderBlockEditor={renderBlockEditor}
          />
          <div className="flex items-center gap-3 py-2">
            <Separator className="flex-1" />
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="shrink-0 text-muted-foreground"
              onClick={() => onRowsChange(insertRowAfter(rows, index))}
            >
              + Add row
            </Button>
            <Separator className="flex-1" />
          </div>
        </div>
      ))}
    </div>
  );
}
