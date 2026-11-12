<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 25/10/2026
 desc ADR 0023 — vá mount để plugin bật sau vẫn có artefact (assets/ + lib/) và bật được bundle cục bộ
-->
# ADR 0023 — Mount: chép `assets/`, build skill-badge, và bật bundle cục bộ

## Bối cảnh

Trang *Plugin → Plugin thử nghiệm* cho **bật** bundle nhưng tính năng không chạy:

| Hiện tượng | Nguyên nhân thật (đo 25/10/2026) |
|---|---|
| Bật *Ghi công Galaxy Blackhole* → boot báo `1 entry did not activate` | `apps/cli/src/mount.ts` chỉ chép `lib/` + `locale/` + `package.json`, **KHÔNG chép `assets/`** ⇒ provider skill đọc `../assets/dsh-badge.md` và chết (`failed to import … lib/index.js`) |
| Gói `gbh-skill-badge` bị `check:rows` CHẶN | Gói chỉ có `lib/index.js`, không có `src/index.ts` **và không có `build.ts`** ⇒ không được coi là gói de-bundle |
| Bật *Tự động duyệt uỷ quyền* / *Worktree Git* → `Bật thất bại` | `DOI_TEN` trỏ tên bundle stock sang **row package** ⇒ `not-bundle`; sau khi tạo bundle thật thì lỗi chuyển thành `operation-error: cannot resolve profile …` vì **gói bundle chưa có trong profile** |
| `@deepseek-ai/…` + mô tả tiếng Anh trong "Thành phần" | `declaredRows` lấy meta của gói stock; chỉ `moduleName` được quy tên |

## Quyết định

1. `apps/cli/src/mount.ts`: chép thêm **`assets/`** (đúng khuôn khối `locale/`) ⇒ skill có nội dung.
2. `packages/host/skill-badge`: thêm **`build.ts`** thật (chép `lib/index.js` sang thư mục đích, chèn header
   artefact) ⇒ `check:rows` coi là de-bundle, và mount có `lib/` trong profile.
3. Tạo 2 bundle mỏng: `packages/host/bundle-auto-review`, `packages/host/bundle-tool-worktree`; `DOI_TEN`
   trỏ tên bundle stock sang chúng; **copy gói bundle + row package vào profile** và thêm vào
   `dsh.profile.bundles`. Nay `listPlugins` trả `include:auto-review`, `include:worktree`,
   `include:tool-worktree` đều `enabled: true`, tool `create_worktree` đã đăng ký.
4. `declaredRows`: tiêu đề = tên gói của ta, mô tả = bảng `ROW_META_VI` (tiếng Việt).

## Hệ quả

- `check:app`: (5) "did not activate" = **0**, app LANH; (8) 56.180 ký tự `#root`, 48 slot, 0 lỗi console.
- Kỹ năng ghi công phục vụ từ profile: `assets/dsh-badge.md` có "Power by Galaxy Blackhole" (3 lần).
- **Còn lại**: bật một bundle *chưa từng cài* vẫn cần bước copy gói bundle vào profile — hiện làm tay cho
  3 bundle; chuẩn hoá (mount tự copy mọi bundle cục bộ) là việc tiếp theo.
