<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ui-settings-subagent cua DSH (M5, diem 11: the Settings co trang thai song).
-->

# @galaxy-blackhole/gbh-client-ui-settings-subagent

Thay row `ui-settings-subagent` của DSH: **trang cài đặt Subagent** — hai form staged (giới hạn uỷ nhiệm trên
namespace `subagent` + quyền chọn model trên `subagent-model-selection-settings`) trên **một trang với một nút
lưu**, đăng ký vào ô `plugins.item` của trang Plugins, chỉ hiện khi Host phục vụ một trong hai namespace.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-settings-subagent` (T3) | `ui-settings-subagent-ours` → `@galaxy-blackhole/gbh-client-ui-settings-subagent` |
| Kích thước bản build | **869 dòng JS** (`lib/index.js` 13 + `lib/client.js` 856) | `lib/index.js` 93 B · `lib/client.js` 41.035 B (sinh tự động) |
| `dsh.client.inject` (manifest) | `client-locale` · `ui-settings` · `ui-plugin-manager` · `api-remotes` (**4**) | khai y hệt |
| `inject` của THÂN plugin | `["slots","locale","remote","remote.session","configForms"]` (**5**) | y hệt |
| Id MODULE gốc đăng ký | **1** | **2** id chung 1 factory, khai `gbh.row.moduleIds` |
| Specifier nửa browser `require` | `react/jsx-runtime` · `react` · `ui-primitives` · `dsh-client-store` (**4**, đúng thứ tự) | y hệt |
| CSS module | **3**: `SubagentLimitsFields` (633 B, hash `hF0LTq_`) · `SubagentModelSelectionFields` (1.898 B, `UPHdGa_`) · `SubagentCard` (152 B, `AZSXYW_`) | nhúng **nguyên văn** bằng `define` |
| Từ điển | `settings.subagent` — **32 khoá × 2 ngữ** | y hệt từng chữ |
| Mức độ dẫn xuất | — | **viết lại theo hành vi**; số đo/chuỗi giữ nguyên vì so A/B từng ô |

### Hành vi phải giữ

**`apply(ctx)` — ĐÚNG BẢY hiệu ứng, đúng thứ tự và đúng nhãn bản gốc**: `dictionaries` (đăng ký `zh`/`en`) →
`limits form subscription` (ghế gỡ form giới hạn) → `adapter invalidations` (`remote.$on("llm/adapters-updated")`
⇒ nạp lại danh mục) → `settings invalidations` (`$on("settings/document-updated")`) → `connection generation`
(`ctx.on("connection/reset")` ⇒ `resetConnection`) → `model preference` (ghế gỡ controller model) → `page`
(`configForms.whileServed([subagent, subagent-model-selection-settings])` ⇒ `slots.inject("plugins.item")` ⇒
`slots.register({name:"plugins.item", id:"subagent", order:10, label:()=>t("subagentTitle"), locale: NS, inject})`).

**Ba controller**:
- `SubagentLimitsCardController` — hai trường số độc lập trả-mặc-định được trên **một** form staged; luật riêng:
  số nguyên an toàn, `maxDepth ≥ 0`, `maxActiveSubagents ≥ 1`, **loại `-0`**.
- `SubagentModelSelectionCardController` — ghép form với **danh mục adapter đang sống**: khoá tuyến
  `provider\0model` (tra cứu, **không bao giờ tự phân tích**), ứng viên = danh mục sống **+ tuyến đã lưu còn
  xoá được sau khi biến mất**, hàng rào `revision` khi lưu (**xung đột ⇒ `conflicted`, không ghi**), hai
  **thế hệ** (`saveGeneration`/`catalogGeneration`) chặn kết quả về muộn, `dispose()` tăng cả hai.
- `subagentCardShell`/`subagentCardFace` — trạng thái dùng chung **không nhân đôi đăng ký**; `save()` chỉ ghi
  khi `available ∧ writable ∧ dirty ∧ ¬invalid ∧ ¬saving`, **model trước rồi giới hạn**, mỗi phép ghi giữ
  hàng rào namespace của nó; `discard()` bỏ cả hai trừ khi đang lưu.

## 2. Peer

**Không khai peer nào.** Bốn specifier nửa browser `require` do **bảng module của trang** cấp, đúng thứ tự bản
gốc. Bản gốc khai `@deepseek-ai/cordis` chỉ để lấy KIỂU.

## 3. Bằng chứng

### 3.1 Test — **22 test / 771 expect** (pass)
| Nhóm | Nội dung |
|---|---|
| **ĐỐI CHỨNG bundle gốc** | `subagentModelKey` trên 25 cặp provider/model (kể cả `""` và chuỗi chứa `\0`) · `subagentModelCandidates` 12 tổ hợp **so từng byte JSON** · `sameRoutes` 36 cặp (kể cả trùng khoá) · `limitField` 15 văn bản × 2 ngưỡng (kể cả `-0` · `1.5` · `1e3` · `0x10` · `Infinity` · số vượt `Number.MAX_SAFE_INTEGER`) · `subagentCardShell` **512 tổ hợp cờ** |
| Test canh CSS | cả **ba** module **trùng nguyên văn** bản gốc sau khi bỏ khoảng trắng + ngoặc cân bằng + hash ba bảng lớp khớp CSS gốc |
| Test canh runtime JSX | stub `react` **KHÔNG có** jsx/jsxs (chỉ `useId`); bundle chạy trong `window` giả rồi gọi factory |
| Controller | bật công tắc ⇒ mở bản nháp + tự nạp danh mục; chọn/bỏ tuyến; đang bật mà trống ⇒ `invalid`; lỗi danh mục ⇒ `catalogStatus = error`; revision đổi nơi khác ⇒ `conflicted`; `save`/`discard` chỉ chạy khi trạng thái chung cho phép (model trước, giới hạn sau) |
| Cây component | ô giới hạn (bảng 0/1, nhãn, callback sửa/trả mặc định, cờ `disabled`) · ô chọn model (tắt ⇒ chỉ công tắc; bật ⇒ nhóm theo nhà cung cấp **+ nhóm "đã lưu nhưng không dùng được"**, câu một phần/bắt buộc/xung đột, nút thử lại) · thẻ (`view summary` ⇒ một dòng mô tả; khung `SettingsForm` nhận `formLabels` + trạng thái chung; chỉ vẽ khối đang phục vụ) |
| `apply` | 7 nhãn hiệu ứng đúng thứ tự · `NS` đăng ký + bind · hai sự kiện Remote · một sự kiện ctx · `whileServed` đúng hai namespace · ô `plugins.item` đúng `id`/`order`/`locale`/`label` · mặt `inject` đủ 7 action · cả 7 hiệu ứng trả hàm dọn |

### 3.2 Lab (home cách ly, cổng riêng) — **hai chiều, cùng home**
| Phép đo | TRƯỚC (row DSH) | SAU (chỉ row ta) |
|---|---|---|
| Trang | 200 · 39.326 B | 200 · 39.351 B |
| `#root` | 57.501 ký tự | **57.501 ký tự** (y hệt) |
| Lỗi console | **0** | **0** |
| `did not activate` | 0 | **0** |

