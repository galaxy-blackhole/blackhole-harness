<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Nguon doi chieu (G4) + ly do peer + bang TRUOC/SAU + phan CHUA lam cua @galaxy-blackhole/gbh-image-offload
-->

# `@galaxy-blackhole/gbh-image-offload`

Bản viết lại của Galaxy Blackhole cho **row host `image-offload`** của DSH
(`@deepseek-ai/dsh-compaction-image-offload`) — **đẩy ảnh ra khỏi ngữ cảnh khi nén**: khi một route
**có ảnh** hỏng request với `IMAGE_OFFLOAD_REQUIRED`, plugin ghi **một** quyết định `image/offload`
chọn các lần xuất hiện ảnh **đầu vào cũ nhất** rồi để tầng trên **thử lại**.

## 1. Cặp row đã xác nhận (bước 0) + phân loại MỘT MẶT

| Việc | Bằng chứng đo được |
|---|---|
| Cặp row có thật | `.parity/dumps/2026-10-17T23-54-01/ours.yml` dòng **394–395**: `- id: image-offload` + `name: '@deepseek-ai/dsh-compaction-image-offload'`; `oracleA.yml` dòng **380–381** giống hệt ⇒ row **đang BẬT**, **không `disabled`**, **không `config`**, **không `inject`** |
| MỘT MẶT | `ls apps/host/node_modules/@deepseek-ai/dsh-compaction-image-offload/lib/` ⇒ **chỉ `index.js` (154 dòng) + `types/`** — **KHÔNG có `lib/client.js`** (nếu có thì row là HAI MẶT và phải DỪNG báo Lead) |
| Câu hỏi 1 — row BẬT? | **BẬT**: row có mặt trong cả `ours.yml` lẫn `oracleA.yml` và **không** mang `disabled: true`; `profiles/blackhole/*.yml` **không** nhắc tên row ⇒ nó đến từ `@deepseek-ai/dsh-base` |
| Câu hỏi 2 — host thuần hay có surface client? | **Host thuần**: bundle gốc có **0** lần `loader.create` · `loader.resolve` · `slots.`; gói chỉ export `apply` · `inject` · `name` |
| Câu hỏi 3 — cần seam nào? | `sessions` (đăng ký projection) + hai điểm mở rộng cordis (`agent/request-error` · `compaction/summary-error`) + **peer `@deepseek-ai/dsh-llm`** (Bậc 2 của §3b — xem §3). **KHÔNG** `extends Service`, **KHÔNG** `node:` builtin |
| Câu hỏi 4 — hành vi đo được? | **Một sự kiện `image/offload`** ghi vào nhật ký phiên (thân `{ targets: [{ seq, imageIndexes }] }`) + **một `Map` thông điệp đã chiếu** do projection dựng; cả hai **đo được TRƯỚC/SAU** bằng test đối chứng với chính bundle gốc |
| Câu hỏi 5 — `dsh.client`? | `python3 -c "…json.load(…).get('dsh')…"` ⇒ **`dsh = None`**, `dsh.client = False` ⇒ **một mặt** |
| 000e (`locale/`) | Gói gốc **CÓ** `locale/{en,zh}.json` (60 B · 161 B) ⇒ đã chép **byte-for-byte** (`410a9589…` · `65a367ad…` khớp cả hai chiều) và khai `exports["./locale/*.json"]` |
| Hồ sơ chi phí (`row:cost`) | **155 dòng** của row · **0** inject trong row · **0** primitive · **0** khoá từ điển · **không** trạng thái sống ⇒ row rẻ, đúng hạng "executor thuần listener + một projection" |

## 2. Nguồn đối chiếu (G4) — đọc CHỈ ĐỌC, rồi viết lại

