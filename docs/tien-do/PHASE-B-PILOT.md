<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc PHASE B — PILOT 1 gói (host/tool-working-directory): bỏ @deepseek-ai/dsh-tools bằng SEAM CẤU TRÚC
      ctx.get("tools") thay vì augmentation của Context (ADR 000d). Ghi cách làm · tệp đã sửa · lệnh đã chạy · kết quả.
-->

# PHASE B — PILOT: `host/tool-working-directory`

## 1. Vấn đề (đo được)

Đổi import `@deepseek-ai/dsh-tools` → `@galaxy-blackhole/gbh-host-tools` mà **vẫn dùng `ctx.tools`** thì tsc đỏ:

```
pilot-demo-old.ts(65,7): error TS2339: Property 'tools' does not exist on type 'Context'.
```

Nguyên nhân: gói stock bơm `Context.tools` bằng `declare module`; `@galaxy-blackhole/gbh-host-tools` **cố ý KHÔNG
augment** (ADR 000d) mà dùng **seam CẤU TRÚC**. ⇒ Phải refactor consumer sang seam cấu trúc **rồi mới** đổi id.

## 2. Cách làm (đã áp cho gói pilot)

| # | Việc | Chi tiết |
|---|---|---|
| 1 | Khai seam cấu trúc cho sổ tool | thêm `interface ToolsLike { register(definition: ToolDefinition): () => void }` ngay trong `src/index.ts` (cùng kiểu seam với `WorkingDirectoryLike` đã có). Kiểu `ToolDefinition` lấy từ chính gói ta ⇒ **một nguồn kiểu** |
| 2 | Đọc sổ tool qua seam | `const tools = ctx.get("tools") as ToolsLike \| undefined;` + **fail loud** `throw` khi thiếu seam (giữ tinh thần "nổ ngay" của bản gốc) |
| 3 | Đổi id | `import { defineTool } from "@galaxy-blackhole/gbh-host-tools"` + `import type { ToolDefinition } from …` |
| 4 | Manifest | **§2e (Lead, 08/11/2026): GIỮ id STOCK trong `peerDependencies`/`devDependencies`** (`@deepseek-ai/dsh-tools`). Peer chỉ là khai báo để mount dựng symlink TỪ KERNEL; đổi sang id GBH làm mount báo `thiếu peer trong kernel`. R6a chỉ áp cho **import trong mã** ⇒ peer ghi `R6b (hoãn, peer-kernel-id)` |
| 5 | `gbh.peers` | **GIỮ** `@deepseek-ai/dsh-tools` (§2e): `mountRewritePackage` dựng symlink peer **từ KERNEL**; id GBH không có ở đó ⇒ mount báo `thieu peer trong kernel`. Gói `gbh-host-tools` là ROW nên mount tự cài; alias stock→ta do `applyProvenanceAliases` lo |
| 6 | Test | `fakeContext` của `tests/host/tool-working-directory.test.ts` lộ thêm đường `get("tools")` (trỏ **cùng một** sổ tool) để đo được **cả hai** bundle: bundle ta đọc `ctx.get`, bundle gốc đọc `ctx.tools`. Phép so hành vi A/B **không đổi** |

## 3. Tệp đã sửa

| tệp | thay đổi |
|---|---|
| `packages/host/tool-working-directory/src/index.ts` | + `ToolsLike` (JSDoc đủ) · `apply()` đọc `ctx.get("tools")` + fail loud · import `defineTool`/`ToolDefinition` từ id GBH · header `modify date 08/11/2026` |
| `packages/host/tool-working-directory/package.json` | **giữ nguyên id STOCK** ở peer/dev + `gbh.peers` (§2e) |
| `tests/host/tool-working-directory.test.ts` | `fakeContext`: tách `soTool` dùng chung, `get()` trả thêm `"tools"`; header `modify date 08/11/2026` |

## 4. Lệnh đã chạy + kết quả

