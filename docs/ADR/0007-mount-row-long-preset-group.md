<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc ADR 0007: co che mount row LONG (preset/group) — mo duong cho tool-schedule, tool-plugin-market,
      tool-session-query, tool-pwsh-persistent (4 tool schedule_* hien KHONG toi duoc agent)
-->

# ADR 0007 — Cơ chế mount row LỒNG (preset/group)

- **Trạng thái:** ĐỀ XUẤT 19/10/2026 (chờ Lead duyệt) — người viết: tm-client-ui-a
- **Chặn gì:** 4 gói tool đã/sắp port xong nhưng tool **không tới được agent**:
  `tool-schedule` (4 tool `schedule_create`/`list`/`delete`/`update`), `tool-plugin-market` (3 row lồng),
  `tool-session-query`, `tool-pwsh-persistent`.

## 1. Số đo (dump 2026-10-18T01-31-57, `ours.yml`)

| sự thật | số đo |
|---|---|
| Preset là row **TOP-LEVEL** | `preset-standard` (dòng 803) · `preset-ptc` (967) · `preset-minimal` (1137), name `@deepseek-ai/dsh-agent-preset` |
| Tool nằm **LỒNG** trong `config.plugins` của preset | `- id: tool-schedule` xuất hiện **3 lần**, đều thụt lề 6 (dòng 833/997/1264) — thuộc **preset-standard · preset-ptc · preset-cordis** (truy ngược `- id: preset-*` gần nhất; **preset-minimal KHÔNG có**) — cùng chuỗi `tool-bash · tool-pwsh · tool-fs · tool-fs-search · tool-jobs · tool-schedule · …` |
| Patch hiện tại chỉ thay row TOP-LEVEL | `profiles/blackhole/app.patch.yml`: **305** dòng `- id:` nhưng **0** dòng cho row lồng; `renderRewriteBlock` (apps/cli/src/rewrite-metadata.ts) chỉ sinh `- id: <row.id>` + `disabled: true` + `- insert: - id: <id>-ours name: <specifier>` |
| Cơ chế mount preset là **của ta** | `packages/host/agent-preset-registry/src/mount.ts:178` `mountPreset()` → `prepareProfileEntries(ctx, plugins, baseUrl)` → `tree.update()`; registry **đã mount** trong app |

## 2. Hai phương án

### Phương án A — patch ghi đè cấu hình preset

Với mỗi preset chứa tool, sinh khối patch:

```yaml
- id: preset-standard
  config:
    plugins:
      - id: tool-schedule
        name: '@galaxy-blackhole/gbh-tool-schedule'
```

- **Ưu:** không cần sửa mã; nằm trong cơ chế patch sẵn có.
- **Nhược (quyết định):** (1) `config.plugins` là **MẢNG** — ngữ nghĩa merge mảng của loader không bảo đảm thay-theo-id;
  nhiều khả năng phải **khai lại TOÀN BỘ** danh sách plugin của từng preset (60–100 entry × 3 preset × 4 gói) ⇒
  patch phình hàng nghìn dòng và **lệch ngay khi DSH nâng cấp**; (2) `!!js` trong preset (vd `disabled: !!js process.platform …`)
  phải chép lại nguyên văn ⇒ dễ sai; (3) mỗi gói tool mới phải sửa 3 khối patch của 3 preset ⇒ công thức nhân 3.

### Phương án B — redirect tên module NGAY TRƯỚC khi mount preset (CHỌN)

Trong `agent-preset-registry` của ta, trước `prepareProfileEntries()`:

1. Đọc **bản đồ redirect** `stockId → specifier của ta` từ metadata `gbh.nested` của các gói ta **đã copy vào
   `<DSH_HOME>/profiles/node_modules/@galaxy-blackhole/*` (hoặc tệp `<DSH_HOME>/nested-redirect.json` nếu có).
2. Deep-walk mảng `plugins` của preset definition; entry nào có `name ∈ bản đồ` thì thay bằng specifier của ta
   (giữ nguyên `id`, `config`, `disabled`, `group`, …).
