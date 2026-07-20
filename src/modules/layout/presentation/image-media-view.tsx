import type { ImageAsset } from "@/modules/asset/domain/asset";
import type { ImageCrop } from "@/modules/layout/domain/image-crop";
import { resolveImageCropRect } from "@/modules/layout/domain/image-crop";

/**
 * Cover-framed image for row media bands. Uses crop metadata when present;
 * otherwise centers at zoom 1 (ADR-0004).
 */
export function ImageMediaView({
  asset,
  crop,
  aspectRatio,
  className,
  alt,
}: {
  asset: ImageAsset;
  crop?: ImageCrop | undefined;
  /** Target width/height. Defaults to the asset's native ratio. */
  aspectRatio?: number | undefined;
  className?: string | undefined;
  alt?: string | undefined;
}) {
  const targetAspect = aspectRatio ?? asset.width / asset.height;
  const rect = resolveImageCropRect(
    asset.width,
    asset.height,
    targetAspect,
    crop,
  );

  return (
    <div
      className={`relative w-full overflow-hidden ${className ?? ""}`}
      style={{ aspectRatio: String(targetAspect) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- R2 asset; crop via CSS rect (ADR-0004) */}
      <img
        src={asset.url}
        alt={alt ?? asset.alt}
        width={asset.width}
        height={asset.height}
        loading="lazy"
        draggable={false}
        className="absolute max-w-none"
        style={{
          width: `${100 / rect.width}%`,
          height: `${100 / rect.height}%`,
          left: `${(-rect.left / rect.width) * 100}%`,
          top: `${(-rect.top / rect.height) * 100}%`,
        }}
      />
    </div>
  );
}

export function VideoMediaView({
  asset,
  aspectRatio,
  className,
}: {
  asset: { url: string; width: number; height: number; alt: string };
  aspectRatio?: number | undefined;
  className?: string | undefined;
}) {
  const targetAspect = aspectRatio ?? asset.width / asset.height;

  return (
    <div
      className={`relative w-full overflow-hidden ${className ?? ""}`}
      style={{ aspectRatio: String(targetAspect) }}
    >
      <video
        src={asset.url}
        width={asset.width}
        height={asset.height}
        controls
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
        aria-label={asset.alt || undefined}
      />
    </div>
  );
}
