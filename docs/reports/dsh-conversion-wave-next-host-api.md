<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Khảo sát 5 package host/api nhỏ nhất còn 'X' trong docs/DSH-CONVERSION-MATRIX.md (dsh-api-* · dsh-session-* · dsh-typert-*) — số dòng bundle gốc + mức rủi ro + đề xuất wave
-->

# Khảo sát wave kế tiếp: 5 gói host/api nhỏ nhất còn `X`

> Người làm: tm-host-core (18/10/2026). Phạm vi khảo sát **CHỈ ĐỌC**: `apps/host/node_modules/@deepseek-ai/<pkg>/lib/**` + `package.json`
> + `docs/DSH-CONVERSION-MATRIX.md`. **Không sửa** ma trận (Lead sở hữu) và không sửa package nào ngoài task-5.

## 0. Cách đo (tái lập được)

- Nguồn trạng thái: `docs/DSH-CONVERSION-MATRIX.md` §3, cột **trạng thái** = `X` (chưa có package GBH 1:1).
- Số dòng: `lib/index.js` = dòng **host entry**; `lib/client.js` = dòng **nửa browser** (0 = gói MỘT MẶT).
- Bài học từ chính task-5: **số dòng host KHÔNG phản ánh chi phí** — `dsh-client-file-upload` chỉ 311 dòng host nhưng
  vẫn phải port 12 method + route + 4 seam; ngược lại gói 114 dòng có thể bị **chuỗi phụ thuộc** chặn.

## 1. NĂM gói nhỏ nhất (theo dòng host entry) còn `X`

| # | package DSH | nhóm | host `index.js` | `client.js` | một/hai mặt | bề mặt đo được | rủi ro |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-session-format-catalog` | session | **114** | 0 | một mặt | 4 export: `sessionFormatCatalog` · `historicalSessionFormatCatalog` · `createSessionFormatCatalogWithChildren` · `SessionFormatUnsupportedMigrationError` | **CAO (chuỗi)** |
| 2 | `dsh-session-title-first-prompt-llm` | session | **118** | 0 | một mặt | `apply` · `inject` · `name` · `Config`; gọi `ctx.sessionTitle.register(...)` | **TRUNG** |
| 3 | `dsh-session-log-deepseek` | session | **196** | 0 | một mặt | `apply` · `inject` · `name` · `Config`; gọi `ctx.deepseekLlmApiExtensions.register(...)` + `ctx.sessions.get(...)` | **TRUNG** |
| 4 | `dsh-session-title-llm` | session | **230** | 0 | một mặt | 5 export hàm/schema: `executeSessionTitleLlm` · `resolveSessionTitleLlmConfig` · `SessionTitleLlmConfigSchema` · `SessionTitleLlmConfigFields` · `SESSION_TITLE_TIMEOUT_CODE`; gọi `ctx.llm.prepareCall` | **TRUNG** |
| 5 | `dsh-session-persistence` | session | **270** | 0 | một mặt | 15 export: `SessionPersistence` (**abstract class**, cũng là `default`) + 8 lớp lỗi + 6 helper (`assertContiguous` · `materializeAppendBatch` · …) | **THẤP về code / CAO về DANH TÍNH** (xem §3) |

Năm gói đều **MỘT MẶT** (không có `dsh.client`) ⇒ không phải lo nửa browser/boot graph — đây là lý do chúng rẻ hơn nhóm `api-*`.

## 2. Vì sao KHÔNG chọn vài gói trông nhỏ hơn

| package | số dòng trông nhỏ | bẫy thật |
|---|---|---|
| `dsh-api-remotes` | host `index.js` **258** | **HAI MẶT**, `lib/client.js` **23.699 dòng** — và chính nó mang `TYPERT_REMOTE` của 10+ controller (bảng remote BFF). Port sai một manifest là mọi RPC client gãy. **Không phải gói nhỏ.** |
| `dsh-api-job-controller` | 378 | hai mặt: client **367** + host lib tổng 1.282; có `./typert` + `./remote` |
| `dsh-api-remote-access` | 442 | hai mặt: client **733**; inject `dsh-client-ui-renderer` |
| `dsh-typert-protocol` | 481 | **trung tâm danh tính**: `Remote` decorator ghi metadata lên prototype bằng symbol **module-local**; `RemoteError.isDSHRemoteError` là cờ cấu trúc nhưng `TypertRemoteService`/`remoteMethods` phụ thuộc **cùng một thể hiện module**. 4+ gói đã chuyển (`message-feedback` · `goal` · `product-analytics` · `account-controller`) đang khai peer vào **gói stock** ⇒ đổi gói này phải đổi **đồng bộ mọi consumer** (xem §3). |
| `dsh-typert-registry` | 633 | một mặt host nhưng `dsh.client` khai `immediately: true` + là seam của `dsh-api-gateway` (X) |

## 3. HAI bẫy danh tính phải xử lý TRƯỚC khi giao wave

### 3a. Gói là LỚP CHA của gói khác ⇒ thay row sẽ tạo HAI lớp cha

Đo được: `packages/host/session-telemetry-otel/src/index.ts:23,192` — gói **đã chuyển** của ta:

```ts
import { SessionTelemetryBackend } from "@deepseek-ai/dsh-session-telemetry"; // peer STOCK
export class OpenTelemetrySessionBackend extends SessionTelemetryBackend { … }
```

⇒ Nếu thay row `session-telemetry` bằng lớp của ta, backend của ta vẫn `extends` lớp **stock** ⇒ hai lớp cha khác nhau.
Cùng hình dạng: `dsh-session-persistence` ← `dsh-session-persistence-jsonl` (X, 3.643 dòng, `extends SessionPersistence`);
`dsh-session-format` ← 5 codec X; `dsh-api-gateway` ← nhiều controller.
**Luật rút ra (đúng mục 2b của HOST-ROW-REWRITE)**: gói bị kế thừa chỉ được thay **cùng lượt** với consumer,
hoặc phải chứng minh `Object.getPrototypeOf(OurClass) === Object.getPrototypeOf(StockClass)`.