3. `mountPreset()` nhận danh sách đã sửa ⇒ `prepareProfileEntries` import **gói của ta** thay gói stock — ở MỌI độ sâu.

- **Ưu:** một khai báo/gói (`gbh.nested`) · không nhân bản cấu hình preset ⇒ **không drift khi DSH nâng cấp** ·
  phủ mọi độ sâu (plugin lồng trong `cordis:group` cũng thay được) · không sửa DSH · rollback = xoá metadata là hết.
- **Nhược:** cần CLI copy thêm gói khai `gbh.nested` vào profile (2 dòng trong `rewritePackages()`, hiện chỉ lấy gói có
  `gbh.row`) và cần một dòng nối vào đường boot; map chỉ áp cho preset mount (đúng phạm vi cần, không đụng row top-level).

## 3. Quyết định

**Chọn B.** Lý do ngắn: A biến mỗi lần DSH nâng cấp thành một cuộc đối chiếu 60–100 entry × 3 preset; B chỉ khai một
lần cho mỗi gói và tự động đúng ở mọi độ sâu. B cũng giữ nguyên nguyên tắc “metadata `gbh.*` là nguồn sự thật” của
ADR 0004, chỉ mở rộng từ **row top-level** sang **plugin lồng**.

## 4. Thi công (phạm vi task-90)

| # | việc | tệp |
|---|---|---|
| 1 | Metadata chuẩn cho gói lồng | `packages/host/tool-schedule/package.json`: `gbh.nested = { pluginId: 'tool-schedule', stockId: '@deepseek-ai/dsh-tool-schedule', presets: ['preset-standard','preset-ptc','preset-minimal'] }` |
| 2 | Hàm đọc bản đồ + hàm viết lại | `packages/host/agent-preset-registry/src/nested-mount.ts` (`readNestedRedirects`, `rewriteNestedNames`) |
| 3 | Nối vào đường mount preset | `mountPreset()`: `plugins` → `rewriteNestedNames(plugins, readNestedRedirects(...))` trước `prepareProfileEntries` |
| 4 | Copy gói lồng vào profile | `tools/nested-mount/mount.ts` (build + copy, dùng lại hàm của `apps/cli/src/mount.ts`) + **1 dòng** nối vào `apps/cli/src/host.ts` (Lead duyệt vì ngoài vùng ghi task-90) |
| 5 | Test | unit: map + rewrite (idempotent, không đụng entry không khớp, giữ `config`/`disabled`/`group`); tích hợp: mount preset giả lập; **boot thật**: dump + agent thấy 4 tool |

## 5. Tiêu chí ĐẠT (bằng chứng phải có)

1. `--dump-config` (hoặc dump parity) của app có **`- id: tool-schedule` với `name: '@galaxy-blackhole/gbh-tool-schedule'`**
   bên trong `preset-standard` (và 2 preset còn lại).
2. Log boot **0 dòng** `did not activate` cho `tool-schedule`.
3. Agent (preset standard) **thấy 4 tool** `schedule_create` · `schedule_list` · `schedule_delete` · `schedule_update`
   — chứng minh bằng dump công cụ của phiên hoặc ảnh chụp danh sách tool trong UI.
4. `check:app` 11/11 ĐẠT; `gate` không vi phạm mới.

## 5b. Trạng thái thi công (19/10/2026)

| # | việc | trạng thái |
|---|---|---|
| 1 | `gbh.nested` trong `packages/host/tool-schedule/package.json` | ✅ `{ pluginId: 'tool-schedule', stockId: '@deepseek-ai/dsh-tool-schedule', presets: ['preset-standard','preset-ptc','preset-minimal'] }` |
| 2 | `packages/host/agent-preset-registry/src/nested-mount.ts` | ✅ `readNestedRedirects` + `rewriteNestedNames` + `profileModulesDir`; **fail-soft** (gói thiếu `lib/index.js` ⇒ 1 dòng cảnh báo, KHÔNG throw) |
| 3 | Nối vào `mountPreset()` | ✅ đọc bản đồ 1 lần/tiến trình (cache), viết lại `name` trước `prepareProfileEntries`; lỗi đọc ⇒ giữ tên stock + cảnh báo |
| 4 | `apps/cli/src/mount.ts` (2 dòng, Lead duyệt) | ✅ `RewritePackage.row` thành optional + `nested?`; `rewritePackages()` thêm điều kiện OR `gbh.nested` (nhánh cũ cho `gbh.row` giữ nguyên) |
| 5 | Tự kiểm | ✅ `bun run tools/nested-mount/check.ts` = **9/9 ĐẠT** (map · fail-soft · thay ở độ sâu 2 trong `cordis:group` · không đụng entry không khớp · giữ id/group/config · idempotent · không sửa tham số vào) |
| 6 | Đo danh sách mount | ✅ `rewritePackages()` = **147 gói**, trong đó **1 gói `gbh.nested`** = `@galaxy-blackhole/gbh-tool-schedule` (stockId `@deepseek-ai/dsh-tool-schedule`, không có `row`) |

