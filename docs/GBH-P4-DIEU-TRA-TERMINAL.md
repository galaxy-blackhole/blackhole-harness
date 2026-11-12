<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 07/11/2026
 desc Điều tra 07/11/2026: vì sao khung Terminal chết và các lỗi console kèm theo. CHƯA sửa — chỉ bằng chứng,
      nguyên nhân gốc và phương án.
-->

# Điều tra: Terminal chết + lỗi console (07/11/2026)

## 1. Triệu chứng người dùng thấy

Mở tab **Terminal** ở thanh bên phải ⇒ khung terminal trống; DevTools Console có 3 lỗi liên tiếp:

1. `client-modules: factory for "@galaxy-blackhole/gbh-client-ui-sidebar-terminal/client.terminal.js" threw:
   client-modules: require("@deepseek-ai/dsh-client-ui-primitives") missed the module table …`
2. `Error: client-modules: require("@deepseek-ai/dsh-client-ui-primitives") missed the module table …
   at factory (client.terminal.js:10:1)`
3. `slot entry crashed in sidebar.right.pane.tab` (đúng hậu quả của 1–2)

## 2. Nguyên nhân gốc (đo được, không suy đoán)

**Chunk lazy `client.terminal.js` được CHÉP NGUYÊN VĂN từ bản gốc DSH, chỉ đổi id ĐĂNG KÝ.**

- `packages/client/ui-sidebar-terminal/build.ts:200-201`:
  `const chunkGoc = readFileSync(stockChunkPath(), "utf8");` rồi
  `writeFileSync(chunk, chunkGoc.split(JSON.stringify("@deepseek-ai/dsh-client-ui-sidebar-terminal")).join(JSON.stringify(PACKAGE_NAME)));`
  ⇒ chỉ thay id ĐĂNG KÝ; mọi `require(...)` bên trong chunk giữ nguyên id stock.
- `packages/client/ui-sidebar-terminal/lib/client.terminal.js:10`:
  `let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");`
- Bảng module lúc chạy CHỈ có id GBH: manifest phục vụ tại `http://127.0.0.1:5439/` có **7** lần
  `@galaxy-blackhole/gbh-client-ui-primitives` và **0** lần `@deepseek-ai/dsh-client-ui-primitives`.
  ⇒ `require` trượt bảng ⇒ factory ném ⇒ khe `sidebar.right.pane.tab` chết.

Đối chứng âm (chứng minh chỉ có MỘT chỗ drift): quét toàn bộ artefact client —
`grep -rn 'require("@deepseek-ai/dsh-[a-zA-Z-]*")' packages/client/*/lib/*.js` chỉ ra **đúng 1 dòng**:
chính dòng 10 của `client.terminal.js`. Các chuỗi `@deepseek-ai/…` khác trong artefact client chỉ là
**dữ liệu** (tên bundle, id lệnh, khoá tra bảng), không phải `require` lúc chạy.

Vì sao build lại KHÔNG chữa được: tôi build gói ra `/tmp/term-build` từ `src` hiện tại ⇒ chunk sinh ra
vẫn chứa đúng id stock đó (`grep -c '@deepseek-ai/dsh-client-ui-primitives' = 1`), vì chunk **không được
biên dịch từ src** mà chép từ `apps/host/node_modules/@deepseek-ai/dsh-client-ui-sidebar-terminal/lib/client.terminal.js`.
Ghi chú 22/10/2026 trong build.ts nói rõ lý do chép bản gốc: "bản chunk viết tay thiếu phần nối xterm với PTY
nên khung terminal in ra ký tự rác". Ngoài ra `@xterm` KHÔNG có trong repo (`node_modules/@xterm` không tồn
tại) nên xterm phải nằm trong chunk (chunk 686 937 byte, 85 lần chuỗi "xterm").

Vì sao các cổng kiểm không bắt: không cổng nào MỞ tab Terminal; `check:app` chỉ đo trang chủ/phiên đang mở
nên (8) vẫn xanh dù khe terminal chết.

## 3. Lỗi console thứ 4 (khác nguyên nhân): 404 `/api/changes.summary`

