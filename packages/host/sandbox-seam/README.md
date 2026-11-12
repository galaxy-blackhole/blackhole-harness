<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho SEAM trừu tượng @deepseek-ai/dsh-sandbox (289 dòng, 16 export) —
      gói THAY dsh-sandbox (KHÔNG phải dsh-sandbox-local); là thư viện consumer-inline nên KHÔNG mount
-->

# @galaxy-blackhole/gbh-sandbox-seam — SEAM trừu tượng `ctx.sandbox`

> ⚠️ **MAPPING**: gói này thay **`@deepseek-ai/dsh-sandbox`** (seam trừu tượng, 289 dòng). Nó **KHÔNG** thay
> `@deepseek-ai/dsh-sandbox-local` — bản local (556 dòng, 2 export) đã là **`@galaxy-blackhole/gbh-sandbox`**
> (row `sandbox`). Đừng nhầm hai nhà này.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Package | `@deepseek-ai/dsh-sandbox` @0.2.1-alpha.4 | `@galaxy-blackhole/gbh-sandbox-seam` @0.1.0 (private) |
| Host | `lib/index.js` **289 dòng** | `src/{index,types,escalation,roots,diagnostics}.ts` — port 1:1 |
| Kiểu | `lib/types/{index,escalation,roots,diagnostics}.d.ts` (363 dòng) | dùng làm **nguồn kiểu** |
| Client / locale / row | **KHÔNG có** (không `lib/client.js`, không `locale/`, không `dsh.client`) | — |
| Peer | `cordis` · `dsh-llm` · `dsh-session` (peer) + `dsh-util-values` (dep) | **cả 4 thành `peerDependencies`** + `gbh.peers` |

`dsh-util-values` (hàm `assertNever`) là **import LÚC CHẠY** ⇒ phải là peer: `apps/cli/src/mount.ts` chỉ symlink
peer vào `profiles/node_modules`, khai `dependencies` thì không có module lúc chạy (tiền lệ `fflate`, task-23).

## 2. Bề mặt đã port — **16 export, BẰNG TỪNG TÊN** (kể cả `default`)

`SandboxProvider` (lớp trừu tượng `extends Service`, tên dịch vụ `sandbox`) · `default` = `SandboxProvider` ·
`SANDBOX_UNAVAILABLE` · `SandboxUnavailableError` · `WIDER_MODES` · `ESCALATION_TARGETS` ·
`validateEscalationArgs` · `sandboxDenialMarker` · `escalationHintMarker` · `sandboxPermissionsDescription` ·
`approveEscalation` · `canonicalPath` · `writableRoots` · `classifyRunnerFailure` · `isRunnerSpawnFailure` ·
`matchesSignature` + (kiểu) `SandboxMode` · `ConfinedSandboxMode` · `SandboxExecutionPolicy` · `SandboxPolicy` ·
`SandboxEnforcement` · `RunnerFailureRule` · `ConfinedArgv` · `EscalationOutcome/Approver/Approval/Request`.

Ngữ nghĩa giữ NGUYÊN VĂN: bậc **thẳng rộng hơn** (`read-only` → `workspace-write`/`danger-full-access`;
`workspace-write` → `danger-full-access`), chuỗi duyệt **đóng-cửa-khi-hỏng** (`approveEscalation`: lặp chế độ
hiệu lực = không hỏi; rộng hơn = hỏi người duyệt, chỉ áp lượt này; còn lại NÉM), marker hướng mô hình,
gốc ghi được canonical đã khử trùng, và 3 hàm chẩn đoán runner hỏng.

### Vì sao là SEAM (consumer inline) — ĐO, không suy đoán
* Patch đang chạy (`~/.galaxy/blackhole/app.patch.yml`): **0 dòng** chứa `dsh-sandbox` (chỉ có
  `dsh-sandbox-local` là row `sandbox`) ⇒ seam **không có row**.
* Dump mới nhất (`.parity/dumps/<mới nhất>/ours.yml`): **không** có `name: '@deepseek-ai/dsh-sandbox'`.
* Seam được **4 gói của ta import INLINE (8 tệp)**: `gbh-sandbox` (row `sandbox`), `bash-sandbox`, `fs-sandbox`,
  `pwsh-sandbox`, `sandbox-policy` ⇒ consumer inline thì **không có row để thay**.