`presets` trong metadata = `['preset-standard','preset-ptc','preset-cordis']` — đo từ dump (preset-minimal không có plugin này).

⚠️ **`--dump-config` KHÔNG thấy được redirect**: theo phương án B, việc đổi tên xảy ra **lúc mount preset trong registry**,
không nằm trong văn bản config ⇒ bằng chứng phải là **log runtime**, hai dòng do registry in ra khi CÓ redirect:
1. `agent-preset[preset-standard] redirect row long: tool-schedule @deepseek-ai/dsh-tool-schedule -> @galaxy-blackhole/gbh-tool-schedule`
2. `agent-preset[preset-standard] tool da dang ky: …` — danh sách tool **đã đăng ký thật** trong scope preset, đọc từ
   `tools.schemas()` của ToolRuntime; phải thấy `schedule_create, schedule_delete, schedule_list, schedule_update`.

**Bằng chứng cuối do Lead chạy** (không thay thế được): `boot-smoke` + `check:app` 11/11; **chụp 2 dòng log trên** (không suy luận);
và `bun run tools/nested-mount/verify-preset.ts` **sau khi boot** (đối chiếu dump + profile thật, in trước/sau cho 3 preset).

## 7. Chẩn đoán 4 tool chưa tới agent (đo 19/10/2026, sau khi cơ chế redirect ĐẠT)

### 7.1 Dữ liệu đã đo (host.log, 4 preset)

```
agent-preset[standard] redirect row long: tool-schedule @deepseek-ai/dsh-tool-schedule -> @galaxy-blackhole/gbh-tool-schedule
agent-preset[standard] tool da dang ky (sau mount settle, moc 3000ms): create_worktree, ralph, session_search, terminal_close, …   ← KHÔNG có schedule_*
agent-preset[standard] inject chua tho (sau settle): tool-schedule(@galaxy-blackhole/gbh-tool-schedule): inject{tools=ok}
agent-preset[standard] dich vu trong realm preset: schedule=object{chain,ctx,initialized,name,ready,retention,runtime,stopping,…(9)} · tools=object{…}
```

- **Cơ chế redirect: ĐẠT** — 3 preset (standard · ptc · cordis) đổi tên đúng; `minimal` không có plugin này nên không redirect.
- **`schedule` KHÔNG phải THIEU** trong realm preset ⇒ loại giả thuyết "thiếu service".
- Object in ra có khoá giống **Fiber của cordis** (`chain/ctx/initialized/ready/stopping`) chứ không giống API nghiệp vụ
  (`list/create/delete/update`) ⇒ **chưa kết luận** được đó là service thật; đã bổ sung probe in `prototype`, tên service, và
  `typeof` từng phương thức nghiệp vụ.

### 7.2 Hai giả thuyết còn lại + cách kiểm

