<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ptc-runtime (DSH @deepseek-ai/dsh-ptc-runtime-node) — host-only, 3 entry
-->
# @galaxy-blackhole/gbh-ptc-runtime-node

Runtime PTC (programmatic tool calling) chạy trên node — bản viết lại 1:1 của
`@deepseek-ai/dsh-ptc-runtime-node` (bundle `lib/index.js` **1.821 dòng**, 12 vùng `#region`).

## 1. G4 — vùng bundle gốc → tệp của ta

| Vùng trong bundle gốc | Dòng | Tệp của ta |
|---|---|---|
| `json-wire` | 11–276 | `src/json-wire.ts` |
| `bindings` | 277–333 | `src/bindings.ts` |
| `output-json` | 334–510 | `src/output-json.ts` |
| `channel` | 511–633 | `src/channel.ts` |
| `launch` | 634–687 | `src/launch.ts` |
| `config` | 688–725 | `src/config.ts` |
| `policy-processes` | 726–794 | `src/policy-processes.ts` |
| `environment` | 795–806 | `src/environment.ts` |
| `output-ledger` | 807–879 | `src/output-ledger.ts` |
| `output-stream` | 880–933 | `src/output-stream.ts` |
| `persistent` | 934–1395 | `src/persistent.ts` |
| `index` | 1396–1820 | `src/index.ts` (`NodePtcRuntime` + `export default`) |
| `lib/process.js` (entry con) | 1.144 | `src/process-protocol.ts` + `src/process-runner.ts` |
| `lib/persistent-process.js` (entry con) | 1.186 | `src/persistent-process-protocol.ts` + `src/persistent-process-runner.ts` |

## 2. Ba entry build (lý do)

Bản gốc có `exports["./process"]` và tiến trình CHA chạy hai script con bằng **đường dẫn**
(`lib/process.js`, `lib/persistent-process.js`). Thiếu một entry là PTC chết khi spawn tiến trình con.
`build.ts` vì vậy build **3 entry**: `lib/index.js` · `lib/process.js` · `lib/persistent-process.js`,
và **nhận `outDir` qua `process.argv[2]`** (đúng cách `apps/cli/src/mount.ts` gọi).

## 3. TRƯỚC → SAU

| Phép đo | TRƯỚC (row DSH) | SAU (gói ta) |
|---|---|---|
| Số dòng nguồn nửa host | 1.821 (bundle) + 2.330 (2 entry con) | **18 tệp · 6.500 dòng** (mỗi tệp ≤1000) |
| Bề mặt export | `NodePtcRuntime` + `default` + type `Config`/`LaunchConfig` | **trùng khít** (`Object.keys` = `['inject','Config']`, `named === default`) |
| `String(static Config)` | baseline | **nguyên văn từng ký tự** |
| `executionInstructions` (per-call + persistent) | baseline | **nguyên văn** |
| 13 kịch bản resolve/run/constructor (8 câu lỗi) | baseline | **trùng khít** |
| 2 entry con thiếu fd 7 | exit 1 + `subprocess control channel was not inherited` | **trùng** (exit code + stderr) |
| Test A/B | — | **49 pass / 0 fail · 463 expect** (~7 s; chạy 2 lượt, không flaky) |
| `tsc --strict` toàn gói | — | **0 lỗi** |
| Build | — | **3/3 entry** (`index.js` · `process.js` · `persistent-process.js`) |
| `lab:row ptc-runtime` | — | chờ Lead (row PARKED) |
| `boot-smoke ptc-runtime` | — | chờ Lead (row PARKED) |

### Vì sao KHÔNG dùng shim cho `stripTypeScriptTypes`

Bundle gốc (và bản port) `import { stripTypeScriptTypes } from "node:module"` — Node **≥22.13** mới có. Bun
1.3.14 không có hàm này nên **import module dưới bun sẽ ném** `SyntaxError`; test A/B vì vậy chứng minh
**A và B cùng nổ** dưới bun (đối xứng) rồi chạy A/B của `index`/`persistent` bằng **node thật**
(`/Users/buitronghieu/.nvm/versions/node/v26.9.0/bin/node` — đúng launcher của app). Lead đã chốt: **giữ 1:1,
không shim**; ràng buộc `Node ≥22.13` là ràng buộc runtime của row.

## 4. NỢ kỹ thuật

1. **Chưa khai `gbh.row`**: row PARKED theo chỉ đạo Lead — chỉ khai sau `boot-smoke` ĐẠT + có dòng
   `packages/README.md` §4 (cổng hygiene).
2. `launch.ts` nhánh CHẠY TỪ NGUỒN (`import.meta.url` kết thúc `.ts`) trỏ `<moduleName>-runner.ts` thay vì
   `./process.ts`/`./persistent-process.ts` của bản gốc (hai tệp gốc vừa là entry vừa export `run*Main`;
   gói ta tách đôi nên runner mới export). Artifact `.js` KHÔNG đổi.
3. Hai entry con gốc đều **>1000 dòng** nên phải tách đôi (`*-protocol.ts` + `*-runner.ts`); entry
   `src/process-entry.ts` / `src/persistent-process-entry.ts` chỉ là vỏ mỏng gọi runner.
3. Không sinh `lib/types/**/*.d.ts` (bản gốc có) ⇒ consumer TS không thấy kiểu; không ảnh hưởng runtime.
4. Kiểu peer (`dsh-ptc-runtime`, `dsh-sandbox`, `dsh-subprocess`…) khai interface tối thiểu cục bộ vì
   workspace không cài các gói đó; runtime phân giải qua symlink peer của `mount.ts`.