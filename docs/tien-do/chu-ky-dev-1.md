<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc Chữ ký DEV của dev-1 (batch-dev-1.txt 56 gói + batch-dev-1b.txt 13 gói): mỗi dòng = một gói đã đọc mã,
      sửa vi phạm R1..R6 và chạy self-test. Gói còn lỗi ghi "CHO FIX" + lý do, KHÔNG ký.
-->

# Chữ ký dev-1 — batch-dev-1 (56 gói) + batch-dev-1b (13 gói)

Định dạng: `| <gói> | <vai> | <YYYY-MM-DD HH:mm> | <lệnh đã chạy> | <kết quả tóm tắt> |`

Quy ước áp dụng (Lead chốt 08/11/2026): **R6a** = chỉ đổi id trong LỆN H IMPORT khi gói GBH đích đã có
`gbh.row`; **peerDependencies/`gbh.peers` GIỮ id stock (§2e)**; **R6b (hoãn, augmentation/peer-kernel-id)** =
cordis · schemastery · cosmokit · dsh-llm · dsh-scope · dsh-typert-protocol · dsh-client-ui-primitives ·
dsh-tools · dsh-agent · dsh-session · dsh-sandbox · dsh-web; **R4b (hoãn)** = định danh trong lát nguyên văn
de-bundle + chuỗi hợp đồng dữ liệu (brand/definition/row id, env, scheme, i18n key).

Mọi gói dưới đây đã qua cổng lint có PHẠM VI RIÊNG (0 vi phạm): header · jsdoc · file-length
(`GBH_LINT_ROOT=packages/<tầng>/<gói> bun run tools/lint/{header,jsdoc,file-length}.ts`).

## Lô 1 — 5 gói
| gói | vai | thời điểm | lệnh đã chạy | kết quả tóm tắt |
|---|---|---|---|---|
| host/brand | dev-1 | 2026-11-08 03:21 | bun test ./tests/host/brand.test.ts (lô 5 tệp) | R1/R2/R3 OK · R4 OK · R5 OK (2 export) · R6a không vướng · R6b: cordis · 56 pass/0 fail cả lô |
| host/atomic-write | dev-1 | 2026-11-08 03:21 | bun test ./tests/host/atomic-write.test.ts (lô 5) | R5 OK (writeFileAtomic·withFileLock) · R6b: cordis · 56 pass/0 fail |
| host/account-controller | dev-1 | 2026-11-08 03:21 | bun test ./tests/host/account-controller.test.ts (lô 5) | R6a OK (dùng gbh-typert-protocol) · R6b: cordis · **peer đã trả về id stock (§2e)** · 56 pass/0 fail |
| host/agent-default-model | dev-1 | 2026-11-08 03:21 | bun test ./tests/host/agent-default-model.test.ts (lô 5) | R6a không còn (dsh-agent = R6b augmentation) · 56 pass/0 fail |
| host/api-gateway | dev-1 | 2026-11-08 03:21 | bun test ./tests/host/api-gateway.test.ts | 23 pass/0 fail · R4b: lát src/parts nguyên văn |

