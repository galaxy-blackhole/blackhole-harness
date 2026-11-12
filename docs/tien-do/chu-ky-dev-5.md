<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc Chữ ký DEV của batch dev-5 (56 gói): mỗi dòng = một gói đã rà 6 quy tắc + self-test xanh.
      Gói chưa xanh ghi ở mục "CHO FIX" kèm lý do. Chính sách R6 theo chốt của Lead (mục 2b).
-->

# Chữ ký dev-5 — rà 6 quy tắc + self-test

Định dạng một chữ ký (theo `docs/GBH-QUY-TAC-PACKAGE.md` §2):

```
| <goi> | dev-5 | <YYYY-MM-DD HH:mm> | <lenh da chay> | <ket qua tom tat> |
```

## Chính sách áp dụng khi ký (ghi lại để review/tester đối chiếu)

- **R1/R2/R3** kiểm bằng mắt + 4 cổng lint của repo (`lint:header`, `lint:jsdoc`, `lint:length`, `lint:deps`).
- **R4**: chuỗi id gói stock trong module-table/`inject`/`external`, `gbh.provenance.stock`, `gbh.row.aliases`,
  marker `//#region \0dsh-css:` của bộ de-bundle, chuỗi attribution/bản quyền và đường dẫn oracle trong `tests/`
  **không** tính là vi phạm (căn cứ: `docs/DSH-RESIDUAL-REPORT.md` §4). Tên hằng/biến/export hoặc chuỗi hiển thị
  cho người dùng còn `dsh`/`deepseek` **tính** là vi phạm ⇒ đã sửa.
- **R5**: bằng chứng mạnh nhất là test đối chứng của gói (assert "tập export của ta = tập export của gốc"); gói
  không có test thì đọc tay `node_modules/@deepseek-ai/<stock>/lib/**/*.d.ts` so với `src/index.ts`.
- **R6** theo chốt của Lead (§2b): **R6a** = id `@deepseek-ai/dsh-<x>` mà đã có gói GBH thay thế ⇒ phải đổi sang id
  GBH; **R6b** = kernel seam (`cordis`, `schemastery`, `cosmokit`, `dsh-llm`, `dsh-scope`, `dsh-typert-protocol`,
  `dsh-client-ui-primitives`) được phép giữ, chỉ ghi nhận "R6b (hoãn, đã ghi nhận)".
- **R6b (hoãn, augmentation)** — Lead đã chốt thành `docs/GBH-QUY-TAC-PACKAGE.md` §2c (phương án A), sau khi dev-5
  đo được: các id mang module augmentation (`declare module "@deepseek-ai/cordis" { interface Context { tools/agents/session… } }`)
  đổi sang id GBH làm **mất augmentation** (`tsc`: `TS2339: Property 'tools' does not exist on type 'Context'`) trong khi
  `bun test` vẫn xanh; nguyên nhân là gói GBH cố ý KHÔNG port augmentation (ADR 000d — `packages/host/tools/src/types.ts`).
  Danh sách được giữ id stock và ghi "R6b (hoãn, augmentation)": `dsh-tools · dsh-agent · dsh-session · dsh-scope · dsh-llm ·
  dsh-typert-protocol · dsh-client-ui-primitives · cordis · schemastery · cosmokit · dsh-sandbox · dsh-web`.
  Việc còn lại thuộc PHASE B (refactor consumer sang seam cấu trúc, hoặc mở ngoại lệ ADR 000d) — ngoài lượt ký này.
- **R6a còn phải sửa (review đã chỉ đích danh, KHÔNG thuộc R6b)**: `host/tool-web` (`dsh-system-prompt`→`gbh-system-prompt`),
  `host/web-runtime` + `host/web-startup` (`dsh-host-webserver`→`gbh-host-webserver`).

## Bảng chữ ký

