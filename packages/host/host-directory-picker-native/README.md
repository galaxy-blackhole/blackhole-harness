<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Backend native của seam directory-picker — bản viết lại 1:1 của @deepseek-ai/dsh-host-directory-picker-native
-->

# @galaxy-blackhole/gbh-host-directory-picker-native

Bản gốc: `@deepseek-ai/dsh-host-directory-picker-native` @0.2.1-alpha.4 — `lib/index.js` **340 dòng** + `lib/worker.cjs` **253 dòng**.

## Bề mặt export (1:1)

- `.` → `default` (class `NativeDirectoryPicker`) + `pickNativeDirectory(signal, internals?)`.
- **`./worker`** → `lib/worker.cjs` (**byte-identical** bản gốc, sha256 `434946b4a825fb5c…`); đây là tiến trình con mở `IFileOpenDialog`, spawn bằng `node` (plane built) hoặc qua `tsx` (plane source).

## Nền tảng

| Nền tảng | Cách mở | Ghi chú |
|---|---|---|
| macOS | `osascript -l JavaScript` chạy **JXA panel** (cài menu Edit trước khi mở `NSOpenPanel` để ⌘C/⌘V/⌘A/⌘X hoạt động) | test bằng runner giả (không mở UI) |
| Linux | `zenity --file-selection --directory`, lỗi `ENOENT` ⇒ thử `kdialog --getexistingdirectory`; cả hai thiếu ⇒ ném 'no supported native directory picker found' | test bằng runner giả |
| Windows | spawn `worker.cjs` (koffi/COM trên thread chính của con) + gửi `WM_CLOSE` để phục vụ abort | **không quan sát được trên macOS** — xem mục dưới |

## Vì sao test worker KHÔNG so byte stderr trên macOS

`worker.cjs` chỉ `import('koffi')` **bên trong** nhánh win32 (lazy) nên trên macOS nó **không nạp được binding COM** và không thể chạy hội thoại hộp thoại thật; spawn nó sẽ thoát mà không in stderr ổn định (không có hành vi để so byte). Vì vậy test khẳng định:
1. `src/worker.cjs` **byte-identical** gốc (sha256 so trực tiếp) — đây là bất biến mạnh hơn so stderr;
2. `spawn` worker bằng `node` với `DSH_DIALOG_TITLE` đặt trước, **so mã thoát + stderr của ta với bản gốc** dưới cùng điều kiện (A/B), có timeout và **ghi rõ** rằng nhánh COM chỉ chạy trên Windows.

## Quan hệ với seam `host-directory-picker`

Như gói `host-directory-picker-browse`: khai **interface HẸP cục bộ** (`DirectoryPickerBase`) thay vì import tĩnh `@deepseek-ai/*` — đúng luật repo, không phụ thuộc thứ tự build, hành vi 1:1.

## Test

`tests/host/host-directory-picker-native.test.ts` — bề mặt export · locale byte-equal (59 + 128 B) · `pickNativeDirectory` 4 nền tảng (darwin/linux/win32/unsupported) với runner giả · nhánh lỗi (`ENOENT` ⇒ fallback, mã 1 ⇒ null, abort ⇒ ném lại) · worker A/B (sha + spawn).