**Mặt Settings render thật** (mở Plugins → bấm mục "Subagent"), đo cả hai chiều:

| Phép đo | TRƯỚC | SAU |
|---|---|---|
| Lớp thẻ `AZSXYW_` / giới hạn `hF0LTq_` / model `UPHdGa_` | 4 / 3 / 11 | **4 / 3 / 11** |
| Dòng mô tả "Set Subagent recursion depth…" | có | **có** |
| Tiêu đề | `["Subagent","Limits","Model selection"]` | **y hệt** |
| Lỗi console | 0 | **0** |

> Lưu ý minh bạch: trong cấu hình lab **mọi row đều thay**, trang lab trắng (14 entry không activate, gốc là
> `ui-conversation: loading`) — **đo hai chiều cho thấy TẮT row này thì hỏng y nguyên**, và `check:rows` chỉ ra
> **5 vấn đề CHẶN** đều thuộc `gbh-client-ui-attachment` (thiếu 5 đăng ký slot mà bản gốc có). Không phải row này.

### 3.3 Cổng
- `bun run check:rows`: gói này **không có dòng nào** (không chặn, không cảnh báo).
- `bun run gate`: **0 vi phạm thuộc gói này**.

## 4. Lệnh tái lập

```bash
bun test tests/client/ui-settings-subagent.test.ts   # 22 pass · 771 expect
bun run check:rows                                   # cổng chặn mount (đừng grep tay)
bun run lab:row ui-settings-subagent                 # home cách ly + overlay + cổng riêng
bun run gate                                         # 8 cổng
```

## 5. Bài học đã trả giá ở row này

- **Cây component giả phải DUỖI mảng lồng nhau như React**: `[...map].map()` trả về **mảng** làm MỘT con —
  helper không duỗi thì bỏ sót cả nhóm. Lần đầu tôi tưởng component thiếu nhóm "đã lưu nhưng không dùng được",
  thực ra là helper sai.
- **Đừng tra element theo chuỗi tự đặt**: `react.jsx(Component, …)` giữ **chính hàm** ở `type` (React mới gọi
  nó lúc render) ⇒ phải tra theo hàm, không phải theo tên tôi gán.
- **Bản gốc gọi `modelCatalog()` NGAY trong `refreshCatalog()`** ⇒ đổi chế độ giả lập phải đổi TRƯỚC khi gọi,
  nếu không thì đang đo lượt cũ.
- `loadStock` dựng lại hàm gốc bằng `new Function`: bản gốc gọi qua **namespace** (`_deepseek_ai_dsh_client_ui_primitives.settingsNumberField`),
  nên phải tiêm **cả namespace**, không phải hàm trần.
- Trong lab đa row, **một gói khác** (`attachment`) làm cả trang trắng — bài học: luôn đo **hai chiều** trước
  khi nhận lỗi về mình, và để **cổng** chỉ mặt gói chặn thay vì đoán.

### 3.4 Xác minh TRÊN APP THẬT (21:50, lượt boot lành 26 gói của ta · 94 entry)

- Mở Settings → Plugins → mục **"Subagent"** (occupant `plugins.item` của row này) rồi đo DOM: **4 lớp `AZSXYW_` · 3 lớp `hF0LTq_` · 11 lớp `UPHdGa_`** — **y hệt bản stock** đo trong lab (4/3/11).
- Dòng mô tả `"Set Subagent recursion depth…"` **có** · tiêu đề `["Subagent","Limits","Model selection"]` **y hệt** · **0 lỗi console**.
- `check:app` (8) 99.183 ký tự · 0 lỗi · (10) 54 file khớp repo.
