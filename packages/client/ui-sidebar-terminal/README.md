<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README của @galaxy-blackhole/gbh-client-ui-sidebar-terminal: nguồn đối chiếu G4, hai bundle, bằng chứng nghiệm thu
-->

# @galaxy-blackhole/gbh-client-ui-sidebar-terminal

Bản viết lại của Galaxy Blackhole cho row **ui-sidebar-terminal** của DSH. Row **HAI MẶT** và là row
**duy nhất có CHUNK LAZY**: tab terminal ở sidebar phải, màn xterm chỉ được nạp khi panel thật sự mở.

## 0. Con số 14.022 dòng và sự thật của nó

| File gói gốc | Số dòng | Là gì |
|---|---|---|
| `lib/client.js` | 497 | **Code thật của row** (nay đo được: **505** dòng cả nửa host) |
| `lib/client.terminal.js` | 13.516 | **Chunk lazy**: ~13.070 dòng là thư viện `@xterm/xterm` 6.0.0 + `@xterm/addon-fit` 0.11.0; code row trong chunk chỉ ~440 dòng |

## 1. Ba bundle và cách nạp

| File build ra | Vai trò |
|---|---|
| `lib/index.js` | Nửa host: `export function apply(): void {}` — giống hệt bản gốc |
| `lib/client.js` | Entry: script classic đăng ký **hai id** (của ta + gốc) dùng chung một factory |
| `lib/client.terminal.js` | **Chunk lazy**: tự khai `{ id, chunk: "client.terminal.js", factory }`; xterm + addon-fit được **bundle bên trong** (kiểm: có tham chiếu xterm, **0** `require("@xterm/xterm")` lúc chạy) |

Entry nạp chunk bằng `react.lazy(async () => ({ default: (await require.async("./client.terminal.js")).TerminalBody }))` — đúng khuôn của bản gốc. `bh host` copy `lib/*.js` nên chunk được copy tự động.

## 2. Nguồn đối chiếu (G4)

| Hành vi | Nguồn gốc (chỉ đọc) |
|---|---|
| CSS TerminalGuide + bảng lớp | `lib/client.js` dòng 10-32 |
| TerminalGuide (nút mở tab · menu chọn shell · ShortcutKeys) | dòng 33-164 |
| LazyTerminalBody (react.lazy + Suspense) | dòng 165-179 |
| TerminalIcon (SVG gốc) | dòng 180-201 |
| CSS TerminalTitle | dòng 202-216 |
| TerminalTitle (đổi tên tại chỗ bằng double-click) | dòng 217-283 |
| Từ điển 28 khoá × 2 ngôn ngữ | dòng 284-347 |
| `inject` 7 dịch vụ | dòng 348-358 |
| `apply`: giữ tab · shortcut `terminal.new` · kiểu tab · close handler · **3 slot** | dòng 359-490 |
| TerminalTheme (OSC 4/10/11/12) | `lib/client.terminal.js` dòng 13076-13204 |
| observeTerminalCursor | dòng 13205-13258 |
| TerminalBody + TerminalScreen | dòng 13259-13516 |

## 3. Phụ thuộc

`@xterm/xterm@^6.0.0` + `@xterm/addon-fit@^0.11.0` khai trong **devDependencies của chính gói** (y hệt bản gốc) và được bundle vào chunk ⇒ app **không** thêm phụ thuộc runtime; `node_modules` của gói là dev-only, không ship.

## 4. Bằng chứng nghiệm thu

1. **6/6 test XANH**, gồm 4 phép đối chứng với chính bundle gốc: từ điển trùng từng chuỗi · cấu trúc đăng ký (phím tắt/kiểu tab/3 slot/close handler) trùng · **cây render TerminalGuide + TerminalTitle trùng từng dòng** · hình dạng hai bundle (id · `chunk:` · xterm nội bộ · không ESM).
2. `check:rows`: gói này 0 vấn đề · `bun run gate`: **6/6 XANH**.
3. Lab cách ly (cổng 5460, có cả chunk): 0 dòng `did not activate` · entry 73 với id ta, id gốc mất · `#root` 57.510 = đường nền · 0 lỗi console.
4. **Phép kiểm DUY NHẤT bắt được chunk hỏng — mở panel terminal rồi đọc DOM** (trên app thật): **1 panel** `[data-sidebar-terminal]` · **1 node `.xterm`** · **có `.xterm-screen` với 61 hàng** · mạng: `api/terminal/environment` và `api/terminal/list` đều **200** · **0 lỗi console**. `.xterm-screen` chỉ tồn tại nếu xterm trong chunk đã tải và mount ⇒ chunk chạy thật.
5. A/B pixel + phần tử lạ: `session-open` · `plugins-installed` · `settings-general` — **0 px cả ba màn** · **phần tử lạ ours +0 · ref +0** · ảnh `.parity/features/2026-10-17T09-17-17/`.

## 5. Ghi chú phương pháp (cho row sau)

- `check:app` chỉ số (8)/(9) **không** bắt được chunk lazy hỏng: entry vẫn xanh, bảng vẫn ĐẠT, panel trắng. Phải **mở panel và đọc DOM** (`[data-sidebar-terminal]` + `.xterm-screen`).
- Dò chunk bằng URL đoán là **vô hiệu**: chunk của bản gốc cũng trả 404 với cùng cách dò. Đường đúng là để bộ nạp tự nạp qua `require.async`.

## 6. Nhật ký

| Thời điểm | Việc | Kết quả |
|---|---|---|
| 17/10/2026 16:04 | Build ba đầu ra (entry + chunk có xterm) | client.js 19,6 KB · client.terminal.js 499 KB · index.js 52 B |
| 17/10/2026 16:12 | 6 test + gate | 6/6 XANH · gate **6/6 XANH** |
| 17/10/2026 16:16 | Lab cách ly cổng 5460 | entry 73 · id ta có, id gốc mất · #root 57.510 · 0 lỗi console |
| 17/10/2026 16:18 | **Mở panel terminal, đọc DOM** | 1 panel · .xterm-screen 61 hàng · api/terminal 200 · 0 lỗi console |
| 17/10/2026 16:17 | A/B ba màn | **0 px · 0/0** |

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-sidebar-terminal` (shasum `en 9c64c05e7d55...` · `zh 104a3df8003d...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
