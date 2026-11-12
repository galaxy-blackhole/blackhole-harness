<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Bang nguon doi chieu (G4) + row gbh.row mirror dump + ly do peer + TRUOC/SAU + phan CHUA LAM cua @galaxy-blackhole/gbh-goal
-->

# @galaxy-blackhole/gbh-goal

Bản viết lại của Galaxy Blackhole cho row **`goal`** của DSH — gói gốc **`@deepseek-ai/dsh-goal`**
(**906 dòng** `lib/index.js`, **MỘT MẶT**: không có `lib/client.js`, manifest gốc không có `dsh.client`).

Row này cấp **`ctx.goals`** — trạng thái goal **cùng phiên** hướng sự kiện, so-sánh-và-đặt theo revision,
và **quyền tự động chạy tiếp** (phạm vi tiến trình). Nó đăng ký **đơn vị chiếu `goal`** (stateVersion **6**)
vào `ctx.sessionProjections`, ghi **MỘT** sự kiện `goal/change` toàn ảnh chụp cho mỗi thay đổi, và phát
hai sự kiện sống: `goal/changed` (phạm vi agent) · `goal/activation-changed` (không phạm vi).

## 0. Row — khai ĐÚNG dump (chỉ `id` + `tests`)

`package.json` khai:

```json
"gbh": {
  "row": {
    "id": "goal",
    "tests": ["tests/host/goal.test.ts"]
  }
}
```

Dump `2026-10-18T01-31-57`: `ours.yml` **dòng 275–276** là cặp **trần**

```yaml
- id: goal
  name: '@deepseek-ai/dsh-goal'
```

Cặp này **giống nhau ở cả bốn bản** của dump: `ours.yml` L275–276 · `oracleA.yml` L249–250 ·
`oracleA_nopatch.yml` L212–213 · `stock.yml` L209–210. Cả bốn **KHÔNG** có `disabled`, **KHÔNG** có
`config`, **KHÔNG** có `inject` — row top-level đang **BẬT** và dùng mặc định của plugin.

### Vì sao KHÔNG thêm khoá nào khác

Cổng parity mới so `config` deep-equal, `inject` deep-equal và `disabled` bằng với dump. Stock không
khai khoá nào trong ba khoá đó ⇒ mọi khoá thêm vào `gbh.row` đều là **bịa**, không phải mirror:

| Khoá KHÔNG thêm | Vì sao |
|---|---|
| `disabled` | `gbh.row.disabled` là giá trị đặt lên **row stock** trong khối disable+insert (bỏ qua = `true`). Dump không khai `disabled` cho row `goal` ⇒ không có biểu thức nào để mirror; thêm khoá chỉ lặp lại mặc định hoặc đổi nghĩa của nó. |
| `insertDisabled` | Chỉ dùng khi row **được chèn** phải mirror một row stock đang **TẮT** có điều kiện (tiền lệ `desktop-product-telemetry`). Goal đang **BẬT** ⇒ row chèn của ta cũng phải BẬT (bỏ khoá = bật); thêm khoá này là bịa điều kiện tắt. |
| `config` | Dump không có `config:` ⇒ phải dùng **mặc định của plugin** (`defaultMaxGoalRounds`). Khai `config` sẽ đổi hành vi và làm `config` khác dump. |
| `inject` | Dump không có `inject:` ⇒ row không tiêm thêm dịch vụ nào. `GoalService.inject = ["agents","sessionProjections"]` là inject **của plugin**, không phải của row, và giữ nguyên. |
| `moduleIds` · `aliases` · `stockId` · `hostAliases` | Chỉ có nghĩa với row **hai mặt**/bundle client đăng ký `__ModuleLoader__`, hoặc khi tên row lệch id stock. Goal là row host **một mặt**, id trùng `goal`; thêm vào là metadata thừa không có tác dụng. |
| `insertOnly` · `insertAs` · `insertAfter` · `moved` | Các cờ bố trí/di chuyển đặc biệt; goal thay đúng row `goal` ở đúng vị trí, không dùng. |

`tests` là khoá **DUY NHẤT** ngoài `id`: đây là **metadata của GBH** (nối row với test G4, bị
`hygiene`/`signoff` đọc), **không được render vào `app.patch.yml`**, nên không phải khoá parity và
không mâu thuẫn với dump. Nhờ vậy `gbh.row` vừa mirror đúng dump, vừa giữ được cổng test.
`gbh.tests` (cấp gói) vẫn giữ nguyên; `gbh.row.tests` là danh sách test **của row**.

## 1. Bảng nguồn đối chiếu (G4)

