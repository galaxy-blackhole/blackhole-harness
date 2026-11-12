<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README của @galaxy-blackhole/gbh-client-ui-session: nguồn đối chiếu G4, hợp đồng seam, bằng chứng đối chứng
-->

# @galaxy-blackhole/gbh-client-ui-session

Bản viết lại của Galaxy Blackhole cho row **ui-session** của DSH — adapter Session Controller cho React.
Row **bán kính nổ 18**: 18 row khác inject nó, nên phép kiểm phải chứng minh **hệ quả**, không chỉ row chạy.

## 0. Con số 1.140 dòng và sự thật của nó

| Vùng trong `lib/client.js` gốc | Dòng | Là gì |
|---|---|---|
| `../../util/values/src/partial-json.ts` + `index.ts` | 11-707 | **Thư viện `@deepseek-ai/dsh-util-values` được BUNDLER inline** (assertNever · WeakMapWithValues · partial-json) — không phải code row |
| `session-provider.js` | 708-719 | Code row: hàm render vùng Session |
| `client/index.js` | 720-1132 | Code row: adapter đầy đủ (miền tương tác, nguồn gốc, phạm vi, apply) |

⇒ **code row thật ≈ 425 dòng**; phần còn lại là thư viện inline. Bản viết lại của ta:
`values.ts` (tự viết lại `WeakMapWithValues` — 82 dòng) · `session-provider.ts` · `ui-session.ts` (lõi) · `plugin.ts` · `client.ts` · `index.ts`.

## 1. Ba bundle / bề mặt

| File build ra | Vai trò |
|---|---|
| `lib/index.js` | Nửa host: `export function apply(): void {}` — y hệt bản gốc (index.js gốc 6 dòng, chỉ có `apply` rỗng) |
| `lib/client.js` | **Script classic** (CJS bọc `__ModuleLoader__.load`) đăng ký **HAI id**: của ta + gốc |
| factory trả về | `{ UiSession, apply, inject }` — **ĐÚNG bề mặt bản gốc** (không chỉ `{apply, inject}`) |

⚠️ **Bài học đã trả giá**: ban đầu tôi chỉ trả `{apply, inject}` như các row trước; **test đối chứng bắt ngay** vì tôi so bề mặt export với chính bundle gốc. Bundle khác có thể `require` lớp `UiSession` từ module này.

`dsh.client.inject` (cấp ROW) giữ nguyên 4 id của bản gốc: `dsh-api-remote-access · dsh-api-remotes · dsh-api-session-controller · dsh-client-ui-renderer` · `platform: web`. `inject` (cấp service) = `["sessions","slots","remote","remoteAccess"]`.

## 2. Hợp đồng seam (đúng cái test bắt được khi tôi làm sai)

- `sessions.binding(sessionId)` trả **đối tượng binding** `{ sessionId, session, ctx }` — KHÔNG phải đối tượng phiên. Row phải dùng **nguyên vẹn** đối tượng đó: `binding.session` (có `projections.faceOf`), `binding.sessionId`, `binding.ctx` (để gắn vòng đời liên kết). Tôi từng tự dựng `session: owner` ⇒ sai.
- Hàng trong `sessions.list` có trường **`id`**; bản gốc chọn phiên chính bằng `Object.values(byId).find((c) => (c.retainedBy.mainView ?? 0) > 0)?.id`. Tôi từng dùng `Object.keys(byId)` ⇒ chọn sai khi hàng thiếu `id`.
- Cả hai lệch trên **chỉ lộ ra khi stub có ĐÚNG hình dạng module thật** — đúng luật nhóm đã ghi.

## 3. Bằng chứng đối chứng (5/5 XANH, so với chính bundle gốc)

| Phép kiểm | Nội dung |
|---|---|
| Hình dạng bundle | hai id đúng thứ tự · không ESM |
| Bề mặt export | `{UiSession, apply, inject}` trùng · `inject` trùng · `inject` = 4 dịch vụ |
| `apply()` | nhãn hiệu ứng · sự kiện remote · tên hook gốc · tên hook theo khoá · tên phạm vi · khoá adapter · nguồn `current` — **TRÙNG từng mục** |
| Trạng thái + tương tác | ảnh chụp `sessionStatus` trước/sau công bố · sau khi bỏ công bố · **thông điệp lỗi khoá trùng** |
| Liên kết + cây render | liên kết vắng mặt · liên kết đã vật chất hoá · cây render nhánh rỗng và nhánh có phiên |

