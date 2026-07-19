import type { ReactNode } from "react";

import type { Block, RowBlock } from "@/modules/layout/domain/blocks";
import { RichTextView } from "@/modules/rich-text/presentation/rich-text-view";

/**
 * Read-only layout renderer, shared by the public pages and the editors'
 * preview mode. Deliberately NOT a client component so public pages never
 * pull editor code into their bundle.
 *
 * `renderBlock` lets a page supply renderers for blocks this module doesn't
 * know how to draw by itself (the site-only profile/project-grid blocks,
 * which need published site/manifest data). Unhandled block types render
 * nothing.
 */

export function columnGridClass(columnCount: number): string {
  if (columnCount <= 1) return "grid-cols-1";
  if (columnCount === 2) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
}

export type RenderBlock = (block: Block) => ReactNode | undefined;

export function RowsView({
  rows,
  renderBlock,
}: {
  rows: RowBlock[];
  renderBlock?: RenderBlock;
}) {
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
                <BlockView key={block.id} block={block} renderBlock={renderBlock} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function BlockView({
  block,
  renderBlock,
}: {
  block: Block;
  renderBlock?: RenderBlock | undefined;
}) {
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
  if (block.type === "video") {
    return (
      <video
        src={block.asset.url}
        width={block.asset.width}
        height={block.asset.height}
        controls
        playsInline
        preload="metadata"
        className="h-auto w-full"
        aria-label={block.asset.alt || undefined}
      />
    );
  }
  if (block.type === "rich-text") {
    return <RichTextView content={block.content} />;
  }
  return renderBlock?.(block) ?? null;
}
