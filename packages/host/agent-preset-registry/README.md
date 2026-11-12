<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo chuyển đổi row agent-preset-registry — sổ preset agent khai bằng YAML + service Remote
-->

# @galaxy-blackhole/gbh-agent-preset-registry — row `agent-preset-registry`

Bản viết lại 1:1 nửa host của `@deepseek-ai/dsh-agent-preset-registry` (811 dòng bundle host + `typert.host`
989 dòng + `typert.remote-client` 148 dòng + các `.d.ts`): **sổ preset agent khai bằng YAML**, mount mỗi
revision preset vào **scope riêng** cho từng Agent chọn nó, **service Remote `agentPresets`** (endpoint
`list` · `read` · `select`) và sửa định nghĩa qua profile.

## 0. Năm câu hỏi bắt buộc (§4f runbook)

1. **Row này làm gì?** Cấp service `agentPresets`: đăng ký preset (id · tên · mô tả · order · danh sách
   plugin con), mount cây plugin của revision dưới scope riêng, audit hàng hỏng/đang chờ, giữ revision cho
   Agent đã join, chọn preset khi phiên còn trống, đọc YAML của một khai báo, và inventory composition.
2. **Row nằm ở đâu?** TOP-LEVEL: `- id: agent-preset-registry` · `name: '@deepseek-ai/dsh-agent-preset-registry'` ·
   `config {default: standard}` (dumps `ours.yml` dòng 799–802). Không lồng/nhóm.
3. **Hai mặt?** **KHÔNG**: gốc không có khoá `dsh` (không `dsh.client`, không `lib/client.js`). Các export
   `./typert` + `./remote` là descriptor/kiểu cho HOST; đo toàn kernel: **0** chỗ `require('…/typert'|'/remote')`
   ⇒ thiếu chúng KHÔNG làm mất khả năng phục vụ lúc chạy (§4f bước 2 ghi rõ lựa chọn này).
4. **Trùng service?** Gốc `super(ctx, 'agentPresets')`; **không gói GBH nào khác cấp** tên này — các gói của ta
   (`agent-preset`, `plugin-inventory`, `plugin-package-inventory-deepseek`) đang TIÊU THỤ seam này, nên mount
   là THAY lớp cấp chứ không đăng ký trùng.
5. **Khai `gbh.row`?** Có: `gbh.row { id: 'agent-preset-registry', config {default: standard}, tests }` — `moduleIds`/aliases không cần vì gói MỘT MẶT; đã có lab cách ly ĐẠT trước khi khai (xem §4).

## 1. Bản đồ hành vi đã port

| Thành phần gốc | Ở đây |
|---|---|
| `entryListProblem` (kiểm entry-list kể cả nhóm lồng) | `src/definition.ts` |
| `agentPresetProjectionDefinition` (projection `agentPreset`) | `src/session.ts` |
| `PresetTree` · `withinFiber` · `leakedServices` · `serviceForMount` · `detailBranches` · `mountDetail` · `auditRows` · `mountPreset` | `src/mount.ts` |
| `activeCompositionModules` · `disabledContribution` · `combineDisabled` · `flattenRows` · `definitionComposition` · `mountedCompositionRows` | `src/composition-inventory.ts` |
| class `AgentPresetRegistry` (register/activate/diagnostic/collect/generationFor/inspectCompositions/list/remoteExportList/resolve/readDocument/retain/bind/join/mount/composeFrom/composedPreset/serviceFor/recompose/select/acquireScope/compositionInventory) | `src/index.ts` |
| `Config` · `inject` · `default` | `src/index.ts` (schemastery + decorator `@Remote`) |

**Export runtime đo trên ARTIFACT** = gốc: `AgentPresetRegistry` · `agentPresetProjectionDefinition` ·
`auditRows` · `default` · `entryListProblem` · `leakedServices` (6/6, `default === class`).

Khác biệt chỉ ở tầng kiểu: seam `ctx.reflect.store`, `ctx.root[Context.isolate]`, `settings`, `session/event`
khai theo CẤU TRÚC (luật 000d, không augment `Context`); `js-yaml` được nạp bằng `createRequire` + một kiểu
TỐI THIỂU NGAY TRONG `src/index.ts` (kernel không cài `@types/js-yaml`); zod dùng qua một lần ép kiểu vì repo
có ambient shim `zod` tối thiểu ở gói client — chạy thật vẫn là zod 4 của kernel.

## 2. Peer + phụ thuộc

`peerDependencies` = các gói KERNEL mà src import runtime: `cordis` · `cordis-plugin-include` ·
`cordis-plugin-loader` · `dsh-app-boot` · `dsh-scope` · `dsh-typert-protocol` (`gbh.peers` = đúng tập này).
`dependencies`: `schemastery` · `js-yaml` · `zod` (đúng như bản gốc). `locale/{en,zh}.json` **byte-for-byte**
(shasum khớp gốc).

## 3. Tác động nếu mount (nêu trước reviewer)

Registry sở hữu **roster preset** + **profile-backed editing** + RPC `agentPresets/read` · `agentPresets/select` ·
`agentPresets/list`. Preset quyết định **plugin con của Agent** ⇒ đổi registry là đổi **agent runtime** (spawn ·
agent-loop · tool schemas · prompt sections). Điều kiện mount: giữ nguyên `Config {default}` · projection
`agentPreset` · ba endpoint Remote · audit/mount helpers; lab:row + boot-smoke phải ĐẠT trước khi Lead boot.

## 4. Bằng chứng (đo)

- `tsc --strict` trên toàn bộ src + build: **0 lỗi**.
- `gate --no-tests --only header,file-length,jsdoc,dep-guard`: **XANH 4/4** (2.224 file).
- Test A/B trên Context cordis THẬT: **27 ca · 27 pass · 187 expect** (bản 19 ca/66 expect là bản nháp đầu, đã thay bằng bản phủ rộng hơn) (`tests/host/agent-preset-registry.test.ts`).
- `check:rows`: **133 gói · TẤT CẢ đạt · 0 chặn** (gói này đã khai `gbh.row`).
- `lab:row agent-preset-registry` (home cách ly): **DAT · #root 22.204 · console 0 · page 0 · did-not-activate 0 (trang) / 0 (host) · overlay 0** — #root bằng ĐÚNG control `ui-shortcuts` cùng ngày.
- `gate --no-tests --only typecheck`: **0 vi phạm thuộc gói này** (vi phạm còn lại ở `ui-plugin-manager`, `token-meter`, `util-code-language` — ngoại lai).

## 5. CHƯA làm (nói thẳng)

- Không ship `./typert` · `./remote` · `./types` · `./display` (descriptor/kiểu máy sinh; đo được 0 consumer
  `require` lúc chạy — theo tiền lệ `message-feedback`/`settings-controller`).
- Chưa chạy preset THẬT trong PTY/agent-loop: mọi ca dùng cây Loader/context thật của kernel nhưng không
  spawn LLM.