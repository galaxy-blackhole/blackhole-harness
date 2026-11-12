<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Bản viết lại của Galaxy Blackhole cho row ui-agent-team (gốc: @deepseek-ai/dsh-experimental-client-ui-agent-team):
      nửa host rỗng + nửa browser 515 dòng (roster + bảng việc chia sẻ trên header phiên hội thoại). CHƯA khai
      gbh.row — chờ nghiệm thu lab:row + boot-smoke
-->

# @galaxy-blackhole/gbh-client-ui-agent-team

> Row **`ui-agent-team`** (PARITY-MATRIX dòng 193, tier T5): action trên header phiên hội thoại — roster đội +
> bảng việc chia sẻ CHỈ ĐỌC. Gói **HAI MẶT**: nửa host **6 dòng** (`apply() {}`), nửa browser **515 dòng**.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-agent-team` (matrix dòng 193) | `ui-agent-team` — **CHƯA khai `gbh.row`** (xem §5) |
| Package | `@deepseek-ai/dsh-experimental-client-ui-agent-team` @0.2.1-alpha.4 | `@galaxy-blackhole/gbh-client-ui-agent-team` @0.1.0 |
| Nửa host | `lib/index.js` **6 dòng** | `src/index.ts` — `apply()` rỗng y bản gốc |
| Nửa browser | `lib/client.js` **515 dòng** | `src/{client,mount,team-action,team-types,class-names,client-registration}.ts` + `src/TeamAction.module.css` |
| Từ điển | 25 khoá `zh` + 25 khoá `en` | `src/locales.ts` (chép 1:1) + `locale/{en,zh}.json` |
| Slot | `conversation.session.header.actions` · id `agent-team` · order `9` (đổi từ -20 — ADR 0014 để cạnh danh mục subagent) · locale `agent-team` | **nguyên văn** (`src/mount.ts`) |
| Inject | 4 service web (`sessions` · `uiWorkspace` · `slots` · `locale`) + 5 id package trong `dsh.client` | **nguyên văn** (`src/ids.ts`, `package.json`) |

## 2. Đã port (1:1, không chép mù)

* `src/team-action.ts` (398) — `TeamMemberRow` · `TaskCard` · `TeamAction`: tooltip + dot/icon trạng thái + tag
  "phiên hiện tại" + model; thẻ việc kẹp 2 dòng (`ResizeObserver`) + nút mở rộng; trigger hover 150ms / ghim khi
  bấm; bảng nổi `createPortal(document.body)` + Escape trả focus; `useAnchoredPosition`/`useDismissOnOutsidePointer`.
* `src/team-types.ts` (231) — kiểu dữ liệu + 4 hàm khoá trạng thái (`statusKey` · `memberStatusKey` ·
  `memberDotState` · `taskDotState`).
* `src/mount.ts` (111) — `inject` + `registerAgentTeamUi`: `ctx.effect(locale.register)` nhãn
  `client-ui-agent-team: dictionaries`, rồi `slots.inject` + `slots.register({ name, id, order, locale, inject })`
  với `openTeammate` 1:1 (chưa giữ ở `mainView` ⇒ không mở; thành viên là lead ⇒ mở id thẳng; còn lại ⇒
  `{ parentSessionId, childSessionId, mode: "continuable" }`).
* `src/client.ts` (84) — `createPlugin(require)`: nhận react · react/jsx-runtime · react-dom · primitive từ loader,
  chèn thẻ `<style data-plugin-css>` (một lần) rồi trả `{ inject, apply }`.
* `src/client-registration.ts` (62) — hợp đồng đăng ký **MỘT BUNDLE MỘT ID** (`window.__ModuleLoader__.load`).
* `src/TeamAction.module.css` (254 dòng / 4.666 B / 43 rule) + `src/class-names.ts` (30 lớp, hash `VoX2oq_`).
* `build.ts` (2 nửa: `lib/index.js` ESM node + `lib/client.js` script classic, CSS nhúng bằng `define`).

## 3. Bằng chứng — 15 ca / 117 expect / 0 fail

| Nhóm | Ca đo |
|---|---|
| Host | `apply.length = 0`, trả `undefined`; artifact export ĐÚNG `apply` |
| Khai báo | chưa có `gbh.row` + LÝ DO có `lab:row`/`boot-smoke`/khối row chuẩn bị; `gbh.tests` đúng |
| Hợp đồng | `INJECT` **BẰNG** danh sách inject của bundle gốc (đọc từ chính `lib/client.js`); slot/id/order/locale |
| Từ điển | 25 khoá `zh` = `en`, không rỗng, `NS = agent-team` |
| **CSS** | chuỗi CSS của ta **BẰNG** chuỗi `css` của bundle gốc sau khi bỏ mọi khoảng trắng (4.666 B · 43 rule) |
| **Bảng lớp** | 30 cặp khoá→tên lớp **BẰNG TỪNG CẶP** bảng gốc (`VoX2oq_…`) |
| **Artifact** | `lib/client.js` đăng ký **ĐÚNG MỘT id** (của ta), KHÔNG đăng ký id gốc, có CSS + `createPlugin` |
| **Mount** | 1 effect từ điển (nhãn gốc) + 1 occupant đúng `name/id/order/locale`; `openTeammate` 3 nhánh |
| **Cây element** | render ta và **component GỐC** (bắt qua factory thật của bundle) trên CÙNG runtime giả ⇒ cây **BẰNG NHAU** ở 4 trạng thái: chưa có projection · đang tải · có team 2 thành viên + 2 việc + `failure` (đóng **và** mở bảng) · bảng COMPACT |

## 4. Lệnh

```bash
bun run build.ts                                   # 2 nửa → lib/index.js + lib/client.js (29,7 KB)
bun test tests/client/ui-agent-team.test.ts        # 15 ca
bun run check:rows                                 # hiện KHÔNG có gbh.row ⇒ bỏ qua (chưa mount)
```

## 4a. Ẩn hậu tố "Model: …" trong thẻ thành viên (ADR 0017)

Thẻ thành viên **không** còn in ` · Model: <id>` — chỉ in trạng thái. Sai lệch có chủ ý so với gói gốc;
test chuẩn hoá bỏ hậu tố ở cả hai phía trước khi so cây element.

## 4b. Hàng toolview bổ sung cho `set_team_limits` (ADR 0013)

Ngoài occupant `conversation.session.header.actions` (nguyên văn bản gốc), gói đăng ký thêm **một keyed hit**
trên slot `tool.call.toolview` với `key: "set_team_limits"` — cơ chế "keyed hit THAY hàng generic" của row
`ui-tool`. Nhờ vậy tool BỔ SUNG của ta có tiêu đề + icon + dòng tóm tắt riêng mà **không** phải sửa hai gói
port nguyên văn (`ui-tool` / `ui-conversation`) hay từ điển `conversation`.

| Hạng mục | Nội dung |
|---|---|
| Component | `src/set-team-limits-row.ts` — `readTeamLimits(block)` + `createSetTeamLimitsRow(runtime)` |
| Đăng ký | `src/mount.ts` — `ctx.slots.inject("tool.call.toolview", …)` (KHÔNG đăng ký trực tiếp lúc apply: slot con do node hội thoại khai, nạp sớm sẽ ném "is not declared" ⇒ UI trắng) |
| Từ điển | thêm 2 khoá `limits.title` · `limits.summary` (25 → **27** khoá, zh/en) |
| CSS | `src/set-team-limits.module.css` — tệp RIÊNG, nhúng bằng define `__GBH_SET_LIMITS_CSS__` |
| Test | `tests/client/ui-agent-team.test.ts` — 4 ca mới (đọc trần từ kết quả/tham số, khối hỏng không ném, component vẽ đúng chuỗi) |

## 5. NGHIỆM THU — **ĐẠT 19/10/2026**, đã khai `gbh.row`

| phép đo | đo được | ngưỡng/baseline | kết quả |
|---|---|---|---|
| `lab:row ui-agent-team` · `#root` | **22.204** ký tự | 22.204 (control `ui-shortcuts`) | ĐẠT |
| lab · `[data-slot]` | 25 | — | ĐẠT |
| lab · lỗi console / pageerror | **0 / 0** | 0 | ĐẠT |
| lab · dòng did-not-activate | **0** | 0 | ĐẠT |
| lab · artifact trong profile | `client.js` 29.543 B + `index.js` 56 B, **MỘT id** (id gốc chỉ còn trong comment tài liệu) | 1 id | ĐẠT |
| `boot-smoke ui-agent-team` | HTML **112.118 B** · `__DSH_BOOT__` ✓ · `__ModuleLoader__` ✓ · `#root` **22.204** · console **0** · did-not-activate **0** | 6/6 | **ĐẠT** |
| `check:rows` | 131 gói khai `gbh.row` — **tất cả đạt**, 0 `chan` | 0 chặn | ĐẠT |

Trạng thái hiện tại: **đã khai `gbh.row`** (khối dưới). Khối row:

```json
{ "id": "ui-agent-team",
  "moduleIds": ["@galaxy-blackhole/gbh-client-ui-agent-team"],
  "aliases": ["@deepseek-ai/dsh-experimental-client-ui-agent-team"],
  "tests": ["tests/client/ui-agent-team.test.ts"] }
```

Đã hoàn tất đúng thứ tự: (1) Lead thêm dòng `packages/README.md` §4z4 → (2) `lab:row` (home riêng, cổng 5460)
→ (3) `boot-smoke` (home tạm `/tmp/gbh-smoke-ui-agent-team`) → (4) khai `gbh.row` + `check:rows` 0 chặn.
**Còn lại**: Lead boot mount thật + reviewer ký.
