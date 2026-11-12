<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Nguon doi chieu va pham vi cua ban viet lai row ui-sidebar-browser
-->

# @galaxy-blackhole/gbh-client-ui-sidebar-browser

Bản viết lại của Galaxy Blackhole cho row **`ui-sidebar-browser`** — pane duyệt web ở **sidebar phải**.

## Nguồn đối chiếu (bắt buộc theo `packages/README.md` §3 mục 4)

| Mục | Giá trị |
|---|---|
| Gói upstream | `@deepseek-ai/dsh-client-ui-sidebar-browser` (0.2.1-alpha.4) |
| Bundle gốc | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-sidebar-browser/lib/client.js` (**1.647 dòng · 60.982 byte**) |
| Khai báo kiểu gốc | `…/lib/types/client/**/*.d.ts` (22 tệp) — dùng để đối chiếu **hình dạng**, không chép mã |
| Từ điển | `…/locale/{en,zh}.json` (chép byte-for-byte) |
| Mức độ dẫn xuất | **Viết lại theo hành vi**: port từng hàm/component, giữ nguyên văn CSS (4.011 byte), hai đường SVG sandbox, tên hai slot, khoá lưu trữ `dsh.sidebar-browser.v1`, 26 khoá từ điển, phím tắt `browser.new` |

## Hợp đồng đã đo trên bundle gốc (không đọc lại bundle)

- **inject (4)**: `slots` · `locale` · `sidebarRight` · `sidebarRightTabs`
- **slot (2)**, đăng ký bằng khuôn **hai tham số** `register(spec, Component)`, tên **LITERAL**:
  `sidebar.right.pane.tab` (mục hướng dẫn `id: "new"`, `commandId: "browser.new"`) và
  `sidebar.right.pane.tab.title`
- **hook root**: không có · **export**: `apply` · `inject` (nửa host chỉ có `apply`)

## Cấu trúc

| Nhóm | Tệp |
|---|---|
| Hằng số | `src/ids.ts` · `src/locales.ts` |
| Tầng dữ liệu (thuần) | `src/url.ts` · `src/persistence.ts` · `src/navigation.ts` · `src/frame.ts` |
| Vòng đời | `src/controller.ts` · `src/controllers.ts` · `src/store.ts` · `src/page.ts` |
| Carrier Web | `src/iframe-impl.ts` · `src/pages.ts` · `src/view/iframe-presentation.ts` |
| Giao diện | `src/view/body.ts` · `src/view/title.ts` · `src/view/icons.ts` · `src/view/css.ts` |
| Nối vào app | `src/definition.ts` · `src/plugin.ts` · `src/client.ts` · `src/index.ts` |

## Nợ kỹ thuật đã khai

Bản gốc có **hai carrier**: iframe (nền web) và `webview` Electron. Nửa Electron
(`createElectronPage` · `ElectronWebViewImpl` · `ElectronWebviewPresentation` · `browserWorkspace`)
**không được port**, vì vỏ Tauri của Galaxy Blackhole **không phơi cầu `window.dshDesktop.browser`**
(đo: `dshDesktop` xuất hiện **0 lần** trong `apps/cli`, `apps/desktop`, `apps/desktop/src-tauri`).
Hệ quả có kiểm soát: `keepMounted: false` — đúng bằng nhánh web của bản gốc. Nếu sau này vỏ Tauri mở cầu
đó thì phải port thêm nửa Electron **trước khi** bật `protocolVersion: 1`.

## Kiểm chứng

```bash
bun run build.ts                                  # lib/index.js + lib/client.js
grep -c 'id: "@deepseek-ai' lib/client.js          # 0
grep -c 'id: "@galaxy-blackhole' lib/client.js     # 1
bun test tests/client/ui-sidebar-browser.test.ts   # 11 ca
bun run check:rows | grep ui-sidebar-browser       # khong dong "chan"
bun run lab:row ui-sidebar-browser                 # 0 loi console + 0 "did not activate"
```