`GET /api/changes.summary?sessionId=…&seq=498` → 404. Đây là **404 CÓ CHỦ ĐÍCH**:
`packages/client/ui-deliverables/lib/index.js:170-178` — `handleChangesSummary` trả 404 khi
`ctx.workspaceChanges.summary(id, seq) === undefined` ("Change summary unavailable.").
Tức chưa có bản ghi thay đổi cho cặp (phiên, seq) đó ⇒ client hỏi, host trả "chưa có". Chrome vẫn log
"Failed to load resource" cho mọi 404 nên nó chỉ là **nhiễu console**, KHÔNG phải lỗi làm hỏng UI.
Việc cần kiểm thêm (phiên sau): dòng `workspace-changes` có được mount đúng không — package khai
`gbh.row.insertAs = "workspace-changes-ours"`, trong `app.patch.yml` không thấy tên này (0 lần), trong
`host-5439.log` có 1 lần. Nếu recorder không chạy thì 404 này sẽ lặp mãi.

## 4. Phương án (CHƯA áp dụng — chờ quyết định)

**A. Vá 1 dòng trong build.ts (khuyến nghị)**: khi chép chunk gốc, đổi THÊM id primitives
(`@deepseek-ai/dsh-client-ui-primitives` → `@galaxy-blackhole/gbh-client-ui-primitives`), cùng tinh thần
với việc đang đổi id đăng ký. Rủi ro thấp, không đụng runtime; kiểm bằng: build → sync → boot → mở tab
Terminal → ảnh chụp + 0 lỗi console.
**B. Thêm id stock vào bảng module** (alias/seed) để mọi `require` id stock đều giải được. Bao quát hơn
nhưng phải sửa tầng nạp/manifest và cần chứng minh bundle primitives đăng ký cả hai id — hiện
`packages/client/ui-primitives/lib/` CHỈ có `index.js` (không có bundle client), nên B chưa chắc khả thi.
**C. Build chunk từ src**: đã bị loại trước đó vì thiếu phần nối PTY (ký tự rác).

## 5. Trạng thái sau điều tra

Không sửa gì trong phiên này (theo yêu cầu "chưa cần fix"). App vẫn chạy; `check:app` (5) = 0;
`bun run gate` XANH 8/8. Bản sao lưu gần nhất: `/tmp/gbh-ok-b11`.

## 6. Vòng sửa 07/11/2026 (17:00–17:40) — đã sửa 3 việc, còn 1 lỗi tầng 2

### 6.1 Tab Terminal: HẾT CHẾT KHE (đã sửa, có ảnh)

- `build.ts` của `ui-sidebar-terminal`: khi chép chunk gốc nay đổi id ĐỒNG BỘ (bảng dựng từ
  `gbh.provenance.stock` trong repo, khớp theo RANH GIỚI tên gói, bỏ id của chính gói) — trước chỉ đổi
  id ĐĂNG KÝ nên còn `require("@deepseek-ai/dsh-client-ui-primitives")` và cả symbol kiểu stock.
- Thêm CỔNG CHẶN HỒI QUY ngay trong build: chunk phát ra mà còn `require("@deepseek-ai/…")` thì build NÉM.
- Kết quả đo: trước — 3 lỗi console, khe `sidebar.right.pane.tab` chết; sau — **0 lỗi console**, panel
  render thật (khung lỗi của terminal hiện đúng chỗ, không còn crash slot).

### 6.2 Lỗi tầng 2 (CHƯA xong): `lookup provider "agent" does not match its strict definition`

Panel terminal giờ hiện đúng một câu lỗi thay vì chết khe:
`typert gateway: terminal/environment: lookup provider "agent" does not match its strict definition`.

Đã kiểm tra (đều KHỚP trên giấy tờ, nên nguyên nhân nằm ở giá trị lúc chạy):
- hợp đồng `terminal/environment`: `wire: "agentId"`, `typeSymbol: "@galaxy-blackhole/gbh-session/types#SessionId"`
  — giống nhau ở cả `typert.host.js`, `typert.remote-client.js` và bảng client trong `gbh-api-remotes`;
