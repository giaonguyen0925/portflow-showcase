"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createBlockId, createColumnId, createRowId } from "@/lib/ids/ids";
import type { Asset } from "@/modules/asset/domain/asset";
import { UploadDropzone } from "@/modules/asset/presentation/upload-dropzone";
import {
  MAX_COLUMNS,
  MIN_COLUMNS,
  type Block,
  type ColumnBlock,
  type ImageBlock,
  type RowBlock,
  type TextBlock,
} from "@/modules/project/domain/blocks";

function createEmptyColumn(): ColumnBlock {
  return { id: createColumnId(), blocks: [] };
}

function createEmptyRow(columnCount: number): RowBlock {
  return {
    id: createRowId(),
    type: "row",
    columns: Array.from({ length: columnCount }, () => createEmptyColumn()),
  };
}

function createImageBlockFromAsset(asset: Asset): ImageBlock {
  return { id: createBlockId(), type: "image", asset };
}

function createTextBlock(): TextBlock {
  return { id: createBlockId(), type: "text", text: "" };
}

function columnGridClass(columnCount: number): string {
  if (columnCount <= 1) return "grid-cols-1";
  if (columnCount === 2) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
}

// ---------------------------------------------------------------------------
// Read-only rendering, shared by the public project page.
// ---------------------------------------------------------------------------