| Bản gốc (CHỈ ĐỌC) | Của ta | Ghi chú |
|---|---|---|
| `…/dsh-compaction-image-offload/lib/index.js` (**154 dòng**, `0.2.1-alpha.4`) | `src/index.ts` (**47 dòng**) | `name` + `inject` + `apply` (đăng ký projection rồi hai listener); **không** `Config`, **không** nửa browser |
| `…/lib/types/image-offload.d.ts` (13 dòng) + region `lib/types/image-offload.js` | `src/image-offload.ts` (**54 dòng**) | `offloadOldestImages`: chọn ảnh **cũ nhất** theo thứ tự request rồi `session.append("image/offload", { targets })` |
| `…/lib/types/project-message.d.ts` (11 dòng) + `lib/types/project-message.js` | `src/project-message.ts` (**46 dòng**) | `offloadMessageImages`: chiếu bất biến + đóng băng sâu; **ném** khi chỉ số không tồn tại/đã đẩy |
| `…/lib/types/projection.d.ts` (27 dòng) + `lib/types/projection.js` | `src/projection.ts` (**86 dòng**) | `imageOffloadProjection`: khai báo bền **an toàn browser** + replay thuần; **11 câu lỗi nguyên văn** |
| `…/lib/index.js` → `deepFreeze` của `@deepseek-ai/dsh-util-values` | `src/freeze.ts` (**42 dòng**) | Viết lại **trung thành** (vòng lặp, `WeakSet`, **bỏ qua `AbortSignal`**) — lý do ở §3 |
| `…/lib/types/index.d.ts` (18 dòng) | `src/types.ts` (**169 dòng**) | Mặt cắt seam khai theo **CẤU TRÚC**: sổ phiên + projection + hai waterfall (không import gói seam nào) |
| `package.json` gốc: `exports["./projection"]` + `locale/*.json` | `build.ts` (**47 dòng**) | **HAI đầu ra** như bản gốc: `lib/index.js` + `lib/projection.js` |
| `…/README.md` mục *Failures and recovery* / *Understand the implementation* | §4 dưới đây | Chín nhánh phục hồi + phép chiếu |

**Bản gốc không có `config`**: row trong `ours.yml` không khai `config`, và module gốc không có
`Config`/`schema` — nên gói ta **cũng không có `Config`** (không tự thêm bề mặt).

## 3. Vì sao peer là `@deepseek-ai/dsh-llm` (và vì sao KHÔNG có `cordis`, KHÔNG có `dsh-util-values`)

| Peer | Vì sao | Ở đâu |
|---|---|---|
| `@deepseek-ai/dsh-llm` | Cần **ĐÚNG LỚP `LlmError`** của kernel: `compaction/summary-error` chỉ phục hồi khi `error instanceof LlmError` — dựng lớp cùng tên trong gói ta thì `instanceof` **LUÔN FALSE** ⇒ mất phục hồi **âm thầm**. Cần luôn hằng `IMAGE_OFFLOAD_REQUIRED_CODE` (`"IMAGE_OFFLOAD_REQUIRED"`) vì mã này đi vào **log bền** | `src/index.ts` |
| `@deepseek-ai/cordis` | **KHÔNG khai** — gói không `import` cordis: seam khai **theo CẤU TRÚC** (`ImageOffloadContext`). `apps/cli/src/mount.ts` luôn symlink `cordis` + `schemastery` cho mọi gói | — |
| `@deepseek-ai/dsh-util-values` | **KHÔNG khai** vì **ngoài bảng §3b** (Bậc 2 không có tên này). `deepFreeze` là **tiện ích THUẦN**, không cần `instanceof` ⇒ viết lại trung thành ở `src/freeze.ts`, và test **đối chứng với chính `deepFreeze` của kernel** trên cùng đồ thị (kể cả `AbortSignal` được bỏ qua) | `src/freeze.ts` |

`gbh.peers` = `["@deepseek-ai/dsh-llm"]` ⊆ `peerDependencies` (**0 tên lệch**, có **đối chứng âm** trong test).
Peer **không** nằm trong `dependencies` (tránh thể hiện thứ hai — kernel cấp một thể hiện duy nhất).

## 4. Chín nhánh hành vi trung thành (kể cả các chi tiết dễ "cải tiến" sai)

**4a. Đăng ký — đúng thứ tự, đúng số lượng.** `sessions.registerMessageProjection(imageOffloadProjection)`
chạy **TRƯỚC** hai `ctx.on` (projection phải có mặt trước khi bất kỳ `image/offload` nào được áp).

**4b. `agent/request-error`** — chỉ nhận việc khi **đủ ba** điều kiện:
`failure.code === IMAGE_OFFLOAD_REQUIRED_CODE` · `failure.offloadImages !== undefined` · `signal.aborted === false`.
Thiếu một điều ⇒ `next()` (**chuyển tiếp** cho tầng phục hồi khác hoặc báo lỗi cuối lượt).
Chọn được ảnh ⇒ ghi quyết định rồi trả `{ kind: "retry" }` — **KHÔNG** gọi `next()`.

**4c. `compaction/summary-error`** — nhận việc khi `error instanceof LlmError` **và** đúng mã **và** có
`error.failure.offloadImages`. Thứ tự **trung thành**: kiểm loại/mã/số lượng → `signal?.throwIfAborted()`
→ chọn ảnh → trả `true`. Vì vậy **huỷ TRƯỚC** khi chọn ⇒ **ném** và **không ghi gì**; **huỷ SAU** khi đã ghi
(kernel gọi listener này **đồng bộ**) ⇒ phần đã bỏ vẫn được giữ, chỉ việc thử lại bị dừng.

