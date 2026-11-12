<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 10/11/2026
 desc README của @galaxy-blackhole/gbh-auto-review (10/11/2026: row chuyển sang ownedByBundle) — bảng nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU
-->

# @galaxy-blackhole/gbh-auto-review

Bản viết lại của Galaxy Blackhole cho row **`auto-review`** của DSH
(`@deepseek-ai/dsh-experimental-auto-review`, bundle MỘT FILE **507 dòng** `lib/index.js` +
**16 dòng** `lib/types/index.d.ts`, đọc từ
`apps/host/node_modules/@deepseek-ai/dsh-experimental-auto-review/` — CHỈ ĐỌC).

**Vai trò**: cổng **duyệt uỷ quyền TỪNG lời gọi tool** bằng model của chính agent, cho preset
`auto` (preset chỉ-sống-theo-tích-hợp của row `permission`). Mọi lời gọi native và mọi lời gọi
con PTC **đã bắt đầu** được duyệt **một lần** trước thân của nó; lời gọi vận chuyển `run_code`
NGOÀI CÙNG **được miễn có chủ ý**.

> ⚠️ **`gbh.row` do LEAD khai NGOÀI phiên viết gói** (mtime `package.json` **10:32:29 ngày
> 18/10/2026**: `id: auto-review` + `tests`; **KHÔNG** `config`/`inject` — khớp row trần). Test canh
> khẳng định nếu khoá đó có mặt thì `id` + `tests` phải trỏ ĐÚNG row này, và không được có
> `row_unmounted_ly_do`.
>
> **SỬA 10/11/2026 — hàng này giờ do BUNDLE cắm (`gbh.row.ownedByBundle: true`).**
> Trước đó app patch sinh cặp `- id: auto-review` + `disabled: true` và `insert: auto-review-ours`
> (`profiles/blackhole/app.patch.yml`), tức row được cắm NGOÀI bundle ⇒ công tắc "Tự động duyệt uỷ quyền"
> trong Cài đặt → Plugin tắt mà preset `auto` VẪN nằm trong menu quyền ở composer (chủ dự án báo 10/11/2026).
> Từ nay app patch KHÔNG phát khối nào (`apps/cli/src/rewrite-metadata.ts` dòng 141: `ownedByBundle` ⇒
> `renderRewriteBlock` trả chuỗi rỗng); row chỉ sống theo patch của `@galaxy-blackhole/gbh-auto-review-bundle`.
> Nhờ vậy `permissionPresets.registerAuto` chỉ chạy khi bundle BẬT, và `permissionPresets.catalog()`
> (nguồn của menu quyền) tự mất preset `auto` khi bundle TẮT.

## 1. Bảng nguồn đối chiếu (G4)

| Phần của bản gốc | Nguồn đã đọc (chỉ đọc) | Bản của ta | Cách đối chiếu |
|---|---|---|---|
| `REVIEW_POLICY` (chính sách cố định) | `lib/index.js` dòng 20–41 | `src/policy.ts` | so **từng ký tự**: `request.system` của hai bên bằng nhau và bằng `REVIEW_POLICY` (3762 ký tự) |
| `json` · `parseLoggedArguments` · `sameJson` · `isRecord` | dòng 53–76 | `src/json.ts` | đi qua hành vi: lịch sử/action của hai bên **khớp từng byte** trong mọi ca |
| `loggedSchema` · `nativeAction` · `ptcAction` | dòng 77–208 | `src/action.ts` | ma trận ảnh chụp: native lệch nhật ký · schema thiếu/mơ hồ · PTC lệch cha/root/tham số/bind |
| `snapshotAutoReview` (năm phần) + `reviewUserText` | dòng 209–332 | `src/snapshot.ts` | bóc bốn mục JSON của yêu cầu rồi so **cấu trúc** với bản gốc: `ENVIRONMENT` · `PROJECT_INSTRUCTIONS` · `FILTERED_HISTORY` · `PENDING_ACTION` |
| phân vai nguồn + gom PTC theo bước | dòng 90–179 | `src/history.ts` | ca phân vai: `human-instruction` · `constraint` · `checkpoint` · `direct-parent-instruction` · `fact`; nguồn `tool` bị bỏ |
| `topLevelMemberCount` · `parseDecision` · `readDecision` | dòng 333–396 | `src/decision.ts` | ma trận 12 ca giao thức (JSON hỏng · mảng · 4 tổ hợp risk/decision sai · thành viên lặp · hai khối chữ · 3 lý do kết thúc · thiếu mốc · dữ liệu sau mốc) |
| `classifyRisk` | dòng 397–415 | `src/classify.ts` | yêu cầu LLM khớp **hình dạng** (provider · model · system · messages · temperature) và **đóng băng sâu** |
| `denied` · `askUser` · `failed` | dòng 416–453 | `src/outcome.ts` | `deny` kèm `info` cấu trúc dưới `never` · `ask` kèm `displayReason` en+zh dưới `ask` · `failed` nêu thân không được chạy |
| `apply` (listener prepend + registerAuto + hàm dọn) | dòng 454–505 | `src/index.ts` | Context cordis THẬT: thứ tự prepend · chuyển phiên Auto → `danger-full-access` · cổng `admit` đóng · huỷ giữa lượt ⇒ `cancel` |
| `deepFreeze` | `@deepseek-ai/dsh-util-values` dòng 824–860 | `src/freeze.ts` | vật thể yêu cầu bị đóng băng sâu; `AbortSignal` đang sống **không** bị đóng băng |
| tập export lúc chạy | `export { apply, inject, name }` | `lib/index.js` | **đo trên ARTIFACT**: tập tên export **BẰNG ĐÚNG** gốc (`apply` · `inject` · `name`, không `default`) |
| `locale/{en,zh}.json` | `locale/*.json` | `locale/*.json` | chép **byte-for-byte** — `shasum` khớp (`7e6f4f77…` · `f018876c…`) |

