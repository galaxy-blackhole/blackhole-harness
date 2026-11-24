<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 24/11/2026
 desc ADR 0031 — Backport PROD hẹp (kernel 0.2.1-alpha.4): sửa lỗi Windows BỎ QUA cờ "win32Native" khiến app desktop luôn rơi vào picker trình duyệt
-->

# ADR 0031 — Backport PROD hẹp: Windows tôn trọng cờ `win32Native`

## Triệu chứng (task-82)

Trên bản **PROD** (kernel **0.2.1-alpha.4**), app desktop Windows (Tauri/WebView2, có
`GBH_TAURI_ROOT`/`GBH_DESKTOP_PORT`) mở **picker trình duyệt** thay vì hộp thoại của hệ điều hành;
vùng chọn thư mục workspace báo toast *"Không mở được. Hãy thử lại."*.

## Truy vết

`packages/host/directory-picker-auto/src/resolve.ts` có nhánh:

```ts
if (facts.platform === "win32") return "browse";
```

Nhánh này trả **luôn** `"browse"` và **bỏ qua** `facts.win32Native` — cờ mà `plugin.ts` tính từ
`GBH_TAURI_ROOT`/`GBH_DESKTOP_PORT`. Vì vậy app desktop Windows không bao giờ tới được backend
`native`; đúng vùng sinh toast trên. (Ghi chú 21/11/2026 — "Windows luôn browse" — chỉ đúng cho CLI web.)

## Quyết định

1. `resolve.ts`: trong nhánh `win32`, tôn trọng cờ —
   `return facts.win32Native === true ? "native" : "browse";`
   App desktop ⇒ `native`; CLI web thuần ⇒ `browse`. Các luật an toàn phía trên (bind ngoài loopback,
   remote authority, SSH) **vẫn thắng** cờ này.
2. `plugin.ts`: hoist `const platform = process.platform` và tách `mountBackend(kind)`; khi mount
   backend `native` **thất bại** trên `win32` thì dọn entry đã tạo rồi mount cặp `browse` thay vì
   ném lỗi — app desktop thiếu `koffi` vẫn chọn được thư mục. Nền tảng khác giữ nguyên hành vi cũ
   (ném lên trên).

Phạm vi backport **hẹp**: chỉ 2 tệp nguồn trên + test của row. **Kernel giữ 0.2.1-alpha.4**;
`apps/host/package.json`, `bun.lock` (gốc và `apps/host`) **không đổi**. Không mang sang bất kỳ thay đổi
nào khác của nhánh rc.5 (kernel 0.2.2-rc.5, dependency, row khác) — chỉ dùng bản vá picker đã kiểm ở rc.5
làm tham chiếu hành vi.

## Hệ quả & bằng chứng

- Test row: `bun test tests/host/directory-picker-auto.test.ts` → **13 pass / 0 fail** (thêm 2 ca win32:
  cờ desktop ⇒ native, không cờ ⇒ browse; cờ desktop KHÔNG vượt qua luật an toàn). Ca đối chứng stock
  dùng `win32Native: true` và ca "win32 không cờ" được khoá **riêng** vì ta cố ý khác stock.
- Lab boot trên worktree backport (`GBH_HOME=/tmp/gbh-backport`, cổng 5591): `[bh] ready`, không có
  plugin lỗi/pending; `pluginInventory/list` trả `include:directory-picker` (bản ta) cùng backend
  `@galaxy-blackhole/gbh-host-directory-picker-native` và surface tương ứng đều `fiberPhase: active`.
  Host lab đã tắt, home tạm đã xoá.
- Chưa đo trên phần cứng Windows thật: nhánh win32 được khoá bằng unit test (dữ kiện host giả lập) +
  lab boot trên macOS; phép đo PROD thật vẫn nên làm khi có máy Windows.