| lệnh | kết quả |
|---|---|
| `bun test ./tests/host/tool-working-directory.test.ts` | **XANH: 5 pass · 0 fail · 68 expect()** (533 ms) — gồm ca A/B với bundle gốc: định nghĩa tool · execute (ensure/set) · đường lỗi · `gbh.peers ⊆ peerDependencies` |
| tsc chương trình TỐI THIỂU với **đúng bộ cờ gate** (`/tmp/tsconfig-pilot-old.json` vs `-new.json`) | OLD (`ctx.tools`): **TS2339** · NEW (`ctx.get("tools")`): **không còn lỗi của tệp pilot** ⇒ chứng minh refactor đúng chỗ |
| `bun run tools/lint/gate.ts --no-tests --only typecheck` | **ĐỎ sẵn ở baseline do gói KHÁC đang sửa dở** (76 vi phạm thuộc `packages/host/subagent` · `packages/host/tools` (untracked) · `packages/host/sandbox`); lọc log: **0 vi phạm của `tool-working-directory`** (`grep tool-working-directory /tmp/typecheck-pilot.log` → không có) |

## 5. Kết luận + đề xuất nhân rộng (12 gói còn lại)

- **Khả thi**: pilot xanh test + không thêm vi phạm typecheck; **không đổi logic nghiệp vụ**, chỉ đổi ĐƯỜNG ĐỌC seam.
- Mỗi gói cần seam riêng đúng bằng mặt cắt nó dùng (vd chỉ `register`; nếu cần `list/describe` thì mở rộng interface — **không** mở rộng augmentation).
- Consumer phức tạp hơn (`packages/host/cordis-host-runner/src/guard.ts` dùng `ctx.tools.register` trong façade sandbox) cần seam rộng hơn ⇒ làm sau, có test riêng.
- **Chưa áp hàng loạt** — chờ Lead duyệt.

## 6. Việc kèm (Lead yêu cầu): typeSymbol ở `client/ui-cot-translation`

Lead yêu cầu đổi `"@galaxy-blackhole/gbh-experimental-translator/types#TranslationRequest"` →
`"@galaxy-blackhole/gbh-host-experimental-translator/types#…"`. **Đã kiểm trước khi sửa: KHÔNG đổi được.**

- `tests/client/ui-cot-translation.test.ts:886` **khẳng định đúng chuỗi cũ**:
  `expect(artifact).toContain("@galaxy-blackhole/gbh-experimental-translator/types#TranslationRequest")`
  và dòng 887 cấm còn id stock. Đây là **type-brand** do `tools/brand-ids-client.ts` sinh theo luật
  `@deepseek-ai/dsh-experimental-translator` → `@galaxy-blackhole/gbh-experimental-translator` (bỏ `dsh-`, thêm `gbh-`),
  **không phải** tên gói thật.
- Đổi sang id gói thật ⇒ **test 000e đỏ**; muốn đổi phải sửa ĐỒNG THỜI test + `tools/brand-ids-client.ts` (ngoài phạm vi pilot).
- **CHỐT (Lead, 08/11/2026): GIỮ NGUYÊN, ĐÃ ĐO.** Lead đồng ý đó là type-brand do tools/brand-ids-client.ts sinh và test pin đúng chuỗi; không sửa brand tool trong lượt này. Muốn đổi sau này phải sửa ĐỒNG THỜI brand tool + test + artefact client.

## 7. Ghi chú tuân thủ

- Không chạm `locale/` (lệnh đóng băng của Lead): 0 tệp locale bị sửa bởi dev-6.
- Một subagent của dev-6 có sửa nhầm `packages/client/ui-workspace/src/runtime.ts` (đổi `dsh-client-ui-primitives` —
  id thuộc R6b §2c) ⇒ **đã `git checkout` khôi phục** và chạy lại `bun test tests/client/ui-workspace.test.ts`
  = **23 pass · 0 fail**.