- nơi đăng ký provider: chỉ `gbh-agent/lib/index.js` đăng ký `"agent"` với `wire: "agentId"`,
  `wireTypeSymbol: "@galaxy-blackhole/gbh-session/types#SessionId"`;
- câu kiểm ném lỗi: `provider.wire !== parameter.wire || (strict && provider.wireTypeSymbol !== parameter.codec.typeSymbol)`.

Đã thử chèn chẩn đoán vào cả 3 bản gateway (kernel `dsh-api-gateway`, `gbh-api-gateway`,
`gbh-host-typert-gateway`, ở cả `lib/index.js` lẫn `lib/types/index.js`) và **không bản nào in ra** ⇒
thông điệp được CLIENT dựng lại từ mã lỗi remote, không phải chuỗi host gửi. Bước tiếp theo: đọc
`data.field`/giá trị trong phản hồi lỗi ở phía client (DevTools → Network/WS) hoặc tạm đổi client để in
`error.detail`, rồi đối chiếu đúng cặp giá trị lệch.

Giả thuyết mạnh nhất (cùng họ với lỗi 6.3): một bên bị đổi id stock → GBH, bên kia thì không, do phép đổi
id trong bản cài BỎ QUA tệp của chính gói (chống self-import) trong khi tệp khác gói thì bị đổi.

### 6.3 Menu "/" ở ô nhập: ĐÃ TRẢ LẠI ĐỦ MỤC + tiếng Việt + icon (đã sửa, có ảnh)

Hai nguyên nhân độc lập, cả hai đều đã sửa:
1. **Mất mục goal · plan · compact · quyền**: `command.list` hỏng vì `flock` không nạp được addon native
   — `gbh-node-addon-system` gọi `require.resolve("@deepseek-ai/node-addon-system-<nền>-<kiến trúc>/package.json")`
   nhưng profile KHÔNG có gói addon đó (nó là gói STOCK chỉ sống trong `apps/host/node_modules`, không
   phải gói ta viết lại nên `gbh.row.hostAliases` không sinh symlink). Thêm
   `linkNativeAddonPackages()` trong `apps/cli/src/mount.ts`: symlink mọi gói
   `@deepseek-ai/*-<darwin|linux|win32>-<x64|arm64|ia32>` từ bản kernel vào profile. Đo được: log boot in
   `[bh] link addon native: @deepseek-ai/libreoffice-kit-darwin-x64, @deepseek-ai/node-addon-system-darwin-x64`;
   console **0 lỗi**; menu có lại goal/plan/compact/quyền/model/xuất.
2. **Nhãn/mô tả tiếng Anh + mất icon của 4 lệnh dựng sẵn**: `builtinCommandName()` so
   `descriptor.definitionId` với bảng `BUILTINS`. Bản cài đổi id ở artefact của gói KHÁC nhưng bỏ qua tệp
   của chính gói ⇒ client có `@galaxy-blackhole/gbh-command-goal` còn host gửi `@deepseek-ai/dsh-command-goal`
   ⇒ trượt. Nay so theo **khoá chuẩn** (bỏ tiền tố scope + `dsh-`/`gbh-`) nên khớp cả hai kiểu id.
   Ảnh: menu hiện "Mục tiêu goal · Đặt hoặc xem mục tiêu cho tác vụ chạy dài", "Kế hoạch plan", "Nén compact",
   "Quyền permission", "Model", "Xuất export" — kèm icon.

### 6.4 Icon cho mục "Hướng dẫn" (đã sửa, có ảnh)

`tools/patch-account-menu-guide.ts` nay chèn thêm `icon: jsx(primitives.IconInfoOutlineMedium, {size:16})`
(dùng đúng bộ icon DSH) và có nhánh NÂNG CẤP TẠI CHỖ khi artefact đã vá từ trước. Ảnh: menu "Thêm" hiện
⚙ Cài đặt + ⓘ Hướng dẫn.

### 6.5 Cổng kiểm- `bun run gate` = **XANH 8/8** (228 708 ms · `/tmp/gate-8.log`): header/file-length 4168 tệp 0 vi phạm ·
  typecheck 2671 tệp 0 vi phạm · `bun test` thoát mã 0.
