<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README goi plugin-manager (HA TANG CAI/GO PLUGIN — Market dung): TRUOC/SAU, TAC DONG KHI MOUNT, bang chung A/B, no ky thuat
-->

# `@galaxy-blackhole/gbh-host-plugin-manager`

Bản viết lại **1:1** của `@deepseek-ai/dsh-plugin-manager` — **hạ tầng cài/gỡ plugin** (Market dùng): phân giải
spec cài, chọn registry, chạy pnpm/plugin command trong profile, ghi patch, duyệt build script, kiểm kết nối
GitHub, và bề mặt typert RPC (host face + remote-client face).

## 1. TRƯỚC → SAU

| hạng mục | TRƯỚC (DSH) | SAU (gói của ta) |
|---|---|---|
| mã nguồn | 1 bundle `lib/index.js` **2.420 dòng** (10 vùng) + 12 module `lib/types/*.js` | **14 tệp TS**: `manager.ts` 999 · `operations.ts` 759 · `types.ts` 336 · `manager-support.ts` 202 · `tools.ts` 210 · `install-spec.ts` 164 · `patch.ts` 111 · `build-approval.ts` 112 · `github-connection.ts` 89 · `run-tree.ts` 95 · `official-install-target.ts` 86 · `registry.ts` 100 · `install-failure.ts` 55 · `failure.ts` 42 (+ `index.ts`) |
| artefact typert | `lib/typert.host.js` 1.161 + `lib/typert.remote-client.js` 889 (SINH TỰ ĐỘNG) | **phát ra `lib/` lúc build** bằng cách đọc nguyên văn artefact sinh từ kernel — **không lưu bản sao trong repo** (mọi tệp trong `packages/**` phải có header + ≤1.000 dòng) |
| mặt export | 5 tên ở `.` + 6 subpath (`./types`, `./registry`, `./operations`, `./tools`, `./typert`, `./remote`) | **giữ đủ 7 artifact**; `lib/index.js` export **5 = 5** |
| locale | `locale/{en,zh}.json` + `locale/tools/{en,zh}.json` | **chép byte-for-byte** (4 tệp) |
| test | — | **18 ca / 46 expect · 0 fail** |

## 2. ⚠️ TÁC ĐỘNG KHI MOUNT (đọc trước khi flip row)

Row `plugin-manager` là **TOP-LEVEL** trong dump và row stock có điều kiện
`disabled: !!js "!ctx.get('profileContext')"` — tức **chỉ bật khi có profileContext**. Mount gói của ta = **thay hạ tầng cài/gỡ plugin đang chạy**, nên:

1. **Luồng cài/gỡ plugin của Market** đi qua đúng các hàm ta port: `parseInstallSpec` → `registryPlan`/`normalizeRegistry` → `runProfilePnpm`/`runPluginCommand` (`operations`) → `writePluginEnabled` (`patch`) → `recordPendingBuilds`/`approveBuilds` (`build-approval`). Sai một nhánh ⇒ **cài hỏng/thay đổi profile sai**, không chỉ lỗi UI.
2. **Bề mặt typert RPC** (`./typert` + `./remote`) phải khớp **từng method** với client `ui-plugin-manager`; hai artefact này là **sinh tự động** từ FaceModel — ta phát lại nguyên văn bản sinh của kernel, nên chỉ an toàn khi class `PluginManager` của ta giữ đúng chữ ký method.
3. **Ghi đĩa**: `saveManifest`, `writePluginEnabled`, `approveBuilds` sửa `app.patch.yml`/profile — mount bản sai có thể **làm hỏng patch của profile** (đây là lý do row phải PARKED tới khi boot-smoke ĐẠT).
4. **Registry/credential**: `checkGithubConnection` + `attributeFailure` quyết định thông điệp lỗi người dùng thấy khi cài thất bại.

## 3. Bằng chứng A/B (18 ca)