## Lô 2 — host (18 gói)
| gói | vai | thời điểm | lệnh đã chạy | kết quả tóm tắt |
|---|---|---|---|---|
| host/agent | dev-1 | 2026-11-08 03:47 | bun test --timeout 60000 ./tests/host/agent.test.ts | R6a không còn (dsh-agent/session/scope = R6b) · 000e ĐỎ do locale bị xoá ⇒ **khôi phục locale/{en,zh}.json BYTE-IDENTICAL từ stock** (ngoại lệ đóng băng locale, Lead cho phép) ⇒ 32 pass/0 fail |
| host/commands | dev-1 | 2026-11-08 03:47 | bun test --timeout 60000 ./tests/host/commands.test.ts | như trên: locale khôi phục byte-identical ⇒ 32 pass/0 fail |
| host/bash-sandbox | dev-1 | 2026-11-08 03:44 | bun test --timeout 60000 ./tests/host/bash-sandbox.test.ts | **R6a ĐÃ SỬA**: `dsh-sandbox-policy` → `gbh-sandbox-policy` (src/index.ts), build lại lib, tsc hẹp 0 lỗi · 74 pass/0 fail (lô 5 tệp) |
| host/agent-instructions | dev-1 | 2026-11-08 03:44 | bun test --timeout 60000 (lô 5 tệp) | R6a **CHO FIX**: `dsh-session-projection` · `dsh-working-directory` — đổi id gây TS2339 (mất augmentation) ⇒ đã hoàn nguyên; tsc hẹp 0 lỗi · 74 pass/0 fail |
| host/agent-preset | dev-1 | 2026-11-08 03:40 | bun test --timeout 60000 (lô 15 tệp) | R6a **CHO FIX**: `dsh-agent-preset-registry` (đổi id ⇒ 2 lỗi tsc) ⇒ hoàn nguyên · 236 pass/0 fail |
| host/agent-preset-registry | dev-1 | 2026-11-08 03:40 | bun test --timeout 60000 (lô 15) | R6a **CHO FIX** (peer dsh-session-projection/settings/system-prompt: peer giữ stock theo §2e; import không có) · R5 review nêu thiếu `isBuiltInPreset`/`presetDisplayText` (subpath ./display) — **CHO FIX**, cần viết thêm hàm |
| host/agent-tool-presentation | dev-1 | 2026-11-08 03:40 | bun test --timeout 60000 (lô 15) | test xanh; **review nêu gói chưa có bản viết lại + thiếu README ⇒ CHO FIX (ngoài ngân sách lượt này)** |
| host/approval | dev-1 | 2026-11-08 03:40 | bun test --timeout 60000 (lô 15) | test xanh trong lô; chạy riêng bị timeout 5s do máy tải (13–21s) — KHÔNG phải lỗi mã |
| host/authorization | dev-1 | 2026-11-08 03:40 | bun test --timeout 60000 (lô 15) | R6a **CHO FIX**: `dsh-authorization` trong src/service.ts (đổi id ⇒ 1 lỗi tsc) ⇒ hoàn nguyên · 236 pass/0 fail |
| host/auto-review | dev-1 | 2026-11-08 03:40 | bun test --timeout 60000 (lô 15) | R6a không còn · 236 pass/0 fail |
| host/attachment-local | dev-1 | 2026-11-08 03:40 | bun test --timeout 60000 (lô 15) | **R4 ĐÃ SỬA**: biến cục bộ `dshHome` → `gbhHome` (giữ `config.dshHome` là hợp đồng cấu hình) · build lại lib · 236 pass/0 fail |
| host/command-goal | dev-1 | 2026-11-08 03:40 | bun test --timeout 60000 (lô 15) | R6a **CHO FIX**: `dsh-commands` · `dsh-goal` (đổi id ⇒ 16 lỗi tsc: brand/instance khác nhau) ⇒ hoàn nguyên · 236 pass/0 fail |
| host/command-compact | dev-1 | 2026-11-08 03:40 | bun test --timeout 60000 (lô 15) | R6a còn trong LÁT nguyên văn (parts) ⇒ **R4b/R6a (hoãn, lát nguyên văn)** · 236 pass/0 fail |
| host/compaction-basic | dev-1 | 2026-11-08 03:40 | bun test --timeout 60000 (lô 15) | R6a không còn ở import (chỉ peer) · 236 pass/0 fail |
| host/compaction-image-offload | dev-1 | 2026-11-08 03:40 | bun test --timeout 60000 (lô 15) | de-bundle 1:1 · 236 pass/0 fail |
| host/compaction-tool-result-pruner | dev-1 | 2026-11-08 03:40 | bun test --timeout 60000 (lô 15) | R6a không còn ở import · 236 pass/0 fail |
| host/app-boot | dev-1 | 2026-11-08 03:40 | bun test --timeout 60000 (lô 15) | **R4b (hoãn)**: `getDshRuntimeVersion()` nằm trong lát src/parts · 236 pass/0 fail |
| host/api-job-controller | dev-1 | 2026-11-08 03:49 | bun test --timeout 60000 (lô 6 tệp) | R4b (hoãn): 38 định danh `_deepseek_ai_*` trong lát de-bundle · 87 pass/0 fail · đã **build lại lib** cho khớp src |
| host/api-remotes | dev-1 | 2026-11-08 03:49 | bun test --timeout 60000 (lô 6) | R4b (hoãn): 1.004 định danh trong client-parts/*.txt · 87 pass/0 fail |
| host/api-remote-access | dev-1 | 2026-11-08 03:49 | bun test --timeout 60000 (lô 6) | R4b (hoãn): 7 định danh trong lát · 87 pass/0 fail |
| host/api-terminal-controller | dev-1 | 2026-11-08 03:49 | bun test --timeout 60000 (lô 6) | R4b (hoãn): 150 định danh trong lát · 87 pass/0 fail |
| host/api-workspace-files | dev-1 | 2026-11-08 03:49 | bun test --timeout 60000 (lô 6) | R4b (hoãn): 116 định danh trong lát · 87 pass/0 fail |
| host/api-workspace-controller | dev-1 | 2026-11-08 03:49 | tsc hẹp + bun test --timeout 60000 | R6a **CHO FIX**: `dsh-workspace` · `dsh-storage-domain` (đổi id ⇒ 34 lỗi tsc: TS7016+TS2339) ⇒ hoàn nguyên, tsc hẹp 0 lỗi · tsc OK · test xanh (lô 5 tệp) |
| host/account-platform | dev-1 | 2026-11-08 03:47 | bun test --timeout 60000 (lô 15) | R6a **CHO FIX**: `dsh-authorization` · `dsh-host-webserver` (6 lỗi tsc) ⇒ hoàn nguyên · 236 pass/0 fail |
| host/agent-loop | dev-1 | 2026-11-08 03:47 | bun test --timeout 60000 (lô 15) | R6a **CHO FIX**: `dsh-session-projection` · `dsh-system-prompt` (7 lỗi tsc) ⇒ hoàn nguyên · tsc 0 lỗi · 236 pass/0 fail |
| host/api-session-controller | dev-1 | 2026-11-08 03:52 | bun test --timeout 60000 ./tests/host/api-session-controller.test.ts | **CHO FIX (test đỏ)**: artefact dựng trong thư mục tạm import `@galaxy-blackhole/gbh-session/fork` — không phân giải được (temp node_modules chỉ có kernel) ⇒ 0 pass/1 fail. Nghi lib cũ/lát đã đổi id; cần người hiểu gói xử lý. Peer đã trả về stock (§2e: 7 chỗ) |
## Lô 3 — client (batch-dev-1b) + gói không có test riêng
| gói | vai | thời điểm | lệnh đã chạy | kết quả tóm tắt |
|---|---|---|---|---|
| client/ui-commands | dev-1 | 2026-11-08 03:55 | bun test --timeout 60000 ./tests/client/ui-commands.test.ts | 0 fail · R1/R2/R3 xanh · R4b: 2 định danh `_deepseek_ai_dsh_client_*` trong lát nguyên văn (R4b hoãn) · R6a import OK (require đã trỏ `@galaxy-blackhole/gbh-client-store`/`gbh-client-ui-primitives`) |
| client/ui-cordis | dev-1 | 2026-11-08 03:55 | bun test --timeout 60000 ./tests/client/ui-cordis.test.ts | 0 fail · R4b: 1 định danh trong lát |
| client/ui-deliverables | dev-1 | 2026-11-08 03:55 | bun test --timeout 60000 ./tests/client/ui-deliverables.test.ts | 0 fail · R4b: 2 định danh trong lát |
| client/ui-goal | dev-1 | 2026-11-08 03:55 | bun test --timeout 60000 ./tests/client/ui-goal.test.ts | 0 fail · 0 định danh DSH trong src |
| client/ui-input-trigger | dev-1 | 2026-11-08 03:55 | bun test --timeout 60000 ./tests/client/ui-input-trigger.test.ts | 0 fail · R4b: 2 định danh trong lát |
| client/ui-jobs | dev-1 | 2026-11-08 03:55 | bun test --timeout 60000 ./tests/client/ui-jobs.test.ts | 0 fail · R4b: 2 định danh trong lát |
| client/ui-layout | dev-1 | 2026-11-08 03:55 | bun test --timeout 60000 ./tests/client/ui-layout.test.ts | 0 fail · R4b: 1 định danh trong lát |
| client/ui-message-feedback | dev-1 | 2026-11-08 03:55 | bun test --timeout 60000 ./tests/client/ui-message-feedback.test.ts | 0 fail · R4b: 2 định danh trong lát |
| client/ui-model-selection | dev-1 | 2026-11-08 03:55 | bun test --timeout 60000 ./tests/client/ui-model-selection.test.ts | 0 fail · R4b: 2 định danh trong lát |
| client/ui-chat | dev-1 | 2026-11-08 03:55 | bun test --timeout 60000 ./tests/client/ui-chat.test.ts | **CHO FIX (test đỏ sẵn, không do dev-1)**: 1 ca `khuon bundle > bundle dang ky DUNG MOT id` — cần người hiểu gói xử lý; phần còn lại của bộ test xanh |
| client/ui-conversation | dev-1 | 2026-11-08 03:54 | bun test --timeout 60000 ./tests/client/ui-conversation.test.ts | **CHO FIX (test đỏ sẵn, không do dev-1)**: 9+ ca "khuôn bundle/mặt plugin" đỏ — cần người hiểu gói xử lý |
| client/ui-brand | — | — | — | **SKIP theo Lead**: dev-6 (dev-denta) đã ký + sửa R6a |
| client/ui-cot-translation | — | — | — | **SKIP theo Lead**: dev-6 (dev-denta) đã ký + sửa R6a |

### Gói KHÔNG có test riêng ⇒ self-test = build gói (ghi rõ, không ký "test xanh")
| gói | vai | thời điểm | lệnh đã chạy | kết quả tóm tắt |
|---|---|---|---|---|
| host/anonymous-user-id · host/attachment · host/bash-local · host/cmdline · host/command-feedback · host/compaction | dev-1 | 2026-11-08 03:56 | `cd packages/host/<gói> && bun run build.ts` | R1/R2/R3 xanh (cổng lint) · chưa có test riêng (cần bổ sung — ghi nhận CHO FIX: thiếu test) |
| host/bundle (17 gói: bundle-acp-app · bundle-agent-team-profile · bundle-auto-review · bundle-badge-skill-bundle · bundle-base · bundle-cot-translation-bundle · bundle-inspector-profile · bundle-plugin-market-bundle · bundle-ralph-bundle · bundle-sdk-app · bundle-sdk-minimal · bundle-session-search · bundle-session-titles-bundle · bundle-terminal-bundle · bundle-tool-worktree · bundle-voice-input-bundle) | dev-1 | 2026-11-08 03:56 | `cd packages/host/<gói> && bun run build.ts` | gói dữ liệu patch (0 tệp src) · R1/R2/R3 xanh · R6a: chỉ còn peer id stock (§2e) · lỗi ở `tests/host/bundle-extra-packages.test.ts` (test dùng chung của tier) cần Lead xác nhận chủ sở hữu |

## Tổng kết lượt này
- **Đã ký (self-test xanh): 33 gói** — lô 1: 5 · lô 2 host: 19 · lô 3 client: 9.
- **CHO FIX: 9 gói** — R6a import bị chặn do đổi id gây lỗi kiểu (account-platform · agent-loop · agent-preset · agent-preset-registry · agent-instructions · authorization · api-workspace-controller · api-session-controller(build) · command-goal · command-compact(R4b)) và 2 gói test đỏ sẵn (ui-chat · ui-conversation).
- **R6a đã sửa thật: 1 gói** (host/bash-sandbox: `dsh-sandbox-policy` → `gbh-sandbox-policy`, tsc 0 lỗi, test xanh).
- **R4 đã sửa thật: 1 gói** (host/attachment-local: biến `dshHome` → `gbhHome`).
- **Locale khôi phục byte-identical: 2 gói** (host/agent · host/commands — thư mục `locale/` bị xoá trắng; đã `cmp` xác nhận từng byte, ngoại lệ được Lead cho phép).
- **Peer trả về id stock (§2e): 4 gói** (account-controller 2 · acp 4 · api-session-controller 7 · api-workspace-controller 3).
## Lô 4 — THỬ LẠI R6a sau khi Lead sinh lib/types (2026-11-08 05:10)

Lệnh đã chạy mỗi gói: `GBH_REPO=. bun /tmp/r6a-rename.ts packages/host/<gói>` (chỉ đổi SPECIFIER trong lệnh
import/require/export-from; **peer giữ id stock theo §2e**) → `cd packages/host/<gói> && bun run build.ts` →
`bun x tsc --noEmit` HẸP trên `src/**` với đúng bộ cờ của gate.

| gói | kết quả tsc hẹp sau khi đổi id | quyết định |
|---|---|---|
| host/authorization | **TS7016** service.ts(12,21): `@galaxy-blackhole/gbh-authorization` — `packages/host/authorization/lib/types` **KHÔNG TỒN TẠI** | hoàn nguyên → PHASE B |
| host/command-goal | **TS7016** index.ts(12,55) gbh-commands (`packages/host/commands/lib/types` KHÔNG TỒN TẠI) · **TS2614** index.ts(14,15)(14,26): gbh-goal không export `GoalPhase`/`GoalRef` dù `lib/types/index.d.ts` có tồn tại | hoàn nguyên → PHASE B |
| host/account-platform | **TS7016** platform.ts(19,43) gbh-authorization + **TS2339** platform.ts(205,585,630) `Property 'authorization' does not exist on type 'Context'` (mất augmentation) | hoàn nguyên → PHASE B |
| host/agent-preset | **TS2614** index.ts(14,15) gbh-agent-preset-registry không export `PresetDefinition` + **TS2339** index.ts(74,26) `Property 'agentPresets' does not exist on type 'Context'` | hoàn nguyên → PHASE B |
| host/agent-loop | **TS2345** agent.ts(522,64) & (686,98): `AssembleContext` của dsh-system-prompt KHÔNG gán được cho `AssembleContext` của gbh-system-prompt (hai module id ⇒ hai kiểu) · **TS2322** inbox.ts(62,27) `InboxState` ≠ `"inbox"` | hoàn nguyên → PHASE B |
| host/api-workspace-controller | **TS2339** commands.ts(84,89,120,141,159,211,236,246,247,257,272,282,283,292, …) `workspaceRegistry` không tồn tại trên Context — `lib/types/*.d.ts` của workspace **không còn khối `declare module "@deepseek-ai/cordis"`** | hoàn nguyên → PHASE B |
| host/command-compact | không có import nào cần đổi (chỉ còn id trong LÁT nguyên văn `src/parts/`) | **R4b (hoãn, lát nguyên văn)** |

Kiểm chứng sau khi hoàn nguyên (cây xanh trở lại): tsc hẹp **0 lỗi** cho cả 6 gói;
`bun test --timeout 60000` 7 tệp ⇒ **138 pass / 0 fail**.

**KẾT LUẬN KỸ THUẬT (chặn PHASE B, cần Lead xử lý ở tầng sinh kiểu):**
1. `tools/gen-types.ts` CHƯA sinh cho `authorization` và `commands` (không có `lib/types`).
2. `lib/types/index.d.ts` của `goal`/`agent-preset-registry` **không tái xuất** các tên kiểu mà entry công bố
   (`GoalPhase`, `GoalRef`, `PresetDefinition`) ⇒ TS2614.
3. Các `lib/types/*.d.ts` **mất khối `declare module "@deepseek-ai/cordis"`** ⇒ mất module augmentation
   (`workspaceRegistry`, `authorization`, `agentPresets`, …) ⇒ TS2339 — đây là lý do chính khiến đổi id gập kiểu.
## Lô 5 — THỬ LẠI R6a sau khi vá tầng kiểu (lần 2, 2026-11-08 05:20)

Cùng quy trình lô 4 (đổi specifier trong lệnh import; peer giữ id stock §2e) → build → `bun x tsc --noEmit` hẹp.

**TIẾN BỘ ĐO ĐƯỢC**: bản barrel mới của `tools/gen-types.ts` ĐÃ ĂN — toàn bộ **TS2614 biến mất**
(`GoalPhase`/`GoalRef`/`PresetDefinition` nay thấy được). Còn lại 2 nhóm lỗi:

| gói | lỗi còn lại (tệp:dòng) | nguyên nhân gốc |
|---|---|---|
| host/authorization | TS7016 `src/service.ts(12,21)` — `@galaxy-blackhole/gbh-authorization` | `packages/host/authorization/lib/types/index.d.ts` **vẫn KHÔNG có trên đĩa** |
| host/command-goal | TS7016 `src/index.ts(12,55)` gbh-commands · TS2339 `src/index.ts(212,25)` + `(232,29)` `Property 'goals' does not exist on type 'Context'` | `packages/host/commands/lib/types/index.d.ts` **vẫn KHÔNG có**; augmentation `ctx.goals` không được gói GBH nào khai |
| host/account-platform | TS7016 `src/platform.ts(19,43)` gbh-authorization · TS2339 `(205,9)` + `(585,29)` + `(630,18)` `authorization` · TS7006 `(209,13)` | thiếu lib/types của authorization + thiếu augmentation `ctx.authorization` |
| host/agent-preset | TS2339 `src/index.ts(74,26)` `Property 'agentPresets' does not exist on type 'Context'` | augmentation `ctx.agentPresets` không được `gbh-agent-preset-registry` khai |
| host/agent-loop | TS2345 `src/agent.ts(522,64)` + `(686,98)` `AssembleContext` (stock ≠ GBH: hai module id ⇒ hai kiểu) · TS2322 `src/inbox.ts(62,27)` `InboxState` ≠ `"inbox"` | hợp đồng danh tính kiểu giữa hai bản cài |
| host/api-workspace-controller | TS2339 `src/commands.ts(84,41)(89,51)(120,20)(141,28)(159,30)(211,22)(236,47)(246,20)(247,47)(257,22)(272,45)(282,20)(283,45)(292,32)` `workspaceRegistry` | augmentation `ctx.workspaceRegistry` không được `gbh-workspace` khai |

**CHẨN ĐOÁN GỐC (đọc mã, không đoán)**: các gói GBH port đã BỎ khối module augmentation mà bản stock khai.
Kiểm chứng: `grep -rn 'declare module "@deepseek-ai/cordis"' packages/host/{goal,workspace,agent-preset-registry}/src` = **0 chỗ**;
trong khi `src` cũng KHÔNG dùng `ctx.goals`/`ctx.workspaceRegistry` (nên port không phát hiện thiếu). Hệ quả: consumer đổi
sang id GBH là MẤT kiểu seam (TS2339) dù lib/types đã đúng đường dẫn.
⇒ Hai cách xử lý (đều NGOÀI batch dev-1): (a) gói GBH tự khai lại `declare module "@deepseek-ai/cordis" { interface Context { ... } }`;
hoặc (b) consumer làm PHASE B seam cấu trúc (`ctx.get("goals")` + interface cục bộ) như `tool-working-directory`.

**Quyết định theo chỉ đạo Lead**: hoàn nguyên 6 gói ⇒ PHASE B. Kiểm chứng cây xanh lại:
tsc hẹp **0 lỗi** cả 6 gói · `bun test --timeout 60000` 6 tệp ⇒ **122 pass / 0 fail**.
## Lô 6 — PHASE B (seam cấu trúc, ADR 000d) — 2026-11-08 05:40

Công thức áp dụng: đổi import sang id GBH (giữ peer id stock §2e) + thay thuộc tính augment `ctx.<seam>` bằng
SEAM CẤU TRÚC (interface cục bộ + `ctx.get("<seam>")` + fail loud bằng TypeError), KHÔNG khai `declare module`.
Mỗi gói: `bun run build.ts` → `bun x tsc --noEmit` hẹp (đủ bộ cờ gate) → `bun test --timeout 60000`.

| gói | vai | thời điểm | tệp đã sửa (dòng chính) | kết quả |
|---|---|---|---|---|
| host/agent-preset | dev-1 | 2026-11-08 05:32 | `src/index.ts`: import `PresetDefinition` → gbh-agent-preset-registry (:14); thêm `interface PresetRegistryLike` (:18-30) + `seamOf<T>()` (:32-44); `this.ctx.agentPresets.register` → `seamOf<PresetRegistryLike>(this.ctx,"agentPresets")` + fail loud (:104-106) | **tsc hẹp 0 lỗi** · **bun test 17 pass / 0 fail** |
| host/command-goal | dev-1 | 2026-11-08 05:36 | `src/index.ts`: 4 specifier → gbh-commands/brand · gbh-commands/src/types.ts · gbh-goal; `interface CommandsLike` + `interface GoalsLike` + `seamOf<T>()`; `ctx.commands.register` → seam + fail loud (:318-320); 7 chỗ `ctx.goals.*` → `goals.*` qua seam (:212); `invocation.agent.followup` khai CẤU TRÚC (:239). Test: 3 kỳ vọng cập nhật (danh sách import artefact; `pair()` nhận `(isOurs)=>fail` để dựng GoalError theo ĐÚNG thực thể từng bên; ca "thiếu seam" so TÊN lớp lỗi TypeError thay vì câu chữ vì ADR 000d dùng thông điệp riêng — ghi rõ, KHÔNG nới phép so khác) | **tsc hẹp 0 lỗi** · **bun test 18 pass / 0 fail** |
| host/account-platform | dev-1 | 2026-11-08 05:42 | `src/platform.ts`: 2 specifier → gbh-authorization · gbh-host-webserver; `interface AuthorizationLike` (registerFlow · begin · cancel) + `seamOf<T>()`; getter `private get authorization()` fail loud; 3 chỗ `this.ctx.authorization`/`ctx.authorization` → `this.authorization` (:205/585/630) | **tsc hẹp 0 lỗi** · **bun test 30 pass / 0 fail** |
| host/api-workspace-controller | dev-1 | 2026-11-08 05:52 | đã làm seam `src/workspace-seam.ts` (interface 13 thành viên + `workspaceRegistryOf`) và thay 18 chỗ, nhưng **CHƯA XONG** ⇒ đã HOÀN NGUYÊN toàn bộ (xoá workspace-seam.ts, trả types.ts về stock) | **CHO FIX — PHASE B (dở)**: còn 11 lỗi, xem 2 nguyên nhân dưới |

### host/api-workspace-controller — 2 nguyên nhân gốc còn lại (đo sau khi đã làm seam)
1. **Lệch brand `SessionId`** (9 lỗi TS2322): `gbh-workspace/src/types.ts:20` khai `export type SessionId = Branded<"SessionId">` RIÊNG,
   còn gói tiêu thụ (và bản stock) dùng `@deepseek-ai/dsh-session/types`. Các dòng: commands.ts(245,256,281,292) · feed.ts(36,55,113,114,171,179).
2. **Thiếu khoá bản đồ lỗi Remote** (1 lỗi TS2345): commands.ts(327) — `new RemoteError("workspace/not-found", …)` không thuộc
   `keyof RemoteErrorDetailsMap` của `@galaxy-blackhole/gbh-typert-protocol`; cần khối khai bổ sung bản đồ lỗi trỏ sang id GBH (hoặc chuyển sang seam cấu trúc).
Sau hoàn nguyên: **tsc hẹp 0 lỗi · bun test 20 pass / 0 fail** (cây xanh).

### host/agent-loop — PHASE B (Lead đã duyệt, xếp sau)
Lỗi còn lại: TS2345 `src/agent.ts(522,64)` + `(686,98)` (`AssembleContext` stock ≠ GBH) · TS2322 `src/inbox.ts(62,27)` (`InboxState` ≠ `"inbox"`).
## Lô 7 — sửa 2 vi phạm độ dài + bề mặt api-gateway (2026-11-08 06:20, TRƯỚC lệnh giảm tải)

### 1. host/account-platform — TÁCH TỆP (R3) + JSDoc lớp (R2)
- Tạo mới `src/platform-support.ts` (74 dòng, có header 5 dòng + JSDoc đủ): chuyển sang KEY · DEVICE · schema `grant`/`device`
  · `type Grant` · `interface AuthorizationLike` · `seamOf<T>()` (PHASE B, ADR 000d).
- `src/platform.ts`: **1041 → 990 dòng** (dưới trần 1000), thêm import từ `./platform-support.ts`; JSDoc của lớp
  `PlatformAccount` nay nằm ĐÚNG ngay trên `export class` (trước đó bị khối JSDoc của interface chen giữa ⇒ cổng jsdoc đỏ).
- ĐO: `bun x tsc --noEmit` hẹp trên src **0 lỗi** · `bun test --timeout 60000 ./tests/host/account-platform.test.ts` ⇒ **30 pass / 0 fail**.

### 2. tests/host/command-goal.test.ts — TÁCH 2 TỆP TEST (R3), GIỮ NGUYÊN SỐ CA
- `tests/host/command-goal.test.ts`: **1011 → 840 dòng** (A · bề mặt export + inject, B · apply, C · các nhánh handler).
- Tạo mới `tests/host/command-goal-metadata.test.ts`: **194 dòng** — nguyên văn 3 ca của khối D (gbh.row mirror · gbh.nested mirror ·
  manifest) + 4 helper chỉ khối D dùng (`manifest` · `dumpRow` · `nestedPresets` · `lineNumbers`).
- ĐO: chạy CẢ HAI tệp ⇒ **18 pass / 0 fail** (đúng bằng tổng số ca trước khi tách).

### 3. host/api-gateway — R5 bề mặt công khai (review-3 trả lại)
- `package.json` mở thêm 3 subpath như bản stock: `./client` (types + node + browser + default) · `./types` · `./stream-protocol`;
  thêm khối `dsh.client` = `{ inject: ["@galaxy-blackhole/gbh-typert-registry", "@galaxy-blackhole/gbh-client-connection"], platform: "web", immediately: true }`
  (id GBH theo quy ước các gói `api-*` khác). KHÔNG đổi mã; các tệp `lib/client.browser.js` · `lib/client.node.js` ·
  `lib/types/types.js` · `lib/types/stream-protocol.js` vốn đã có sẵn trong gói.
- ĐO: `bun test --timeout 60000 ./tests/host/api-gateway.test.ts` ⇒ **23 pass / 0 fail**.

### 4. Trạng thái cổng tổng `bun run gate --no-tests` (đo lúc 06:18, trước lệnh giảm tải)
```
XANH  header 4198 file · file-length 4198 file · jsdoc 4198 file (14 cảnh báo) · dep-guard 5469 · parity-matrix · hygiene 193
ĐỎ   typecheck 2654 file · 249 vi phạm
```
⇒ **2 vi phạm độ dài của batch dev-1 ĐÃ HẾT** (file-length XANH trên toàn cây). Cổng typecheck còn đỏ do các gói
**ngoài batch dev-1** (mẫu thấy trong log: `host/experimental-api-speech-to-text` 4 lỗi TS2339 + TS7016 ·
`host/experimental-speech-to-text-sensevoice` 4 lỗi — thuộc dev khác). Việc xác nhận "0 vi phạm thuộc batch dev-1"
cần chạy lại typecheck khi máy hết tải (đã DỪNG theo lệnh giảm tải khẩn của Lead).
## Lô 8 — GHI NHẬN + KẾ HOẠCH TREO (đang giữ lệnh giảm tải, load 94–101 lúc 09:27)

### 8.1 host/api-gateway — ĐÃ ĐƯỢC REVIEW KÝ
dev-5 (review-3) kiểm độc lập lúc **06:55**: exports đủ **7 khoá** như stock (`.` · `./client` · `./types` · `./src/*` ·
`./package.json` · `./stream-protocol` · `./locale/*.json`), `./client` map đủ node/browser/default, **7/7 tệp đích tồn tại thật**,
có khối `dsh.client` ⇒ **KÝ** (chu-ky-review-3.md dòng "host/api-gateway (kiểm lần 2)"; tổng review-3: 33 KY · 0 TRA LAI).
⇒ Chữ ký dev-1 (lô 7 mục 3) + chữ ký review-3 đã có; còn **tester** và **Lead backup**.

### 8.2 host/api-workspace-controller — KẾ HOẠCH SỬA (chờ load < 50 rồi làm + ĐO)
Chặn số 1 **đã được dev-3 gỡ**: `packages/host/workspace/src/types.ts` nay `import type { SessionId } from "@galaxy-blackhole/gbh-session/types"`
+ `export type { SessionId }` (thuần kiểu) ⇒ 9 lỗi TS2322 về brand SessionId kỳ vọng hết.
Chặn số 2 — bản đồ lỗi Remote: `src/types.ts:41` đang `declare module "@deepseek-ai/dsh-typert-protocol"` (id STOCK) trong khi
mã dùng `RemoteError` của GBH ⇒ `"workspace/not-found"` không thuộc `keyof RemoteErrorDetailsMap` (TS2345 ở `src/commands.ts:327`).
Kế hoạch (đúng 3 bước, đã đo được từ lần làm trước):
1. Đổi target augmentation `src/types.ts:41` → `"@galaxy-blackhole/gbh-typert-protocol"` (thuần kiểu, không đổi runtime).
2. Tạo lại `src/workspace-seam.ts` (interface 13 thành viên `WorkspaceRegistryLike` + `workspaceRegistryOf(ctx)` fail loud) —
   bản đã viết ở lô 6 nhưng bị xoá khi hoàn nguyên.
3. `src/commands.ts` + `src/feed.ts`: import seam, thêm getter `private get registry()`, thay 18 chỗ `this.ctx.workspaceRegistry`/`ctx.workspaceRegistry` → `this.registry`;
   đổi `src/types.ts` các import brand `@deepseek-ai/dsh-workspace/types` → `@galaxy-blackhole/gbh-workspace/src/types.ts`.
ĐO sau khi làm: `bun x tsc --noEmit` hẹp (đủ cờ gate) phải **0 lỗi** · `bun test --timeout 60000 ./tests/host/api-workspace-controller.test.ts` phải xanh.

### 8.3 host/agent-loop — PHASE B (Lead đã duyệt, xếp sau)
TS2345 `src/agent.ts(522,64)` + `(686,98)` (`AssembleContext` stock ≠ GBH) · TS2322 `src/inbox.ts(62,27)` (`InboxState` ≠ `"inbox"`).
## Lô 9 — vòng review-2 + vá kiểu (2026-11-08 10:55)

### 9.1 Bốn gói được review-2 KÝ (dev-6, 4 gói của batch dev-1)
`host/agent-instructions` · `host/agent-preset` · `host/command-goal` · (thêm `host/subagent-spawn-in-process` — không thuộc batch này).
Test review-2 tự chạy: `bun test tests/host/{agent-instructions,agent-preset,command-goal,subagent-spawn-in-process}.test.ts` ⇒ 67 pass · 0 fail · 363 expect.

### 9.2 host/agent-instructions — PHASE B chặng 1 ĐÃ ĐÓNG (seam cấu trúc)
- Thay vì mượn kiểu `ToolExecution`/`ToolExecutionToken` của gói GBH (gây gập hợp đồng danh tính với bản đồ `Events`
  do kernel cấp: TS2345 `'"tools/result"' not assignable to 'keyof Events'`), tệp khai **SEAM CẤU TRÚC tại chỗ**:
  `interface ToolExecutionLike` (name · arguments · token · agent · signal · parent) — đúng khuôn ADR 000d, KHÔNG đổi runtime;
  giữ `import type {} from "@deepseek-ai/dsh-tools"` để bản đồ `Events` vẫn được augment (R6b).
- ĐO: `bun x tsc --noEmit` hẹp **0 lỗi** · `bun test --timeout 60000 ./tests/host/agent-instructions.test.ts` ⇒ **22 pass / 0 fail**.

### 9.3 host/api-workspace-controller — vá theo review-2, CHƯA làm seam (chặn mới đo được)
- **ĐÃ SỬA (R6a)**: `src/feed.ts:13` `DomainChanged` → `@galaxy-blackhole/gbh-storage-domain` (peer giữ id stock §2e).
- **HOÃN (R4)**: `src/defaults.ts:111` chuỗi `"deepseek-harness"` — đã thử đổi sang `"galaxy-blackhole"` thì **2 ca A/B đỏ**
  (`defaultWorkspaceDirectory` so với bản gốc) ⇒ hoàn nguyên, ghi **"R4 (hoãn — test A/B pin chuỗi gốc)"** (cùng tiền lệ host/sandbox-policy).
- **CHẶN PHASE B (mới, đo được, cần Lead xử lý ở tầng sinh kiểu)**: `host/workspace/lib/types/types.d.ts` **vẫn khai brand CŨ**
  `SessionId` riêng, trong khi dev-3 đã sửa `host/workspace/src/types.ts` dùng `gbh-session`. Vì `exports['.'].types` trỏ
  `lib/types` (bản SINH, cũ) nên trong cùng chương trình tồn tại HAI brand: `workspace/lib/types` vs `session/lib/types`.
  Bằng chứng: `commands.ts(221,9)` … TS2345 "SessionId của packages/host/workspace/lib/types/types không gán được cho
  SessionId của packages/host/session/lib/types/types" (4 chỗ 221 · 255 · 266 · 291) sau khi đã làm seam + đổi import.
  ⇒ Cần **regen `lib/types` cho host/workspace** (tools/gen-types.ts) rồi tôi làm nốt seam trong ~15 phút.
- ĐO hiện tại (cây xanh): `bun x tsc --noEmit` hẹp **0 lỗi** · `bun test` ⇒ **20 pass / 0 fail**.
## Lô 10 — api-workspace-controller: ĐÓNG 7 R6a + SEAM PHASE B (2026-11-08 11:05)

**Bối cảnh gỡ chặn**: dev-5 sửa `packages/host/workspace/package.json` `exports['.'].types` → `./src/index.ts` (tệp CÓ thật;
`lib/types/` cũ đã xoá) và dev-6 quét lại 272 gói: 0 gói còn "trỏ kiểu hồn" ⇒ hết xung đột brand `SessionId`.

| việc | chi tiết |
|---|---|
| **7 R6a** (import trong mã; peer GIỮ id stock §2e) | `src/commands.ts:31,36` · `src/feed.ts:19` · `src/service.ts:22` · `src/types.ts:14,16,22` — đổi `@deepseek-ai/dsh-workspace` (+ `/types`) → `@galaxy-blackhole/gbh-workspace`; dòng tái xuất `export type { WorkspaceId } from …/types` cũng đã đổi (không còn tái xuất id stock). Thêm `dsh-typert-protocol` → `gbh-typert-protocol` và `dsh-session/types` → `gbh-session` (để cùng một brand `SessionId`). |
| **Seam PHASE B** | tạo `src/workspace-seam.ts`: `interface WorkspaceRegistryLike` (13 thành viên) + `workspaceRegistryOf(ctx)` fail loud (TypeError) theo ADR 000d; `commands.ts`/`feed.ts` thêm getter `private get registry()`; **18 chỗ** `ctx.workspaceRegistry` → `this.registry`. |
| **Bản đồ lỗi Remote** | `src/types.ts` augmentation khai BỔ SUNG 2 khoá còn thiếu bằng id GBH: `workspace/not-found` · `session/not-found` (trước đây đến từ augmentation của gói stock nên đổi id là mất — TS2345). |
| **R4 (hoãn)** | `src/defaults.ts:111` chuỗi `"deepseek-harness"`: đổi sang tên sản phẩm làm **2 ca A/B đỏ** ⇒ hoàn nguyên, ghi "R4 (hoãn — test A/B pin chuỗi gốc)" (review-2 đã đồng ý). |

**ĐO (cây xanh)**: `bun run build.ts` OK · `bun test --timeout 60000 ./tests/host/api-workspace-controller.test.ts` ⇒ **20 pass / 0 fail**.
`bun x tsc --noEmit` hẹp: **0 lỗi thuộc gói này**; còn **6 lỗi ở `packages/host/session/src/types.ts`** (Duplicate identifier
`SessionSeq` ×3 · `SessionLogOffset` ×2 tại dòng 38,40,55,62,73) — **gói NGOÀI batch dev-1**, bị kéo vào chương trình vì
`gbh-session` khai `types` từ src. Cần chủ gói `host/session` (dev-3) sửa; đã báo.

### Ghi nhận thêm: host/bundle (thuộc batch dev-1) thiếu artifact
`packages/host/bundle/lib/` **không tồn tại** ⇒ `exports` (`./lib/index.js` · `./cordis.patch.yml` · `./web-app.patch.yml`) trỏ hồn;
stock cũng không ship `lib/` ⇒ gói phải BUILD mới có artefact. dev-6 đã báo Lead; dev-1 KHÔNG tự chạy build (`build.ts` có `rm(lib)`, Lead đang giữ nhịp build) — **chờ Lead chỉ định ai build + khi nào**.
## Lô 11 — ghi nhận artefact hụt (không tự build) (2026-11-08 11:15)

| gói (batch dev-1) | hiện trạng đo được | xử lý |
|---|---|---|
| `client/ui-chat` | `lib/` chỉ còn `index.js` (mtime 10:47) — **thiếu `lib/client.js`** trong khi `exports["./client"] = "./lib/client.js"` và `src/client.ts` vẫn còn ⇒ trỏ hồn. `exports["."].types` đã đúng `./src/index.ts`. | **KHÔNG tự chạy build** (build.ts có `rm(lib)`; Lead đang giữ nhịp build). dev-6 đã xin Lead cấp lượt build riêng cho gói này. |
| `host/bundle` | `lib/` **không tồn tại** ⇒ `exports` (`./lib/index.js` · `./cordis.patch.yml` · `./web-app.patch.yml`) trỏ hồn; stock cũng không ship `lib/` ⇒ phải BUILD. | Chờ Lead chỉ định ai build + khi nào (dev-6 đã báo Lead). |

Ghi chú: cả hai là **artefact hụt do một lượt build dọn `lib/`**, KHÔNG phải lỗi mã; chữ ký dev-1 cho hai gói này vẫn giữ
nguyên trạng thái "self-test = build" đã ghi ở lô 3, chỉ bổ sung cảnh báo cần build lại trước khi Lead backup.
## Lô 12 — ui-chat cắt lại (A), host/bundle, vá 3 lỗi typecheck, api-session-controller (2026-11-08 11:20)

### 12.1 client/ui-chat — CẮT LẠI DẢI LÁT THEO (A) đã được Lead duyệt
- Gốc sự cố: 18 lát cũ TRỘN HAI KIỂU CẮT (part-01..14 = đúng 908 dòng/lát kiểu cắt cứng; part-15..18 = 727/877/947/682 dòng
  kiểu `//#region`) ⇒ `turnTailDefinition` (47 dòng, GIỐNG TỪNG BYTE) bị khai 2 lần ở part-13/part-16; part-13 chồng lấn vùng part-10, part-07 chồng lấn part-04.
- Đã làm: sinh lại **18 lát** từ `apps/host/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js` theo MỘT kiểu (`//#region`), gộp ≤ 900 dòng/lát (vùng `chat-snapshot-builder.js` 1.000 dòng bị cắt tiếp); mỗi lát = header 5 dòng + `// @ts-nocheck` + **nguyên văn** dòng bundle, KHÔNG newline cuối tệp.
- **Verify TRONG BỘ NHỚ trước khi ghi lib** (đúng điều kiện Lead): `clientBody()` = 591.747 B · `new Function(body)` **CHẠY** (trước khi cắt lại: ném `Cannot declare a const variable twice: 'turnTailDefinition'`).
- Sau đó mới `build.ts`: ghi `lib/client.js` (595.120 B) + `lib/index.js`; test ⇒ **9 pass / 0 fail** (trước: 1 fail).
- Sổ cắt lát + offset/length + lý do + bài học: **`docs/tien-do/so-cat-lat-ui-chat.md`**.

### 12.2 host/bundle — artefact hụt (Lead cho phép build 1 gói)
- Gói KHÔNG có `build.ts` (gói DỮ LIỆU: `cordis.patch.yml` · `web-app.patch.yml` · `presets/` · `experimental/`).
- Đã tạo `lib/index.js` (header 5 dòng + `export {}`) và vá `"./experimental/*": "./experimental/"` → `"./experimental/*"`; thêm `README.md` ghi rõ **không mount row / không có test riêng** (gói dữ liệu thuần) theo yêu cầu Lead.
- ĐO: quét mọi đích `exports` ⇒ **MISS: 0**; lint header/file-length 0 vi phạm.

### 12.3 Vá 3 lỗi typecheck do làn sóng `types → ./src/index.ts` (KHÔNG phải lỗi mã)
| gói | nguyên nhân | cách vá | đo |
|---|---|---|---|
| host/agent-preset | `gbh-agent-preset-registry` không mở `./src/*` và entry KHÔNG tái xuất `PresetDefinition` ⇒ TS2614 | lấy kiểu từ chính API công khai: `type PresetDefinition = Parameters<InstanceType<typeof AgentPresetRegistry>["register"]>[0]` | tsc **0 lỗi** · **17 pass / 0 fail** |
| host/command-goal | `gbh-goal` entry không tái xuất `GoalPhase/GoalRef/GoalView` ⇒ TS2614 ×3 + TS2345 ×2 | nhập từ `@galaxy-blackhole/gbh-goal/src/types.ts` (gói goal CÓ mở `./src/*`) | tsc **0 lỗi** · test xanh |
| host/api-workspace-controller | JSDoc lớp bị dòng `import` chen giữa ⇒ cổng jsdoc đỏ 2 vi phạm | đưa import lên đúng chỗ, JSDoc sát `export class` | jsdoc **0 vi phạm** · tsc **0 lỗi** |

### 12.4 host/api-session-controller — vá assertion theo chuẩn mới (review-2 trả lại)
`tests/host/api-session-controller.test.ts:562` nay so `exports` SAU KHI chuẩn hoá khoá `types` hai bên về cùng placeholder,
rồi khẳng định RIÊNG `exports["."].types === "./src/index.ts"` (KHÔNG revert manifest về `lib/types` đã bị xoá).
ĐO: **22 pass / 0 fail** ⇒ review-2 ĐÃ KÝ (sổ review-2: 76 ký · 0 trả lại).

### 12.5 Cổng tổng — MỘT lượt `bun run gate --no-tests` (11:20)
```
XANH  file-length 4209 · jsdoc 4209 (14 cảnh báo) · dep-guard 5486 · parity-matrix · hygiene 193
ĐỎ   header 1 vi phạm  → packages/client/ui-theme/assets/styles/brand-font.css:1  (NGOÀI batch dev-1)
ĐỎ   typecheck 2656 file · 212 vi phạm → toàn bộ thuộc experimental-api-speech-to-text (10) · experimental-tool-agent-team (6)
      · experimental-speech-to-text(-sensevoice) (8) · experimental-agent-team (3) · client/ui-theme (2) … (NGOÀI batch dev-1)
```
Kiểm chéo từng gói: **0/69 gói của batch dev-1 xuất hiện trong danh sách vi phạm** (các dòng chứa `packages/host/agent/...`
trong log là ĐƯỜNG DẪN KIỂU nằm trong thông điệp lỗi của gói `experimental-agent-team`, không phải lỗi của `host/agent`).
## Lô 13 — chạy canon 2 gói + vá công cụ debundle-client (2026-11-08 11:10)

### 13.1 client/ui-conversation — chạy canon ĐẠT
`bun run tools/debundle-client.ts packages/client/ui-conversation @deepseek-ai/dsh-client-ui-conversation @galaxy-blackhole/gbh-client-ui-conversation`
⇒ **ĐẠT · 51 lát · ta 774.324 B · gốc 774.080 B**. Test: **16 pass / 0 fail**.
Artefact nay `require()` id seed GBH (`@galaxy-blackhole/gbh-client-store|ui-primitives|ui-slots`) và GIỮ `@deepseek-ai/cordis`
(platform seed) — khớp bản vá của Lead.

### 13.2 client/ui-schedule — SỰ CỐ + phục hồi artefact (nguồn còn nợ, Lead chọn hướng (B) làm sau)
- Lệnh canon đã **xoá `src/parts/` có TÊN NGỮ NGHĨA** (40+ tệp theo `src/manifest.ts` `PART_FILES`, gồm khối VIẾT TAY
  `plugin-surface` + bảng tiếng Việt `gbh-vi-locale`) và ghi đè bằng 19 lát chung `part-NN.ts` ⇒ build ném ở
  `assertBodyParses`, test 2 pass/12 fail.
- **ĐÃ PHỤC HỒI ARTEFACT**: bản thật còn trong `~/.galaxy/blackhole/profiles/node_modules/@galaxy-blackhole/gbh-client-ui-schedule/lib/client.js`
  (mtime 10:45, trước khi chạy 10:57; đăng ký ĐÚNG MỘT id của ta, **0** id stock) ⇒ copy về `packages/client/ui-schedule/lib/client.js` (374.494 B).
  Test sau phục hồi: **12 pass / 2 fail**; 2 ca đỏ là kiểm ở MỨC NGUỒN (vùng nguyên văn không còn dòng viết tay · thân factory
  trùng từng byte theo VỊ TRÍ MANIFEST) — sẽ hết khi dựng lại 40+ lát theo tên (hướng (B), Lead xếp sau việc cổng xanh).

### 13.3 Vá `tools/debundle-client.ts` (2 lỗi làm app đỏ + làm mất nguồn)
1. **THIẾU chuẩn hoá id seed**: công cụ chỉ chạy `applyBrandRename`, không chạy `chuanHoaIdSeed` ⇒ artefact `require()` id
   STOCK (`@deepseek-ai/dsh-client-store|ui-primitives|ui-slots`) ⇒ shell không có trong module table ⇒ app trắng.
   Nay gọi `chuanHoaIdSeed(artifactBase)` cho MỌI `require()`; cổng byte vẫn đo trên bản TRƯỚC chuẩn hoá (parity 1:1 với bundle gốc),
   và báo cáo in thêm `seed doi: <id>→<id>×n`. Kiểm chứng: chạy `chuanHoaIdSeed` trên artefact ui-conversation hiện tại ⇒ `doi: []`,
   `giu: [@deepseek-ai/cordis ×1]` (idempotent, khớp bản vá tay của Lead).
2. **THIẾU chặn an toàn cho gói cắt lát theo manifest**: nay TỰ CHẶN trước khi ghi bất kỳ tệp nào —
   gói nào có `src/manifest.ts` khai `PART_FILES` thì trả về
   `"CẤM: <pkg> khai src/manifest.ts PART_FILES (cắt lát TÊN NGỮ NGHĨA) — công cụ này chỉ dùng cho gói cắt lát chung part-NN.ts."`
   ⇒ thuốc chống tái diễn sự cố ui-schedule. Đã thử: chạy lệnh canon lên ui-schedule ⇒ bị CHẶN, **không ghi tệp nào**.

### 13.4 client/ui-chat — ghi cảnh báo vào README gói
Đã thêm khối cảnh báo đầu README: **KHÔNG SỬA TAY `src/parts/`** — mọi lát sinh tự động từ bundle gốc theo `//#region`;
quy tắc cắt + bảng offset/số dòng + bài học chống trộn kiểu cắt ở `docs/tien-do/so-cat-lat-ui-chat.md`.
## Lô 14 — khai điều kiện `types` trong exports (2026-11-08 11:35)

Chính sách Lead chốt: **có `lib/types/index.d.ts` thì khai `./lib/types/index.d.ts`**; chỉ dùng `./src/index.ts` khi KHÔNG có tệp sinh.

| gói | trước | sau | test |
|---|---|---|---|
| host/app-boot | `exports["."] = "./lib/index.js"` | `{ types: "./lib/types/index.d.ts", default: "./lib/index.js" }` | 10 pass / 0 fail |
| host/command-compact | như trên | như trên | 16 pass / 0 fail |
| host/compaction-basic | như trên | như trên | 9 → **xanh** (sau khi cập nhật pin A9) |
| host/compaction-tool-result-pruner | như trên | như trên | **xanh** (sau khi cập nhật pin) |
| host/auto-review | `exports["."]` thiếu `types` (top-level `types = src/index.ts`, không có lib/types) | `{ types: "./src/index.ts", default: "./lib/index.js" }` | 40 pass / 0 fail |

**Cập nhật test pin (đúng chuẩn hoá, KHÔNG nới phép so khác)**: `tests/host/compaction-basic.test.ts:595` và
`tests/host/compaction-tool-result-pruner.test.ts:501` pin cứng `exports["."] = "./lib/index.js"` ⇒ nay khẳng định
đúng hình dạng mới `{ types, default }` (trùng hình dạng stock), kèm comment 08/11/2026 (dev-1) nêu lý do.

**ĐO**: 5 gói test gộp ⇒ **90 pass / 0 fail**; quét mọi đích `exports` của 5 gói ⇒ **MISS: 0**;
`bun run tools/lint/header.ts` toàn cây ⇒ **[OK] 4151 file · 0 vi phạm** (vi phạm CSS của ui-theme Lead đã vá).
## Lô 15 — ký hàng đợi docs/tien-do/dev-hang-doi-1.txt (14 gói) + host/experimental-agent-team (2026-11-08 11:45)

### 15.1 host/experimental-agent-team — CHỈ ĐỊNH của Lead (gói cuối chặn cổng typecheck), ĐÃ XONG
- Lỗi gốc: `roster.ts(313,65)` TS2322 · `(344,71)` TS2345 · `(389,11)` TS2769 — `Agent` của kernel (stock) ≠ `Agent` của gói GBH
  (`gbh-subagent`/`gbh-agent` dùng kiểu của chúng).
- Cách sửa (khuôn ADR 000d, KHÔNG đổi hành vi, KHÔNG nới kiểu nơi khác): thêm seam cấu trúc **tại biên gọi** —
  `type SubagentAgentArg = Parameters<SubagentRuntime["drainChildren"]>[0];` rồi ép kiểu đúng 3 chỗ:
  `interrupt(… { kind: "ancestor", agent: caller as unknown as SubagentAgentArg })` ·
  `drainChildren(root as unknown as SubagentAgentArg, childIds)` · `spawn({ …, parent: root as unknown as SubagentAgentArg })`.
- ĐO: `bun x tsc --noEmit` hẹp ⇒ **0 lỗi** · `bun test --timeout 60000 tests/host/experimental-agent-team.test.ts` ⇒ **24 pass / 0 fail** ·
  `bun run gate typecheck` sau đó: **0 vi phạm thuộc gói này**.

### 15.2 Ký 14 gói hàng đợi (append-only; gói nào ngoài batch cũ ghi rõ "ký thay")
Cổng hẹp đã chạy cho TỪNG gói: `GBH_LINT_ROOT=packages/<p> bun run tools/lint/{header,jsdoc,file-length}.ts` ⇒ **0 vi phạm cả ba cổng**;
quét mọi đích `exports` (kể cả điều kiện `types`) ⇒ **MISS: 0**; quét import R6a trong `src` ⇒ **0**.

| gói | vai | thời điểm | lệnh đã chạy | kết quả tóm tắt |
|---|---|---|---|---|
| client/ui-cot-translation | dev-1 (ký thay — dev-6 đã ký vòng trước, nay ký theo hàng đợi Lead) | 2026-11-08 11:45 | header/jsdoc/file-length hẹp · expMISS · `bun test tests/client/ui-cot-translation.test.ts` | 21 tệp src (max 3.231 dòng) · R4b: 10 định danh `_deepseek_ai_*` trong LÁT nguyên văn `src/parts/part-01.ts` (require đã trỏ GBH) · **27 pass / 0 fail** |
| host/acp | dev-1 | 2026-11-08 11:45 | 3 cổng hẹp + expMISS + `bun test tests/host/acp.test.ts` | 2 tệp src (1.489 dòng, phần lớn là lát de-bundle) · R6a 0 · **test xanh trong lượt gộp 204 pass/0 fail** |
| host/anonymous-user-id | dev-1 | 2026-11-08 11:45 | 3 cổng hẹp + expMISS | 0 tệp src (artefact 1:1) · R6a 0 · test khai trong manifest, xanh |
| host/attachment | dev-1 | 2026-11-08 11:45 | 3 cổng hẹp + expMISS | 0 tệp src (artefact 1:1) · R6a 0 |
| host/bash-local | dev-1 | 2026-11-08 11:45 | 3 cổng hẹp + expMISS | 0 tệp src · R6a 0 · 2 test khai, xanh |
| host/bundle | dev-1 | 2026-11-08 11:45 | 3 cổng hẹp + expMISS + `ls lib/index.js` | GÓI DỮ LIỆU: tạo `lib/index.js` (header + `export {}`) · vá `./experimental/*` · README ghi rõ KHÔNG mount row · **MISS: 0** |
| host/bundle-acp-app | dev-1 | 2026-11-08 11:45 | 3 cổng hẹp + expMISS | gói dữ liệu patch · R6a 0 · test khai, xanh |
| host/bundle-agent-team-profile | dev-1 | 2026-11-08 11:45 | 3 cổng hẹp + expMISS | gói dữ liệu patch · R6a 0 · test khai, xanh |
| host/bundle-auto-review | dev-1 | 2026-11-08 11:45 | 3 cổng hẹp + expMISS | gói dữ liệu patch · R6a 0 (chỉ còn peer id stock §2e) |
| host/bundle-badge-skill-bundle | dev-1 | 2026-11-08 11:45 | 3 cổng hẹp + expMISS | gói dữ liệu patch · R6a 0 · test khai, xanh |
| host/bundle-base | dev-1 | 2026-11-08 11:45 | 3 cổng hẹp + expMISS | gói dữ liệu patch · R6a 0 · test khai, xanh |
| host/bundle-cot-translation-bundle | dev-1 | 2026-11-08 11:45 | 3 cổng hẹp + expMISS | gói dữ liệu patch · R6a 0 · test khai, xanh |
| host/bundle-inspector-profile | dev-1 | 2026-11-08 11:45 | 3 cổng hẹp + expMISS | gói dữ liệu patch · R6a 0 · test khai, xanh |
| host/bundle-plugin-market-bundle | dev-1 | 2026-11-08 11:45 | 3 cổng hẹp + expMISS | gói dữ liệu patch · R6a 0 · test khai, xanh |

**ĐO lượt gộp test của các gói khai `gbh.tests`**: `tests/host/acp.test.ts` · `bundle-profile-patches.test.ts` ·
`host-utils-cluster.test.ts` · `sandbox-seam-ab.test.ts` ⇒ **204 pass / 0 fail**; cộng `ui-cot-translation` **27 pass / 0 fail**.

**Ghi chú R6b (hoãn) chung cho cả 14 gói**: id còn lại thuộc kernel seam/augmentation (cordis · schemastery · dsh-*);
R4b (hoãn) chỉ có ở `client/ui-cot-translation` (định danh trong lát nguyên văn) — **không có vi phạm R4 nào ở mã của ta**.
## Lô 16 — vá thiếu entry `"."` trong exports cho 6 gói bundle (2026-11-08 11:55)

Review-2 trả lại 6 gói: exports của ta **thiếu entry `"."`** (chỉ có `./cordis.patch.yml`, `./package.json`, `./locale/*.json`)
trong khi `lib/index.js` + `lib/types/index.d.ts` CÓ thật và stock khai `".": { types, default }` ⇒ consumer không import được gói.

| gói | exports sau khi vá | MISS | import "." (đo thật bằng bun) |
|---|---|---|---|
| host/bundle-sdk-minimal (`@galaxy-blackhole/gbh-sdk-minimal`) | `".": { types: "./lib/types/index.d.ts", default: "./lib/index.js" }` + 2 subpath cũ | 0 | **OK** (exports rỗng — gói dữ liệu) |
| host/bundle-session-search | như trên + 3 subpath cũ | 0 | **OK** (rỗng) |
| host/bundle-session-titles-bundle | như trên + 3 subpath cũ | 0 | **OK** (rỗng) |
| host/bundle-terminal-bundle | như trên + 3 subpath cũ | 0 | **OK** (rỗng) |
| host/bundle-tool-worktree (`@galaxy-blackhole/gbh-tool-worktree-bundle`) | như trên + 3 subpath cũ | 0 | **OK** — `exports=[apply,inject,name]` |
| host/bundle-voice-input-bundle | như trên + 3 subpath cũ | 0 | **OK** (rỗng) |

Giữ NGUYÊN mọi subpath cũ (`./cordis.patch.yml` · `./locale/*.json` · `./package.json`); chỉ thêm `"."` đứng đầu.
Chính sách types: cả 6 gói CÓ `lib/types/index.d.ts` ⇒ khai `./lib/types/index.d.ts` (đúng hình dạng stock).
**ĐO**: test chung `tests/host/bundle-profile-patches.test.ts` (5/6 gói khai) chạy lại sau khi vá ⇒ xem kết quả ở lượt chạy;
`bundle-tool-worktree` không khai `gbh.tests` (ghi nhận, không tự thêm vì ngoài phạm vi vá exports).
## Lô 17 — ghi nhận review-2 ký 6 gói bundle + quyết định về `bundle-tool-worktree` (2026-11-08 12:00)

- Review-2 (dev-6) đã **KÝ cả 6 gói** ở lô 16, đo độc lập bằng máy: `exports["."]` đúng hình dạng stock · **MISS = 0** mọi đích
  (kể cả điều kiện `types`) · import thật bằng bun: 5 gói exports rỗng (đúng vai dữ liệu) và `gbh-tool-worktree-bundle`
  ⇒ `[apply, inject, name]` (đúng vai plugin) · `tests/host/bundle-profile-patches.test.ts` **16 pass / 0 fail**.
- **Quyết định về `gbh.tests` của `host/bundle-tool-worktree`** (review-2 nêu, Lead chốt sau): gói KHÔNG khai `gbh.row`
  và KHÔNG khai `gbh.tests`; đã đối chiếu `tests/host/bundle-profile-patches.test.ts` — **không có ca nào chạm gói này**
  ⇒ KHÔNG trỏ `gbh.tests` vào test chung (sẽ là khai man). Đây là **lỗ hổng test thật** của một gói có hành vi
  (`apply/inject/name`): đề nghị viết test riêng `tests/host/bundle-tool-worktree.test.ts` (dựng plugin trên ctx giả, khẳng định
  3 export + patch `./cordis.patch.yml`), rồi mới khai `gbh.tests`. Hiện KHÔNG tự thêm vì ngoài phạm vi vá exports.
- Sổ review-2: **140 ký · 0 trả lại**.
## Lô 18 — test riêng bundle-tool-worktree + 2 gói typecheck cuối + atomic-write (2026-11-08 12:20)

### 18.1 host/bundle-tool-worktree — TEST RIÊNG (Lead duyệt), đã khai `gbh.tests`
Tạo `tests/host/bundle-tool-worktree.test.ts` (9 ca): ba export (`apply`/`inject`/`name`, KHÔNG `default`) ·
`name = "tool-worktree"` · `inject = ["tools","worktrees"]` · dựng ctx GIẢ ⇒ `apply` đăng ký ĐÚNG MỘT định nghĩa
`create_worktree` · tham số `name`/`from` trong `properties` (JSON Schema của `defineTool`) · output schema 4 trường bắt buộc ·
`presentCall` trả thẻ `generic` · `execute` uỷ nhiệm `ctx.worktrees.create(agent,args,signal)` và trả nguyên kết quả ·
thiếu agent ⇒ ném đúng câu `create_worktree requires a calling agent` · `cordis.patch.yml` cắm ĐÚNG hai row stock ·
manifest: `exports["."]` điều kiện types+default · `gbh.tests` trỏ chính tệp này · `provenance.patchLines` khớp số DÒNG NỘI DUNG.
## Lô 20 — DỰNG LẠI 50 lát ui-schedule (hướng B) + đóng 2 ca đỏ (2026-11-08 14:10)

## Lô 63 — Sửa cổng test đỏ: inject 6→5 của session-inspector + patch inspector 1:1 (2026-11-09 10:55)

### 63.1 Ca (1) — nguyên nhân THẬT không phải `gbh.row` của client-store
Ca đỏ là `tests/host/session-inspector.test.ts:272`: `expect(meta.dsh?.client?.inject).toHaveLength(5)` —
em đã **thêm** `@galaxy-blackhole/gbh-client-store` vào `dsh.client.inject` của `session-inspector` ⇒ thành **6**, vượt kỳ vọng.
Đối chiếu stock: `dsh-experimental-session-inspector/package.json` có **đúng 5** id và **KHÔNG** liệt kê `dsh-client-store`
(store là module nền, không phải inject của row). ⇒ Đã **bỏ id em thêm**, trả về đúng 5 id (đã map GBH).
**Không có test nào đòi `gbh.row` cho `gbh-client-store`** (grep `tests/` = 0 hit) ⇒ giữ nguyên quyết định bỏ `gbh.row`.

### 63.2 Ca (2) — CHIỀU của `replacements` đã đúng (đo bằng phép nghịch)
Phép nghịch: lấy patch của ta (bỏ 6 dòng header) rồi thay ngược id GBH→stock theo `replacements` (longest-first):
kết quả **BẰNG NGUYÊN VĂN** `apps/host/node_modules/@deepseek-ai/dsh-experimental-inspector-profile/cordis.patch.yml` (`True`).
Để đạt điều đó, em **bỏ 3 dòng chú thích 09/11** khỏi thân patch (patch phải 1:1 với stock sau khi map id; lời giải thích giữ ở sổ này).
`patchLines` cập nhật = 15. Cặp `replacements` hiện có 2 mục:
`dsh-experimental-inspector → gbh-experimental-inspector` (count 1) · `dsh-experimental-session-inspector → gbh-session-inspector` (count 1).
⇒ Ca `bundle-inspector-profile` còn đỏ CHỈ vì khối ngoại lệ cứng `if (bundle.stock === "dsh-experimental-inspector-profile")` đòi chuỗi `08/11/2026` + `TẠM GỠ` — thuộc phạm vi tester/ra-soát.

### 63.3 ĐO
- `bun test tests/client/client-store.test.ts tests/contract` ⇒ **57 pass / 0 fail**.
- `bun run gate --no-tests` ⇒ **XANH 8/8** (header 4210 · exports-targets 0 · typecheck 2677 tệp · hygiene 193).
- sha256: `session-inspector/package.json = 6983681b6823926cdb…` · `bundle-inspector-profile/cordis.patch.yml = 9b9c0ca81dbc408808…` ·
  `bundle-inspector-profile/package.json = 59d0716d0ffd3a430a…` · `client-store/package.json = 2bae7dc30616117b19…`
