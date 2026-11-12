<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-harness-dev-context — bảng nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU
-->

# @galaxy-blackhole/gbh-harness-dev-context

Bản viết lại của Galaxy Blackhole cho row **`harness-dev-context`** của DSH
(`@deepseek-ai/dsh-harness-dev-context`, bundle MỘT FILE **124 dòng** `lib/index.js`, đọc từ
`apps/host/node_modules/@deepseek-ai/dsh-harness-dev-context/` — CHỈ ĐỌC).

**Vai trò**: ngữ cảnh phát triển của harness. Row đăng ký **hai mục system prompt** (mô tả checkout và
mô tả bề mặt Web GUI) **KHÔNG chứa đường dẫn/URL**, rồi nêu **checkout hiện tại** và **URL Web GUI hiện
tại** bằng **runtime context** — nhờ vậy một tiến trình khởi động từ checkout/port/bản cài khác **không
làm đổi system prompt**. Kèm theo là **một đơn vị chiếu phiên** giữ **nguyên văn** đoạn prompt mà phiên
đã nhận, để resume **không viết lại** prompt đã ghi.

> ⚠️ **Gói CHƯA khai `gbh.row`** — theo chỉ đạo của Lead (boot do Lead thực hiện). Gói **không thể
> làm hỏng app**: `bh host` chỉ sinh patch từ package CÓ `gbh.row`, và `check:rows` chỉ kiểm package
> CÓ `gbh.row`. Có **test canh** khẳng định điều đó (`tests/host/harness-dev-context.test.ts`).

## 0. Trả lời năm câu bắt buộc (trước khi viết)

| # | Câu hỏi | Trả lời ĐO ĐƯỢC |
|---|---|---|
| 1 | Row đang BẬT? | **CÓ** — `.parity/dumps/2026-10-17T23-54-01/ours.yml` dòng 576–577 có cặp `- id: harness-dev-context` + `name: '@deepseek-ai/dsh-harness-dev-context'` và **không** có `disabled` |
| 2 | Thuần host hay có mount surface client? | **Thuần host** — `lib/index.js` 124 dòng, **KHÔNG có `lib/client.js`** (đã kiểm `ls lib/`), package.json **không có `dsh.client`** |
| 3 | Cần seam nào? | `systemPrompt` · `sessionProjections` · `webApp` — khai theo **CẤU TRÚC**, không import gói seam; thêm `node:url` và `zod/v4` (thư viện) |
| 4 | Hành vi ĐO ĐƯỢC là gì? | Hai lượt `section()` + hai lượt `context()` + một `register()` chiếu; văn bản của chúng (fallback và đoạn đã nhận) + phép gộp `harnessDevLegacyPrompt` |
| 5 | Package gốc có `dsh.client` không? | **KHÔNG** — `python3 -c "import json;print(bool((json.load(open('…/package.json')).get('dsh') or {}).get('client')))"` ⇒ `False` ⇒ **MỘT MẶT**, thay được ngay |

**Luật 000e (locale)**: bản gốc **KHÔNG ship `locale/`** (chỉ có LICENSE · README · README.zh ·
README.i18n.yaml · lib) ⇒ không áp dụng; không tạo file locale giả.

## 1. Bảng nguồn đối chiếu (G4)

| Phần của bản gốc | Nguồn đã đọc (chỉ đọc) | Bản của ta | Cách đối chiếu |
|---|---|---|---|
| `name` · `inject` | `lib/index.js` dòng 14–21 | `src/index.ts` | bằng **từng chữ** với bản gốc (ca "name · inject") |
| `SOURCE_ROOT` | `lib/index.js` dòng 23 (`new URL("../../../..", import.meta.url)`) | `src/index.ts` | ca "runtime context": dựng lại **ĐÚNG biểu thức** từ vị trí module của **từng bản cài** rồi so — kể cả dấu `"/"` cuối do `fileURLToPath` giữ |
| hai câu prompt fallback | `lib/index.js` dòng 28–29 | `src/index.ts` | ca "câu fallback": văn bản render ra của **hai bên** phải **BẰNG NHAU từng byte**, với cả `{}` và `{agent:{}}` |
| `LEGACY_SOURCE` · `LEGACY_WEB_SURFACE` | `lib/index.js` dòng 36–43 | `src/index.ts` | ca "đoạn đã nhận": **trích mốc cắt từ CHÍNH artifact gốc** rồi dựng prompt legacy ⇒ hai bên phải trả **nguyên văn đoạn** (sai một ký tự là đỏ) |
| `legacyParagraph` | `lib/index.js` dòng 50–58 | `src/index.ts` | ca "phép gộp" (6 sự kiện: không phải system · không mốc · rỗng · khác loại · hai khối) + ca "đoạn đã nhận" |
| `foldLegacyPrompt` | `lib/index.js` dòng 59–76 | `src/index.ts` | ca "phép gộp": trạng thái sau **mỗi** sự kiện phải bằng bản gốc, **kể cả việc giữ nguyên tham chiếu** khi không đổi |
| `legacyPromptSchema` (zod) | `lib/index.js` dòng 46–49 | `src/index.ts` | ca schema: nhận `{source,web}` (chuỗi/null) · **TỪ CHỐI** `"x"` · `null` · `{source:1}` · `{web:null}` · `{}` — hai bên cùng ném |
| `apply` | `lib/index.js` dòng 86–122 | `src/index.ts` | ca "đăng ký": so **thứ tự truy vấn vị trí**, tên mục, `order`, `interpolate`, khoá chiếu + `stateVersion` |
| tập export lúc chạy | `export { apply, inject, name }` (không `default`) | `lib/index.js` | **đo trên ARTIFACT**: tập tên export **BẰNG ĐÚNG** tập gốc |
| `locale/` | không có ở bản gốc | — | luật 000e **không áp dụng** (không tạo file) |