- `bun run check:app` = **app LÀNH** (11/11 chỉ số, có (8) render + (9) bố cục + (10) 529 file khớp repo + (11) HMR).
- Bản sao lưu: **`/tmp/gbh-ok-b12`** (311 MB · gồm cả `apps/cli/src`).
- Việc còn lại: lỗi tầng 2 ở §6.2 (contract/provider typert của terminal) — cần đọc giá trị lệch ở phía client.

## 7. Ba thay đổi mã nguồn của vòng này

| Tệp | Thay đổi |
|---|---|
| `packages/client/ui-sidebar-terminal/build.ts` | Chép chunk gốc xong thì đổi id ĐỒNG BỘ (bảng từ `gbh.provenance.stock`, khớp ranh giới tên gói, bỏ id của chính gói) + cổng chặn hồi quy "chunk còn require id stock thì ném" |
| `packages/client/ui-commands/src/resolution.ts` | `builtinCommandName()` so theo KHOÁ CHUẨN (bỏ `@scope/` + `dsh-`/`gbh-`) để khớp cả id stock lẫn id GBH |
| `apps/cli/src/mount.ts` | Thêm `linkNativeAddonPackages()`: symlink các gói `@deepseek-ai/*-<nền>-<kiến trúc>` từ bản kernel vào profile (flock + libreoffice-kit) |
| `tools/patch-account-menu-guide.ts` | Mục "Hướng dẫn" có icon `IconInfoOutlineMedium` + nhánh nâng cấp tại chỗ cho artefact đã vá |

## 8. Vòng 3 (18:35–19:05) — Terminal ĐÃ CHẠY THẬT + icon gói thay thế

### 8.1 Nguyên nhân gốc của `lookup provider "agent" does not match its strict definition`

Không phải lỗi typert contract "trên giấy tờ": **bản cài trong profile giữ id/symbol STOCK** trong khi
bảng module client + provider lại dùng id GBH. Đo cụ thể: `gbh-api-terminal-controller/lib/typert.host.js`
trong profile có **16** symbol `@deepseek-ai/dsh-session/types#SessionId` (stock) còn `gbh-agent` đăng ký
lookup `agent` với symbol `@galaxy-blackhole/gbh-session/types#SessionId` (GBH) ⇒ câu kiểm strict của
gateway (`provider.wireTypeSymbol !== parameter.codec.typeSymbol`) trượt ⇒ tab Terminal chết.

Vì sao lệch: repo CỐ Ý giữ artefact nguyên văn stock; phép đổi id (`tools/p1b/denta-profile.ts`) chỉ chạy
trong `scripts/sync-lib-to-profile.sh`, **KHÔNG chạy ở đường restart chuẩn** `scripts/restart-host.sh`
(script này chỉ xoá bản cũ rồi để mount chép lại artefact từ repo). Vì thế mỗi lượt restart lại làm lệch.

**Sửa hẳn (không còn tuỳ vào việc nhớ chạy sync):**
- `tools/p1b/denta-profile.ts`: tách hàm dùng lại `suaIdProfile(thuMuc, gocRepo?)` (giữ nguyên CLI).
- `apps/cli/src/mount.ts`: thêm `chuanHoaProfile()` = `suaIdTrongProfile()` + `chepIconVaoProfile()`;
  `suaIdProfile` nay nhận `gocRepo` do mount truyền vào (đường boot không có biến `GBH_REPO`).
- `apps/cli/src/host.ts`: gọi `chuanHoaProfile()` ngay sau `writeAppPatch()` — bước LUÔN chạy, không bị
  short-circuit theo stamp như trong `mountRewritePackage`.

Bằng chứng: log boot in `[bh] doi id stock -> GBH: 76 tep / 14 goi · manifest …`; sau restart, symbol
trong contract là GBH (16/0); mở tab Terminal ⇒ prompt thật `✝ Desktop/Project/galaxy`, **0 lỗi console**.

### 8.2 Icon gói thay thế (yêu cầu "copy icon của DSH sang GBH")

- `chepIconVaoProfile()`: chép `icon.svg`/`icon.png` của từng gói ta vào bản cài (mount chỉ chép
  lib/locale/assets/runtime nên icon không bao giờ tới app). Log: `[bh] chep icon vao profile: 14`.