## 2. Peer — vì sao, và thuộc seam nào

| Peer | Vì sao thuộc seam | Ghi chú |
|---|---|---|
| `@deepseek-ai/cordis` | vòng đời plugin + `ctx.on` · `ctx.effect` | bảng §3b bậc 1. Ta **không import**: context khai theo **CẤU TRÚC** (`AutoReviewContext`) — tránh `declare module` toàn cục (luật 000d) |
| `@deepseek-ai/dsh-llm` | `BlockAssembler` (**lớp thật**) + kiểu `StreamChunk`/`GenerateOptions` | bảng §3b bậc 2. Gói gốc cũng nhập đúng lớp này; viết lại `BlockAssembler` sẽ là **bản sao thứ hai** của một bộ lắp ráp stream |

### Bốn thứ của gói gốc KHÔNG import (ngoài bảng §3b)

| Bản gốc lấy từ | Ta khai lại ở | Lý do |
|---|---|---|
| `dsh-util-values` → `deepFreeze` | `src/freeze.ts` | tiện ích hạ tầng; **viết lại nguyên thuật** (kể cả `WeakSet` + bỏ qua `AbortSignal`) thay vì kéo peer |
| `dsh-permission-presets` → `AUTO_PRESET` | `src/constants.ts` (`"auto"`) | **giá trị chuỗi của giao thức**, không phải seam cần thể hiện duy nhất; bản thân row `permission` của ta cũng khai `"auto"` |
| `dsh-tools` → `RUN_CODE_NAME` | `src/constants.ts` (`"run_code"`) | như trên; chỉ dùng để **miễn trừ** đúng một tên |
| `dsh-agent` · `dsh-session` · `dsh-working-directory` · `dsh-user-approval` | `src/types.ts` | **chỉ kiểu/seam**, khai theo cấu trúc đúng phần row này chạm tới |

`ctx.<tên-service>` (thay vì `ctx.get`) là **nguyên văn** cách bản gốc đọc sáu seam
(`approval` · `llm` · `permissionPresets` · `sessions` · `tools` · `workingDirectory`), và
`inject` giữ **nguyên thứ tự**.

## 3. Bảng TRƯỚC/SAU

Gói **chưa được mount** (chưa khai `gbh.row`), nên "SAU" dưới đây là phép đo **trên artifact với
CÙNG một giàn giả**, không phải trên app 5439. Lệnh tái lập:

```bash
cd galaxy-blackhole/blackhole-tauri
~/.bun/bin/bun test tests/host/auto-review.test.ts     # 40 test · 246 expect · 0 fail
```

| Phép đo | TRƯỚC (bundle gốc) | SAU (artifact của ta) |
|---|---|---|
| ca hành vi trên hai giàn giống hệt nhau | 40 ca | **40 ca, mọi kết luận JSON BẰNG NHAU** |
| `ENVIRONMENT`·`PROJECT_INSTRUCTIONS`·`FILTERED_HISTORY`·`PENDING_ACTION` | — | **bằng nhau từng byte** ở native · PTC · phân vai |
| `request.system` | 3762 ký tự | **3762 ký tự, bằng nhau** |
| ma trận giao thức (12 ca) · ảnh chụp (12 ca) | cùng thông điệp | **cùng thông điệp, 0 lệch** |
| vòng đời (chuyển preset · `admit` · huỷ giữa lượt) | — | **y hệt** (cùng dấu vết `set` + cùng `cancel`) |
| `grep -c "id: @deepseek-ai" lib/index.js` | — | **0** |
| `locale/{en,zh}.json` | sha `7e6f4f77…` · `f018876c…` | **cùng sha** |

