<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README gói @galaxy-blackhole/gbh-sandbox-policy — nguồn đối chiếu, lý do peer, bảng TRƯỚC/SAU, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-sandbox-policy

Bản viết lại của Galaxy Blackhole cho row **`sandbox-policy`** của DSH (tier T4, nhóm `sandbox`):
nhà CHÍNH SÁCH sandbox — service `ctx.sandboxPolicy` cấp chế độ tác động tệp cho MỌI capability
cưỡng chế (filesystem, bash một lần, terminal), kèm chữ ngữ cảnh đưa vào system prompt.

## 1. Nguồn đối chiếu (G4)

| # | Nguồn (CHỈ ĐỌC) | Đọc gì | Mức dẫn xuất |
|---|---|---|---|
| 1 | `apps/host/node_modules/@deepseek-ai/dsh-sandbox-policy/lib/index.js` (159 dòng) | toàn bộ thân bundle: `SANDBOX_MODES` · `setSandboxMode` · `resolveWorkspaceRoot` · `renderPolicyContext` · schema trạng thái · lớp `SandboxPolicyService` | **viết lại theo hành vi** (không chép code); ba CHUỖI ngữ cảnh model và thông điệp lỗi giữ **nguyên văn** vì chúng là hành vi nhìn thấy được |
| 2 | `…/lib/types/index.d.ts` (97 dòng) + `…/lib/types/session-mode.d.ts` (50 dòng) | hợp đồng công khai: export, `Config`, `SandboxPolicyRequest`, `SandboxExecutionPolicy`, khoá chiếu `sandboxMode` | tham chiếu |
| 3 | `…/package.json` | `dsh.client` (KHÔNG có ⇒ thuần host), `exports`, peer, `locale/` | tham chiếu |
| 4 | `…/locale/{en,zh}.json` | `meta.title` cho màn Plugins | **chép byte-for-byte** (sha256 khớp: `1338011b…` · `c226050c…`) |
| 5 | `docs/PARITY-MATRIX.md` dòng 41 · `docs/contracts/data/dsh-packages.json` (`id: sandbox-policy`, `disabled: false`) | row ↔ gói gốc, trạng thái bật | tham chiếu |

Ba phần KHÔNG chép nguyên văn mà viết lại theo hành vi, có ghi lý do:
1. **`stateSchema`** — bản gốc dùng `zod` (`z.union([...]).nullable()`); ta dùng validator nội bộ cùng hợp đồng `.parse`
   (sổ chiếu chỉ gọi đúng `.parse`, xem `dsh-session-projection/lib/index.js` dòng 254/296) để KHÔNG kéo thêm phụ thuộc runtime
   vào profile. Hành vi với dữ liệu hợp lệ/không hợp lệ là như nhau: nhận đúng ba chế độ hoặc `null`, ném khi khác.
2. **Đường tra seam** — `ctx.sessionProjections` và `scope.systemPrompt` tra theo HÌNH DẠNG qua một phép cast, không import
   gói seam (cùng lối đã dùng ở `packages/host/settings-controller`). Nhờ vậy gói chỉ cần hai peer trong bảng §3b.
3. **Kiểu** — `SandboxMode` · `SandboxSession` · `SandboxExecutionPolicy` khai lại theo cấu trúc thay vì import
   `@deepseek-ai/dsh-sandbox` / `dsh-session` (hai gói này KHÔNG thuộc bảng peer §3b).

## 2. Peer — vì sao, và thuộc seam nào

| Peer | Thuộc seam | Vì sao cần |
|---|---|---|
| `@deepseek-ai/cordis` | vòng đời plugin + `Service`/`Context` (§3b) | lớp service PHẢI là **cùng một instance** `Service` mà kernel cấp (đăng ký `ctx.sandboxPolicy`) |
| `@deepseek-ai/schemastery` | schema `Config` (§3b) | `static Config` để Settings/config-editor render được `mode` + `workspaceRoot` |