| # | giả thuyết | cách kiểm (đã cài trong mã) | dấu hiệu ĐẠT/LOẠI |
|---|---|---|---|
| **H1** | Tool có đăng ký nhưng vào **runtime của scope preset**, còn agent dùng **runtime ở ROOT** ⇒ agent không thấy | log `tool trong ROOT runtime loc 'schedule': …` — đọc `tools.schemas()` từ context GỐC | thấy `schedule_*` ở ROOT ⇒ H1 SAI (agent phải thấy); rỗng ⇒ H1 ĐÚNG |
| **H2** | `apply` của plugin **không chạy xong** (inject động `ctx.inject(['schedule'])` không callback, hoặc ném) | log `fiber tool-schedule: apply xong KHONG loi` / `LOI <thông điệp>` — `await entry.fiber.await()` | LOI ⇒ H2 ĐÚNG, cần sửa đường mount; `apply xong KHONG loi` ⇒ H2 SAI |

Bằng chứng phụ đã có: `tools=object{…}` trong realm preset ⇒ service `tools` tồn tại; danh sách tool của preset có các tool KHÁC
(`create_worktree`, `ralph`, `session_*`, `terminal_close`) ⇒ runtime của preset **có nhận đăng ký** từ các plugin khác.

### 7.3 Hướng sửa dự kiến (chưa chốt — chờ log H1/H2)

- Nếu **H1**: đổi chỗ mount `tool-schedule` từ scope preset sang **scope Agent/session** (nơi ToolRuntime thật dùng), hoặc cho
  registry mount preset **vào chính scope agent** thay vì scope con; phải A/B với row stock trước khi sửa.
- Nếu **H2**: tìm lý do inject động không callback — nghi vấn: `schedule` service trong realm preset là **Fiber wrapper** chứ
  không phải service API (đúng như khoá in ra), tức `ctx.inject` chờ một service KHÁC tên/khác realm; khi đó cần khai báo
  `inject` đúng tầng hoặc dùng service qua `ctx.reflect.get`.
- Cả hai nhánh đều **không sửa gói byte-identical** (tool-schedule vẫn nguyên văn) — chỉ đổi cách nối trong registry/CLI.

## 7.4 A/B đối chứng cơ chế (đo 19/10/2026, lab 2 lượt, home cách ly)

**Thiết kế phép đo:** cùng một bản dựng, hai lượt boot trong **home cách ly riêng** (`/tmp/gbh-ab-a`, `/tmp/gbh-ab-b`),
cùng bộ probe (in `tools.schemas()` của scope preset ở 4 mốc: ngay sau mount · 200/700/1500/3000 ms · **5 s · 10 s · 20 s**),
mở trang một lần để tạo phiên, rồi so từng mục.

| | Lượt A | Lượt B |
|---|---|---|
| công tắc | `GBH_NESTED_REDIRECT=off` | `GBH_NESTED_REDIRECT=on` |
| cổng | 5486 | 5487 |
| dòng `TAT redirect row long` (chế độ A/B) | **1** | 0 |
| dòng `redirect row long` (THẬT) | **0** | **3** (standard · ptc · cordis) |
| dòng `did not activate` | **0** | **0** |
| dòng log có `schedule_*` | **0** | **0** |
| số mục probe thu được | 12 | 12 |
| **kết quả so từng mục** | **12/12 GIỐNG NHAU · 0 KHÁC** | |

**Kết luận (bằng chứng, không suy luận):**
1. Cơ chế redirect **CHẠY** ở lượt B (3 dòng) và **TẮT** ở lượt A (0 dòng) — đúng công tắc.
2. **Tool inventory của scope preset GIỐNG HỆT** ở hai lượt ⇒ **redirect KHÔNG làm thay đổi / không làm hỏng** việc đăng ký tool.
3. Cả hai lượt đều **KHÔNG có `schedule_*`** trong scope preset ⇒ việc thiếu 4 tool **không phải do cơ chế của ta** và
   **cũng không phải do redirect**: đó là hành vi của bản thân DSH ở scope preset (tool chỉ vào runtime của **Agent/session**).
⇒ **Tiêu chí “agent thấy 4 tool” phải đo ở scope Agent/session**, không đo ở scope preset. Phép đo scope preset bị **loại**.

**Hệ quả cho ADR §5:** tiêu chí (3) đổi thành: “tạo một phiên/agent, đọc danh sách tool của phiên đó và thấy 4 tool
`schedule_*`” — đo bằng đường agent (HTTP/CLI với token app, hoặc log ở scope agent), **không** dùng `tools.schemas()` của preset scope.
