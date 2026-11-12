<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Nguon doi chieu (G4) + ly do peer + bang TRUOC/SAU + phan CHUA lam cua @galaxy-blackhole/gbh-session-checkpoint-policy
-->

# `@galaxy-blackhole/gbh-session-checkpoint-policy`

Bản viết lại của Galaxy Blackhole cho **row host `session-checkpoint-policy`** của DSH
(`@deepseek-ai/dsh-session-checkpoint-policy`) — **chính sách checkpoint phiên**: ghi bền sự kiện
đã cam kết **trước request model**, **trước tác dụng phụ của tool top-level**, và ở **mỗi ranh giới bước**.

## 1. Cặp row đã xác nhận (bước 0) + phân loại MỘT MẶT

| Việc | Bằng chứng đo được |
|---|---|
| Cặp row có thật | `.parity/dumps/2026-10-17T23-25-26/ours.yml` dòng **377–378**: `- id: session-checkpoint-policy` + `name: '@deepseek-ai/dsh-session-checkpoint-policy'`; `oracleA.yml` dòng **369–370** giống hệt ⇒ row **đang BẬT**, **không `disabled`**, **không `config`**, **không `inject`** |
| MỘT MẶT | `ls apps/host/node_modules/@deepseek-ai/dsh-session-checkpoint-policy/lib/` ⇒ **chỉ `index.js` (78 dòng) + `types/`** — **KHÔNG có `lib/client.js`** |
| Câu hỏi 5 (`dsh.client`) | `python3 -c "…get('dsh').get('client')"` ⇒ **False** |
| 000e (`locale/`) | Gói gốc **CÓ** `locale/{en,zh}.json` (61 B · 155 B) ⇒ đã chép **byte-for-byte** (`shasum fa92eb01…` · `9cb23a5f…` khớp cả hai chiều) |
| Hồ sơ chi phí (`row:cost`) | **79 dòng** build · **0** inject trong row · **0** primitive · **0** khoá từ điển · **không** trạng thái sống ⇒ row rẻ, đúng hạng "policy thuần listener" |

## 2. Nguồn đối chiếu (G4) — đọc CHỈ ĐỌC, rồi viết lại

| Bản gốc (CHỈ ĐỌC) | Của ta | Ghi chú |
|---|---|---|
| `apps/host/node_modules/@deepseek-ai/dsh-session-checkpoint-policy/lib/index.js` (**78 dòng**, `0.2.1-alpha.4`) | `src/index.ts` (**62 dòng** nguồn ⇒ **55 dòng** `lib/index.js` đã build) | Ba listener + `name` + `inject`; **không** có `Config`, **không** có nửa browser |
| `…/lib/types/index.d.ts` (23 dòng — chỉ `name` · `inject` · `apply`) | `src/types.ts` | Mặt cắt seam khai theo **CẤU TRÚC**: sổ phiên + ba điểm mở rộng cordis |
| `…/lib/index.js` (hàm `abortedBeforeDispatchResult`, không export) | `src/result.ts` | Vật thể **mới mỗi lần gọi**; mã lỗi lấy từ **hằng của kernel**, không chép chuỗi |
| `…/README.md` mục *What becomes durable* / *Observable behavior* | §4 dưới đây | Ba rào ghi bền + hai đường fail-closed |

**Bản gốc không có `config`**: row trong `ours.yml` không khai `config`, và module gốc không có
`Config`/`schema` — nên gói ta **cũng không có `Config`** (không tự thêm bề mặt).

## 3. Vì sao peer là `@deepseek-ai/dsh-tools` (và không cần `cordis`)

| Peer | Vì sao | Ở đâu |
|---|---|---|
| `@deepseek-ai/dsh-tools` | Cần **đúng hằng `TOOL_ABORTED_BEFORE_DISPATCH`** của kernel (`"ABORTED_BEFORE_DISPATCH"`): mã lỗi này đi vào **log bền** và được tầng chính sách định tuyến ⇒ chép chuỗi sẽ trôi khi kernel đổi | `src/result.ts` |
| `@deepseek-ai/cordis` | **KHÔNG khai** — gói không `import` cordis: seam khai **theo CẤU TRÚC** (`CheckpointContext`). `apps/cli/src/mount.ts:133` luôn symlink `cordis` + `schemastery` cho mọi gói, nên không thiếu lúc chạy | — |

`gbh.peers` = `["@deepseek-ai/dsh-tools"]` ⊆ `peerDependencies` (**0 tên lệch**, có **đối chứng âm** trong test).
Peer **không** nằm trong `dependencies` (tránh thể hiện thứ hai — kernel cấp một thể hiện duy nhất).

## 4. Ba rào ghi bền — hành vi trung thành (kể cả các chi tiết dễ "cải tiến" sai)

1. **`llm/stream`** — chỉ khi `options.sessionId !== undefined` **và** `ctx.sessions.get(id)` trả phiên sống.
   Luồng trả về là **generator LƯỜI**: lúc listener trả về **chưa** ghi bền; `flush` chạy ở **lần kéo chunk đầu**,
   rồi mới `yield*` luồng adapter ⇒ **adapter không được dựng** nếu checkpoint hỏng (fail-closed).
   Không có phiên ⇒ trả **NGUYÊN** luồng hạ nguồn (so **danh tính** trong test).
