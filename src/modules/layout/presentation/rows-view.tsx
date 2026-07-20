import type { ReactNode } from "react";

import type { Block, RowBlock } from "@/modules/layout/domain/blocks";
import { rowMediaAspectRatio } from "@/modules/layout/domain/image-crop";
import {
  ImageMediaView,
  VideoMediaView,
} from "@/modules/layout/presentation/image-media-view";
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

/** Keep the authored column count at every viewport (WYSIWYG; columns shrink). */
export function columnGridClass(columnCount: number): string {
  if (columnCount <= 1) return "grid-cols-1";
  if (columnCount === 2) return "grid-cols-2";
  return "grid-cols-3";
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
      {rows.map((row) => {
        const mediaAspect = rowMediaAspectRatio(row);
        return (
          <div
            key={row.id}
            className={`grid items-start gap-4 ${columnGridClass(row.columns.length)}`}
          >
            {row.columns.map((column) => (
              <div key={column.id} className="flex flex-col gap-3">
                {column.blocks.map((block) => (
                  <BlockView
                    key={block.id}
                    block={block}
                    mediaAspect={mediaAspect}
                    renderBlock={renderBlock}
                  />
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function BlockView({
  block,
  mediaAspect,
  renderBlock,
}: {
  block: Block;
  mediaAspect: number | undefined;
  renderBlock?: RenderBlock | undefined;
}) {
  if (block.type === "image") {
    return (
      <ImageMediaView
        asset={block.asset}
        crop={block.crop}
        aspectRatio={mediaAspect}
      />
    );
  }
  if (block.type === "video") {
    return (
      <VideoMediaView asset={block.asset} aspectRatio={mediaAspect} />
    );
  }
  if (block.type === "rich-text") {
    return <RichTextView content={block.content} />;
  }
  return renderBlock?.(block) ?? null;
}
