<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ui-shortcuts cua DSH (M5, ~1.170 dong) — TRANG THAI: dang port.
-->

# @galaxy-blackhole/gbh-client-ui-shortcuts

Thay row `ui-shortcuts` của DSH: **bảng tra phím tắt** (dialog reference + hàng trong Settings + trình ghi tổ hợp phím).

> ⚠️ **KHÁC gói `shortcuts`** (của tm-m5b): gói kia **cấp SERVICE `shortcuts`**; row này là **UI** và **tiêu thụ** service đó.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Kích thước | `lib/index.js` 6 + `lib/client.js` **1.164** = **1.170 dòng** | đang port |
| `dsh.client.inject` | `dsh-client-shortcuts` · `dsh-client-locale` · `dsh-client-ui-layout` · `dsh-client-ui-settings` (**4**) | khai y hệt |
| Id MODULE gốc | **1** | **1** (id ta); id stock ở `gbh.row.aliases` |
| Specifier nửa browser | `react/jsx-runtime` · `react` · `dsh-client-ui-primitives` · `dsh-client-store` | y hệt |
| CSS | **1**: `Reference.module.css` — **7.771 B**, hash `nhfO0a_`, **40 lớp** | nhúng **nguyên văn** (đã khớp từng ký tự) |
| Primitive dùng | `Button` · `Modal` · `Toast` · `Tooltip` · `ShortcutKeys` · 2 icon · `closeTopModal` · `focusWithoutRing` · `isBehindModal` · `observeComposition` · `rankByName` (**12**) | y hệt |
| Hook dùng | `useState` ×11 · `useRef` ×7 · `useEffect` ×6 · `useLayoutEffect` ×3 · `useCallback` ×2 · `useId` ×1 | y hệt |

### Bản đồ vùng bản gốc + trạng thái

| Dòng gốc | Vùng | Trạng thái |
|---|---|---|
| 11–38 | `store.js` — `createShortcutsStore()` | ✅ `src/store.ts` |
| 40–54 | `clsx` bundled | dùng `clsx` của dự án |
| 55–82 | `feedback.js` — `shortcutReadFailure` · `shortcutFailure` | ✅ `src/feedback.ts` |
| 84–136 | CSS + bảng lớp `nhfO0a_*` | ✅ CSS + `src/class-names.ts` (91 dòng) + `src/types.ts` (81) |
| 137–472 | `Editor.js` — `ShortcutEditor` (**329 dòng**) | ✅ `src/editor.ts` (**462 dòng**, đã sạch kiểu) |
| 473–501 | `Icons.js` — `artwork` + `ShortcutIcon` | ✅ `src/icons.ts` |
| 502–881 | `Reference.js` — `ShortcutsRow` · `ShortcutReference` | 🟡 chuyển máy móc xong (510 dòng, WIP ở `/tmp`), **chưa xong khai kiểu** — xem §3.1 |
| 882–1001 | `locales.js` — `en`/`zh` | ✅ `src/locales.ts` (127 dòng) |
| 1002–1046 | `fixed.js` — `fixedCommands(t)` | ✅ `src/fixed.ts` |
| 1047–1164 | `index.js` — `apply` + mặt plugin | ⬜ **CÒN LẠI** |

**Hợp đồng kiểu**: `.d.ts` của bản gốc import kiểu package DSH khác (`ShortcutCatalogEntry` · `Shortcuts` · `PropsStore`…) ⇒ **không copy được**; mỗi module tự khai **kiểu cấu trúc** đủ dùng (không dùng `any`).

## 2. Cách port (đã kiểm, dùng tiếp cho 2 component)

Bundle gốc **giữ nguyên JSDoc + logic** ⇒ chuyển **máy móc** thay vì chép tay:

```text
(0, react_jsx_runtime.jsxs)(  ->  runtime.jsxs(
(0, react_jsx_runtime.Fragment) ->  runtime.Fragment
(0, _deepseek_ai_dsh_client_ui_primitives.X)(  ->  primitives.X(
Reference_module_css_default.X  ->  classes.X
```

Giữ nguyên JSDoc/thứ tự/số đo; phần phải làm tay là **khai kiểu cho tham số**.

### Ba luật CHỐT của nhóm (áp khi làm tiếp — Lead chốt 17/10)

1. **Cổng idempotent**: `let` **phạm vi module (boolean)** là ĐIỀU KIỆN CHẶN — **KHÔNG** khoá theo `ctx` (ca thật: **hai entry ⇒ hai ctx** nên cổng khoá-ctx không bao giờ kích hoạt; `shortcuts` đã trả giá). `WeakSet` chỉ là **lưới trong tuỳ chọn**. Test phải **nạp module tươi mỗi ca**.
2. **Bundle đăng ký MỘT id** (id của ta); id stock để ở `gbh.row.aliases`; `moduleIds: [id ta]` — không để id stock ở cả hai chỗ.
3. `build.ts` phải build **CẢ HAI nửa** (`src/index.ts` host + `src/client.ts` browser) — thiếu nửa browser thì gói mount được mà **không có gì chạy**.

### Bẫy của phép chuyển máy móc (tôi đã vấp)