- Trong repo: chép 14 `icon.svg` từ gói stock sang gói ta tương ứng (script một lần, có đối chiếu
  `gbh.provenance.stock`). Ảnh danh sách Plugin: mọi dòng đều có icon đúng (Subagent, Tìm kiếm web,
  Vòng lặp agent, Shell, Agent Teams, Auto Authorization Review, DSH badge skill, …).
- KHÔNG chép `README.i18n.yaml` của bản stock: tệp đó thiếu khối header 5 dòng của repo ⇒ cổng
  `header` đỏ (đã xoá lại, giữ đúng 14 icon).

### 8.3 Bundle patch: đổi id stock → id ta

13 tệp `packages/host/bundle-*/cordis.patch.yml` được đổi id theo bảng `gbh.provenance.stock`
(`bundle-session-titles-bundle`, `bundle-base`, `bundle-sdk-app`, `bundle-acp-app`, `bundle`,
`bundle-tool-worktree`, `bundle-session-search`, `headless`, `bundle-ralph-bundle`, `bundle-auto-review`,
`bundle-sdk-minimal`, `bundle-terminal-bundle`, `bundle-plugin-market-bundle`).

### 8.4 Việc còn lại (nêu đúng, chưa làm)

Trang **Plugin → mục "Plugin thử nghiệm" → chi tiết** vẫn hiện id **npm gốc**
(`@deepseek-ai/dsh-experimental-agent-team-profile`, `…-agent-team`, `…-tool-agent-team`,
`…-client-ui-agent-team`) và mô tả tiếng Anh. Đây là **mục danh mục chính thức** (đọc từ bản cài kernel +
catalog npm), không phải gói đang chạy: gói đang chạy là `@galaxy-blackhole/gbh-*: dsh.profile.bundles`
trong profile đã liệt kê toàn bộ id GBH và `cordis.patch.yml` của ta cũng khai id GBH (đã kiểm).
Muốn đổi hiển thị/đích cài của mục đó thì phải sửa `packages/host/plugin-manager/src/manager.ts`
(`BundleInfo.name` đã qua `quyTenBundle`, nhưng `installTarget.spec` vẫn là tên npm gốc) — cần quyết định
nghiệp vụ: ẩn mục đã thay thế, hay trỏ `installTarget` về bundle cục bộ của ta.
### 8.5 Cổng kiểm + trạng thái cuối (20:35 07/11/2026)

- `bun run gate` = **XANH 8/8** (328 454 ms · `/tmp/gate-13.log`).
- `bun run check:app`: **(5) = 0** · 78 gói của ta đang chạy · mount tươi 529 tệp.
- Log boot: `[bh] doi id stock -> GBH: 88 tep / 23 goi · manifest …` + `[bh] chep icon vao profile: 14` +
  `[bh] va mat API llm-deepseek: 2 tep`.
- Bản sao lưu: **`/tmp/gbh-ok-b15`** (308 MB) · `/tmp/gbh-ok-b14`.
- Lưu ý ghi nhận: `tests/host/bundle-profile-patches.test.ts` có con số ẢNH CHỤP (9 → 79) — đã ghi rõ lý do
  trong test (số lần đổi id tăng theo số gói đã mount); điều kiện kiểm thật vẫn là "mọi đích đều là gói
  CÓ trong repo" + "patch sinh lại khớp từng byte".
- Một lượt `gate` đỏ oan: `tests/host/account-platform.test.ts` báo "beforeEach/afterEach hook timed out"
  khi máy đang chạy song song nhiều restart/gate; chạy riêng **30 pass / 0 fail** (5,4 s) ⇒ không phải lỗi mã.
## 9. Sự cố 08/11/2026 (00:40–02:10) — bản vá alias làm web boot chết, đã cuộn lại

### 9.1 Chuyện đã xảy ra

1. Vì entry `@deepseek-ai/dsh-experimental-session-inspector` không materialize, tôi cho bundle client của
   `gbh-session-inspector` đăng ký THÊM id gói gốc. Kết quả: **web boot chết** —
   `Failed to load plugins … import failed` (tầng nạp nạp CÙNG URL cho entry alias nên bundle chạy lần hai).