Đúng hai peer, đều là `peerDependencies` **và** `devDependencies` (không bao giờ là `dependencies`), yêu cầu (a)+(b)+(c) của §3b.
Không có peer thứ ba: seam `sessionProjections` · `systemPrompt` được tra theo hình dạng (xem §1).

## 3. Bề mặt phải khớp (đo trên ARTIFACT)

| Hạng mục | Giá trị |
|---|---|
| Export | `SANDBOX_MODES` · `SandboxPolicyService` · `default` (= `SandboxPolicyService`) · `setSandboxMode` |
| Service | tên `sandboxPolicy`; `static inject = ["sessionProjections"]`; `static Config` (schemastery) |
| Trường | `defaultMode` (mặc định `read-only`) · `workspaceRoot` (mặc định `process.cwd()`, phải TUYỆT ĐỐI) |
| Phương thức | `resolve(request?)` → `{ mode, workspaceRoot, sessionId? }` · `overrideOf(session)` → chế độ cuối hoặc `undefined` |
| Thứ tự ưu tiên | `request.mode` > sự kiện `sandbox/mode` cuối của phiên > `defaultMode` |
| Sổ chiếu | khoá `sandboxMode`, `stateVersion: 1`, `init() = null`, `apply` chỉ đổi khi `event.type === "sandbox/mode"` |
| Ngữ cảnh prompt | tên `sandbox:policy`, `order = getContextOrder("SANDBOX_POLICY")` (= 110), chữ theo chế độ; KHÔNG có phiên ⇒ chuỗi rỗng |
| Đường ghi | `setSandboxMode(session, mode)` ghi ĐÚNG MỘT sự kiện `session.append("sandbox/mode", { mode })` |

## 4. TRƯỚC/SAU và lệnh tái lập

| Phép đo | TRƯỚC (bản gốc) | SAU (bản của ta) |
|---|---|---|
| `resolve()` trên 5 tổ hợp đầu vào | oracle | **trùng từng ký tự JSON** |
| `overrideOf` (có/không ghi đè) | oracle | trùng |
| Gốc tương đối ⇒ thông điệp ném | `sandbox-policy: workspace root must be an absolute execution-world path` | **y hệt** |
| Gộp chiếu (`key`/`stateVersion`/`init`/`apply`) | oracle | trùng |
| Chữ ngữ cảnh 3 chế độ | oracle | **trùng từng ký tự** |
| Tập export trong artifact | 4 tên | **4 tên, y hệt** |
| `grep -c "id: @deepseek-ai" lib/index.js` | — | **0** |

```bash
cd packages/host/sandbox-policy && bun run build.ts        # ⇒ lib/index.js (ESM, 97 dòng)
grep -c "id: @deepseek-ai" lib/index.js                    # ⇒ 0
cd ../../.. && bun test tests/host/sandbox-policy.test.ts  # ⇒ 5 pass / 0 fail
bun run check:rows                                         # gói này: 0 dòng (chưa khai gbh.row)
bun run tools/lint/gate.ts --no-tests                      # các cổng của gói này XANH
```

**Vì sao chưa có bảng TRƯỚC/SAU trên app thật**: gói CHƯA khai `gbh.row` (xem §6), nên chưa mount ⇒ chưa có
phép đo trên app 5439. Mọi phép đo ở trên đều trên **artifact** hoặc **đối chứng trực tiếp với chính bundle gốc**.

## 5. Test

`tests/host/sandbox-policy.test.ts` — 5 ca / 53 expect, và **mọi phép so đều chạy CẢ HAI bản**:

1. **ARTIFACT**: build bằng chính `build.ts`, nạp artifact, so tập export với bundle gốc, so `default === SandboxPolicyService`,
   so **tên phương thức trên prototype**, và `grep` hai chiều `id: @deepseek-ai` / `id: @galaxy-blackhole` ⇒ **0**.
