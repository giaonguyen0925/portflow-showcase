# Portflow Showcase

Website portfolio tối giản cho một designer/team nhỏ: một portfolio, một admin, không database. Toàn bộ JSON và ảnh nằm trên Cloudflare R2, đăng nhập admin qua Cloudflare Access, deploy trên Vercel.

Tài liệu kiến trúc đầy đủ: [ARD-portflow-showcase.md](./ARD-portflow-showcase.md).

## Surface

| Route | Mô tả |
| --- | --- |
| `/` | Portfolio public (release đã publish) |
| `/{projectSlug}` | Chi tiết project đã publish |
| `/admin` | Trang quản trị duy nhất (Cloudflare Access + JWT verification) |
| `/api/admin/*` | Write API, bắt buộc `requireAdmin()` |

## Local development

```bash
pnpm install
cp .env.example .env.local   # rồi điền giá trị thật
pnpm dev
```

`.env.local` hiện có sẵn placeholder — cần cập nhật trước khi upload/publish hoạt động:

- `ADMIN_EMAIL` — email admin duy nhất được phép.
- `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUDS` — từ Cloudflare Zero Trust (hai Access applications cho `/admin*` và `/api/admin*`, lấy Audience tags, phân tách bằng dấu phẩy).
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — API token R2 quyền tối thiểu trên 2 bucket.
- `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BUCKET`, `R2_PUBLIC_BASE_URL` — bucket private (JSON) + bucket public (ảnh) + custom domain của bucket public.
- `UPLOAD_TOKEN_SECRET` — chuỗi ngẫu nhiên ≥ 32 ký tự.

Khi dev local, `DEV_ADMIN_BYPASS=true` (đặt trong `.env.development.local`, chỉ được load khi `next dev`) cho phép vào `/admin` không cần Cloudflare Access. **Chỉ hoạt động với `NODE_ENV=development`** — build sẽ fail nếu biến này là `true` trong môi trường build/Preview/Production.

## Scripts

```bash
pnpm dev          # dev server
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest unit + application tests
pnpm test:e2e     # playwright (cần dev server / R2 test bucket)
pnpm build        # production build
pnpm check        # lint + typecheck + test + build
```

## Kiến trúc nhanh

- `src/modules/{site,project,asset,publishing,access}` — DDD-lite: `domain` (schema Zod, invariant), `application` (use case + port), `infrastructure` (R2/Cloudflare adapter), `presentation` (React).
- `src/lib` — env (Zod, server-only), R2 ObjectStore + key builder, API error contract, rate limit, logger.
- `src/stores` — Zustand: `upload-store` (queue upload, concurrency 3), `admin-ui-store`.
- Nội dung: draft → (Save, revision check) → R2 private; Publish tạo release snapshot bất biến, ghi `content/current.json` sau cùng — publish fail không ảnh hưởng release đang chạy.
- Upload: warm-up (presigned PUT 90s + finalize token) → browser PUT thẳng lên R2 staging → complete (verify checksum/size, copy sang public bucket, idempotent).

## Deploy (tóm tắt — chi tiết xem ARD §27)

1. **R2**: tạo 2 bucket (private/public), API token quyền tối thiểu, gắn custom domain cho bucket public, cấu hình CORS cho origin app (PUT + header `content-type`, `x-amz-checksum-sha256`), lifecycle rule tự xóa `uploads/staging/*`.
2. **Cloudflare Access**: 2 self-hosted applications (`/admin*`, `/api/admin*`), policy allow đúng `ADMIN_EMAIL`, lấy cả 2 Audience tags bỏ vào `CF_ACCESS_AUDS`.
3. **Vercel**: import repo, đặt env riêng cho Preview/Production (không bật `DEV_ADMIN_BYPASS`), gắn production domain qua Cloudflare proxy.
4. Kiểm tra: vào `/admin` qua domain Cloudflare (login OTP/IdP); gọi thẳng `*.vercel.app/api/admin/content` phải trả `401`.

## Troubleshooting

- **401 UNAUTHENTICATED trên `/admin`** — request không đi qua Cloudflare proxy hoặc thiếu header `Cf-Access-Jwt-Assertion`; kiểm tra DNS proxy (đám mây cam) và Access application path.
- **403 FORBIDDEN** — đăng nhập bằng email khác `ADMIN_EMAIL`.
- **Upload fail ngay khi PUT** — kiểm tra CORS của bucket private (origin app, method PUT, headers `content-type`, `x-amz-checksum-sha256`).
- **`STORAGE_UNAVAILABLE`** — credential R2 sai hoặc bucket không tồn tại; xem server logs (JSON, có `requestId`).
- **Build fail `DEV_ADMIN_BYPASS`** — biến này đang `true` ở môi trường không phải development; xóa khỏi Vercel env.
- **409 REVISION_CONFLICT khi Save** — nội dung đã bị sửa ở tab khác; reload trang admin.
