<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-timeout-policy — bảng nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU
-->

# @galaxy-blackhole/gbh-timeout-policy

Bản viết lại của Galaxy Blackhole cho row **`timeout-policy`** của DSH
(`@deepseek-ai/dsh-tool-call-timeout-policy`, bundle MỘT FILE **144 dòng** `lib/index.js`, đọc từ
`apps/host/node_modules/@deepseek-ai/dsh-tool-call-timeout-policy/` — CHỈ ĐỌC).

**Vai trò**: chính sách timeout cho lượt gọi tool. Đây là **bộ THI HÀNH**: ngân sách nằm trên
**định nghĩa của TỪNG TOOL** (`ToolDefinition.timeoutMs`), gói này **không có cấu hình riêng**.

> 📌 **`gbh.row` do LEAD khai lúc 07:50 ngày 18/10/2026** (`id: timeout-policy` ·
> `tests: ["tests/host/timeout-policy.test.ts"]`) — tác giả gói **không tự khai** (luật *"khai = nhận
> rủi ro mount"*). Test canh đã **đổi chiều** theo recipe §7: nay nó khẳng định `gbh.row` trỏ ĐÚNG row
> và ĐÚNG file test này, và row MỘT MẶT **không** kéo theo `moduleIds`/`aliases`. Việc mount/lab/boot
> vẫn thuộc Lead — gói **chưa được mount**.

## 0. Bước 0 — danh tính row (đo, không suy từ tên thư mục)

| Phép | Kết quả |
|---|---|
| Cặp `- id: timeout-policy` + `name: '@deepseek-ai/dsh-tool-call-timeout-policy'` | **CÓ THẬT** — `.parity/dumps/2026-10-17T23-54-01/ours.yml` dòng **375–376**, KHÔNG `disabled` |
| `lib/client.js` của gói gốc | **KHÔNG TỒN TẠI** (chỉ `lib/index.js` + `lib/types/index.d.ts`) |
| Câu hỏi #5 — khoá `dsh.client` trong `package.json` gốc | **KHÔNG** (không có khoá `dsh`) |
| Kết luận | **MỘT MẶT** ⇒ thay bằng disable+insert **không** mất nửa client nào |

## 1. Bảng nguồn đối chiếu (G4)

| Phần của bản gốc | Nguồn đã đọc (chỉ đọc) | Bản của ta | Cách đối chiếu |
|---|---|---|---|
| `TOOL_TIMEOUT` | `lib/index.js` dòng 80 | `src/codes.ts` | so **giá trị** trên ARTIFACT với bản gốc |
| `name` · `inject` | `lib/index.js` dòng 82 · 84 | `src/index.ts` | `toEqual` với export của bundle gốc |
| `toolTimeoutResult` (nội bộ) | `lib/index.js` dòng 93–109 | `src/result.ts` | 2 ca A/B so **nguyên văn** `content`/`error.info` |
| `apply` — listener `tools/execute` | `lib/index.js` dòng 115–142 | `src/index.ts` | 8 ca A/B dựng hai giàn giống hệt, so `Observation` bằng `toEqual` |
| `deadline` · `timeoutOf` | `@deepseek-ai/dsh-timeout` `lib/index.js` | **KHÔNG chép** — gọi peer | peer thật (xem §2), không viết lại phép hợp nhất/hẹn giờ |
| tập export lúc chạy | `export { TOOL_TIMEOUT, apply, inject, name }` | `lib/index.js` | **đo trên ARTIFACT**: `Object.keys` **BẰNG ĐÚNG** gốc, không `default` |
| `locale/{en,zh}.json` | `locale/*.json` | `locale/*.json` | chép **byte-for-byte** — `shasum` khớp (`e6aa697e…` · `7ad695ec…`), luật 000e |

## 2. Peer — vì sao, và thuộc seam nào

| peer | Bậc §3b | Vì sao ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/dsh-timeout` | **Bậc 2** (seam dịch vụ của DSH) | `timeoutOf` phân loại bằng **`instanceof TimeoutReason`**; nếu ta tự viết hoặc nạp **thể hiện thứ hai**, một hạn chót do bộ bọc KHÁC dựng sẽ không được nhận ra ⇒ phân loại timeout sai âm thầm. Vì vậy `deadline`/`timeoutOf` **phải** là của kernel, và peer **phải** là `peerDependencies`. |

⇒ `gbh.peers` = `["@deepseek-ai/dsh-timeout"]`, **⊆** `peerDependencies` (so **PHẦN TỬ**, có **ĐỐI CHỨNG ÂM**).
⇒ `npm/bun` không cấp thể hiện thứ hai; `mount.ts` symlink peer đã khai. Trong repo, peer được
resolve qua symlink `node_modules/@deepseek-ai/dsh-timeout` của **chính package** (luật 000d-2 —
**không** dùng ambient `declare module`).

Gói gốc khai thêm `@deepseek-ai/dsh-llm` · `@deepseek-ai/dsh-tools` · `@deepseek-ai/cordis`, nhưng
**không** dùng chúng lúc chạy (chỉ kiểu): seam `tools` (`ctx.tools.get`) và `exec.signal` được khai
**theo CẤU TRÚC** trong `src/types.ts` — đúng tiền lệ `fs-observation-policy` · `session-checkpoint-policy`.

## 3. Bản đồ hành vi (đọc từ bundle gốc, viết lại theo hành vi)

1. **Tra ngân sách**: `ctx.tools.get(exec.name, exec.agent)?.timeoutMs` — nguồn duy nhất. Không khai ⇒
   `return next()` **nguyên vẹn** (không đồng hồ, không đổi tín hiệu).
2. **Vũ trang**: `deadline(exec.signal, timeoutMs, TOOL_TIMEOUT)` hợp nhất tín hiệu caller với đồng hồ
   mang **mã của ta**; `exec.signal` được **THAY tạm thời** bằng tín hiệu hợp nhất.
3. **Dispatch**: `await next()` — registry tự hợp nhất tín hiệu gốc của caller vào mọi tín hiệu thay thế,
   nên thay tín hiệu **không** cắt được đường huỷ của caller.
4. **Phân loại theo PHẠM VI**: chỉ khi `timeoutOf(armed.signal, TOOL_TIMEOUT) !== undefined` mới thay
   kết quả; hạn chót **lồng nhau** của bộ bọc khác cháy trước ⇒ đọc như **huỷ thượng nguồn bình thường**.
5. **Hoàn tín hiệu + dọn đồng hồ** trong `finally`: `exec.signal = upstream` rồi
   `armed[Symbol.dispose]()` ⇒ `tools/post-execute` không bao giờ thấy tín hiệu đã-cháy của ta, và lượt
   gọi xong nhanh **không để lại hẹn giờ**.
6. **Kết quả thay thế**: `content: [{ type: "text", text: "Error: tool call timed out after <ms>ms" }]`,
   `isError: true`, `error.info = { name: "ToolTimeoutError", code: "TOOL_TIMEOUT" }` — **dựng mới mỗi lượt**.
7. **Giới hạn CÓ Ý của bản gốc** (giữ nguyên): plugin chỉ **XIN** dừng qua tín hiệu; tool bỏ qua tín hiệu
   vẫn chạy tiếp và kết quả chỉ bị thay **sau khi** nó settle — không hard-stop được.

## 4. Bảng TRƯỚC / SAU

| Phép đo | TRƯỚC (bundle gốc) | SAU (gói của ta) |
|---|---|---|
| Tool **không** khai `timeoutMs` | `next()` nguyên vẹn, tín hiệu caller không đổi | **y hệt** (ca 1) |
| Tool có `timeoutMs`, xong trong hạn | kết quả nguyên vẹn; `exec.signal` hoàn lại; đồng hồ bị xoá | **y hệt** (ca 2) |
| Hạn chót của ta thắng | `Error: tool call timed out after 10ms` + `ToolTimeoutError/TOOL_TIMEOUT` | **y hệt từng chữ** (ca 3) |
| Tool bỏ qua tín hiệu | kết quả **bị thay** sau khi settle | **y hệt** (ca 4) |
| Hạn chót **lồng nhau** (mã `OUTER_TIMEOUT`) | kết quả tool đi qua, **không** bị nhận nhầm | **y hệt** (ca 5) |
| Tầng dưới NÉM | lỗi đi qua; tín hiệu hoàn; đồng hồ dọn | **y hệt** (ca 6) |
| `timeoutMs = Infinity` | NÉM `deadline timeoutMs must be a positive finite number no greater than 2147483647` | **y hệt** (ca 7) |
| `timeoutMs = 0` (sentinel) | không đồng hồ, tín hiệu caller giữ nguyên | **y hệt** (ca 8) |
| Tập export trên ARTIFACT | `TOOL_TIMEOUT` · `apply` · `inject` · `name` | **4 = 4**, 0 thiếu · 0 thừa, không `default` |

Lệnh tái lập:

```bash
bun test tests/host/timeout-policy.test.ts     # 17 pass · 88 expect · 0 fail
bun run build.ts                               # ARTIFACT: lib/index.js
grep -c "id: @deepseek-ai" lib/index.js        # PHAI = 0
```

## 5. Test — 17 ca · 88 expect (≥4 ca của recipe + 3 ca bắt buộc của M6)

**8 ca A/B hành vi**: mỗi ca dựng **HAI giàn giống hệt nhau** rồi cài **cả hai** `apply` (ta + chính
bundle gốc) và so `Observation` bằng `toEqual` — gồm: kết quả, **số lượt gọi tầng dưới**, vết tra sổ
tool (kèm **danh tính** agent), tín hiệu đã hoàn, và **đồng hồ có bị bỏ quên sau settle hay không**
(phép đo này bắt đúng lỗi quên `[Symbol.dispose]`).

**Ca tập export (ARTIFACT)**: build ra thư mục tạm rồi so `Object.keys` với bundle gốc — **4 = 4**,
`apply.length` **1 = 1**, `name`/`inject`/`TOOL_TIMEOUT` khớp, `toolTimeoutResult` **không** export.

**Ca `gbh.peers ⊆ peerDependencies`**: so **PHẦN TỬ** + **ĐỐI CHỨNG ÂM** ba dạng (xoá một tên ⇒ báo
đúng tên; xoá sạch ⇒ báo đủ; cùng số lượng mà lệch phần tử ⇒ vẫn ĐỎ) + thừa tên vẫn ĐẠT.

**Ca C6 (danh tính)**: hai kết quả timeout **so sâu ĐẠT** nhưng `content`/`content[0]`/`error`/
`error.info` **khác danh tính**; sửa bản này **không lan** bản kia. Ca thứ hai: hai lượt cài tra sổ
tool của **chính context mình** (không có trạng thái cấp module), và chạy cho **cả hai** bản cài.

**Ca 000e**: `locale/{en,zh}.json` **byte-for-byte** + `exports["./locale/*.json"]`.

**Hợp đồng khai row**: `gbh.row` (Lead khai) trỏ ĐÚNG `id: timeout-policy` + ĐÚNG file test này, và KHÔNG `moduleIds`/`aliases`.

## 6. CHƯA làm (điều kiện chặn mount nếu chưa xong)

- **Chưa mount** (Lead đã khai `gbh.row` ngày 18/10/2026; mount/lab/boot là việc của Lead) ⇒ **chưa có**
  `check:app` `(5)` · `(8)` · `(9)(10)(11)` trên app 5439, và chưa có phép
  đo TRƯỚC/SAU **trên app thật** — bảng §4 hiện là **A/B trong giàn test**, không phải số trên app.
- Row này **không có bề mặt UI/route** ⇒ recipe mục 3 ca 2 (byte) và ca 4 (an ninh route) **không áp**:
  không có thân phản hồi, không có cookie, không có dữ liệu bí mật để rò.