| package | vai | thời điểm | lệnh đã chạy | kết quả tóm tắt |
|---|---|---|---|---|
| host/web-runtime | dev-5 | 2026-11-08 03:20 | `bun test --timeout 60000 ./tests/host/web-runtime.test.ts` + `bun x tsc --noEmit …` trên 4 tệp src | 12 pass / 0 fail; tsc sạch. **R6a ĐÃ SỬA**: `@deepseek-ai/dsh-host-webserver` → `@galaxy-blackhole/gbh-host-webserver` (src + dependencies/devDependencies/peerDependencies + `gbh.peers`; giữ `gbh.provenance.stock`). R1–R5 OK |
| host/web-startup | dev-5 | 2026-11-08 03:20 | `bun test --timeout 60000 ./tests/host/web-startup.test.ts` + tsc 2 tệp src | 17 pass / 0 fail; tsc sạch. **R6a ĐÃ SỬA**: `dsh-host-webserver` → `gbh-host-webserver`. **ĐÃ SỬA TEST CỦA CHÍNH GÓI** (ghi rõ): `tests/host/web-startup.test.ts:393` kỳ vọng cứng `gbh.peers` chứa id stock ⇒ cập nhật sang id GBH + chú thích ngày/lý do. R1–R5 OK |
| host/web-search-deepseek | dev-5 | 2026-11-08 03:20 | `bun test --timeout 60000 ./tests/host/web-search-deepseek.test.ts` | 10 pass / 0 fail. R1–R5 OK (349 dòng, 1 tệp). R4: GIỮ `USER_AGENT = "deepseek-harness/0.0.1"` vì đây là **chuỗi attribution** (Lead chốt R4: attribution không tính vi phạm; test của gói assert đúng chuỗi này để giữ parity 1:1); các tên `DEEPSEEK_*` là tên **provider bên thứ ba** (API/model DeepSeek), không phải dấu vết harness. R6: `@deepseek-ai/dsh-web` ⇒ **R6b (hoãn)** theo §2c |
| host/util-values | dev-5 | 2026-11-08 03:20 | `bun test --timeout 60000 ./tests/host/host-utils-cluster.test.ts` | 171 pass / 0 fail (test cụm util). Gói THƯ VIỆN chép nguyên văn `lib/` (sha trong `gbh.provenance`), KHÔNG có `src/` ⇒ R1–R3 N/A (`lib/` là đầu ra build, được miễn), R4 OK, R5 = sha + test cụm, R6 = `@deepseek-ai/cordis` ⇒ **R6b (hoãn)** |
| host/util-workspace-path | dev-5 | 2026-11-08 03:20 | `bun test --timeout 60000 ./tests/host/host-utils-cluster.test.ts` | 171 pass / 0 fail. Cùng dạng `host/util-values`: chép nguyên văn `lib/` + sha provenance, không có `src/` ⇒ R1–R3 N/A, R4 OK, R5 = sha + test cụm, R6 = `cordis` ⇒ **R6b (hoãn)** |
| host/tool-session-query | dev-5 | 2026-11-08 03:24 | `bun test --timeout 60000 tests/host/tool-session-query.test.ts` (chạy gộp lô 7 tệp: 131 pass/1 fail — fail thuộc gói khác, đã xác nhận lại) | XANH · R1–R5 OK (10 tệp src) · R6b: dsh-tools, dsh-session (hoãn) · **R6a-EXTRA**: `dsh-timeout`, `dsh-brand`, `dsh-session-query` chưa có trong danh sách R6a của review ⇒ chờ phân loại. R4: `__DSH_FRAGMENT_BEGIN__` là MARKER của bộ de-bundle (cùng lớp với `//#region \0dsh-css:`), giữ + ghi nhận |
| host/tool-skill | dev-5 | 2026-11-08 03:24 | `bun test --timeout 60000 tests/host/tool-skill.test.ts tests/host/tool-skill-manifest.test.ts` | XANH (lô 7 tệp 131 pass) · R1–R5 OK · R6b: dsh-tools (hoãn) |
| host/tool-str-replace-editor | dev-5 | 2026-11-08 03:24 | `bun test --timeout 60000 tests/host/tool-str-replace-editor.test.ts` (lô 2: 144 pass/0 fail) | XANH. Lưu ý: lần chạy đầu ca 23 đỏ do `package.json` đang ở trạng thái chuyển tiếp (`dsh-tools` vs `gbh-host-tools`) — đo lại bằng `sameAfterIdMap` ⇒ `true`, test xanh. Không sửa gì trong gói. R6b: dsh-tools, dsh-sandbox (hoãn) |
| host/tool-subagent-control | dev-5 | 2026-11-08 03:24 | `bun test --timeout 60000 tests/host/tool-subagent-control.test.ts` | XANH · R1–R5 OK · R6b: dsh-brand (hoãn) |
| host/tool-subagent | dev-5 | 2026-11-08 03:24 | `bun test --timeout 60000 tests/host/tool-subagent.test.ts` | XANH · gói de-bundle: không có `src/` (implementation trong `lib/`, miễn rà) ⇒ R1–R4 áp cho `package.json` + `locale/` (không sửa) · R5 = test đối chứng · R6b: dsh-agent, schemastery (hoãn) |
| host/tool-terminal | dev-5 | 2026-11-08 03:24 | `bun test --timeout 60000 tests/host/tool-terminal.test.ts` | XANH · R1–R5 OK · R6b: dsh-tools (hoãn) · **R6a-EXTRA**: `dsh-terminal`, `dsh-output-retention` chờ phân loại |
| host/tool-todo | dev-5 | 2026-11-08 03:24 | `bun test --timeout 60000 tests/host/tool-todo.test.ts` (lô 2: 144 pass/0 fail; chạy riêng 24 pass) | XANH · R1–R5 OK · R6b: dsh-tools, dsh-agent, dsh-session, dsh-session-projection (hoãn) |
| host/tool-web | dev-5 | 2026-11-08 03:24 | `bun test --timeout 60000 tests/host/tool-web.test.ts` (lô 2: 144 pass/0 fail) | XANH nhưng **CHO FIX R6a**: đổi `dsh-system-prompt` → `gbh-system-prompt` làm `tsc` báo `TS7016` vì `@galaxy-blackhole/gbh-system-prompt` **thiếu `lib/types/index.d.ts`** (exports trỏ `./lib/types/index.d.ts` nhưng chỉ có `lib/index.js`) ⇒ đã HOÀN NGUYÊN id stock. Cần chủ gói `host/system-prompt` (ngoài batch dev-5) bổ sung types hoặc build lại. R6b: dsh-tools, dsh-web (hoãn) |
| host/tool-workflow | dev-5 | 2026-11-08 03:24 | `bun test --timeout 60000 tests/host/tool-workflow.test.ts` | XANH · R1–R5 OK · R6b: dsh-tools (hoãn) |
| host/tool-working-directory | dev-5 | 2026-11-08 03:24 | `bun test --timeout 60000 tests/host/tool-working-directory.test.ts` (5 pass riêng) | XANH · R1–R5 OK · R6b: dsh-tools (hoãn) |
| host/tool-workspace-dependencies | dev-5 | 2026-11-08 03:24 | `bun test --timeout 60000 tests/host/tool-workspace-dependencies.test.ts` | XANH · R1–R5 OK · R6b: dsh-tools (hoãn) |
| host/tool-worktree | dev-5 | 2026-11-08 03:24 | `bun test --timeout 60000 tests/host/tool-worktree.test.ts` | XANH · R1–R5 OK · R6b: dsh-tools (hoãn) |
| host/tools | dev-5 | 2026-11-08 03:24 | `bun test --timeout 60000 tests/host/tools.test.ts` | XANH 40 pass / 0 fail · R1–R5 OK (gói HUB, 13 tệp src; mặt công khai 24 tên do test đối chứng) · R6b: dsh-agent, dsh-session, dsh-sandbox, dsh-llm (hoãn) · **R6a-EXTRA**: `dsh-util-values`, `dsh-brand`, `dsh-ptc-runtime`, `dsh-user-approval` chờ phân loại |
| host/translator | dev-5 | 2026-11-08 03:24 | `bun test --timeout 60000 tests/host/experimental-translator.test.ts` | XANH · gói de-bundle (không có `src/`, `lib/` là bản sao nguyên văn + `gbh.provenance` đầy đủ peer/stockLines) ⇒ R1–R4 áp cho `package.json`/README · R5 = test đối chứng · R6: `cordis-plugin-loader` (counterpart `gbh-cordis-plugin-loader` KHÔNG có row) ⇒ ghi nhận, chờ phân loại |
| host/util-crypto | dev-5 | 2026-11-08 03:12 | `bun test ./tests/host/util-crypto.test.ts` | 7 pass / 0 fail. R1 OK (header 5 dòng) · R2 OK (JSDoc @param/@returns) · R3 OK (39 dòng) · R4 OK (0 dấu vết DSH) · R5 OK (2 export = 2 export gốc, test đối chứng) · R6 OK (không import @deepseek-ai) |
| host/util-time | dev-5 | 2026-11-08 03:12 | `bun test ./tests/host/util-time.test.ts` | 4 pass / 0 fail. R1–R5 OK (29 dòng, 1 export = gốc) · R6 OK (không import @deepseek-ai) |
| host/util-code-language | dev-5 | 2026-11-08 03:12 | `bun test ./tests/host/util-code-language.test.ts` | 6 pass / 0 fail. R1–R5 OK (277 dòng, 3 export = 3 export gốc) · R6 OK (không import @deepseek-ai) |
| client/ui-brand-official | dev-5 | 2026-11-08 03:12 | `bun test ./tests/client/ui-brand-official.test.ts` | 8 pass / 0 fail. R1–R5 OK (198 dòng src, test đối chứng bề mặt + slot) · R6 OK: 0 import @deepseek-ai; `STOCK_PACKAGE_NAME` chỉ là hằng id-alias theo hợp đồng `gbh.row.aliases` (đọc mã, không phải vi phạm R4) |
| client/settings-about | dev-5 | 2026-11-08 03:12 | `cd packages/client/settings-about && bun run build.ts ./.review-lib` (gói KHÔNG có test riêng) | build OK (`.review-lib/client.js` + `index.js`, đã xoá thư mục tạm). R1 OK (header 4 tệp) · R2 OK · R3 OK (269 dòng) · **R4 ĐÃ SỬA**: 3 chuỗi người dùng thấy (`about.section` en/vi/zh) + `description` còn "DSH" ⇒ đổi sang "GBH" · R5 N/A (gói UI MỚI của GBH, không có `gbh.provenance.stock`) · R6: chỉ peer `@deepseek-ai/cordis` = **R6b (hoãn)** |