export function RowsView({ rows }: { rows: RowBlock[] }) {
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <div
          key={row.id}
          className={`grid items-start gap-4 ${columnGridClass(row.columns.length)}`}
        >
          {row.columns.map((column) => (
            <div key={column.id} className="flex flex-col gap-3">
              {column.blocks.map((block) => (
                <BlockView key={block.id} block={block} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  if (block.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- R2-hosted asset, no crop (ARD §10)
      <img
        src={block.asset.url}
        alt={block.asset.alt}
        width={block.asset.width}
        height={block.asset.height}
        loading="lazy"
        className="h-auto w-full"
      />
    );
  }
  return (
    <p className="whitespace-pre-line text-sm leading-6 text-zinc-600">
      {block.text}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Editable canvas, used by the admin project editor.
// ---------------------------------------------------------------------------

export function RowsCanvas({
  rows,
  projectId,
  onRowsChange,
}: {
  rows: RowBlock[];
  projectId: string;
  onRowsChange: (rows: RowBlock[]) => void;
}) {
  function updateRowAt(index: number, updater: (row: RowBlock) => RowBlock) {
    onRowsChange(rows.map((r, i) => (i === index ? updater(r) : r)));
  }

  function addRow(afterIndex: number, columnCount = 3) {
    const next = [...rows];
    next.splice(afterIndex + 1, 0, createEmptyRow(columnCount));
    onRowsChange(next);
  }

  function deleteRow(index: number) {
    onRowsChange(rows.filter((_, i) => i !== index));
  }

  function duplicateRow(index: number) {
    const source = rows[index];
    if (!source) return;
    const clone: RowBlock = {
      id: createRowId(),
      type: "row",
      columns: source.columns.map((column) => ({
        id: createColumnId(),
        blocks: column.blocks.map((block) => ({ ...block, id: createBlockId() })),
      })),
    };
    const next = [...rows];
    next.splice(index + 1, 0, clone);
    onRowsChange(next);
  }

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    onRowsChange(next);
  }

  function setColumnCount(index: number, count: number) {
    updateRowAt(index, (row) => {
      if (count === row.columns.length) return row;
      if (count > row.columns.length) {
        const additions = Array.from(
          { length: count - row.columns.length },
          () => createEmptyColumn(),
        );
        return { ...row, columns: [...row.columns, ...additions] };
      }
      // Reducing columns never deletes content: blocks from removed
      // trailing columns are merged into the last remaining column.
      const kept = row.columns.slice(0, count);
      const overflow = row.columns.slice(count).flatMap((c) => c.blocks);
      const lastIndex = kept.length - 1;
      return {
        ...row,
        columns: kept.map((c, i) =>
          i === lastIndex ? { ...c, blocks: [...c.blocks, ...overflow] } : c,
        ),
      };
    });
  }

  function addTextBlockToColumn(rowIndex: number, columnId: string) {
    updateRowAt(rowIndex, (row) => ({
      ...row,
      columns: row.columns.map((c) =>
        c.id === columnId ? { ...c, blocks: [...c.blocks, createTextBlock()] } : c,
      ),
    }));
  }

  function addTextBlockToRow(rowIndex: number) {
    const row = rows[rowIndex];
    if (!row) return;
    const emptyColIndex = row.columns.findIndex((c) => c.blocks.length === 0);
    if (emptyColIndex !== -1) {
      addTextBlockToColumn(rowIndex, row.columns[emptyColIndex]!.id);
      return;
    }
    const newRow = createEmptyRow(row.columns.length);
    const firstColumn = newRow.columns[0];
    if (firstColumn) {
      firstColumn.blocks = [createTextBlock()];
    }
    const next = [...rows];
    next.splice(rowIndex + 1, 0, newRow);
    onRowsChange(next);
  }

  function updateTextBlock(
    rowIndex: number,
    columnId: string,
    blockId: string,
    text: string,
  ) {
    updateRowAt(rowIndex, (row) => ({
      ...row,
      columns: row.columns.map((c) =>
        c.id === columnId
          ? {
              ...c,
              blocks: c.blocks.map((b) =>
                b.id === blockId && b.type === "text" ? { ...b, text } : b,
              ),
            }
          : c,
      ),
    }));
  }

  function removeBlock(rowIndex: number, columnId: string, blockId: string) {
    updateRowAt(rowIndex, (row) => ({
      ...row,
      columns: row.columns.map((c) =>
        c.id === columnId
          ? { ...c, blocks: c.blocks.filter((b) => b.id !== blockId) }
          : c,
      ),
    }));
  }

  function addImageToColumn(rowIndex: number, columnId: string, asset: Asset) {
    updateRowAt(rowIndex, (row) => ({
      ...row,
      columns: row.columns.map((c) =>
        c.id === columnId
          ? { ...c, blocks: [...c.blocks, createImageBlockFromAsset(asset)] }
          : c,
      ),
    }));
  }

  /**
   * Multi-file "Upload images" for a whole row: fills this row's empty
   * columns left to right; once full, each further completed upload creates
   * its own new row with the same column count. Uploads complete out of
   * order, so with more overflow files than one row can hold you may get
   * several mostly-empty continuation rows instead of one fully packed
   * one — simpler and race-free, at the cost of some tidiness.
   */
  function handleRowUploadAsset(rowId: string, asset: Asset) {
    const index = rows.findIndex((r) => r.id === rowId);
    if (index === -1) return;
    const row = rows[index];
    if (!row) return;
    const emptyColIndex = row.columns.findIndex((c) => c.blocks.length === 0);
    if (emptyColIndex !== -1) {
      addImageToColumn(index, row.columns[emptyColIndex]!.id, asset);
      return;
    }
    const newRow = createEmptyRow(row.columns.length);
    const firstColumn = newRow.columns[0];
    if (firstColumn) {
      firstColumn.blocks = [createImageBlockFromAsset(asset)];
    }
    const next = [...rows];
    next.splice(index + 1, 0, newRow);
    onRowsChange(next);
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
        <Button type="button" onClick={() => addRow(-1)}>
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
            projectId={projectId}
            onColumnCountChange={(count) => setColumnCount(index, count)}
            onUploadAsset={(asset) => handleRowUploadAsset(row.id, asset)}
            onAddText={() => addTextBlockToRow(index)}
            onDuplicate={() => duplicateRow(index)}
            onDelete={() => deleteRow(index)}
            onMoveUp={index > 0 ? () => moveRow(index, -1) : undefined}
            onMoveDown={index < rows.length - 1 ? () => moveRow(index, 1) : undefined}
            onAddTextToColumn={(columnId) => addTextBlockToColumn(index, columnId)}
            onUploadToColumn={(columnId, asset) => addImageToColumn(index, columnId, asset)}
            onUpdateText={(columnId, blockId, text) =>
              updateTextBlock(index, columnId, blockId, text)
            }
            onRemoveBlock={(columnId, blockId) => removeBlock(index, columnId, blockId)}
          />
          <div className="flex justify-center py-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => addRow(index)}
            >
              + Add row
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function RowEditor({
  row,
  projectId,
  onColumnCountChange,
  onUploadAsset,
  onAddText,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddTextToColumn,
  onUploadToColumn,
  onUpdateText,
  onRemoveBlock,
}: {
  row: RowBlock;
  projectId: string;
  onColumnCountChange: (count: number) => void;
  onUploadAsset: (asset: Asset) => void;
  onAddText: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: (() => void) | undefined;
  onMoveDown: (() => void) | undefined;
  onAddTextToColumn: (columnId: string) => void;
  onUploadToColumn: (columnId: string, asset: Asset) => void;
  onUpdateText: (columnId: string, blockId: string, text: string) => void;
  onRemoveBlock: (columnId: string, blockId: string) => void;
}) {
  return (
    <div className="group rounded-xl border border-transparent p-2 hover:border-border">
      <div className="mb-2 flex flex-wrap items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex items-center rounded-md border border-border">
          {Array.from({ length: MAX_COLUMNS - MIN_COLUMNS + 1 }, (_, i) => i + MIN_COLUMNS).map(
            (count) => (
              <button
                key={count}
                type="button"
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
          scope={`row:${projectId}:${row.id}`}
          label="Upload images"
          onAsset={onUploadAsset}
        />
        <Button type="button" variant="outline" size="xs" onClick={onAddText}>
          Add text
        </Button>
        <Button type="button" variant="outline" size="xs" onClick={onDuplicate}>
          Duplicate row
        </Button>
        {onMoveUp ? (
          <Button type="button" variant="ghost" size="xs" onClick={onMoveUp}>
            ↑
          </Button>
        ) : null}
        {onMoveDown ? (
          <Button type="button" variant="ghost" size="xs" onClick={onMoveDown}>
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
            projectId={projectId}
            rowId={row.id}
            onAddText={() => onAddTextToColumn(column.id)}
            onUpload={(asset) => onUploadToColumn(column.id, asset)}
            onUpdateText={(blockId, text) => onUpdateText(column.id, blockId, text)}
            onRemoveBlock={(blockId) => onRemoveBlock(column.id, blockId)}
          />
        ))}
      </div>
    </div>
  );
}

function ColumnEditor({
  column,
  projectId,
  rowId,
  onAddText,
  onUpload,
  onUpdateText,
  onRemoveBlock,
}: {
  column: ColumnBlock;
  projectId: string;
  rowId: string;
  onAddText: () => void;
  onUpload: (asset: Asset) => void;
  onUpdateText: (blockId: string, text: string) => void;
  onRemoveBlock: (blockId: string) => void;
}) {
  if (column.blocks.length === 0) {
    return (
      <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3">
        <UploadDropzone
          scope={`column:${projectId}:${rowId}:${column.id}`}
          multiple={false}
          label="Upload image"
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
          {block.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- R2 asset preview, kept at intrinsic ratio (ARD §10)
            <img
              src={block.asset.url}
              alt={block.asset.alt}
              width={block.asset.width}
              height={block.asset.height}
              className="h-auto w-full rounded-md bg-muted"
            />
          ) : (
            <TextBlockEditor
              block={block}
              onChange={(text) => onUpdateText(block.id, text)}
            />
          )}
          <Button
            type="button"
            variant="destructive"
            size="xs"
            className="absolute top-1 right-1 opacity-0 group-hover/block:opacity-100"
            onClick={() => onRemoveBlock(block.id)}
          >
            Remove
          </Button>
        </div>
      ))}
    </div>
  );
}

function TextBlockEditor({
  block,
  onChange,
}: {
  block: TextBlock;
  onChange: (text: string) => void;
}) {
  const [text, setText] = useState(block.text);

  return (
    <Textarea
      value={text}
      rows={4}
      placeholder="Text…"
      onChange={(event) => {
        setText(event.target.value);
        onChange(event.target.value);
      }}
    />
  );
}
