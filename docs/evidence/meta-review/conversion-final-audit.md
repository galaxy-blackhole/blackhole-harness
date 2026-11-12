<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 21/10/2026
 desc TASK-212: audit doc lap 10/16 goi de-bundle + 3 goi ha tang mien chuyen + chi so 'entry goc = 0',
      kem so do gate/check:app tai thoi diem ra soat.
-->

# Conversion final audit (TASK-212)

- Người rà: **tm-reviewer** · 2026-10-21 ~17:30–18:05 (Asia/Saigon). Không dùng lại script của Lead.
- Công cụ tự viết: `tools/check/audit-debundled-16.ts` (byte-compare + .debundled + test + exports), `audit-matrix-shim.ts` (payload + profile).
- Chọn mẫu: 10/16 theo seed cố định `sha256(tên thư mục)` (tái lập được).
- Môi trường: `bun run gate` cảnh báo **32 tệp vừa bị ghi trong 120 s** ⇒ số đo lúc rà có thể nhiễu do writer khác.

## 1. Bảng 10 gói × 4 tiêu chí

| # | gói | .debundled | lib/ byte-identical với stock | test trong gbh.tests & xanh | exports đủ như stock |
|---|---|---|---|---|---|
| 1 | host/sandbox-local | ✓ | ✓ 3/3 tệp | ✗ **không khai**, không có tệp test | ✓ 4 = 4 |
| 2 | host/session-title-all-prompts-llm | ✓ | ✓ 2/2 | ✓ **8 pass / 16 expect** | ✓ 2 = 2 |
| 3 | host/settings-controller | ✓ | ✓ 11/11 | ✓ 4 pass / 31 expect | ✗ **2 vs 7** — thiếu `./remote` `./src/*` `./typert` `./types` `./package.json` |
| 4 | host/agent-loop | ✓ | ✗ 62.907 B vs stock **74.599 B** (khác 11.692 B) | ✓ 25 pass / 48 expect | ✓ 3 = 3 |
| 5 | host/compaction-image-offload | ✓ | ✓ 9/9 | ✓ 6 pass / 20 expect | ✓ 4 = 4 |
| 6 | host/tool-web | ✓ | ✗ index.js **51.539 B** vs stock **34.229 B** (+17.310) | ✓ 24 pass / 158 expect | ✓ 4 = 4 |
| 7 | host/timeout-policy | ✓ | ✗ index.js **1.218 B** vs stock **4.970 B** (−3.752) | ✓ 17 pass / 88 expect | ✓ 4 = 4 |
| 8 | client/ui-settings-account | ✓ | ✗ 41 tệp giống, **client.js +322 B** (3.415.225 vs 3.414.903) | ✓ 17 pass / 110 expect | ✗ **3 vs 5** — thiếu `./locale/*.json` `./src/*` |
| 9 | host/translator | ✓ | ✓ 13/13 | ✗ tệp test **có** (`tests/host/experimental-translator.test.ts` 15 pass/34 expect) nhưng **không khai trong gbh.tests** | ✓ 4 = 4 |
| 10 | host/tool-subagent | ✓ | ✓ 8/8 | ✗ test **có** (24 pass/113 expect) nhưng **không khai** | ✗ **3 vs 6** — thiếu `./locale/*.json` + 2 nhánh `./model-selection-settings` |

**Tổng theo tiêu chí (10 gói):** `.debundled` **10/10** · byte-identical **6/10** · test khai + xanh **7/10** · exports đủ **7/10**.
⇒ Tuyên bố chung "16 gói de-bundle byte-identical + có test + exports đủ" **KHÔNG đúng cho toàn bộ**: 4 gói lệch byte, 3 gói test không khai, 3 gói thiếu exports.

## 2. Ba gói "hạ tầng miễn chuyển" — KIỂM LẠI: SAI

| stock | matrix ghi | thực tế trong repo |
|---|---|---|
| `@deepseek-ai/dsh-web-frontend` | asset-only / miễn chuyển | **có** `packages/host/web-frontend` (`gbh.provenance.stock = dsh-web-frontend`, 1 test, draft "GÓI TÀI NGUYÊN TĨNH (task-207)") |
| `@deepseek-ai/dsh-sandbox` | `MANUAL null` = chưa chuyển | **có** `packages/host/sandbox` — **có `gbh.row`**, `provenance.stock = dsh-sandbox`, 0 test |
| `@deepseek-ai/dsh-llm-deepseek` | `MANUAL null` = chưa chuyển | **có** `packages/host/llm-deepseek` (`provenance.stock = dsh-llm-deepseek`, không row, 0 test) |

⇒ 3/3 gói chọn kiểm đều **có gói GBH tương ứng** ⇒ nhãn "miễn chuyển" trong matrix (MANUAL/ASSET_ONLY) **không khớp trạng thái repo**; riêng `dsh-sandbox` còn khai `gbh.row`. Đề nghị Lead rà lại MANUAL/ASSET_ONLY trước khi chốt.