| host/typert-gateway | dev-5 | 2026-11-08 03:25 | bun test --timeout 60000 tests/host/typert-gateway.test.ts (gộp 5 tệp typert: 65 pass / 1 fail — fail thuộc typert-registry) | XANH · R1–R5 OK (36 tệp src) · R6b: dsh-typert-protocol (hoãn) · R6a-EXTRA chờ phân loại: dsh-deque, dsh-timeout · R4: `FRAGMENT_BEGIN_MARKER` chứa "__DSH_FRAGMENT_BEGIN__" là marker của bộ de-bundle ⇒ ghi nhận, không sửa |
| host/typert-loader | dev-5 | 2026-11-08 03:25 | bun test --timeout 60000 tests/host/typert-loader.test.ts | XANH (gộp 5 tệp: 65 pass) · R1–R5 OK (4 tệp src) · R6b: dsh-typert-protocol (hoãn) |
| host/typert-protocol | dev-5 | 2026-11-08 03:25 | bun test --timeout 60000 tests/host/typert-protocol.test.ts | XANH (gộp 5 tệp: 65 pass) · R1–R5 OK (1 tệp, 67 dòng) · R6b: dsh-typert-protocol (hoãn) |
| host/user-approval | dev-5 | 2026-11-08 03:25 | bun test --timeout 60000 tests/host/user-approval.test.ts | XANH (gộp 6 tệp: 37 pass) · gói de-bundle: không có src/, lib/ là bản sao 1:1 (miễn rà) ⇒ R1–R4 áp cho package.json (đủ provenance/peers) · R5 = test đối chứng · R6: 7 peer đều thuộc R6b / không có counterpart ⇒ ghi nhận |
| host/user-questions | dev-5 | 2026-11-08 03:25 | bun test --timeout 60000 tests/host/user-questions.test.ts | XANH (gộp 6 tệp: 37 pass) · R1–R5 OK (9 tệp src) · R6b: dsh-agent, dsh-session, dsh-llm (hoãn) · GHI NHẬN: locale/en.json + locale/zh.json của gói đang bị XOÁ trong working tree (git status D) — test vẫn xanh; locale đang đóng băng nên dev-5 KHÔNG tự khôi phục (đã báo Lead) |
| host/web-app | dev-5 | 2026-11-08 03:25 | bun test --timeout 60000 tests/host/web-app.test.ts | XANH (gộp 6 tệp: 37 pass) · gói BUNDLE de-bundle (không có src/) ⇒ R1–R4 áp cho package.json/cordis.patch.yml/presets · R5 = test đối chứng · R6b (hoãn) cho các id thuộc §2c; các id còn lại (vd dsh-api-settings-controller) là R6a-EXTRA — gói là bundle của hàng chục row nên đổi id ở đây thuộc phase nguyên tử, chờ review phân loại |
| host/web-fetch-http | dev-5 | 2026-11-08 03:25 | bun test --timeout 60000 tests/host/web-fetch-http.test.ts | XANH (gộp 6 tệp: 37 pass) · R1–R5 OK (5 tệp, 693 dòng) · R4: User-Agent đã đổi thương hiệu CÓ CHỦ ĐÍCH sang galaxy-blackhole/0.0.1 (README ghi rõ) ⇒ OK · R6b: dsh-web (hoãn) · R6a-EXTRA: dsh-timeout, dsh-http-proxy |
| host/web-frontend | dev-5 | 2026-11-08 03:25 | bun test --timeout 60000 tests/host/web-frontend.test.ts | XANH (gộp 6 tệp: 37 pass) · gói phân phối tĩnh (dist/ + LICENSE, không có src/) ⇒ R1–R4 áp cho package.json; dist/ là đầu ra build (miễn) · R5 = test đối chứng · R6: mã của gói không import @deepseek-ai |
| host/web | dev-5 | 2026-11-08 03:25 | bun test --timeout 60000 tests/host/web.test.ts | XANH (gộp 6 tệp: 37 pass) · R1–R5 OK (3 tệp, 364 dòng) · R6b: dsh-agent, dsh-session (hoãn) |

