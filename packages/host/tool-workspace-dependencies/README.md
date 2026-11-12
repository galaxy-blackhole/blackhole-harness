<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port dsh-tool-workspace-dependencies → @galaxy-blackhole/gbh-tool-workspace-dependencies:
      gói HOST-ONLY (stock KHÔNG có trường 'dsh', KHÔNG có row trong dump) — chỉ provenance + test A/B
-->

# @galaxy-blackhole/gbh-tool-workspace-dependencies — gói host-only

Port 1:1 `@deepseek-ai/dsh-tool-workspace-dependencies` (**295 dòng** `lib/index.js`, single-faced) thành module TS
trong `src/` rồi build lại bằng `build.ts` (Bun.build, ESM node, entry `src/index.ts` → `lib/index.js`).

## 1. Vì sao KHÔNG khai `gbh.row` / `gbh.nested`

- `package.json` của bản gốc **KHÔNG có trường `dsh`** (chỉ `name · description · version · publishConfig ·
  repository · type · main · types · exports · files · license · peerDependencies · devDependencies · dependencies`)
  ⇒ đây là gói **host-only**, không phải thành viên cây plugin.
- Đo dump: **KHÔNG có row `tool-workspace-dependencies`** ở bất kỳ thụt lề nào (top-level lẫn lồng trong preset).
- Vì vậy gói chỉ khai `gbh.provenance` + `gbh.tests`; **không** `gbh.row`, **không** `gbh.nested`, **không** flip row.

## 2. Provenance

```json
"gbh": {
  "provenance": {
    "stock": "@deepseek-ai/dsh-tool-workspace-dependencies",
    "version": "0.2.1-alpha.4",
    "sha": "b8478381a1501a11c1f7f8db7810bb4389694851ecad6131ac7d09055431a0b2"
  },
  "tests": ["tests/host/tool-workspace-dependencies.test.ts"]
}
```

`sha` = SHA-256 của **`lib/index.js` stock**; test A/B khẳng định lại cả `version` lẫn `sha` (đọc thẳng
`apps/host/node_modules/@deepseek-ai/dsh-tool-workspace-dependencies`).

## 3. Bề mặt xuất khẩu (11 tên, đúng bản gốc)

`Config · apply · copyPrimaryRuntime · inject · installPrimaryRuntime · name · parsePrimaryRuntime ·
primaryRuntimePythonAliases · readPrimaryRuntime · resolvePrimaryRuntime · workspaceDependencyPaths`

Bundle gốc chỉ có **MỘT vùng** `//#region lib/types/index.js` (dòng 5–294) nên `src/` tách theo trách nhiệm,
mỗi module chép nguyên văn phần tương ứng:

| Tệp | Nội dung chép nguyên văn |
|---|---|
| `src/config.ts` | `name` · `inject` · `Config` (schemastery) · `VERSION` · `PLATFORMS` · `isVersion` · `isRecord` · `isDistributionMap` |
| `src/metadata.ts` | `parsePrimaryRuntime` · `readPrimaryRuntime` (mọi chuỗi lỗi + quy tắc legacy `components`) |
| `src/payload.ts` | `primaryRuntimePythonAliases` · `copyPrimaryRuntime` · `workspaceDependencyPaths` · `validatePayloadEntries` · `exists` |
| `src/runtime.ts` | `compatibleManifest` · `resolvePrimaryRuntime` · `installPrimaryRuntime` (previous/staging/replace) |
| `src/plugin.ts` | `apply` + định nghĩa tool `load_workspace_dependencies` (mô tả 530 ký tự, schema, render, presentCall) |
| `src/types.ts` | `PrimaryRuntimeManifest` · `WorkspaceDependencies` (kiểu, chép từ `lib/types/index.d.ts`) |

## 4. Hành vi giữ nguyên

- `source` bắt buộc + khác rỗng; `root` tuỳ chọn + khác rỗng — cả hai phải **tuyệt đối** trước khi đăng ký
  (`"workspace dependencies: source and root must be absolute paths"`).
- Không có `root` ⇒ **dùng tại chỗ** (`resolvePrimaryRuntime`): kiểm metadata + điểm vào, **không chép**.
- Có `root` ⇒ **cài** (`installPrimaryRuntime`): staging → `<root>.previous` → rename, giữ cây trước khi lỗi.
- Lời gọi đầu cache `preparation`; lỗi thì xoá cache để lần sau thử lại.
- `ctx.effect` đăng ký disposer chờ `preparation.catch(() => undefined)` — không ném khi huỷ.
- Tool chỉ **đọc** đường dẫn: không đổi `PATH`, không đổi cấu hình package-manager.

## 5. Build + test

```bash
cd packages/host/tool-workspace-dependencies && bun run build.ts   # lib/index.js + in sha256
bun test tests/host/tool-workspace-dependencies.test.ts            # A/B với bundle gốc
```

`build.ts` có **cổng bề mặt export**: artefact phải xuất đúng 11 tên, sai thì build đỏ.

## 6. Phần chưa chắc

- Chưa chạy `bun run gate` (luật của lượt port cấm chạy) — mới chạy tsc tay trên `src/` + `build.ts` + test.
- Test dùng payload giả trong `os.tmpdir()` (không có payload Python/Node thật), nên chỉ khẳng định **hình dạng
  đường dẫn + luồng tệp**, không khẳng định chạy được trình thông dịch thật.
- Gói chưa được mount vào profile nào (đúng trạng thái stock: host-only, chưa flip).