- **export**: `lib/index.js` 5 tên trùng khít, `default === PluginManager`; `./registry`, `./operations`, `./tools`, `./types` so **runtime keys** với bản gốc; 2 artefact typert **khớp BYTE** với kernel.
- **parseInstallSpec**: npm có/không version, scope, git/URL, đường dẫn, tarball, rỗng/sai → cùng kết quả hoặc cùng `InvalidInstallSpecError`.
- **classifyInstallFailure**: 404/timeout/git-not-found → cùng phân loại.
- **registry**: 2 hằng registry + `normalizeRegistry` + `registryPlan` (kể cả đầu vào sai → cùng lỗi).
- **patch/**`flatten`** · **run-tree**`leadsOwnGroup` (darwin/linux/win32 × cli/service) · **tools**`inject` — trùng bản gốc.
- **Config**: `String(PluginManager.Config)` trùng từng ký tự · **locale**: 4 tệp byte-for-byte · row PARKED đúng quy ước.

## 4. Kiểm

```bash
bun test tests/host/plugin-manager.test.ts          # 18 pass / 46 expect
bun run packages/host/plugin-manager/build.ts       # 5 artifact TS + 2 artefact typert
```

## 5. Trạng thái row — **PARKED**

`package.json` KHÔNG khai `gbh.row`; park: `gbh.row_unmounted_ly_do = { ly_do, row: { id: "plugin-manager", tests: [...] } }`.
Flip chỉ khi: (1) test A/B xanh ✅, (2) **Lead tự chạy `boot-smoke plugin-manager` ĐẠT**, (3) Lead thêm dòng `packages/README.md` §4, (4) mount + `check:app` 11/11, **và** thử một lượt cài/gỡ plugin thật trên profile tạm.

## 6. Nợ kỹ thuật

1. Hai artefact typert là **sinh tự động**: ta phát lại bản sinh của kernel (không viết tay, không lưu trong repo). Nếu kernel đổi FaceModel, build sẽ lấy bản mới; nếu **method của ta lệch** bản sinh, RPC sẽ sai — cần `typert` generator để sinh từ chính class của ta (nợ riêng).
2. Khối `declare module '@deepseek-ai/cordis'` của bản gốc **không port** (ADR 000d) ⇒ 3 sự kiện `plugin-manager/*` chỉ còn payload interface.
3. `operations.ts`/`tools.ts` dùng seam CẤU TRÚC (`PackageOperationContext`, `PluginManagerSeam`, `SandboxPolicySeam`, `AgentSeam`) + ép kiểu tại biên.
4. Test A/B phủ hàm thuần + mặt export; **chưa** chạy một lượt cài/gỡ plugin thật trong lab — sẽ làm ở cửa sổ đo của Lead (đây là gói có rủi ro ghi đĩa cao nhất trong đợt).

## 19/10/2026 — task-130: build TỪNG entrypoint + nested tool-plugin-manager + row điều kiện

1. **Build tách entry**: build.ts trước đây gộp 5 entry trong MỘT `Bun.build` ⇒ Bun sinh prelude/chunk chia sẻ,
   byte artifact lệch (bài học 1.103 B → 5.188 B). Nay build TỪNG entrypoint riêng (naming = tên artifact);
   đo lại: index 83.087→82.420 B · operations 30.736→25.720 · registry 7.916→2.443 · tools 16.013→10.540 B;
   build 2 lần liên tiếp cùng kích thước (idempotent). `./tools` xuất đúng `apply,inject` như bản gốc.
2. **Row điều kiện**: row stock `plugin-manager` có `disabled: !!js '!ctx.get(''profileContext'')'` ⇒ `gbh.row.disabled = true`
   + `gbh.row.insertDisabled = { js: "!ctx.get('profileContext')" }` (row INSERT tắt theo đúng điều kiện; tiền lệ config-editor/pwsh-sandbox).
3. **Nested tool-plugin-manager**: dump 2026-10-18T01-31-57 có row TOP-LEVEL dòng 2 (`disabled: true`) + 3 entry LỒNG
   trong preset: 961 preset-standard (disabled:true) · 1131 preset-ptc (disabled:true) · 1399 preset-cordis (disabled ĐIỀU KIỆN).
   Đã khai `gbh.nested = { kind:"preset", pluginId:"tool-plugin-manager", stockId:"@deepseek-ai/dsh-plugin-manager/tools",
   presets:[standard,ptc,cordis] }`. Row TOP-LEVEL thứ hai KHÔNG biểu diễn được bằng schema 1-row/1-nested hiện tại ⇒
   vẫn là row stock (`disabled:true`, không đổi hành vi); cần Lead quyết nếu muốn thay riêng row đó.