## 3. "Entry GỐC còn chạy = 0" — KHÔNG xác nhận được (và có bằng chứng ngược)

Đo độc lập trên **payload đang phục vụ** (không qua `--dump-config`):

- Payload hiện tại: **76 entry / 11 batch**; `(6)` báo **74 gói của ta** ⇒ 76 − 74 = **2 entry không phải của ta**.
- Trong URL batch còn tên stock: **`@deepseek-ai/dsh-client-ui-settings`** (đã hết sau reboot) và hiện còn **`@deepseek-ai/dsh-client-ui-directory-picker-native`**.
- Kiểm `~/.galaxy/blackhole/profiles/node_modules/@deepseek-ai/<tên>`: **không tồn tại** ⇒ module đó được phục vụ từ **stock node_modules của harness**, không qua profile redirect.
- Profile: **264** thư mục stock; **249** trong đó có gói GBH mapping (harness vẫn cần cho import nội bộ) ⇒ **sự hiện diện trong profile không chứng minh đang chạy**, nhưng payload thì có.

Kết luận: tầng **client** còn **1 module stock chạy thật** ⇒ phát biểu "entry gốc còn chạy = 0" **FAIL** nếu hiểu toàn cục; tầng **host** chưa đo lại được vì `--dump-config` fail build `packages/client/ui-conversation` (`ENOENT src/parts/01-requires.ts`).

## 4. Gate + check:app tại thời điểm rà

**`bun run gate` (8 cổng):** 7 XANH (header 3.684 file · file-length · jsdoc · dep-guard 4.823 · parity-matrix · typecheck 2.559 · hygiene 189) · **ĐỎ `test` (1 vi phạm, 150.024 ms)** · cảnh báo **32 tệp vừa ghi < 120 s** ⇒ kết quả test lúc này **không đáng tin** (chính gate tự cảnh báo).

**`check:app` (11 chỉ số):**
| chỉ số | đo được |
|---|---|
| (1) | 81.184 B |
| (2) | có `__GBH_BOOT__` |
| (3) | **76 entry** |
| (4) | 11 batch · release 0.1.0 |
| (5) | **0** dòng "did not activate" |
| (6) | **74 gói của ta** đang chạy |
| (7) | 76 / mốc 72 |
| (8) | #root **47.551** · **46 slot** · 0 console · 0 pageerror |
| (9) | **0/80** lệch (nhưng baseline là của chính ta — xem audit TASK-194) |
| (10) | **KHÔNG ĐẠT**: 1 bản mount cũ `gbh-client-ui-chat/client.js` (repo `6f6e1d0e26d5` mới hơn mount `c46810156f1a`) |
| (11) | HMR 200 · SSE connected |

⇒ **KẾT LUẬN app: "LANH nhưng đang chạy bản build cũ của 1 chỉ số"** — không phải app hỏng, nhưng **không thể coi là 11/11 sạch** ở thời điểm rà.

## 5. Kết luận PASS/FAIL theo claim matrix

| claim | kết quả |
|---|---|
| 16 gói de-bundle: lib byte-identical 100% | **FAIL** — mẫu 10: 6/10 identical; 4 gói lệch (agent-loop, tool-web, timeout-policy, ui-settings-account) |
| 16 gói de-bundle: có test trong gbh.row.tests và xanh | **FAIL** — 7/10 khai + xanh; sandbox-local không có tệp test; translator & tool-subagent có test nhưng không khai |
| 16 gói: exports đủ như stock | **FAIL** — 7/10; settings-controller, ui-settings-account, tool-subagent thiếu nhánh |
| 3 gói hạ tầng "miễn chuyển" | **FAIL** — cả 3 đều có gói GBH khai đúng stock; `dsh-sandbox` còn có `gbh.row` |
| "entry gốc còn chạy = 0" | **FAIL (client)** — payload còn `dsh-client-ui-directory-picker-native` từ stock harness; host chưa đo lại được |
| gate 8/8 XANH | **KHÔNG ĐẠT lúc rà** — test đỏ + cảnh báo 32 tệp vừa ghi |
| app 11/11 | **KHÔNG ĐẠT lúc rà** — (10) 1 bản mount cũ; app vẫn "LANH" |

## 6. Đề nghị

1. Rà lại **MANUAL/ASSET_ONLY** của matrix cho `dsh-web-frontend`, `dsh-sandbox`, `dsh-llm-deepseek`.
2. Với 4 gói lệch byte: xác nhận **cố ý** (port viết lại) hay **nợ debundle**; nếu cố ý thì matrix không được quảng cáo "byte-identical".
3. Khai đủ test + exports cho: sandbox-local (thiếu test), translator, tool-subagent (khai test), settings-controller, ui-settings-account, tool-subagent (exports).
4. Đo lại "entry gốc" bằng **payload đang phục vụ** (đếm entry có URL `@deepseek-ai/*` không resolve qua profile) — đây là phép đo sống, không phụ thuộc `--dump-config`.
5. Chạy lại gate khi repo **yên** (không writer) và boot lại để (10) sạch trước khi chốt số cuối.