## 2. Peer — vì sao, và thuộc seam nào

| Peer | Vì sao | Bậc trong §3b |
|---|---|---|
| `@deepseek-ai/dsh-system-prompt` | seam `ctx.systemPrompt` — nơi hai mục prompt và hai dòng runtime context được đăng ký | **Bậc 2** (seam dịch vụ DSH) — được phép khi row **thật sự gọi** seam đó |
| `@deepseek-ai/dsh-session-projection` | seam `ctx.sessionProjections` — nơi đơn vị chiếu `harnessDevLegacyPrompt` được đăng ký và đọc | **Bậc 2** |
| `@deepseek-ai/dsh-web-app` | seam `ctx.webApp` — nguồn của URL trong dòng runtime context | **Bậc 2** |

Ba tên này là **đúng ba seam row gọi lúc chạy** (`inject` của bản gốc cũng đúng ba tên này),
**không import** gói nào (khai theo cấu trúc), nên chúng nằm ở `peerDependencies` + `gbh.peers`
với **cùng một tập** ⇒ `gbh.peers ⊆ peerDependencies` **0 tên lệch**, có **đối chứng âm**
(xoá-một-tên · so-số-lượng · thừa-tên). Không khai `@deepseek-ai/cordis`: row **không chạm** vòng đời
cordis (context khai theo cấu trúc), và `mount.ts` vẫn tự trỏ `cordis`/`schemastery` về kernel.

`zod` là **dependency** (bản gốc cũng để ở `dependencies`), nạp qua **`zod/v4`** vì
`packages/client/ui-sidebar-right/src/externals.d.ts` khai ambient `declare module "zod"` **có thân**
(đè kiểu thật toàn cục — luật 000d).

## 3. Bảng TRƯỚC/SAU

Gói **chưa được mount**, nên "SAU" dưới đây là phép đo **trên artifact**, không phải trên app 5439.
Lệnh tái lập:

```bash
cd galaxy-blackhole/blackhole-tauri/packages/host/harness-dev-context
bun run build.ts                                   # ⇒ lib/index.js
grep -c "id: @deepseek-ai" lib/index.js            # ⇒ 0   (không có id module nào của gói gốc)
bun run build.ts /tmp/gbh-harness-dev-context-out  # ⇒ build theo process.argv[2]
cd ../../.. && bun test tests/host/harness-dev-context.test.ts
```

| Phép đo | Bản gốc | Bản của ta | Kết luận |
|---|---|---|---|
| Tập export lúc chạy (artifact) | `apply · inject · name` (không `default`) | **y hệt** | BẰNG |
| `name` · `inject` | `"harness-dev-context"` · 3 seam | **y hệt** | BẰNG |
| Số lượt đăng ký | 2 `section` · 2 `context` · 1 `register` | **y hệt, đúng thứ tự** | BẰNG |
| Văn bản fallback hai mục | 2 câu | **từng byte** | BẰNG |
| `order` của bốn đăng ký | lấy từ bảng kernel (`HARNESS_SOURCE` · `WEB_SURFACE`) | **cùng tên truy vấn** | BẰNG |
| Dòng runtime context URL | `Current … URL: "<url>".` | **y hệt** | BẰNG |
| Dòng runtime context checkout | `… checkout: "<root>".` | **cùng biểu thức `../../../..`** | BẰNG (khác giá trị vì khác vị trí cài — đúng thiết kế) |
| Phép gộp `harnessDevLegacyPrompt` | 1 khoá · `stateVersion 1` | **y hệt** | BẰNG |
| Hành vi gộp 6 loại sự kiện | — | **y hệt từng bước** | BẰNG |
| Số file nguồn · số dòng nguồn | 1 file build 124 dòng | **1 file · 270 dòng** (có mô tả từng export) | KHÁC HÌNH DẠNG CÓ Ý |
| `lib/index.js` (bản build) | 124 dòng | **88 dòng** | — |
| id module của gói gốc trong bundle | 0 (host-only) | **0** | KHÔNG có nửa browser |