Chạy: `bun test tests/client/ui-session.test.ts` · probe in khác biệt: `.parity/features/probe/uisession-diff.ts`.

## 4. Nhật ký

| Thời điểm | Việc | Kết quả |
|---|---|---|
| 17/10/2026 18:0x | Scaffold + đo gói gốc | 1.140 dòng bundle nhưng **code row ≈ 425 dòng** (700 dòng là util/values inline) |
| 17/10/2026 18:1x | Viết lại 6 module | values · session-provider · ui-session (715 dòng) · plugin · client · index |
| 17/10/2026 18:1x | Test đối chứng | phát hiện 3 lệch thật (thiếu export `UiSession` · sai hình dạng binding · sai cách chọn phiên chính) ⇒ sửa ⇒ **5/5 xanh** |
| 17/10/2026 18:2x | Lab riêng | (đang chạy) |


## 5. BÀI HỌC ĐÃ TRẢ GIÁ: MODULE ≠ SERVICE (lỗi 9 console của app, 17/10 18:2x)

**Triệu chứng**: app thật có **9 lỗi console** dạng `slots.bindStoreScope is not a function` tại `UiSession.createMaterializedBinding`; hai người khác đã loại trừ row của họ bằng cách gỡ + restart (lỗi y nguyên).

**Nguyên nhân (đã tra bằng grep, không đoán)**: `bindStoreScope` chỉ có ở **hai** bundle gốc — `@deepseek-ai/dsh-client-ui-renderer` (**định nghĩa**, method của lớp cài service `slots`) và `@deepseek-ai/dsh-client-ui-session` (người gọi). Nó **KHÔNG có** trong module `@galaxy-blackhole/gbh-client-ui-slots` (0 lần).

⇒ **Module và service là hai thứ khác nhau.** Row `ui-session` `require("@galaxy-blackhole/gbh-client-ui-slots")` để lấy `standardHookPropName` (hàm của MODULE) — nhưng `bindStoreScope` là method của **SERVICE** `ctx.slots`. Bản đầu tôi gọi trên module ⇒ nổ. Bản gốc gọi `this.ctx.slots.bindStoreScope(value)`.

**LUẬT CHO MỌI ROW SAU**: khi một lời gọi giống nhau xuất hiện ở cả `require(...)` và `ctx.<service>`, phải grep **nơi ĐỊNH NGHĨA** trong bundle gốc rồi gọi đúng tầng. Phép kiểm bắt được lỗi này là **lab + đếm lỗi console** — unit test không bắt được (stub của tôi có cả hai đường nên xanh).

**Bằng chứng sau khi sửa** (lab riêng cổng 5463, gói ta thay row `ui-session`): trang 49.505 B · có `__DSH_BOOT__` · id của ta trong boot payload · **lỗi console: 0** (trước: 9) · **0** dòng `did not activate` · test 5/5 xanh.


## 6. MOUNT + NGHIỆM THU TRÊN APP THẬT (17/10/2026 18:38) — ĐÃ XONG

| Lớp | Kết quả |
|---|---|
| Mount | Lead gom vào lượt boot: chỉ số (6) **23 gói của ta đang chạy**, có `gbh-client-ui-session` |
| (5) `did not activate` | **0** |
| (8) render | `#root` **99.183 ký tự · 0 lỗi console** — **9 lỗi cũ đã hết** sau khi sửa MODULE ≠ SERVICE |
| (9) bố cục | ĐẠT (1/80 phần tử lệch 1 px — đường nền) |
| A/B pixel | `session-open` **0/1.075.392 px** (PASS) · `settings-general` **0/1.119.744 px** (PASS) |
| Phần tử lạ | `session-open` **ours +0 · ref +0** · `settings-general` **ours +0 · ref +0** |
| Ảnh | `.parity/features/2026-10-17T11-38-54` |

Ca `session-open` được tm-host-api yêu cầu riêng (họ mount `ui-jobs` và cần biết row của họ có làm xê dịch hàng đầu session không): **không xê dịch** — 0 px và 0/0 phần tử lạ.

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-session` (shasum `en b55af0064c8f...` · `zh 1eedf25abddd...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