⇒ **KHÔNG khai `gbh.row`** (khai row cho gói không có row stock sẽ khiến `check:rows` so với hư không).

## 3. Bằng chứng — test đối chứng (19 ca / 113 expect / 0 fail)

| Mục | Ca đo |
|---|---|
| A | **16 = 16** export trên ARTIFACT, bằng từng tên; `default === SandboxProvider` cả hai bên; artifact ESM thư viện (import `cordis`/`dsh-llm`/`dsh-util-values`, không `__ModuleLoader__`) |
| B | `SANDBOX_UNAVAILABLE` · `WIDER_MODES` · `ESCALATION_TARGETS` **BẰNG** |
| C | marker từ chối (3 chế độ) + gợi ý + mô tả tham số (2 danh từ) **BẰNG TỪNG KÝ TỰ** |
| D | `validateEscalationArgs` 5 tổ hợp: hợp lệ im lặng, sai thì **cùng thông điệp** |
| E | `SandboxUnavailableError`: message (không/kèm `Runner failure: …`), `name`, `code` = `SANDBOX_UNAVAILABLE`, **`instanceof HarnessError` của kernel** |
| F | Dịch vụ trên **Context cordis THẬT**: đăng ký tên `sandbox`, `confine` chạy, **unload plugin ⇒ service BIẾN MẤT** (dọn dẹp); đăng ký 2 lần ⇒ lỗi cordis `service "sandbox" has been registered` |
| G | `approveEscalation`: lặp chế độ ⇒ không hỏi; `allowed-once` ⇒ cấp + **payload duyệt BẰNG từng trường** (reason, `displayReason.en`, `displayReason.zh`, toolName, callId, **signal**); `rejected`/`cancelled`/`unavailable`/`weird`/thiếu approver/thiếu agent/hẹp hơn ⇒ **cùng lỗi** |
| H | `canonicalPath` (đường thật + đường không tồn tại giữ nguyên) và `writableRoots` (`read-only` rỗng; `workspace-write` = workspace + `/tmp` + `tmphânh` đã **khử trùng**) **BẰNG** |
| I | `classifyRunnerFailure` (6 tổ hợp: null/0/mã khác 0/cổng exit-code/dòng thông tin bị loại/hoa thường) · `matchesSignature` · `isRunnerSpawnFailure` (đúng argv[0]+syscall, `EACCES`/`ENOENT`, path sai, mã lạ, **cwd không dùng được**, thiếu program, không phải object) — **BẰNG** |
| J | `package.json`: không `gbh.row` + lý do SEAM; `gbh.peers ⊆ peerDependencies`; **ĐO** matrix row `sandbox` là `dsh-sandbox-local` + dump **0** dòng seam + **8 tệp consumer inline ở 4 gói** (và chính gói này không import bản gốc) |
| K | **TRÙNG TÊN**: chỉ `packages/host/sandbox-seam/src/index.ts` export `SANDBOX_UNAVAILABLE`/`SanboxProvider` |

## 4. Lệnh

```bash
bun run build.ts                                 # → lib/index.js (ESM, node) — nhận outDir qua argv[2]
bun test tests/host/sandbox-seam.test.ts         # 19 ca đối chứng
bun run check:rows                               # seam KHÔNG khai gbh.row ⇒ cổng bỏ qua (đúng: không có row)
```

## 5. Nợ kỹ thuật đã biết (ghi để phiên sau không đoán)

1. **Repoint consumer**: 5 gói vẫn import `@deepseek-ai/dsh-sandbox` (bản gốc). Khi chuyển sang gói này phải
   đổi **cùng một lượt** cả import lẫn khai peer, vì `SandboxUnavailableError`/`SandboxProvider` là **hai lớp
   khác nhau** nếu hai bản cùng có mặt (`instanceof` sẽ trượt — bài học `SessionPersistenceNotFoundError`).
2. **Khai báo cộng gộp `Context.sandbox`**: bản gốc khai trong `.d.ts`; gói ta khai trong `src/index.ts`.
   ĐO 18/10: typecheck toàn repo **0 vi phạm liên quan sandbox** (không có TS2717) — nhưng khi repoint phải
   kiểm lại vì lúc đó cả hai khai báo có thể cùng nằm trong chương trình.
