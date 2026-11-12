<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo chuyển đổi row deepseek-account (gói dsh-deepseek-account-platform) — uỷ quyền DeepSeek qua
      trình duyệt bằng PKCE; tách VENDOR (protocol/details/logout) khỏi SERVICE (PlatformAccount)
-->

# @galaxy-blackhole/gbh-account-platform — row `deepseek-account`

Bản viết lại 1:1 của `@deepseek-ai/dsh-deepseek-account-platform` (1.145 dòng bundle host): cấp
implementation `PlatformAccount` cho service `deepseekAccount` — **uỷ quyền tài khoản DeepSeek qua trình
duyệt bằng PKCE**, giữ grant trong `ctx.credentials`, gia hạn/xoá phiên, đọc chi tiết/ví/bonus.

## 0. Năm câu hỏi bắt buộc (§4f)

1. **Row này làm gì?** Provider `deepseekAccount` bản Platform: login PKCE qua trình duyệt, exchange code,
   lưu grant (2 credential key), refresh/hạn dùng, logout có retry, chi tiết tài khoản/ví/bonus, headers
   Platform (kèm Cookie hợp nhất), locale wire.
2. **Row nằm ở đâu?** TOP-LEVEL · id **`deepseek-account`** (KHÔNG phải tên gói) · name
   `@deepseek-ai/dsh-deepseek-account-platform` · config `desktopPlatform: !!js (profileContext==='desktop' &&
   darwin|win32 ? platform : null)` · KHÔNG disabled (dumps 88–93).
3. **Hai mặt?** **KHÔNG**: package.json gốc không có khoá `dsh` (không `dsh.client`, không `lib/client.js`).
4. **Trùng service/row?** `PlatformAccount extends DeepSeekAccount` cấp service `deepseekAccount`; gói nền
   `@galaxy-blackhole/gbh-deepseek-account` của ta **không khai row** ⇒ mount row này là THAY lớp cấp, không
   đăng ký trùng. Hàng đợi tiêu thụ: `account-controller`, `llm-deepseek-account`, UI settings.
5. **Khai `gbh.row`?** Có, SAU khi `lab:row` ĐẠT: `{ id: 'deepseek-account', config: { desktopPlatform: {js: <đúng
   biểu thức oracle>} }, tests }` — mirror ĐÚNG `!!js` của oracle (không hard-code giá trị).

## 1. Tách VENDOR khỏi code thật

| Lớp | Tệp | Nguồn gốc | Nội dung |
|---|---|---|---|
| VENDOR | `src/protocol.ts` (372) | stock 10–326 | `PlatformAuthError`/`AccountUnauthorizedError`, `platformOrigin`, `browserUrl`, `platformHeaders`, schema `initialization`/`exchange`, `requestPlatform/requestAccount/requestUnnotifiedBonuses/requestBonusNotified/logoutAccount`, `loginOrigin` |
| VENDOR | `src/details.ts` (193) | stock 327–457 | schema profile/ví/bonus + `profile`, `readAccountDetail`, `readUnnotifiedBonuses`, `sendBonusNotified` |
| VENDOR | `src/logout.ts` (44) | stock 458–486 | `revokeAccount` |
| VENDOR | `src/types.ts` (86) | `lib/types/*.d.ts` | `Config` (13 trường) + alias kiểu dùng chung |
| SERVICE | `src/platform.ts` (998) + `src/attempt.ts` (95) + `src/index.ts` (13) | stock 487–1145 | hằng credentials, schema grant/device, `Config` (schemastery), class `PlatformAccount` (PKCE · exchange · credentials · device · details · logout · listeners) |

**Export runtime đo trên ARTIFACT = gốc**: `Config` · `PlatformAccount` · `default` (`default === class`),
`static inject = ['credentials','authorization']`.

## 2. Peer + phụ thuộc

`peerDependencies` = kernel runtime: `cordis` · `dsh-deepseek-account` · `dsh-authorization` ·
`dsh-credentials` · `dsh-host-webserver` (`gbh.peers` = đúng tập này). `dependencies`: `schemastery` · `zod`.
`locale/{en,zh}.json` **byte-for-byte** (sha 82bec4d… / b1c95e0…).

## 3. Tác động nếu mount (nêu trước reviewer)

Thay provider `deepseekAccount`: đăng nhập/xoá phiên DeepSeek, grant trong credential store, chi tiết/ví/bonus.
Ảnh hưởng trực tiếp luồng đăng nhập + `account-controller` + `llm-deepseek-account` + UI settings. Vì vậy row
chỉ được khai sau `lab:row` ĐẠT và cần boot-smoke của Lead trước khi kết luận.

## 4. Số đo TRƯỚC → SAU

| Phép đo | TRƯỚC | SAU |
|---|---|---|
| gói GBH cho row `deepseek-account` | 0 | **1** (vendor 695 dòng + service 1.106 dòng) |
| export runtime artifact | — | **3/3 khớp gốc** (`default===class`) |
| tsc strict (toàn gói + build) | — | **0 lỗi** (kể cả `gate --no-tests --only typecheck`: XANH 1.997 file) |
| test A/B trên Context cordis THẬT | 0 ca | **30 ca · 30 pass · 577 expect** (991 dòng) |
| gate lint vùng này | — | **0 vi phạm** (header/file-length/jsdoc) |
| `check:rows` | 135 gói đạt | **135 gói · 0 chặn** |
| `lab:row account-platform` (home cách ly) | — | **DAT · #root 22.204 · console 0 · page 0 · did-not-activate 0/0 · overlay 0** (đo khi row đã khai; row đang hạ về `gbh.row_unmounted_ly_do` chờ dòng README §4z10 của Lead) |

## 5. Nợ kỹ thuật (nói thẳng)

- `platform.ts` kế thừa `DeepSeekAccount` từ **gói nền DSH** `@deepseek-ai/dsh-deepseek-account` (peer) — gói
  nền đã có bản port `@galaxy-blackhole/gbh-deepseek-account` nhưng bản đó **chưa export `./types`** và chưa
  được mount; khi gói nền được mount/khai row, phải đổi import sang `@galaxy-blackhole/gbh-deepseek-account`
  (thêm export `./types`) trong một task riêng.
- Chưa ship `./types` (chỉ kiểu) như gốc; `./src/*` là dev-only.
- Differential 53/53 phép so của lớp vendor (subagent đo với fetch giả) — logic giữ nguyên; khác biệt chỉ ở
  tầng kiểu (Branded<>, cast cho K tổng quát).