## 4. Test — 13 ca / 95 expect (0 fail)

- **Bề mặt (ARTIFACT)**: tập export **BẰNG** tập gốc + `name` · `inject` + `id: @deepseek-ai` = **0**.
- **Hành vi — A/B TRỰC TIẾP với chính bundle gốc**: mỗi ca dựng **hai giàn giống hệt nhau**, cài
  **cả hai** bản rồi so ảnh chụp đăng ký, văn bản render ra, trạng thái chiếu sau **từng** sự kiện.
  Giàn giả **hẹp bằng** seam thật: `section`/`context` ném khi `order` không hữu hạn,
  `register` ném khi `stateVersion` không phải số nguyên ≥ 0, `stateOf` trả `undefined` khi chưa đăng ký.
- **Đường lỗi**: schema chiếu từ chối 5 dạng dữ liệu sai (hai bên cùng ném); mốc cắt lấy từ artifact gốc
  nên một ký tự lệch là ca "đoạn đã nhận" đỏ ngay.
- **C6 — danh tính**: hai lượt cài cho **vật thể riêng** (`not.toBe` cho cả hai mục, hai dòng, định nghĩa
  chiếu) và **sửa bên này không lan sang bên kia**; đồng thời khẳng định bản gốc **cũng** tạo vật thể mới
  mỗi lượt cài. Trạng thái `init` **dùng chung một vật thể** là hành vi **của bản gốc** — giữ nguyên có
  chủ đích, có ca test ghi lại.
- **Manifest**: `gbh.peers ⊆ peerDependencies` (so **PHẦN TỬ**) + peer có thật trong kernel + đúng dải
  phiên bản + **TEST CANH** khẳng định gói **chưa** khai `gbh.row`.

> **Không có ca "an ninh"**: row này **không** phục vụ route HTTP nào, nên mục 3.4 của recipe
> (*"không cookie ⇒ 401"*) **không áp dụng** — nói rõ để người sau không tưởng đã bỏ sót.

## 5. CHƯA làm

1. **Chưa khai `gbh.row`** — theo chỉ đạo của Lead. Hệ quả: `bh host` **không** mount gói này, và
   `check:rows` **không** kiểm nó. Muốn mount: khai `gbh.row: { id: "harness-dev-context", tests: [...] }`
   rồi đổi test canh thành khẳng định ngược lại.
2. **Chưa đo trên app 5439.** Chưa có `check:app` · `lab:row` · TRƯỚC/SAU trên app thật cho row này —
   chúng chỉ có nghĩa sau lượt boot của Lead.
3. **Chưa có entry `./types`.** Bản gốc ship `lib/types/*.d.ts`; ta build **một file** theo khuôn của
   repo và không phát `.d.ts`. Khác hình dạng **có ý**.
4. **Không khai module augmentation `SessionProjectionStateMap`.** Bản gốc augment bảng đó để tsc biết
   khoá `harnessDevLegacyPrompt`; ta **cố ý không** khai (một `declare module` cho gói **có thật** là đè
   kiểu ở MỌI file — luật 000d), thay bằng khai **theo cấu trúc** trong `src/index.ts`.
5. **Khác biệt kiểu có ý**: `apply(ctx: HarnessDevContext)` nhận context **theo cấu trúc** thay vì
   `Context` của cordis — cùng hình dạng lúc chạy, không import gói seam nào.

## 6. Khác biệt thương hiệu CÓ Ý (18/10/2026 — task-17/N2)

- Sáu chuỗi trong hai system-prompt (`HARNESS_SOURCE_PROMPT`, `WEB_SURFACE_PROMPT`, hai `prefix`, hai dòng động
  "Current … implementation checkout / Web GUI URL") đổi **tên sản phẩm**: `DeepSeek Harness` → `Galaxy Blackhole`.
- **Chỉ đổi tên sản phẩm**; cấu trúc câu, thứ tự, điều kiện chèn và toàn bộ hành vi giữ nguyên.
- Test `tests/host/harness-dev-context.test.ts` cập nhật **đúng chuỗi kỳ vọng** (3 dòng), không đổi cấu trúc ca.