2. **`tools/execute`** — chỉ lời gọi **top-level** (`exec.agent !== undefined && exec.parent === undefined`):
   ghi bền `exec.agent.session` **trước** thân tool. Lời gọi **lồng nhau** (PTC, có `parent`) **dùng lại**
   checkpoint của lời gọi ngoài ⇒ **0 flush**.
   ⚠️ Thứ tự trung thành: **flush chạy TRƯỚC** khi kiểm `exec.signal.aborted` — nên tín hiệu đã huỷ từ trước
   **vẫn ghi bền một lần** rồi mới trả kết quả canonical.
   Kết quả canonical: `{ content: [{type:"text", text:"Error: tool call aborted before dispatch"}], isError: true,
   error: { message: "tool call aborted before dispatch", info: { name: "AbortError", code: TOOL_ABORTED_BEFORE_DISPATCH } } }`
   ⇒ **thân tool không chạy** (0 lượt gọi `next`).
3. **`agent/pre-step`** — ghi bền batch response + kết quả tool của bước **TRƯỚC** rồi mới `next()`;
   flush ném ⇒ lượt hỏng **trước khi** request kế tiếp được dựng.

⚠️ **Cờ boolean của `flush` bị BỎ QUA có chủ ý** — hợp đồng kernel (`dsh-session/lib/types/index.d.ts:483`):
`flush` trả *"có listener ghi bền nào tham gia không"* **sau khi** mọi listener xong, và **NÉM** lỗi listener đầu tiên.
Vì vậy **thành công = không ném**, không phải `=== true`. Test có ca riêng: `flush` trả `false` ⇒ **vẫn chạy tiếp** (y bản gốc).

## 5. Nghiệm thu (đo trên máy, 18/10/2026)

| Phép đo | Kết quả |
|---|---|
| `bun test tests/host/session-checkpoint-policy.test.ts` | **20 pass · 0 fail · 86 expect** |
| Đối chứng hành vi | **10 ca** dựng **HAI giàn giống hệt** rồi chạy **CẢ HAI** `apply` (ta + chính bundle gốc), so `{vết gọi seam, chunk, kết quả, số lượt gọi tầng dưới, lỗi}` bằng `toEqual` |
| Tập export trên **ARTIFACT** | `Object.keys(ta) = Object.keys(gốc) = ["apply","inject","name"]` — **0 thiếu · 0 thừa**, không `default`; `apply.length` **1 = 1**; `inject` **4 = 4** nguyên văn + đúng thứ tự |
| Artifact id module | `grep -c "id: @deepseek-ai" lib/index.js` = **0** · `grep -c "id: @galaxy-blackhole"` = **0** (host-only, không có bundle) |
| `gbh.peers ⊆ peerDependencies` | **0 tên lệch** + **đối chứng âm** (xoá từng peer ⇒ báo **đúng tên**; xoá sạch ⇒ báo **đủ**) + đối chứng âm thứ hai (thừa tên vẫn ĐẠT) |
| 000e locale | `shasum` **khớp byte-for-byte** (`en.json` `fa92eb01…` · `zh.json` `9cb23a5f…`) |
| C6 (độc lập vật thể) | Kết quả canonical dựng **mới mỗi lần**: `content`/`error`/`info` **khác danh tính**, sửa một **không lan**; hai lượt dispatch huỷ ⇒ hai vật thể riêng |
| Test canh mount | Khẳng định `gbh.row` **vẫn chưa khai** (ai bật sớm ⇒ test ĐỎ) |

## 6. TRƯỚC / SAU

| Phép đo | TRƯỚC (row gốc) | SAU (gói ta) |
|---|---|---|
| Vết 3 ranh giới trên cùng giàn (mục 5) | `get:s1 → flush:s1 → next` · `flush:s1 → next` · `flush:s1 → next` | **y hệt từng phần tử** (so bằng `toEqual`) |
| Kết quả huỷ trước dispatch | canonical `ABORTED_BEFORE_DISPATCH` | **trùng từng phần tử** |
| 0 lần flush khi request không phiên / tool lồng nhau / tool không agent | đúng | **đúng** |
| App 5439 (`check:app`) | — | **CHƯA ĐO** — gói **chưa mount** (xem §7) |

Cách tái lập: `bun test tests/host/session-checkpoint-policy.test.ts` (tự build ARTIFACT vào
`lib/test-artifact/`, dọn ở `afterAll`).

## 7. CHƯA làm (điều kiện chặn mount — nói thẳng)

- **Chưa khai `gbh.row`** — theo đúng luật "chưa nghiệm thu thì chưa nhận rủi ro mount".
- **Chưa chạy `lab:row`** và **chưa mount** trên app 5439 ⇒ **chưa có** TRƯỚC/SAU ở tầng app
  (`(5) did not activate` · `(6) gói của ta đang chạy` · `(8) #root`/lỗi console · `(11) HMR`).
- **Chưa đo độ bền thật** (kill tiến trình giữa request rồi khôi phục phiên) — phép đo đó cần home cách ly
  + backend `session-persistence` của kernel, thuộc lượt boot của Lead.
- Khi mount: `mount.ts` sẽ symlink `@deepseek-ai/dsh-tools` theo `gbh.peers` — **không** cần symlink `cordis`
  (gói không import), nhưng `mount.ts` vẫn luôn symlink `cordis`+`schemastery`.

## 8. Bản đồ file

| File | Dòng | Vai trò |
|---|---|---|
| `src/index.ts` | 62 | `name` · `inject` · `afterCheckpoint` · `apply` (ba listener) |
| `src/result.ts` | 35 | Kết quả canonical cho lời gọi bị huỷ trước khi vào thân tool |
| `src/types.ts` | 141 | Mặt cắt seam theo cấu trúc: sổ phiên + ba điểm mở rộng cordis |
| `build.ts` | 36 | Build ESM ra `lib/index.js`, nhận `process.argv[2]` |
| `locale/{en,zh}.json` | 5 · 6 | Bản gốc có ⇒ chép **byte-for-byte** (000e) |
| `tests/host/session-checkpoint-policy.test.ts` | 528 | 20 test (đối chứng gốc · ARTIFACT · peer ⊆ · 000e · C6 · test canh) |