| Vùng bản gốc (`lib/`) | Hành vi | Bản viết lại |
|---|---|---|
| `types/runtime.js` | `GOAL_CHANGE_VERSION = 1` · `GoalId` · `GoalError extends HarnessError` | `src/runtime.ts` |
| `types/fold.js` | giải mã NGHIÊM thay đổi bền (create/edit/pause/resume/complete/block/clear), bộ đếm vòng, phép gộp thuần `foldGoal` | `src/fold.ts` |
| `types/index.js` (schema) | `goalProjectionSchema` + `goalProjectionStateSchema` (strict, superRefine) + `goalProjectionDefinition` stateVersion 6 | `src/projection.ts` |
| `types/index.js` (lái) | `applyGoalProjection` — KHÔNG ném khỏi lượt lái; sự kiện hỏng đầu tiên vào `failure` | `src/projection.ts` |
| `types/index.js` (service) | `GoalService` (`ctx.goals`): get · disarm · create · edit · pause · resume · complete · block · clear · remoteExportCreate | `src/service.ts` |
| `dispatch.js` (dsh-agent, được gọi) | `agentEvents(ctx, agent).emit("goal/changed", …)` — vật mang phạm vi + gắn `agent` + chặn lỗi người nghe | `src/dispatch.ts` |
| `types/domain.js`, `types/types.js` | từ vựng kiểu (view/snapshot/change/source/error code) + khai merge `Events`/`MessageSourceMap`/`SessionEventMap` | `src/types.ts` |
| `lib/index.js` (10 export) | điểm vào | `src/index.ts` |

Bảy quy tắc bất biến đã tái hiện **nguyên văn hành vi** (đo trong test A/B):

1. `disarm` là thao tác **phạm vi tiến trình** ⇒ **KHÔNG** đổi revision/pha bền (khác `pause`/`block`).
2. `roundsStarted` là dữ kiện **dẫn xuất** ⇒ vòng được nhận (`user/message` nguồn `kind:"goal"`) **không** đổi revision.
3. `clear` giữ **tombstone** `{id, revision+1}` + `clearedAt` ≥ `updatedAt` hiện tại.
4. Mốc thời gian bị **kẹp** `max(now, updatedAt)` khi đồng hồ tường chạy lùi.
5. `create` chỉ thay được goal đã `complete` (hoặc sau clear); id `goal-<uuid>` đã thấy thì **không tái dùng**.
6. `resume` từ chối khi goal `active` **và đang armed** (không phải chuyển pha), và từ chối khi **cạn ngân sách vòng**.
7. Lỗi phát lại trong `applyGoalProjection` **không** ném: `failure = "goal replay failed at session event <seq>: <msg>"`, lượt đọc host sau đó **ném lại đúng chuỗi đó**.

## 2. Vì sao mỗi peer (bảng §3b của `HOST-ROW-REWRITE.md`)