**4d. Chọn ảnh — `offloadOldestImages`** — duyệt `sourceEventSeqs` **theo đúng thứ tự request**:
chỉ xét `user/message` và `tool/result` (**nút assistant mang đầu ra model ⇒ BỎ QUA HOÀN TOÀN**);
chỉ số ảnh đếm **MỌI** lần xuất hiện trong thông điệp, **kể cả ảnh đã đẩy** (nên `imageIndexes` của một
quyết định sau vẫn khớp thông điệp gốc); ảnh `offloaded === true` **không** được chọn lại nhưng **vẫn** tính
chỉ số; dừng ngay khi đủ `count`; **không còn gì để đẩy ⇒ `false`, KHÔNG ghi sự kiện rỗng**.

**4e. Phép chiếu — `offloadMessageImages`** — **thuần**: không sửa thông điệp đầu vào; chỉ cấp phát
`content` mới khi **có** khối bị đổi (`next ??= blocks.slice(0, index)` rồi `push`), nên thông điệp
không có ảnh nào được chọn trả **NGUYÊN** mảng cũ. Kết quả **đóng băng sâu**; giữ nguyên mọi trường khác
của thông điệp (danh tính/series/id).

**4f. Câu lỗi nguyên văn** (11 nhánh) — `image/offload: data must contain a nonempty targets array` ·
`… each target must contain a seq and nonempty imageIndexes` · `… duplicate target seq N` ·
`… target seq N is not a current surface node` · `… target seq N must be user/message or tool/result` ·
`… imageIndexes must be strictly increasing non-negative safe integers` · `… image index N is already offloaded` ·
`… image index N does not exist`. Test so **từng câu** với bản gốc.
⚠️ Chi tiết dễ "cải tiến" sai: với "chỉ số không tồn tại", bản gốc in **`indexes[selected]`** — khi đã chọn
hết thì đó là `undefined`. Ta giữ **y hệt** (`${indexes[selected]}`), không "sửa" thành số khác.

**4g. Kiểm TRƯỚC, dựng SAU** — `project` kiểm **trọn** quyết định (hình dạng → nút mặt → trùng `seq` →
loại sự kiện nguồn → chỉ số tăng nghiêm ngặt) **rồi mới** chiếu; quyết định hỏng ⇒ **ném**, **không** đổi gì.

**4h. `context.messages` THẮNG sự kiện gốc** — thông điệp đã chiếu trước đó được dùng lại
(`context.messages.get(seq) ?? nguồn`), nên nhiều quyết định **cộng dồn** trên cùng một `seq`.
Nguồn của một `seq`: `user/message` ⇒ `event.data`; `tool/result` ⇒ `event.data.message`.

**4i. `deepFreeze`** — vòng lặp + `WeakSet` + **bỏ qua `AbortSignal`** (tín hiệu huỷ phải dùng được tiếp),
đóng băng **tại chỗ** và trả **ĐÚNG** vật thể đã nhận.

## 5. Nghiệm thu (đo trên máy, 18/10/2026)

| Phép đo | Kết quả |
|---|---|
| `bun test tests/host/image-offload.test.ts` | **27 pass · 0 fail · 150 expect** |
| Đối chứng hành vi | **9 ca** dựng **HAI giàn giống hệt** rồi chạy **CẢ HAI** `apply` (ta + chính bundle gốc), so `{vết gọi seam, hành động trả về, quyết định đã ghi, số lượt gọi next, lỗi}` bằng `toEqual` |
| Projection | **11 ca thân sự kiện sai** ⇒ thông điệp lỗi **trùng từng câu** với bản gốc; ca hợp lệ ⇒ `content` trùng + cùng đóng băng sâu |
| `deepFreeze` | So **cùng đồ thị**: danh sách `Object.isFrozen` theo **từng đường dẫn** trùng bản kernel; `AbortSignal` **không** bị đóng băng |
| Tập export trên **ARTIFACT** | `Object.keys(ta) = Object.keys(gốc) = ["apply","inject","name"]` — **0 thiếu · 0 thừa**, không `default`; `apply.length` **1 = 1**; `inject` **2 = 2** nguyên văn + đúng thứ tự |
| Subpath `./projection` | `lib/projection.js` export **đúng một** tên `imageOffloadProjection` — y bản gốc (`lib/types/projection.js`) |
| Artifact id module | `grep -c "id: @deepseek-ai" lib/index.js` = **0** · `grep -c "id: @galaxy-blackhole"` = **0** (host-only, không có bundle) |
| `gbh.peers ⊆ peerDependencies` | **0 tên lệch** + **đối chứng âm** (xoá từng peer ⇒ báo **đúng tên**; xoá sạch ⇒ báo **đủ**) + đối chứng âm thứ hai (thừa tên vẫn ĐẠT) |
| 000e locale | `shasum` **khớp byte-for-byte** (`en.json` `410a9589…` · `zh.json` `65a367ad…`) |
| C6 (độc lập vật thể) | Hai lượt chọn ⇒ `targets`/`targets[0]`/`imageIndexes` **khác danh tính**, sửa một **không lan**; hai lượt chiếu ⇒ hai `Map`, hai `content`, hai khối đã đẩy **riêng** |
| Hợp đồng khai row | Gói được viết khi **CHƯA** khai `gbh.row`; **Lead khai row lúc 07:50 ngày 18/10/2026** (trong lúc gói đang viết) ⇒ test kiểm **hợp đồng**: nếu có `gbh.row` thì `id` phải là `image-offload` và `tests` phải trỏ `tests/host/image-offload.test.ts` |