Mẫu `(0, react.useState)(` phải đổi **cả cặp ngoặc**: regex phải là `\(0, react\.([A-Za-z_$][\w$]*)\)\(` → `react.(`; nếu chỉ thay tiền tố thì còn dấu `)` thừa và file **không parse được** (tôi đã dính, 457 dòng lỗi TS1005/TS1134).

Và **đừng đặt tên tham số factory trùng tên prop**: component nhận prop `runtime` (web/desktop) còn factory cần JSX runtime — tôi phải đổi tham số factory thành `jsxRuntime`.

### 3.1 Trạng thái port `reference.ts` — ĐÃ CHUYỂN MÁY MÓC, CHƯA XONG KHAI KIỂU

- Bản chuyển máy móc **510 dòng** nằm ở **`/tmp/ui-shortcuts-reference-wip.ts`** (không để trong `src/` vì **còn 20 lỗi kiểu** ⇒ giữ cổng XANH; đã ghi rõ ở đây thay vì để file dở trong repo).
- Nó chứa: `ShortcutsRow` + `ShortcutReference` đã đổi tên tham chiếu (`jsxRuntime.*` · `primitives.*` · `classes.*`), giữ nguyên JSDoc.
- **Việc còn lại của pass khai kiểu** (đúng các nhóm lỗi đã gặp, làm theo thứ tự này sẽ nhanh):
  1. `toast` là **object** `{ text, error, seq }` chứ không phải chuỗi ⇒ khai `useState<{ text: string; error: boolean; seq: number } | null>(null)` (tôi đã khai nhầm `string | null`).
  2. `persist` nhận **rest tuple**: `(...args: [{ type: string; id?: string; binding?: unknown }, number | null]) => Promise<{ status: string }>` — chú ý **không** viết `number | null?` (TS17019).
  3. `edit(...args)` cần tuple khớp chữ ký `edit(edit, revision)`; và `persist({...}, resetRevision)` phải nhận `string | null` (state revision).
  4. `rankByName` bản gốc **2 tham số** (tôi khai 3) ⇒ khai `query?`; `row.keys`/`row.aliases` đã thành **bắt buộc** trong `types.ts` (đã sửa).
  5. Còn **1 chỗ sót** tên cũ `react_jsx_runtime.Fragment` (regex chuyển chưa ăn vì viết trên dòng xuống) ⇒ đổi thành `jsxRuntime.Fragment`.
  6. `config.document` là **tuỳ chọn** ⇒ dùng `config.document?.profiles?.[...] ?? {}`.

### 3.2 Đã kiểm được gì (các module đang ở trong `src/`)

- **`Reference.module.css` 7.771 B · 40 lớp** — trùng nguyên văn bản gốc (bỏ khoảng trắng khớp tuyệt đối, ngoặc cân bằng, hash `nhfO0a_`).
- **`bun run gate --no-tests` = XANH 7/7** · **0 vi phạm thuộc gói** (đã trả **21 lỗi** kiểu ngay sau khi chuyển máy móc, rồi **4 vòng nữa** cho `editor.ts`: TS2352 · TS18046 · TS2345 · TS2339 · TS2349 · TS2554 · TS2353 · TS18048 — nay 0).
- `src/` hiện **1.123 dòng**: `editor.ts` 462 · `locales.ts` 126 · `class-names.ts` 91 · `types.ts` 83 · `icons.ts` 67 · `fixed.ts` 65 · `feedback.ts` 58 · `store.ts` 54 · CSS 70 · + 2 entry khung 47.

## 4. CÒN LẠI

1. `src/reference.ts` — port `ShortcutsRow` (gốc 532) + `ShortcutReference` (gốc 567).
2. `src/plugin.ts` theo **mục 3 của task-55**: `let` phạm vi module + `WeakSet`, đặt **TRƯỚC** JSDoc hàm, ôm `applyInner`, `console.error` kèm id rồi **rethrow**; **KHÔNG** khoá theo `ctx`.
3. `build.ts` **hai nửa** (khung hiện chỉ build `src/index.ts`): thêm nhánh `src/client.ts` (script classic, **MỘT** id) + nhúng CSS bằng `define`.
4. `package.json`: `dsh.client` (4 inject) + `gbh.row` với `moduleIds: [id ta]` **và** `aliases: [id stock]` — **không** để id stock ở cả hai chỗ.
5. Test: đối chứng bundle gốc cho phần thuần (từ điển · `fixedCommands` · `feedback` · store actions · artwork) · cây render 2 component · test canh CSS · khuôn bundle · nối dây `apply`.
6. Lab cô lập (0 lỗi console + 0 `did not activate`) → khai `gbh.row` → `check:rows` 0 dòng CHẶN → mount → §3.4 số đo thật.
7. ⚠️ Bề mặt service: row này **tiêu thụ** service `shortcuts` (gói tm-m5b) — thiếu method/thuộc tính thì **báo họ**, đừng tự thêm; chạy `bun run parity:surface` để đối chiếu consumer-đọc vs provider-có.

## 5. Bài học

- Chuyển máy móc từ bundle **đang phục vụ** giữ được JSDoc + logic; **kiểu là phần làm tay** (21 lỗi TS ngay sau khi chuyển).
- `feedback.ts`: bản gốc truyền `result.snapshot` **có thể undefined** vào hàm đọc `config.error` ⇒ bản port dùng `?? {}` và ghi rõ **đây là điểm khác có chủ đích** để không ném trong đường lỗi.