2. Tôi thử sửa tiếp bằng đổi id `dsh-client-store` trong 173 tệp + build lại 51 gói ⇒ **lan rộng**: nhiều
   artefact client lệch bảng module (`gbh-client-store` là id MA, không gói nào cung cấp), 30 entry chết.
3. Đã CUỘN LẠI bằng bản sao lưu `/tmp/gbh-ok-b15` (19:57) cho `packages/host` + `packages/client`, rồi:
   - tắt sinh entry alias: `aliasRows()` trả RỖNG (packages/client/modules/src/combos.ts) — đúng hành vi bản
     đang chạy tốt trước 08/11 (manifest không có entry alias nào);
   - bỏ `["settings.sessionLog", …]` khỏi từ điển trung tâm (gói tự đăng ký vi; `register` NÉM khi trùng ⇒
     apply của gói chết);
   - GỠ entry "session-inspector" khỏi `packages/host/bundle-inspector-profile/cordis.patch.yml`.

### 9.2 Trạng thái hiện tại (02:10)

- App **CHẠY ĐƯỢC**: `curl` cổng 5439 = 401; `check:app` = **"app LÀNH"**, (5) `did not activate` = 0.
  Ảnh chụp: giao diện đầy đủ (sidebar phiên, hero "Bước vào vùng chưa biết", composer "Chế độ Chuẩn").
- **Nợ kỹ thuật phải trả ngay phiên sau**: `bun run gate` ĐỎ 2/8 — `typecheck` **140 vi phạm trên 3 025 tệp**
  và `test` đỏ, vì bản khôi phục b15 mang thêm ~354 tệp nguồn mà cây hiện tại không có (gói de-bundle nay có
  `src/` đầy đủ). Cần đối chiếu từng gói: giữ `src` (nếu build từ src) hoặc bỏ (nếu de-bundle), rồi sửa
  typecheck cho tới khi XANH.
- DevTools mất tab "session-inspector" (đã gỡ entry) — chấp nhận tạm.
- ⚠️ **Bản sao lưu của phiên này SAI CẤU TRÚC**: lệnh `rsync -a ... packages/ tests/ tools/ scripts/ docs/ <đích>/`
  trải NỘI DUNG mỗi thư mục ra đích (nên `/tmp/gbh-ok-b15/host`, `.../client` chứ không phải `packages/host`).
  Phiên sau phải dùng `rsync -a --relative` hoặc copy từng thư mục riêng.

### 9.3 Việc đúng cần làm để bật lại alias (không làm vội)

1. Cấp module `store` cho bảng client (hiện `@deepseek-ai/dsh-client-store` không phải seed, cũng không có
   gói nào cung cấp) — không có nó thì mọi bundle de-bundle của inspector đều không chạy.
2. Sửa CƠ CHẾ alias cho đúng: hoặc bundle đăng ký thêm id alias + tầng nạp chịu được hai lời gọi `load` trong
   một lần nạp, hoặc entry alias trỏ URL riêng. Hiện `aliasRows()` trả rỗng nên mọi `gbh.row.aliases` là
   vô hiệu (an toàn, nhưng mất khả năng phục vụ id stock ở client).
3. Sau đó mới bật lại entry "session-inspector" trong bundle inspector-profile.
## 10. Sự cố 08/11/2026 (03:26–04:30) — boot chết liên hoàn khi đội rà soát đổi id; đã vá 4 lỗi thật

### 10.1 Bốn lỗi THẬT phát hiện (đều là lỗi cơ chế, không phải lỗi gói)

1. **mount xoá xuyên symlink làm MẤT `locale/` của repo** (`apps/cli/src/mount.ts`): entry profile là symlink trỏ
   ngược về `packages/<tầng>/<gói>`, nên `rmSync(<profile>/…/locale)` xoá CHÍNH thư mục locale trong repo rồi
   `cpSync` thất bại (nguồn vừa bị xoá) ⇒ mất vĩnh viễn. Đo được **32 tệp / 16 gói** qua vài lượt boot.
   → Vá: helper `chepThuMucCon()` + `trungNguon()` so `realpath` (kể cả khi đích CHƯA tồn tại — phân giải thư mục
   cha), dùng cho `locale/`, `assets/`, `runtime/`.
