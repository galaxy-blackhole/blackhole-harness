<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README @galaxy-blackhole/gbh-host-frontend-static
-->

# @galaxy-blackhole/gbh-host-frontend-static

Port 1:1 `@deepseek-ai/dsh-host-frontend-static` (**99 dòng**) — **SPA dist server chạy TRÊN webserver** của ta.

## Quan hệ với `web-frontend` (Lead hỏi)
- `@deepseek-ai/dsh-web-frontend` là gói **CHỈ CÓ `dist/`** (`exports: {"./dist/*": "./dist/*"}`, `files: ['dist', '!dist/**/*.map', …]`) ⇒ **0 dòng code để port**.
- `dsh-host-frontend-static` **phục vụ chính `dist/` đó**: JSDoc gói ghi *“SPA dist server over the webserver … `distIndex` is typically supplied through …”*,
  và `Config = z.object({ distIndex: z.string().required() })` ⇒ **BẮT BUỘC** có `distIndex` trỏ tới `index.html` trong `web-frontend/dist`.
- Hành vi bảo mật giữ nguyên: index render ở dist root + index path; thiếu path ⇒ **404**; **traversal ra ngoài dist root ⇒ 403**; asset không phải index ⇒ public.

## Số đo
| phép đo | kết quả |
|---|---|
| lib/index.js | **99 dòng** · **byte-identical** (3 lát) |
| id stock | **2** lần, cả hai ở **JSDoc** (dòng 6 + 16) ⇒ artefact 0 lần đổi tên |
| exports | `Config` · `apply` · `inject` · `name` · `serveStatic` |
| row trong dump | **KHÔNG** (gói thư viện của `web-app`) |

## Nợ / việc Lead xử lý ở tầng matrix
1. `web-frontend`: **không port code**, chỉ đóng gói `dist/` khi build app (Lead ghi chú ở matrix).
2. Gói này cần `distIndex` từ composing app khi dùng thật; hiện chỉ port hành vi.