2. **Hành vi chính**: `resolve()` trên 5 tổ hợp (không phiên · chỉ `mode` · phiên có cwd · phiên không cwd · phiên + `mode`)
   và `overrideOf` — so **từng ký tự JSON** với bản gốc.
3. **Cấu hình + đường lỗi**: mặc định `read-only`; gốc tương đối ⇒ **cùng thông điệp** như gốc; cwd tương đối của phiên cũng bị chặn (không treo).
4. **Sổ chiếu + đường ghi**: `setSandboxMode` ghi đúng một sự kiện (so nhật ký hai bên); `init`/`apply`/`stateSchema` so với bản gốc.
5. **Ngữ cảnh prompt**: đúng MỘT mục, tên `sandbox:policy`, `order` hỏi bằng `SANDBOX_POLICY`, chữ ba chế độ **trùng bản gốc**, không phiên ⇒ `""`.

Điểm kỹ thuật đáng nhớ: hai bản nằm ở **hai bản cài `cordis` khác nhau** (`packages/host/sandbox-policy/node_modules`
và `apps/host/node_modules`), nên test dựng **mỗi bản trên Context của chính bản đó** — dùng lẫn là `instanceof`/`provide` sai ngay.
Và lỗi trong constructor chỉ ném ra khi dựng lớp **trực tiếp**; qua `ctx.plugin` nó nằm trong fiber nên test gọi thẳng `new`.

## 6. CHƯA làm (điều kiện chặn mount, không phải ghi chú cuối báo cáo)

1. **CHƯA khai `gbh.row`** — theo luật của Lead cho lô M6 này: gói chỉ được khai khi đã chạy sạch trong lab.
   Hệ quả: gói này **không thể làm hỏng app** ở bất kỳ lượt boot nào (không có khối disable+insert nào được sinh).
2. **CHƯA mount + CHƯA có bảng TRƯỚC/SAU trên app 5439** (`check:app` 11 chỉ số · parity 0/0/0) — chờ Lead.
3. **CHƯA chạy `lab:row`** (công cụ cần gói đã khai `gbh.row`) — chờ lượt boot của Lead.
4. Row này là **row NỀN**: 6 gói khác inject `sandboxPolicy`/`sandboxMode` (`dsh-terminal-bash` · `dsh-tools` ·
   `dsh-api-workspace-files` · `dsh-api-terminal-controller` · `dsh-plugin-manager` · `dsh-client-ui-deliverables`).
   Trước khi mount BẮT BUỘC đo lại nhóm này: tên service, khoá chiếu và thứ tự ưu tiên phải y hệt (đã có test đối chứng).

## 7. Năm câu hỏi bắt buộc (mục 0 của công thức)

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row có đang BẬT không? | **CÓ** — `docs/contracts/data/dsh-packages.json` dòng 946: `id: sandbox-policy`… `"disabled": false` (đo trên dữ liệu cấu hình đã trích; KHÔNG chạy `bh host --dump-config` vì lệnh đó ghi lại `app.patch.yml` của app đang chạy) |
| 2 | Thuần host hay có mount surface client? | **THUẦN HOST** — bundle chỉ `export` + `Service`, không có `slots.register`/`loader.create/resolve` |
| 3 | Cần seam nào? | `extends Service` (cordis) + seam `sessionProjections` và `systemPrompt` (tra theo hình dạng) + `node:path`. **Trong bảng §3b** |
| 4 | Hành vi đo được là gì? | `ctx.sandboxPolicy.resolve()` trả `{mode, workspaceRoot, sessionId?}`; mỗi lần đổi ghi 1 sự kiện `sandbox/mode`; mục `sandbox:policy` (order 110) góp chữ ngữ cảnh vào system prompt; gốc tương đối ⇒ ném lỗi |
| 5 | Gói gốc có `dsh.client` không? | **KHÔNG** (`python3 … .get("dsh")` ⇒ `False`) ⇒ **một mặt**, thay được ngay, không cần nửa browser |