| peer | bậc | lý do ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/dsh-typert-protocol` | 2 | `GoalService` **phải kế thừa đúng** `TypertRemoteService` để Gateway của kernel discovery `ctx.goals`; bảy decorator `@Remote` ghi marker mà gateway đọc |
| `@deepseek-ai/dsh-llm` | 2 | `GoalError` **phải là cùng lớp** `HarnessError` — `tool-goal`/`command-goal` bắt lỗi theo mã và theo lớp |
| `@deepseek-ai/dsh-scope` | 2 | **vật mang phạm vi không thể tự chế**: `goal/changed` phải đi qua `scopeTarget(agent, agent)` để lọc phạm vi của listener |
| `@deepseek-ai/schemastery` | 1 | `static Config` — kernel đọc schema của plugin (`String(Config)` trùng gốc từng ký tự) |
| `zod` | 3 | hai schema dây của đơn vị chiếu; **zod là nơi phát lỗi kiểm trạng thái** (thông điệp trùng gốc từng ký tự) |

`@deepseek-ai/cordis` chỉ mượn **KIỂU** (`Context`) nên ở `peerDependencies` + `devDependencies` nhưng **không** vào `gbh.peers`
(tầng mount luôn symlink sẵn cordis + schemastery — `apps/cli/src/mount.ts:133`). `dependencies` **RỖNG**.

## 3. TRƯỚC / SAU — đo trên ARTIFACT và trên giàn A/B

| phép đo | TRƯỚC (bản gốc `@deepseek-ai/dsh-goal`) | SAU (bản của ta, build tại chỗ) |
|---|---|---|
| tập export trên `lib/index.js` | **10** | **10** — 0 thiếu · 0 thừa (cùng danh sách) |
| tên thuộc tính `GoalService.prototype` | **25** | **25** — trùng TỪNG TÊN |
| `GoalService.inject` / `String(Config)` | `["agents","sessionProjections"]` · `{ defaultMaxGoalRounds?: number }` | **y hệt** |
| vòng đời 22 bước trên cùng giàn | — | **vết bước + vết sự kiện trùng từng ký tự** |
| schema trạng thái (8 giá trị hỏng) | — | **cùng thông điệp zod từng ký tự** |
| `grep -c "id: @deepseek-ai" lib/index.js` | (không áp dụng) | **0** |
| `__ModuleLoader__` trong artifact | (không có — row host) | **0** |

**App 5439: CHƯA đo** — gói **đã khai `gbh.row`** (id `goal`, chỉ thêm `tests`; xem §0) nhưng **chưa mount**;
mọi phép đo app (entry, `(5)`, `(8)`, `check:app`) thuộc lượt boot của Lead.

## 4. Test — 22 ca / 100 expect / 0 fail

* **Bước 0**: cặp `- id: goal` + `name: '@deepseek-ai/dsh-goal'` trong `ours.yml` mới nhất (L275–276), **KHÔNG** `disabled`/`config`/`inject`; `lib/client.js` **KHÔNG**; `dsh.client` **KHÔNG**; **TEST CANH** `gbh.row` mirror ĐÚNG dump — đúng `{ id, tests }`, không `disabled`/`insertDisabled`/`config`/`inject` (ca 0c).
* **ARTIFACT**: tập export 10 = 10 (so **đúng tên gói gốc**), prototype 25 = 25, `build.ts` nhận `process.argv[2]`.
* **Đối chứng trực tiếp với chính bundle gốc** trên **Context cordis THẬT** + **sổ chiếu phiên THẬT**: 22 bước vòng đời, 8 thông điệp lỗi, failure phát lại, ngân sách vòng, vòng đã nhận.
* **Schema/decoder**: 8 giá trị trạng thái hỏng + 8 thay đổi hỏng cho **cùng thông điệp**; khung nhìn dây bị zod **cắt khoá lạ** y hệt.
* **C6 — DANH TÍNH** (`not.toBe`): `init()` hai lần là hai vật; `seenGoalIds` không chia sẻ; `foldGoal` trả **bản sao**; `get()` hai lần là hai khung nhìn; hai giàn không chung trạng thái.
* **waitFor CÓ TRẦN**: người nghe `goal/changed` reject bất đồng bộ ⇒ log `listener rejected`, lượt ghi vẫn xong (trần 1000ms, không bao giờ treo).
* **`gbh.peers` ⊆ `peerDependencies` so PHẦN TỬ + 3 ĐỐI CHỨNG ÂM** (xoá-một-tên · xoá-sạch · thêm-tên).
* **ĐỐI CHỨNG ÂM của chính test**: đổi một export trong artifact ⇒ phép so export BÁO lệch; đổi một trường trong vết ⇒ phép so vết BÁO; đổi `defaultMaxGoalRounds` ⇒ vết hành vi KHÁC.
* **000e**: `locale/{en,zh}.json` **byte-for-byte** (sha256 `ac23639e…` · `cb93d5a4…`).

## 5. Khác biệt CÓ Ý (đã đo, không phải thiếu sót)

1. **Không ship `./typert` (face model sinh tự động)** — giống các row typert đã viết lại (`plugin-inventory`, `settings-controller`); mặt này do trình sinh của kernel tạo và tự khai `package` của nó, chép tay 1.396 dòng sẽ lệch nguồn. Hệ quả: khi mount, RPC `ctx.remote.goals.*` cần Lead xác nhận face model (xem §6).
2. **Không augment `Context.goals` / `Events`** — `.d.ts` gốc của `@deepseek-ai/dsh-goal` **đang ở trong cùng chương trình tsc** (vì `goal-round-driver` mượn kiểu `GoalView`), augment thêm sẽ đỏ `TS2717` (đo thật, cùng lý do đã ghi ở gói `system-prompt`). Vì vậy seam của Context được khai **theo CẤU TRÚC** trong `src/types.ts`.
3. **`SessionSeq` nội bộ** — bản gốc import `SessionSeq` từ `@deepseek-ai/dsh-session` nhưng nó chỉ **đóng dấu kiểu** + kiểm số nguyên; ta giữ **đúng phép kiểm và đúng thông điệp TypeError** mà không thêm peer ngoài bảng §3b.
4. **`agentEvents` dựng lại bằng `scopeTarget`** — thay vì peer `@deepseek-ai/dsh-agent` (ngoài bảng §3b), ta dùng `dsh-scope` (trong bảng, đúng lý do *"vật mang không thể tự chế"*) và lái `ctx.events.dispatch("emit", …)` y hệt `agentEvents`: gắn `agent`, chặn lỗi đồng bộ, bắt promise bị từ chối và ghi log cùng thông điệp.

## 6. CHƯA làm (điều kiện chặn mount)

* **Đã khai `gbh.row`** (id `goal` + `tests`, không khoá nào khác — §0) nhưng **chưa mount** app 5439:
  chưa `lab:row` · chưa `check:app` · chưa A/B pixel (thuộc lượt boot của Lead).
* **Face model `./typert`**: chưa sinh cho gói ta. Khi Lead mount, nếu `ctx.remote.goals.*` cần mặt này thì phải bổ sung **trước** khi tắt row stock (nếu không, Client `GoalBar` mất RPC — lớp lỗi *"mất chức năng âm thầm"*).
* **`(5)` `did not activate` = 0** và **entry của ta trong manifest** chưa đo được vì chưa mount.
