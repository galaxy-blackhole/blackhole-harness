<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 25/10/2026
 desc ADR 0027 — bỏ ảnh xem trước plugin, sửa tên/icon row ghi công, row do bundle cắm không sinh app-patch, và panel setup của voice-input
-->
# ADR 0027 — Bốn lỗi trang Plugin (25/10/2026)

## 1. Bỏ ảnh xem trước tính năng

DSH nhúng sẵn hai ảnh preview (badge-skill, voice-input). Bản port nạp chúng từ hằng base64 và ảnh **không
render được** ⇒ hiện dòng đỏ "Không hiển thị được ảnh xem trước".

Đã bỏ: xoá `packages/client/ui-plugin-manager/src/assets-preview.ts`; gỡ `BUNDLE_PREVIEWS`, component
`PackagePreview` và chỗ render trong `page-detail.ts`; đồng thời vô hiệu hoá điểm tra preview trong artefact
đã de-bundle (`lib/client.js`, `src/parts/part-08.ts`: `const previews = undefined;`).

## 2. Row "Kỹ năng ghi công" không còn hiện "DSH"

- Tiêu đề row: thêm cặp `ROW_TITLE_VI` (`@galaxy-blackhole/gbh-skill-badge` → "Kỹ năng ghi công").
- Icon: khi có tên riêng, `declaredRows` **bỏ** `icon`/`artwork` của gói stock (icon stock vẽ chữ "DSH").

## 3. Bật bundle nhưng thành phần vẫn TẮT + hộp thoại "cấu hình ưu tiên cao hơn ghi đè"

Nguyên nhân: mount sinh app patch `- id: skill-badge / disabled: true` + `insert: skill-badge-ours` cho **mọi**
gói khai `gbh.row`, trong khi bundle của chính tính năng đó cũng cắm row ấy ⇒ hai tầng patch tranh nhau, tầng
app (ưu tiên cao hơn) thắng.

Đã thêm cờ `gbh.row.ownedByBundle: true`: `renderRewriteBlock` trả chuỗi rỗng ⇒ app patch **không** phát khối
disable/insert cho row ấy, bundle patch là nguồn duy nhất. Đặt cờ cho 15 gói row thuộc các bundle tính năng
(agent-team, auto-review, worktree, tool-worktree, skill-badge, inspector, plugin-market, cot-translation,
voice-input…).

Kết quả đo: app patch còn **0** khối `-ours` và **0** khối cho `skill-badge`; trang "Ghi công Galaxy Blackhole"
hiện bundle BẬT, thành phần "Kỹ năng ghi công · Đang chạy", bấm công tắc không còn hộp thoại lỗi.

## 4. Panel setup của voice-input không hiện

Client stock đăng ký slot `plugins.bundle.config` với `key` = **tên bundle stock**
(`@deepseek-ai/dsh-experimental-voice-input-bundle`); bundle của ta đổi tên ⇒ plugin-manager client không thấy
khoá đó nên không vẽ panel.

Đã vá điểm tính `configured` trong artefact de-bundle (`lib/client.js`, `src/parts/part-11.ts`):
`ledger.bundles.has(name) || ledger.bundles.has(GBH_BUNDLE_SLOT_ALIAS[name] ?? name)` với bảng alias
`gbh-voice-input-bundle → dsh-experimental-voice-input-bundle`.

Kết quả đo (bundle voice BẬT): `[data-plugin-config]` = **1** (panel "Input device / Recognition service /
Model download source / Download and prepare"); TẮT ⇒ 0.

### 4b. Panel hiện khung nhưng RỖNG, rồi báo ENOENT (đo lại 25/10/2026 lần 2)

- Khung `[data-plugin-config]` render nhưng `innerHTML` chỉ 72 ký tự: chỗ **vẽ** slot vẫn truyền
  `entryKey: pkg.name` (tên bundle của ta) trong khi client stock đăng ký slot bằng **tên bundle stock** ⇒
  không khớp. Vá tiếp điểm render trong artefact de-bundle + `src/parts/part-08.ts`.
- Sau khi khớp, thẻ chuẩn bị báo `ENOENT … @galaxy-blackhole/gbh-experimental-speech-to-text-sensevoice/runtime/assets.json`:
  mount chỉ chép `lib/`, `locale/`, `assets/` — **thiếu `runtime/`**. Đã thêm `runtime/` vào danh sách chép
  trong `apps/cli/src/mount.ts`.
- Chuỗi tiếng Việt trong panel còn nhắc "DSH": đổi 12 chuỗi ở `packages/client/locale/src/locales-vi.ts` và 1 chuỗi
  ở `ui-sidebar-documentpreview/src/locales-vi.ts` sang "Galaxy Blackhole".

## Rà soát: plugin nào có panel setup khi bật?

Quét mọi `lib/client.js` của gói stock: chỉ **2** bundle đăng ký `plugins.bundle.config` —
`dsh-experimental-voice-input-bundle` và `dsh-experimental-cot-translation-bundle`. Bản port: voice dùng alias
(như trên), cot-translation đã đăng ký đúng tên bundle của ta nên hiện bình thường.