### 3b. Gói PROTOCOL bị nhiều gói import làm peer

`dsh-typert-protocol` (481 dòng) đang là `peerDependencies` của **4 gói GBH đã chuyển** + mọi row `-` sắp ký.
Đổi nó = sửa **đồng bộ** danh sách peer + test của 4 gói đó (không thể làm trong một vùng ghi đơn lẻ).

## 4. Đề xuất wave (theo rủi ro THẤP → CAO, giữ đúng thứ tự tầng T2 → T3 → T4 → T0/T1)

| wave | gói | vì sao xếp ở đây | điều kiện tiên quyết |
|---|---|---|---|
| **A (làm ngay, 1 vùng ghi/gói)** | `dsh-session-log-deepseek` (196) · `dsh-session-title-llm` (230) · `dsh-session-title-first-prompt-llm` (118) | host-only, `apply` + `Config` + seam **đã có row đang chạy** (`deepseekLlmApiExtensions` · `llm` · `sessionTitle`); peer hợp lệ §3b (`dsh-llm`) | mỗi gói 1 teammate; test A/B bundle gốc như task-5 |
| **B (làm sau A, cần phối hợp)** | `dsh-session-format-catalog` (114) | nhỏ nhất nhưng **chặn bởi 5 codec X + compaction-image-offload** ⇒ chỉ port khi đã có `session-format` + các `vX-to-vY` | chốt thứ tự codec trước; nếu chưa, **để cuối** |
| **C (M3 hoặc cùng consumer)** | `dsh-session-persistence` (270) · `dsh-session-telemetry` (280) · `dsh-typert-registry` (633) · `dsh-typert-protocol` (481) | chúng là **lớp cha/protocol** của gói khác ⇒ thay lẻ sẽ tạo hai thể hiện | phải sửa **đồng thời** consumer (jsonl · telemetry-otel · 4 gói GBH đang dùng protocol) + có test `Object.getPrototypeOf` và test «một thể hiện duy nhất» |
| **KHÔNG giao sớm** | `dsh-api-remotes` (host 258 / client 23.699) · 7 `api-*-controller` còn lại | hai mặt, client bundle lớn, mang manifest remote của cả BFF | sau khi có `dsh-api-gateway` + quy ước manifest remote |

## 5. Đề nghị cụ thể cho Lead

1. Giao **wave A** cho 1–3 teammate, mỗi người MỘT gói (đúng luật một vùng ghi): `session-log-deepseek` · `session-title-llm` ·
   `session-title-first-prompt-llm`. Ba gói này **không** là lớp cha của ai ⇒ mount lẻ an toàn.
2. **Chưa giao** `session-persistence` / `session-telemetry` / `typert-*` cho tới khi có task **đổi đồng bộ consumer**
   (mỗi task ghi rõ 2+ vùng ghi, do Lead điều phối) — nếu không sẽ lặp lại lớp lỗi *hai lớp cha* đã có tiền lệ.
3. `dsh-session-format-catalog` xếp **sau** chuỗi codec, không phải wave kế tiếp dù chỉ 114 dòng.
4. Khi giao wave A: dùng đúng khuôn task-5 (`gbh.row` khai cuối · test A/B cả hai bản trên cordis Context thật ·
   `lab:row` 0/0 · `check:rows` 0 chặn · gate `--no-tests`) — chi phí đo đã được chứng minh ~1 phiên/gói nhỏ.

## 6. Bảng số đo thô (để Lead tự xếp lại nếu muốn)

| package | host index | host lib tổng | client | hai mặt |
|---|---|---|---|---|
| `dsh-session-format-catalog` | 114 | 114 | 0 | không |
| `dsh-session-title-first-prompt-llm` | 118 | 118 | 0 | không |
| `dsh-session-log-deepseek` | 196 | 196 | 0 | không |
| `dsh-session-title-llm` | 230 | 230 | 0 | không |
| `dsh-api-remotes` | 258 | 23.957 | 23.699 | **CÓ** |
| `dsh-session-persistence` | 270 | 270 | 0 | không |
| `dsh-session-telemetry` | 280 | 280 | 0 | không |
| `dsh-api-job-controller` | 378 | 1.282 | 367 | **CÓ** |
| `dsh-api-remote-access` | 442 | 1.485 | 733 | **CÓ** |
| `dsh-typert-protocol` | 481 | 481 | 0 | không |
| `dsh-session-format` | 492 | 492 | 0 | không |
| `dsh-session-log-export` | 566 | 883 | 317 | **CÓ** |
| `dsh-typert-registry` | 633 | 1.935 | 0 | không (có `dsh.client`) |
| `dsh-api-workspace-files` | 638 | 2.151 | 480 | **CÓ** |
| `dsh-session-reference` | 746 | 1.629 | 0 | không |

(12 gói `api-*`/`session-*`/`typert-*` còn lại lớn hơn: xem `docs/DSH-CONVERSION-MATRIX.md` §4.)

## 7. Ghi chú về task-5 (gói vừa xong, để đối chiếu chi phí)

`dsh-client-file-upload` = 311 host + 319 client, **hai mặt**, 12 method/prototype, 1 route, 4 seam, 3 lệnh ghi của consumer →
**1 phiên** của một teammate. Đây là mốc chi phí thực tế để Lead ước lượng wave A (3 gói host-only nhỏ hơn ⇒ kỳ vọng ≤ 1 phiên cả 3 nếu chia 3 teammate).