2. **Alias stock → gói ta khi gói ta chỉ có khai kiểu**: `gbh-session` de-bundle chỉ có `lib/types/*.d.ts`,
   consumer import subpath runtime ⇒ `ERR_MODULE_NOT_FOUND … lib/types/types.js` ⇒ host chết.
   → Vá: `chiCoKhaiKieu()`; nếu gói ta chỉ có `.d.ts` mà KERNEL có bản đầy đủ thì alias trỏ KERNEL.
3. **Gói GBH thư viện không được liên kết vào profile**: dev đổi import sang `@galaxy-blackhole/gbh-credentials`,
   `…gbh-lazy-require` (gói KHÔNG có `gbh.row`) ⇒ `ERR_MODULE_NOT_FOUND` ⇒ host chết.
   → Vá: `linkMoiGoiGbh()` — liên kết ĐỦ mọi gói GBH trong repo vào `node_modules` của profile (idempotent).
4. **Artefact client bị xoá khi build lỗi**: `gbh-client-ui-chat` mất `lib/client.js` ⇒ client-modules không
   compose được ⇒ app chết ở tầng client. → Vá: dựng lại từ bản backup theo gói (`/tmp/gbh-ok-b16/…`).

### 10.2 Bài học quy trình (đã ghi vào docs/GBH-QUY-TAC-PACKAGE.md §5)

- Mỗi lần đổi **id import** (R6a) phải coi là thay đổi RUNTIME: bắt buộc kiểm `bun run gate typecheck` hẹp +
  **một lượt boot smoke** trước khi ký; không gộp nhiều gói vào một lượt boot mù.
- Không bao giờ `rmSync` một đường dẫn trong profile mà chưa so `realpath` với nguồn (đã vá ở mount).
- `lib/` của gói client là artefact: nếu build lỗi thì phải khôi phục từ bản backup theo gói, không để trống.

### 10.3 Tồn đọng P1 (chưa sửa, cần một gói mới)

`client/ui-settings-models` (và vài gói client khác) `require("@deepseek-ai/dsh-client-store")` — id **không có
trong bảng module của vỏ app** (không phải seed, không gói nào cung cấp; `src/store.ts` của ta import
`@galaxy-blackhole/gbh-client-store` cũng KHÔNG tồn tại). Hiện app VẪN chạy (entry đó fail riêng lẻ, không chặn
boot), nhưng mục **Cài đặt → Mô hình** không dùng được. Việc đúng: port `store` thành gói GBH thật
(hoặc bỏ phụ thuộc store trong 2 tệp `store.ts`/`welcome-store.ts`).
### 10.4 ĐÃ VÁ P1 (05:05) — id module của bundle client phải là id mà VỎ seed

Nguyên nhân gốc: vỏ app (dist của ta) chỉ seed **4 module nền** dưới id **GBH**:
`@galaxy-blackhole/gbh-client-store` · `…/gbh-client-ui-slots` · `…/gbh-client-ui-primitives` · `…/gbh-client-ui-dockkit`.
Nhưng bundle client của `ui-settings-models` lại `require("@deepseek-ai/dsh-client-store")` và
`require("@deepseek-ai/dsh-client-ui-primitives")` ⇒ tầng nạp báo "not a platform seed word" ⇒ entry chết.

Cách vá đã làm (đo được 0 lỗi console sau khi vá):
1. `src/parts/part-01.ts`: `require("@deepseek-ai/dsh-client-store")` → `require("@galaxy-blackhole/gbh-client-store")`
   (build.ts của gói đã ghi rõ id GBH là seed nền tảng, không phải id stock).
2. Sau khi build, quét bundle và đổi mọi id stock có seed GBH tương ứng sang id GBH
   (`tools/lib/id-normalize.ts` mới là chỗ nên làm VĨNH VIỄN — hiện là bước tay, đã ghi nợ).
3. Xoá luôn 12 lát mồ côi `src/parts/*` của gói nếu chúng không được entrypoint nào import (đã chuyển sang
   `/tmp/ui-settings-models-parts-backup/`).