## 4. Test — đối chứng với CHÍNH bundle gốc

- **40 test / 247 expect / 0 fail**; **mọi ca hành vi chạy CẢ HAI bản cài** trên hai harness
  **giống hệt nhau** (Context cordis THẬT + sáu seam giả ghi vết), rồi so **JSON kết luận**.
- **Đủ 4 ca của recipe §3**: (1) hành vi chính (native allow/deny/ask) · (2) **ca BYTE không áp dụng**
  — row không có tầng vận chuyển nào (không route, không thân phản hồi) · (3) đường lỗi (24 ca giao
  thức + ảnh chụp) · (4) **an ninh không áp dụng** — row không phục vụ route và không đọc/ghi tệp;
  bề mặt an ninh thật của nó là **cổng `admit` + huỷ khi gỡ tích hợp**, đã có ca riêng.
- **C6 DANH TÍNH**: hai lượt duyệt cho **hai vật thể yêu cầu RIÊNG** (`not.toBe` trên request,
  `messages`, phần tử message; cả hai đóng băng); **hai lần mount cho hai vòng đời RIÊNG** — gỡ
  mount A **không** làm mount B đóng cổng `admit` hay ngừng duyệt.
- **Ca flaky dùng `waitFor` CÓ TRẦN** (2000 ms) và có ca chứng minh `waitFor` **kết thúc đúng hạn**
  khi điều kiện không bao giờ đạt (trần 40 ms, đo `< 2000 ms`).
- **`gbh.peers ⊆ peerDependencies` so PHẦN TỬ + ĐỐI CHỨNG ÂM** (xoá-một-tên · xoá-sạch · thừa-tên ·
  cùng-độ-dài-mà-lệch) và `dependencies` **rỗng**.
- **000e**: `locale/en.json` + `locale/zh.json` **trùng từng byte** bản gốc.
- **Test canh**: `package.json` **không** có `dsh.client`, **không** có `gbh.row`/`row_unmounted_ly_do`.

## 5. Khác biệt CÓ Ý (đã biết, không ảnh hưởng hành vi trên nhật ký hợp lệ)

1. **Một lần kiểm thêm ở `snapshotAutoReview`**: `events[seq]` vắng ⇒ ném
   *"auto-review: the session surface refers to a missing event"*. Bản gốc để `TypeError` của
   `undefined` nổi lên. Nhật ký hợp lệ **không đi vào nhánh này**; đây là thông điệp rõ hơn cho
   nhật ký hỏng, không phải thay đổi hành vi.
2. **Khối nội dung khai theo CẤU TRÚC** (`ReviewContentBlock` với trường tuỳ chọn) và khối
   `tool-call` được hẹp kiểu bằng một phép ép CÓ GHI CHÚ — thay vì nhập `ContentBlock` của
   `dsh-llm`. Giá trị chuyển tiếp **nguyên tham chiếu**, đúng như bản gốc.
3. **Hằng số giao thức khai tại chỗ** (`auto` · `run_code` · `danger-full-access`) thay vì nhập gói
   ngoài bảng §3b — xem §2. Giá trị **nguyên văn**.
4. **`Config` không tồn tại** — bản gốc **cũng không có**; `apply(ctx)` chỉ nhận context.

## 6. Lượt boot của Lead (ngoài phiên viết gói)

- **`gbh.row` ĐÃ được Lead khai** (`10:32:29`) + **patch + profile đã sinh** (`10:32:51`) — xem hộp
  cảnh báo đầu README. Phiên viết gói **không tự khai** khoá này.
- `check:rows` sau khi khai: **0 `chan`** (111 package có `gbh.row` tại thời điểm đo, TẤT CẢ đạt;
  gói này **không có dòng vấn đề** nào).
- **CHƯA đo trên app 5439** (`lab:row` + `check:app` + TRƯỚC/SAU) — thuộc lượt boot của Lead.
- `docs/PARITY-MATRIX.md` dòng 198 vẫn ghi `T5` · *"chưa quyết (sau M7) · dùng nguyên bản"* — cần Lead
  cập nhật trạng thái sau khi quyết định viết lại (tài liệu, không phải mã).