## 6. TRƯỚC / SAU

| Phép đo | TRƯỚC (row gốc) | SAU (gói ta) |
|---|---|---|
| Đăng ký seam | projection → `agent/request-error` → `compaction/summary-error` | **y hệt từng phần tử** |
| `agent/request-error` (mã đúng, `offloadImages: 1`) | ghi `targets:[{seq:1,imageIndexes:[0]}]`, trả `{kind:"retry"}` | **trùng từng phần tử** |
| `agent/request-error` (sai mã / thiếu số lượng / đã huỷ) | `next()` ×1, 0 quyết định | **y hệt** |
| `compaction/summary-error` (`LlmError` thật) | ghi quyết định, trả `true` | **trùng từng phần tử** |
| `compaction/summary-error` (lỗi **không** phải `LlmError`, cùng mã) | `next()` ×1 | **y hệt** (chứng minh cần **đúng lớp**) |
| Huỷ trước khi chọn (summary) | **ném** đúng `signal.reason`, 0 quyết định | **y hệt** |
| Projection: 11 ca sai | 11 câu lỗi | **trùng từng câu** |
| App 5439 (`check:app`) | — | **CHƯA ĐO** — gói **chưa mount** (xem §7) |

Cách tái lập: `bun test tests/host/image-offload.test.ts` (tự build ARTIFACT vào `lib/test-artifact` rồi
tự dọn trong `afterAll`), và `cd packages/host/image-offload && bun run build.ts` cho `lib/`.

## 7. CHƯA làm — nói thẳng

1. **Chưa mount** — gói được viết khi `gbh.row` **CHƯA** được khai (đúng chỉ đạo cho lượt này), rồi
   **Lead tự khai row** lúc **07:50 ngày 18/10/2026** (`"row": { "id": "image-offload", "tests": ["tests/host/image-offload.test.ts"] }`,
   không kèm `inject` — đúng như row gốc trong `ours.yml` **không có `inject`**). Vì vậy lượt này **vẫn chưa**
   có `check:app` · `(5) did not activate` · ảnh A/B · `lab:row`; ba phép tiền-mount của
   `M6-MOUNT-PLAN.md` **đã đạt** trước khi row được khai (export 3 = 3 đo trên ARTIFACT · `gbh.peers ⊆ peerDependencies`
   · phân loại MỘT MẶT). ⇒ Việc **mount + đo TRƯỚC/SAU trên app 5439** thuộc **lượt boot của Lead**.
2. **Không ship `SessionEventMap` augmentation** — bản gốc khai `interface SessionEventMap { 'image/offload': … }`
   trong `.d.ts`. Gói ta build **chỉ JS** (như mọi gói host đã viết lại) nên phần **chỉ-kiểu** đó không có;
   **hành vi lúc chạy trùng khít** (kernel không đọc `.d.ts`). Nếu sau này cần kiểu cho người viết khác thì
   phải symlink `@deepseek-ai/dsh-session` và thêm `src/types.d.ts` — **cố ý chưa làm** để không mở lại
   lớp lỗi 000d (ambient đè kiểu thật).
3. **`deepFreeze` viết lại thay vì dùng peer** — xem §3; đối chứng bằng test trên cùng đồ thị. Nếu Lead
   muốn dùng thẳng `@deepseek-ai/dsh-util-values` thì đó là **một dòng peer** + **một dòng import**, và
   phải ghi lý do ngoài bảng §3b vào chính README này.