| host/web-search-ollama | dev-5 | 2026-11-08 03:27 | bun test --timeout 60000 tests/host/web-search-ollama.test.ts | XANH (gộp 7 tệp: 128 pass / 0 fail) · R1–R5 OK (1 tệp, 232 dòng) · R6b: dsh-web (hoãn) |
| host/win32-process | dev-5 | 2026-11-08 03:27 | bun test --timeout 60000 tests/host/win32-process.test.ts | XANH (gộp 7 tệp: 128 pass) · R1–R5 OK (1 tệp) · R6a-EXTRA chờ phân loại: dsh-lazy-require |
| host/workflow-ptc | dev-5 | 2026-11-08 03:27 | bun test --timeout 60000 tests/host/workflow-ptc.test.ts | XANH (gộp 7 tệp: 128 pass) · R1–R5 OK (3 tệp) · R6b: dsh-tools, dsh-session (hoãn) · R6a-EXTRA: dsh-workflow, dsh-util-values |
| host/workflow | dev-5 | 2026-11-08 03:27 | cd packages/host/workflow && bun run build.ts (gói KHÔNG có test riêng) | build OK: built lib/index.js · R1–R5 OK (5 tệp, 421 dòng) · R6b: dsh-agent, dsh-session (hoãn) · R6a-EXTRA: dsh-brand |
| host/working-directory | dev-5 | 2026-11-08 03:27 | bun test --timeout 60000 tests/host/working-directory.test.ts | XANH (gộp 7 tệp: 128 pass) · R1–R5 OK (4 tệp, 512 dòng) · R6b: dsh-session (hoãn) |
| host/workspace-changes | dev-5 | 2026-11-08 03:27 | bun test --timeout 60000 tests/host/workspace-changes.test.ts | XANH (gộp 7 tệp: 128 pass) · R1–R5 OK (9 tệp, 2018 dòng, tệp lớn nhất dưới ngưỡng) · R6b: dsh-session, dsh-agent (hoãn) |
| host/workspace | dev-5 | 2026-11-08 03:27 | bun test --timeout 60000 tests/host/workspace.test.ts | XANH (gộp 7 tệp: 128 pass) · R1–R5 OK (8 tệp, 1771 dòng) · R6b: dsh-session (hoãn) · GHI NHẬN: locale/en.json + locale/zh.json bị xoá trong working tree (chờ Lead quyết khôi phục) |
| host/worktree | dev-5 | 2026-11-08 03:27 | bun test --timeout 60000 tests/host/worktree.test.ts | XANH (gộp 7 tệp: 128 pass) · R1–R5 OK (6 tệp, 727 dòng) · R6b: dsh-session (hoãn) · R6a-EXTRA: dsh-timeout |
| host/typert-registry | dev-5 | 2026-11-08 03:40 | bun test --timeout 60000 tests/host/typert-registry.test.ts | XANH 12 pass / 0 fail. **Ngoại lệ đóng băng locale được Lead cho phép (ghi rõ)**: đã chép `locale/en.json` + `locale/zh.json` BYTE-IDENTICAL từ `node_modules/@deepseek-ai/dsh-typert-registry/locale/` (kiểm bằng `cmp` ⇒ IDENTICAL) vì test 000e assert byte-for-byte. R1–R5 OK (15 tệp src) · R6b: dsh-typert-protocol (hoãn) · R6a-EXTRA: dsh-api-gateway |
| client/client-hmr | dev-5 | 2026-11-08 03:45 | bun test --timeout 60000 tests/client/client-hmr.test.ts | 10 pass / 0 fail · R1–R5 OK · R6b: cordis, schemastery (hoãn) · **Chênh 6.772 B so gốc đã giải thích TRỌN VẸN**: gốc nhúng thư viện bên thứ ba eventsource-parser@3.1.0 (~5,9 KB) + glue TextDecoderStream; ta thay bằng createSseDecoder 25 dòng ⇒ KHÔNG thiếu logic DSH |
| client/client-ui-directory-picker-browse | dev-5 | 2026-11-08 03:45 | bun test --timeout 60000 tests/client/client-ui-directory-picker-browse.test.ts | 16 pass / 0 fail · R1–R3 OK · R4: lát nguyên văn (R4b) + marker de-bundle + STOCK_* sổ di trú ⇒ ghi nhận, KHÔNG sửa · R5 OK · R6b: cordis (hoãn) |
| client/client-ui-directory-picker-native | dev-5 | 2026-11-08 03:45 | bun test --timeout 60000 tests/client/client-ui-directory-picker-native.test.ts | 19 pass / 0 fail · R1–R3 OK · R4: R4b lát nguyên văn + marker de-bundle · R5 OK · R6b: cordis (hoãn) |
| client/connection | dev-5 | 2026-11-08 03:45 | bun test --timeout 60000 tests/client/connection.test.ts | 24 pass / 0 fail · **R2 ĐÃ SỬA**: bổ sung "Nhận:/Trả:" cho 4 JSDoc ở src/host/rpc-schema.ts (theo cảnh báo cổng jsdoc) + modify date · R4: `dsh-auth-` (khoá cookie bị test đóng băng) + `dsh.invalid` (URL tổng hợp) ⇒ ghi nhận · R6b: cordis, schemastery (hoãn) |
| client/file-upload | dev-5 | 2026-11-08 03:45 | bun test --timeout 180000 tests/client/file-upload{,-host,-browser,-staged}.test.ts | **55 pass / 0 fail** · R1–R5 OK · R6b: cordis, dsh-typert-protocol (hoãn) · **ĐÃ KHÔI PHỤC locale** (ngoại lệ đóng băng được Lead cho phép, ghi rõ): chép `locale/en.json` + `locale/zh.json` BYTE-IDENTICAL từ stock (kiểm `cmp` ⇒ IDENTICAL) — trước đó thư mục locale/ mất trọn nên test 000e đỏ |
| client/locale | dev-5 | 2026-11-08 03:45 | bun test --timeout 60000 tests/client/locale.test.ts | 6 pass / 0 fail · R1–R3 OK · R4: 29 dòng chuỗi hiển thị còn "DSH"/"DeepSeek" (locales-vi.ts 23 · locales-vi-stock.ts 4 · locales-common.ts 2) ⇒ **KHÔNG sửa được trong lượt này**: locale/ đóng băng + bản dịch sinh tự động ⇒ đề nghị một lô "brand sweep" riêng · R6b: cordis, schemastery (hoãn) |
| client/modules | dev-5 | 2026-11-08 03:45 | bun test --timeout 60000 tests/client/client-modules.test.ts | 23 pass / 0 fail · R1–R5 OK (HUB) · R4: `__DSH_BOOT__` CHỈ còn trong lát nguyên văn src/parts/part-01.ts; artefact thật lib/client.js + lib/index.js chỉ có __GBH_BOOT__ (0 id stock) ⇒ không rủi ro runtime, KHÔNG sửa · R6b: cordis (hoãn) · Đề xuất riêng: xoá 972 dòng lát mồ côi + rename 5 định danh `Dsh*` (1 cái bị test đóng băng import) |
| client/product-analytics | dev-5 | 2026-11-08 03:45 | bun test --timeout 60000 tests/client/product-analytics.test.ts | 18 pass / 0 fail · R1–R5 OK · R4: `dshDesktop` là global do vỏ Desktop tiêm (hợp đồng ngoài) · R6b: cordis, dsh-typert-protocol, schemastery (hoãn) · GHI NHẬN: exports map thiếu 4 subpath so gốc (./typert, ./remote, ./types, ./locale/*.json) — không consumer nào dùng, cần khi mở Phase B typert |
| client/resources | dev-5 | 2026-11-08 03:45 | bun test --timeout 60000 tests/client/resources.test.ts | 14 pass / 0 fail · R1–R5 OK · R4: `dsh-resource` là HỢP ĐỒNG DỮ LIỆU (nhận cả 2 scheme có chủ đích) · R6b: cordis (hoãn) |
| client/shortcuts | dev-5 | 2026-11-08 03:45 | bun test --timeout 60000 tests/client/shortcuts-protocol.test.ts tests/client/shortcuts-service.test.ts | 14 pass / 0 fail (A/B với lib/protocol.js gốc) · R1–R5 OK · R4: `dsh.keybindings.v1` = khoá persist cũ chỉ còn trong bảng migration MỘT LẦN; `window.dshDesktop` = cầu Desktop · R6b: cordis, schemastery (hoãn) |
| client/ui-agent-preset | dev-5 | 2026-11-08 03:45 | bun test --timeout 60000 tests/client/ui-agent-preset.test.ts | 18 pass / 0 fail · R1–R5 OK · R4: từ điển en/zh NGUYÊN VĂN, test đối chứng TỪNG CHUỖI 47×2; bản vi sinh tự động từ nguồn locale đóng băng ⇒ không sửa tay · R6: không có import @deepseek-ai |
| client/ui-agent-team | dev-5 | 2026-11-08 03:45 | bun test --timeout 60000 tests/client/ui-agent-team.test.ts | 19 pass / 0 fail · R1–R5 OK · R4: biến CSS `--dsh-*` do packages/client/ui-theme phát (ngoài batch) + CSS nguyên văn ⇒ ghi nhận · R6b: cordis (hoãn) |
| client/ui-approval | dev-5 | 2026-11-08 03:45 | bun test --timeout 60000 tests/client/ui-approval.test.ts | 30 pass / 0 fail · R1–R5 OK · R4: biến CSS `--dsh-*` (như trên) · R6: không có import @deepseek-ai · Lưu ý khi chạy gate: ca Bun.build mất ~62 s ⇒ dùng --timeout 180000 để tránh đỏ GIẢ |
| client/ui-attachment | dev-5 | 2026-11-08 03:45 | bun test --timeout 60000 tests/client/ui-attachment.test.ts | 5 pass / 0 fail · R1–R3 OK (tệp lớn nhất 937 dòng = lát nguyên văn) · R4: R4b lát nguyên văn · R5 OK · R6b: cordis (hoãn) |
## Đang chờ (chưa ký, KHÔNG phải lỗi)

_Không còn — đủ 56/56 gói đã ký (mục "BỔ SUNG LẦN CUỐI" ở cuối ghi các việc đề nghị lô riêng)._

## CHO FIX (chưa ký)

_Không còn gói nào bị chặn ký. Hai mục dưới đã XỬ LÝ XONG trong lượt này (giữ lại để review/tester đối chiếu lịch sử):_

| package | trạng thái |
|---|---|
| host/typert-registry | ✅ ĐÃ XỬ LÝ — đã chép `locale/en.json` + `locale/zh.json` BYTE-IDENTICAL từ stock (ngoại lệ đóng băng locale do Lead cho phép, ghi rõ trong chữ ký); test 000e xanh, gói đã ký (12 pass). |
| host/tool-web | ✅ ĐÃ KÝ kèm ghi chú theo dõi — R6a `dsh-system-prompt` KHÔNG đổi được: `tsc` báo **TS2345** (kiểu `PromptSection` của GBH lệch `AssembleContext` so với augmentation stock) ⇒ thuộc PHASE B chặng 2 (seam cấu trúc), cùng họ `dsh-session`. Đã hoàn nguyên id stock, test 24 pass / 0 fail. |
| client/file-upload | ✅ ĐÃ XỬ LÝ — khôi phục `locale/{en,zh}.json` byte-identical từ stock (cùng ngoại lệ); test **55 pass / 0 fail**, gói đã ký. |

## BỔ SUNG LẦN CUỐI (08/11/2026) — đủ 56/56 gói

### A. PHẦN C (14 gói client) — kết quả đo
- **13 gói KY**: client-hmr · client-ui-directory-picker-browse · client-ui-directory-picker-native · connection · locale · modules · product-analytics · resources · shortcuts · ui-agent-preset · ui-agent-team · ui-approval · ui-attachment (270 pass / 0 fail trước khi vá locale).
- **client/connection**: **R2 ĐÃ SỬA** — bổ sung 'Nhận:/Trả:' cho 4 JSDoc trong src/host/rpc-schema.ts (đúng 5 cảnh báo của cổng jsdoc).
- **client/file-upload**: trước là CHO FIX (mất trọn thư mục locale/ ⇒ test 000e đỏ). **Nay ĐÃ KÝ**: dùng ngoại lệ đóng băng locale mà Lead cho phép — chép locale/en.json + locale/zh.json BYTE-IDENTICAL từ node_modules/@deepseek-ai/dsh-client-file-upload/locale/ (kiểm bằng cmp ⇒ IDENTICAL). Test lại: **55 pass / 0 fail**.
- **client-hmr**: chênh lệch 6.772 B so bundle gốc (docs/CONVERSION-GAPS.md) đã giải trình trọn vẹn — bundle gốc nhúng thư viện bên thứ ba eventsource-parser@3.1.0 (~5,9 KB) + glue TextDecoderStream; bản ta thay bằng createSseDecoder 25 dòng ⇒ **không thiếu logic DSH**.

### B. PHASE B chặng 1 (theo điều phối của dev-6) — 2 gói của dev-5
- **host/tool-worktree** + **host/tool-workspace-dependencies**: nguồn đã đọc sổ tool qua **seam cấu trúc** ctx.get("tools") (interface ToolsLike cục bộ, fail loud khi thiếu seam), import defineTool/ToolDefinition → @galaxy-blackhole/gbh-host-tools; **peer + gbh.peers GIỮ id stock** đúng §2e.
- Test fake ctx của 2 gói đã được vá get(name) trả seam tools (đúng công thức docs/tien-do/PHASE-B-12-GOI.md bước 5, KHÔNG đổi assertion). Kết quả: **30 pass / 0 fail**. dev-6 đã kiểm độc lập và CHẤP NHẬN phần manifest.

### C. §2e — trả peer về id stock (yêu cầu Lead, chỉ sửa package.json)
- host/tool-skill: 6 id GBH trong peerDependencies/gbh.peers → id stock (dsh-agent · dsh-fs · dsh-credentials · dsh-launch-environment · dsh-timeout · dsh-llm).
- host/typert-protocol: gbh-brand trong gbh.peers → @deepseek-ai/dsh-brand.
- Test lại: **45 pass / 0 fail** (tool-skill + tool-skill-manifest + typert-protocol).
- Trước đó đã trả: tool-todo, tools, web-runtime, web-startup (+ hoàn nguyên kỳ vọng trong tests/host/web-startup.test.ts).

### D. Việc còn lại đề nghị một lô riêng (không chặn chữ ký)
1. **host/tool-web** — R6a dsh-system-prompt: đổi id thì tsc báo **TS2345** (kiểu PromptSection của GBH lệch AssembleContext so với augmentation stock) ⇒ cần seam cấu trúc (PHASE B chặng 2, cùng họ dsh-session).
2. **client/connection** — cũng mất thư mục locale/ (không làm đỏ test, nhưng exports trỏ hư) ⇒ khôi phục byte-identical khi có lô locale.
3. **Brand sweep** chuỗi hiển thị: client/locale (29 dòng "DSH"/"DeepSeek"), ui-agent-preset (bản vi sinh tự động) — cần mở khóa locale + mở rộng tests/lib/brand-parity.ts.
4. **client/modules**: xoá 972 dòng lát mồ côi src/parts/* + rename 5 định danh Dsh* (1 cái bị test đóng băng import).
5. **client/product-analytics**: bổ sung 4 subpath exports + artefact TYPERT khi Phase B mở typert.

### E. Phản hồi REVIEW (ra-soat, 10 gói đã ký) — xử lý 3 việc nhỏ + 1 đính chính
1. **host/web-runtime `"dsh web: …"`** và **host/web-startup help text `dsh --profile web …` + `.name()`**: đã THỬ đổi sang nhãn GBH (`gbh web: …`, `bh host …`) và **HOÀN NGUYÊN** vì đây là chuỗi bị **test A/B ĐÓNG BĂNG**:
   - `tests/host/web-runtime.test.ts:282/294/295/347` so `dsh web: …` với chính output của bundle GỐC (so khớp TUYỆT ĐỐI);
   - `tests/host/web-startup.test.ts:235` "--help in NGUYÊN VĂN văn bản trợ giúp gốc" ⇒ đổi cú pháp làm lệch 7 dòng diff.
   Đo lại sau khi đổi thử: 2 test ĐỎ; sau khi hoàn nguyên: **29 pass / 0 fail**. ⇒ Xếp lớp **"R4 (hoãn — test A/B pin chuỗi gốc)"** đúng tiền lệ Lead đã chốt cho `host/sandbox-policy`. Muốn đổi thật thì phải mở một lô riêng: đổi cả assertion A/B sang `normalizeBrand` + rebuild + đo parity byte.
   (Ghi chú: `apps/cli/src/host.ts:extractReadyUrl` chỉ regex URL nên đổi nhãn KHÔNG phá `bh host`; nhưng test A/B thì phá.)
2. **host/tool-skill thiếu type `SkillCatalogSource`**: giữ nguyên — mục đích DUY NHẤT của type đó ở bản gốc là `declare module` augment `MessageSourceMap`, mà ADR 000d cấm augment. Không consumer nào dùng ⇒ gap bề mặt KIỂU, không phải hàm (R5 về hàm vẫn 14/14 trùng khít).
3. **host/tools 8 dòng id kernel trong tiền tố lỗi/`Symbol(...)`**: đồng ý xếp lớp "giá trị kernel được giữ" (§2e) — đã ghi trong cột kết quả của gói.
4. **ĐÍNH CHÍNH phạm vi batch**: `client/connection` (dòng 44) và `client/file-upload` (dòng 45) **thuộc batch-dev-5**, không phải batch 1b của dev-1 — căn cứ `docs/tien-do/batch-dev-5.txt`. Vì vậy 2 sửa đổi đó (locale byte-identical + 4 JSDoc) nằm ĐÚNG vùng ghi của dev-5, mời review ký bình thường.

### F. Sửa 2 gói REVIEW trả lại (08/11/2026, sau khi ra-soat trả 2/11 gói)
**client/modules — ĐÃ SỬA (test 23 pass / 0 fail):**
- R5: thêm 3 dòng tái xuất vào `src/index.ts`: `export { bootInjections, orderByModuleGraph } from "./combos.ts"` + `export { stripClientSuffix } from "./client/manifest.ts"` ⇒ mặt công khai khớp bản gốc.
- `src/ids.ts`: `BOOT_GLOBAL_LEGACY` nay là `"__DSH_BOOT__"` (trước đó chép TRÙNG `__GBH_BOOT__` ⇒ hằng chết, phép đo global cũ vô hiệu); có JSDoc giải thích + trỏ `tools/check/boot-global.ts`.
- `package.json`: `types` + `exports["."].types` → `./lib/types/index.d.ts`; `exports["./client"].types` → `./lib/types/client/index.d.ts` (barrel Lead sinh bằng `tools/gen-types.ts`, cả hai tệp TỒN TẠI); description đổi `__DSH_BOOT__` → `__GBH_BOOT__`.
- `lib/` đã build lại (index.js + client.js). GHI CHÚ: `tools/gen-types.ts packages/client/modules` FAIL (`src/parts/part-01.ts:410 TS1010`, `part-02.ts:9 TS1109` — lát nguyên văn không parse được bằng tsc) ⇒ barrel `lib/types/index.d.ts` được vá tay 3 dòng tái xuất, sẽ bị ghi đè khi chạy lại gen-types **sau khi** xoá lát mồ côi `src/parts/*` (đề nghị lô riêng).

**client/ui-attachment — ĐÃ SỬA (test 5 pass / 0 fail):**
- 000e: chép LẠI `locale/en.json` + `locale/zh.json` **byte-identical** từ stock (kiểm `cmp` + shasum khớp từng byte); chuỗi tiếng Việt giữ trong `locale/vi.json` (không đổi). Trước đó bản zh của ta là bộ khoá phẳng ⇒ mất `meta.title`/`meta.description` ở màn Plugins.
- README §5: sửa lại cho đúng sự thật (trước đó khẳng định byte-for-byte trong khi đang LỆCH) + ghi mốc 08/11/2026 đã đồng bộ lại.

### G. P1 của Lead (08/11/2026): host/tools thiếu locale
- `packages/host/tools/` KHÔNG có thư mục `locale/` dù `package.json` export `./locale/*.json` (stock có 2 tệp).
- ĐÃ chép `locale/en.json` (41 B) + `locale/zh.json` (125 B) **BYTE-IDENTICAL** từ `apps/host/node_modules/@deepseek-ai/dsh-tools/locale/` (ngoại lệ đóng băng locale Lead duyệt; kiểm bằng `cmp` ⇒ IDENTICAL).
- Test lại: `bun test --timeout 60000 ./tests/host/tools.test.ts` ⇒ **40 pass / 0 fail**.

### H. host/workspace — vá "types trỏ hồn" (08/11/2026, dev-6 báo)
- Hiện trạng lúc kiểm (đo bằng máy): `exports["."].types` NAY = `./src/index.ts` và **tệp TỒN TẠI**; `types` cấp cao nhất (:48) = `src/index.ts`; `lib/` chỉ có `index.js` + `.gbh-build-stamp` (KHÔNG còn `lib/types/`).
- ⇒ Ca "trỏ hồn" ĐÃ HẾT (không cần tôi sửa: bản đã được vá trước khi tôi kịp ghi; mtime package.json 08/11 10:46).
- Ca (b) mà dev-6 nêu — `lib/types/types.d.ts` CŨ tự khai `Branded<"SessionId">` gây TS2345 hai brand cho `host/api-workspace-controller` — **đã hết**: `grep -rl "Branded<\"SessionId\">" packages/host/workspace/lib` = KHÔNG CÒN; `src/types.ts:11,18-22` nay dùng brand của `@galaxy-blackhole/gbh-session/types` (khai `Branded` tại chỗ nhưng `SessionId` DÙNG LẠI brand kernel).
- GHI NHẬN (dọn sau): còn thư mục tạm `packages/host/workspace/lib/.types-tmp/*.d.ts` — dấu vết lần `tools/gen-types.ts` dừng giữa đường cho gói này (gen-types emit vào `lib/.types-tmp` rồi mới thay `lib/types`). Nằm trong `lib/**` (miễn lint) nên không chặn gì; nên xoá khi rảnh.

### I. host/web-app — port asset patch (08/11/2026, dev-6 báo)
- Lỗi: `exports["./cordis.patch.yml"]` + `exports["./presets/*.patch.yml"]` trỏ tệp KHÔNG có trong gói (gói không có `build.ts`, chỉ `lib/` + `locale/`).
- ĐÃ vá: chép từ `apps/host/node_modules/@deepseek-ai/dsh-web-app/` — `cordis.patch.yml` + `presets/{cordis,minimal,ptc,standard}.patch.yml` (5 tệp).
- Cách làm: prepend khối header 5 dòng kiểu `#` theo luật repo (giống `packages/client/settings-about/cordis.patch.yml` và các gói `bundle-*` đang làm), **thân tệp giữ NGUYÊN VĂN** — kiểm bằng `tail -n +8 | cmp` ⇒ **BODY BYTE-IDENTICAL** cho cả 5 tệp (YAML comment nên ngữ nghĩa patch không đổi).
- QUÉT LẠI TOÀN BATCH: script kiểm MỌI đường dẫn tĩnh trong `exports` của 56 gói ⇒ **0 đường dẫn trỏ hồn** (trước khi vá có 1: chính `host/web-app/./cordis.patch.yml`).

### J. tests/host/tool-workflow.test.ts — sửa assertion lỗi thời do manifest đổi (08/11/2026)
- Bối cảnh: lượt quét toàn cây của Lead đổi `exports["."]` của 28 gói từ CHUỖI sang `{ types, default }`, trong đó có `host/tool-workflow` (gói của tôi).
- Hệ quả: `tests/host/tool-workflow.test.ts:783` pin `expect(json.exports["."]).toBe("./lib/index.js")` ⇒ **đỏ** sau khi manifest đổi.
- ĐÃ SỬA: đổi thành `expect(json.exports["."]).toEqual({ types: "./lib/types/index.d.ts", default: "./lib/index.js" })` + 2 dòng comment nêu lý do (lib/types CÓ THẬT ⇒ consumer TS mới thấy kiểu). Không đổi nội dung kiểm nào khác.
- QUÉT LẠI 56 gói của batch dev-5: chỉ có 2 chỗ khớp mẫu pin cũ — `host/tool-workflow:783` (đã sửa) và `host/tool-web:456` (`manifest.exports["."].default` — ĐÚNG, truy cập qua `.default`, không cần sửa).

### K. TỰ KÝ DEV cho 3 gói còn lại của batch (08/11/2026, theo lệnh Lead)
Ba gói DE-BUNDLE (src/ rỗng, có .debundled), tôi tự soát R1–R6 trước khi ký:

| gói | R1 | R2/R3 | R4/R6 | R5 | kết |
|---|---|---|---|---|---|
| host/translator | README header OK | n/a (lib/** là artefact 1:1 §2d) | 0 mã tay ⇒ 0 import, 0 dấu vết | export 2/2 **khớp khít stock** (0 thiếu/0 thừa); exports["."].types = ./lib/types/index.d.ts **TỒN TẠI**; subpath . · ./src/* · ./types · ./package.json | **KY dev-5** |
| host/util-values | README header OK | n/a (artefact §2d) | 0 mã tay | export 7/7 **khớp khít stock**; types TỒN TẠI; subpath . · ./package.json | **KY dev-5** |
| host/util-workspace-path | README header OK | n/a (artefact §2d) | 0 mã tay | export 11/11 **khớp khít stock**; types TỒN TẠI; subpath . · ./package.json | **KY dev-5** |

Phép đo: đọc package.json (exports + types), kiểm TỒN TẠI thật của mọi đích literal, so dòng export {…} của lib/index.js ta với stock, kiểm README.md 10 dòng đầu và .debundled. Không chạy bun test/gate/build (đang giữ lệnh giảm tải của Lead).
| client/ui-chat | dev-5 | 2026-11-08 20:34 | `bun run build.ts` · `bun test --timeout 60000 tests/client/ui-chat.test.ts` | N1 (Lead duyệt B1): thêm bảng `__gbhRouteNames` + hàm `napTenRoute(ctx)` gọi `remote.session.modelCatalog()` ĐÚNG MỘT LẦN trong `src/parts/part-018.ts`, dùng CHUNG `ctx.effect` sẵn có (không thêm phần tử vào chuỗi inject/effect); `src/parts/part-010.ts` `routeLabel` đọc bảng, thiếu ⇒ fallback `${provider}/${model}` y stock. Nhãn lấy từ CONFIG ⇒ `Galaxy Blackhole / Auto` (A hoa theo `models[].name`). sha `lib/client.js` = `9d8a0f1c71d16b52…`, `lib/index.js` = `58a81dc7d80948ac…`; `grep -c "Galaxy Blackhole" lib/client.js` = **0**. Test: **9 pass · 5 skip · 0 fail · 111 expect** |
| client/ui-session-delete | dev-5 | 2026-11-08 20:34 | `bun run build.ts` · `bun test --timeout 60000 tests/client/ui-session-delete.test.ts` | Xoá phiên dùng ĐÚNG cơ chế Lưu trữ phiên: `if (child.uiWorkspace.mainReference?.sessionId === sessionId) child.uiWorkspace.clearMain()` (`ui-workspace/src/service.ts:286`, method public `:462`); `createInWorkspace` = **0** lần trong mã gói; chỉ nhả khi phiên bị xoá ĐANG mở; `sessions.refresh()` vẫn gọi trước đó. sha `lib/client.js` = `c3f719c13732dcf4…` (index `c376ef81cbfeb5c4…`). Test: **5 pass · 0 fail · 20 expect** |
| client/locale | dev-5 | 2026-11-08 20:34 | `bun run build.ts` · `bun test --timeout 60000 tests/client/locale.test.ts` | Thêm **2 khoá `limits.*`** cho `agent-team` (`limits.title` = "Giới hạn nhóm", `limits.summary` = "{members} thành viên · {tasks} nhiệm vụ", `src/locales-vi.ts`) và **9 khoá `session-delete`** (điền `viSessionDelete` trước đây RỖNG). sha `lib/client.js` = `06fdec2421e84dcf…` (index `bfa76e020d854da2…`); `grep -c "Giới hạn nhóm" lib/client.js` = 1, `grep -c "Xoá phiên"` = 1. Test: **6 pass · 0 fail · 76 expect** |
| client/ui-agent-team | dev-5 | 2026-11-08 20:34 | `bun run build.ts` · `bun test --timeout 60000 tests/client/ui-agent-team.test.ts` | 2 khoá VI `limits.*` do gói này dùng (đăng ký tập trung ở `client/locale` namespace `agent-team`) ⇒ chuỗi "Set team limits" nay hiện tiếng Việt. sha `lib/client.js` = `89b676588661c930…` (index `f8aca264b5aa791c…`). Test: **19 pass · 0 fail · 128 expect** |