**Việc còn nợ (P2)**: đưa bước 2 vào `build.ts`/`id-normalize` để mọi gói client tự đổi id khi build; kiểm
bằng cách grep `require("@deepseek-ai/` trong `packages/client/*/lib/client.js` (hiện 0 tệp nếu build sạch).

#### 10.4b P2 ĐÃ XONG (08/11/2026 05:20) — bước đổi id seed đã vào ĐƯỜNG BUILD, không vá tay

Nợ ở §10.4 (bước 2 làm bằng tay) đã trả:

1. **Helper dùng chung** — `tools/lib/id-normalize.ts`:
   - `SEED_MODULES`: nguồn sự thật DUY NHẤT của 4 seed (`dsh-client-store` → `gbh-client-store`,
     `dsh-client-ui-slots` → `gbh-client-ui-slots`, `dsh-client-ui-primitives` → `gbh-client-ui-primitives`,
     `dsh-client-ui-dockkit` → `gbh-client-ui-dockkit`).
   - `chuanHoaIdSeed(text)` → { text, doi, giu }: chỉ đổi id **trong vị trí NẠP** (`require(`, `from`, `import(`, `import `),
     KHÔNG đụng kernel seam (`cordis`/`schemastery`/`cosmokit`); id stock không có seed tương ứng được trả về ở `giu`.
   - `chuanHoaIdSeedTrongTep(file)`: áp tại chỗ lên một artefact và trả danh sách đã đổi/giữ.
2. **Nối vào đường build (tự động)**:
   - `packages/tools/brand-rename/src/index.ts` → `renameClientArtifact()`: sau bước brand-rename (cổng đảo ngược
     `assertRenameOnly` vẫn giữ nguyên cho phần brand) chạy thêm `chuanHoaIdSeed` ⇒ **31 build.ts client** đang gọi
     hàm này tự đổi id seed mà không phải sửa từng gói.
   - `packages/client/ui-sidebar-documentpreview/build.ts`: 3 chunk chép NGUYÊN VĂN từ stock (pdf · excel ·
     frontmatter-fields) nay chạy `chuanHoaIdSeed` sau khi vá dòng `load({ id })`; id stock không có seed được in ra log.
   - Cầu nối `tools/lib/brand-rename-client.ts` re-export thêm `chuanHoaIdSeed`, `chuanHoaIdSeedTrongTep`, `SEED_MODULES`.
3. **Đo lại (08/11/2026 05:20)**:
   - `grep -rn 'require("@deepseek-ai/dsh-client-store"|@deepseek-ai/dsh-client-ui-slots|@deepseek-ai/dsh-client-ui-primitives|@deepseek-ai/dsh-client-ui-dockkit' packages/client/*/lib/`
     → **0 dòng** (trước khi vá: 2 dòng ở `client.pdf.js` + `client.excel.js`).
   - Chunk của `ui-sidebar-documentpreview` nay: `require("@galaxy-blackhole/gbh-client-ui-primitives")` ×2.
   - Build lại `ui-sidebar-documentpreview` OK; `bun test tests/client/ui-sidebar-documentpreview.test.ts` → **13 pass/0 fail**;
     `bun test tests/client/client-ui-directory-picker-native.test.ts` (ca canh `renameClientArtifact`) → **19 pass/0 fail**.
4. **CÒN LẠI — GIỮ NGUYÊN và LIỆT KÊ (kernel seam, không có seed tương ứng)**: 6 artefact client còn
   `require("@deepseek-ai/cordis")` (kernel seam một-thể-instance, ADR-0030):
   `file-upload/lib/client.bundle.js`, `file-upload/lib/client.js`, `shortcuts/lib/client.js`,
   `ui-conversation/lib/client.js`, `ui-input-trigger/lib/client.js`, `ui-settings/lib/client.js`.
   Vì vậy lệnh `grep -rl 'require("@deepseek-ai/' packages/client/*/lib/client.js | wc -l` hiện = **5** (đều là cordis);
   muốn = 0 phải quyết định kernel seam (đổi id cordis = instance thứ hai ⇒ KHÔNG làm trong phase này).
