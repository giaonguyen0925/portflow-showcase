# ADR-0003: Video asset uploads (MP4/WebM, 25 MiB)

| Thuộc tính | Giá trị |
| --- | --- |
| Trạng thái | Accepted |
| Ngày | 2026-07-19 |
| Phạm vi | Upload protocol + asset/block schema. Không đổi auth, publish immutability, hay `publicAssetUrl(id)` semantics cho avatar/cover. |

## Bối cảnh

Upload V1 chỉ chấp nhận `image/webp` (preprocess client-side), key cố định `assets/{id}/original.webp`, max 20 MiB. Portfolio cần nhúng clip ngắn trong canvas mà không thay pipeline warm-up → staging → complete.

## Quyết định

- Content types: `image/webp` (giữ nguyên) + `video/mp4` + `video/webm`.
- Limits: ảnh 20 MiB; video **25 MiB**. Dimension max vẫn 12_000px (đọc từ metadata video).
- Public key: `assets/{assetId}/original.{webp\|mp4\|webm}` theo content type đã ký trong finalize token.
- Layout: thêm `type: "video"` block; cover/OG/`firstImageBlock` chỉ lấy `image`.
- Avatar dropzone vẫn `image/*`; `publicAssetUrl(base, id)` mặc định `.webp`.

## Hệ quả

ARD §8/§13/§18 (WebP-only, `original.webp`, 20 MiB cho mọi file) được nới đúng phạm vi video. Draft/release JSON ảnh cũ không cần migration.
