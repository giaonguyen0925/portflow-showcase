# ADR-0004: Row image cover + focal crop

| Thuộc tính | Giá trị |
| --- | --- |
| Trạng thái | Accepted |
| Ngày | 2026-07-20 |
| Phạm vi | Project/site row image rendering + image block schema. Không đổi upload protocol, R2 immutability, hay video encoding. |

## Bối cảnh

ARD §10 cấm `object-fit: cover` và crop ảnh project (giữ tỷ lệ gốc). Trong row nhiều cột, ảnh khác tỷ lệ làm chiều cao lệch; yêu cầu mới là khung đồng nhất theo ảnh cao nhất, hiển thị `cover`, và cho phép chỉnh vùng nhìn thấy kiểu crop avatar Facebook — mà không re-encode hay thay asset trên R2.

## Quyết định

- **Aspect gốc của row**: lấy media đầu tiên mỗi cột (image hoặc video); chọn cái có `height/width` lớn nhất (cao nhất khi cột cùng bề ngang). `aspect = width/height` của media đó. Mọi image/video ở vị trí media đầu cột dùng khung này.
- **Hiển thị**: khung `aspect-ratio` cố định + `cover` (không letterbox trắng).
- **Crop metadata** trên `ImageBlock` (optional): `{ x, y, zoom }` — tâm vùng nhìn (0–1) và hệ số zoom ≥ 1. Thiếu field = center, zoom 1. Asset gốc trên R2 không đổi.
- **Editor**: sau upload, image có nút Crop → dialog pan/zoom trong khung đúng aspect row (giống crop avatar FB). Video không có crop UI; vẫn nằm trong khung cover chung.

## Hệ quả

ARD §10 / acceptance “ảnh không crop” lỗi thời cho project/site row images. Draft JSON cũ không crop vẫn hợp lệ (optional field). Publish chỉ thêm field trên block; URL asset giữ nguyên.
