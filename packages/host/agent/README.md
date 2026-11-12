<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README cua @galaxy-blackhole/gbh-agent — bản viết lại của dsh-agent (sổ agent ctx.agents + phạm vi initiator + từ vựng sự kiện agent)
-->

# @galaxy-blackhole/gbh-agent

Bản viết lại của Galaxy Blackhole cho row **`agent`**: dịch vụ **`ctx.agents`** — **sổ agent ĐANG SỐNG**,
uỷ quyền **tạo/resume** cho factory do bộ điều khiển vòng chạy cấp, **phạm vi initiator theo tiến trình**,
và **từ vựng sự kiện agent** cùng ba helper phái sinh (`agentEvents`/`agentCarrier` · `installModelSelection` ·
`foldConsumedWork`).

Đây là row **MỘT MẶT** — đã kiểm ở bước 0: gói gốc **KHÔNG có `lib/client.js`**, **KHÔNG có `dsh.client`**
trong `package.json` ⇒ không nửa browser, không bẫy id module/alias/HMR/JSX. Nửa host gốc **702 dòng**
(`apps/host/node_modules/@deepseek-ai/dsh-agent/lib/index.js`, chỉ đọc).

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `agent` (T1) — dump `2026-10-18T01-31-57` `ours.yml` **L61–62**, đang BẬT, **không `config`**, **không `inject`**, **không `disabled`** | `@galaxy-blackhole/gbh-agent` |
| Package | `@deepseek-ai/dsh-agent@0.2.1-alpha.4` | cùng bề mặt, viết lại |
| Kích thước bản build | **702 dòng JS** (`lib/index.js`) + **8 file `.d.ts`** (`lib/types/`) | **480 dòng JS** sau build (không chép khối JSDoc/type của gốc) |
| Hai mặt? | **KHÔNG** (`lib/client.js` vắng mặt; `dsh.client` vắng mặt) | — |
| Tập export | `AgentRegistry` · `default` · `agentCarrier` · `agentEvents` · `assembleContextFor` · `emitAgentEvent` · `foldConsumedWork` · `installModelSelection` (**8**) | **8 = 8**, đo trên ARTIFACT; `default === AgentRegistry` |
| Hợp đồng kiểu | `lib/types/{index,runtime-types,types,dispatch,consumed-work,model-selection,projection,archive-admission}.d.ts` (chỉ đọc) | `src/types.ts` viết lại theo hợp đồng đó |
| Helper kernel dùng lại | `createUserMessage` + `boundContextSummary` của `@deepseek-ai/dsh-llm`; `scopeTarget` của `@deepseek-ai/dsh-scope`; `Service`/`getTraceable`/`symbols` của cordis | **cùng lớp/hàm của kernel** (peer), không phải bản sao |
| Ba module gốc gộp trong bundle | `archive-admission` · `consumed-work` · `model-selection` · `dispatch` · `index` | cùng cách tách: `src/archive-admission.ts` · `src/consumed-work.ts` · `src/model-selection.ts` · `src/dispatch.ts` · `src/index.ts` |
| `locale/` | `en.json` (41 B) · `zh.json` (128 B) | **chép byte-for-byte** — sha256 `c6c65a47…` · `46aa2bef…` |
| Cơ chế thay row | cặp disable + insert, metadata `gbh` trong `package.json` — ADR 0004 §2/§11 | **CHƯA khai `gbh.row`** (xem §6) |

### Vì sao KHÔNG chép `lib/types/*.js`

Bản gốc ship các module `.js` phụ trong `lib/types/` (bản build của từng `//#region`), nhưng
`package.json` gốc chỉ mở **một** subpath chạy được (`./types`) và **không gói nào trong repo import
subpath đó lúc chạy** (quét `apps/host/node_modules`, `packages/`). Bề mặt thật của row là
`lib/index.js` — và đó cũng là thứ `check:rows`/`M6-MOUNT-PLAN §1c` so. Ta **không** ship subpath
`./types` (xem §7).

## 2. Bản đồ hành vi (đo từ bản gốc, rồi viết lại)

| Bề mặt | Việc |
|---|---|
| `constructor(ctx)` | `super(ctx, "agents")`; `ctx.inject(["typert"])` ⇒ `typert.lookups.register("agent")` + `typert.contexts.registerHost("agent")`; nghe `internal/status` (state **5 = UNLOADING** + fiber sở hữu ⇒ `closeInitiators`); một effect generator 2 hàm dọn; cài **archive admission** |
| `currentInitiator` · `requireInitiator` | đọc `AsyncLocalStorage`; `require` ném `no initiating agent is active`; đã bỏ ⇒ cả hai ném `agent initiator scope is disposed` |
| `withInitiator` · `withoutInitiator` | mở MỘT ranh giới có theo dõi, giữ **ĐÚNG** giá trị/Promise trả về; Promise được theo dõi tới khi lắng (**kể cả reject**); `undefined` = ranh giới XOÁ kế thừa |
| `setFactory` | effect-scoped; **trùng ⇒ ném** `an agent factory is already registered`; bóc `symbols.original` để receiver của create/resume là **bên gọi** |
| `create` · `resume` | `getTraceable(ownerCtx, target)` + `Reflect.apply(target.…, receiver, [ownerCtx, options])` — đúng thứ tự tham số của gốc |
| `enter(agent, owner)` | kiểm `agent.id === agent.session.id` (lệch ⇒ ném **nguyên văn**); dựng carrier `scopeTarget(agent, agent)`; trùng id ⇒ ném; trả closure detach **luỹ đẳng** |
| `announce(agent, source, signal)` | bật CẢ HAI cờ trước khi `ctx.serial(carrier, "agent/created", …)`; `finally` hạ cờ + gỡ nếu detach đã tới trong lúc phát; payload có `signal` CHỈ khi được truyền |
| `register(agent)` | **effect async-generator**: `yield` closure detach (để Cordis lồng đúng thứ tự) rồi `await announce(agent, "startup")` |
| `get` · `isOwnedBy` · `list` · `roots` | tra theo danh tính; `list`/`roots` trả **mảng MỚI** mỗi lần |
| `installTurnArchiveAdmission` | `workspace/session-activity` (waterfall) thêm `{kind:"turn"}` khi Agent **đang chạy**; `workspace/session-stop` gọi `agent.cancel({kind:"user"})` — **không** `keepInbox` |
| `agentCarrier` · `agentEvents` · `emitAgentEvent` · `assembleContextFor` | carrier mới mỗi lần gọi nhưng **cùng khoá**; `emit` gọi MỌI người nghe, bao lỗi ném/reject thành **một dòng log**; `serial`/`waterfall` tách hàm rồi gọi (giữ nguyên cách gốc gọi) |
| `foldConsumedWork` | một lượt quét; **thứ tự đoản mạch** `stepped.delete(turn) || (claimed.delete(turn) && accountsForClaim(reason))`; `canceled` + `inserted.length === 0` ⇒ `droppedUnrun`; `turn/end` tính được ⇒ **reset** cờ |
| `installModelSelection` | `system-prompt/assemble` chụp `current` TRƯỚC `next()`; `agent/request` áp tuyến + **xoá effort kế thừa** khi không chọn effort; `agent/pre-step` với **`prepend: true`** chèn thông báo `[model changed: …]` khi provider/model ĐỔI |

## 3. Peer (bảng §3b của `packages/README.md`)

| Peer | Bậc | Vì sao ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | 1 — kernel | `Service` nền (phải **cùng lớp** thì `ctx.provide("agents")` mới đúng), `getTraceable`, `symbols.original`, `ctx.serial`/`ctx.effect`/`ctx.on` |
| `@deepseek-ai/dsh-scope` | 2 — seam | `scopeTarget` — **vật mang phạm vi không thể tự chế**: khoá carrier được khớp bằng DANH TÍNH trong `dsh-scope`, chép lại sẽ không lọc được listener |
| `@deepseek-ai/dsh-llm` | 2 — seam | `createUserMessage` + `boundContextSummary`: thông báo đổi model là **cùng biểu diễn của kernel** (id có thương hiệu, vật đóng băng sâu qua `structuredClone`) và đi vào **nhật ký phiên** — tự dựng tay sẽ lệch hình dạng |

`gbh.peers` **⊆** `peerDependencies` — so **PHẦN TỬ** (không so số lượng), có **3 ĐỐI CHỨNG ÂM** trong test
(xoá-một-tên · xoá-sạch · cùng-số-lượng-mà-lệch). **KHÔNG có `dependencies`**.

## 4. Bảng TRƯỚC / SAU (đo trên máy người viết)

| Phép đo | TRƯỚC (row DSH stock) | SAU (gói của ta) | Diễn giải |
|---|---|---|---|
| Tập export trên ARTIFACT | 8 tên | **8 tên — 0 thiếu · 0 thừa** | `lib/index.js` hai bên, đo bằng đúng hai regex của `check:rows` |
| Prototype `AgentRegistry` | 25 tên | **25 tên — bằng nhau** | mọi phương thức (kể cả private của TS) nằm trên prototype như gốc |
| `grep -c "id: @deepseek-ai" lib/index.js` | — | **0** | row host thuần: KHÔNG đăng ký id module nào |
| `locale/{en,zh}.json` | 41 B · 128 B | **byte-for-byte** | sha256 `c6c65a47…` · `46aa2bef…` |
| `bun test tests/host/agent.test.ts` | — | **17 test · 118 expect · 0 fail** | xem §5 |
| `bun run check:rows` | 114 gói · **0 `chan`** | **114 gói · 0 `chan`** (gói này chưa khai `gbh.row`) | cổng chặn mount không đổi |
| `bun run gate --no-tests` | — | xem §6 | gói này **0 vi phạm** |
| Mount thật (`lab:row` · `check:app` · A/B) | — | **CHƯA làm** | thuộc lượt boot của Lead (§6) |

## 5. Năm phép đối chứng với CHÍNH bundle gốc

Mọi ca chạy **CẢ HAI** bản (ta + `apps/host/node_modules/@deepseek-ai/dsh-agent/lib/index.js`) trên
**Context cordis THẬT của từng bản** (`new Context()` của chính cordis mỗi bản nạp), rồi so **từng trường**:

1. **`AgentRegistry`**: `enter`/`get`/`isOwnedBy`/`list`/`roots`, lỗi nguyên văn (trùng id · lệch id phiên ·
   announce hai lần · announce agent không sống), payload `agent/created` (`source` + `signal`),
   `agent/disposed` phát **đúng một lần** (detach luỹ đẳng, detach TRONG lúc announce), carrier của listener.
2. **Factory + initiator**: `create`/`resume` nhận ĐÚNG `(ownerCtx, options)` với `this` = factory;
   trùng factory/ném, gỡ factory rồi `create` ⇒ ném; initiator sync/nested/xoá kế thừa/async; lỗi của
   operation vẫn ném ra; **rút cạn lúc dọn** — `fiber.dispose()` chờ ranh giới đang mở lắng xong.
3. **`foldConsumedWork`**: ma trận **12 nhật ký** (kể cả ca dị dạng: `turn` vắng số, `removedCount` vắng,
   lý do `max-tokens`/lạ, huỷ sau lượt) — trùng `end` **theo DANH TÍNH** + `droppedUnrun`.
4. **`agentEvents`/`agentCarrier`/`assembleContextFor`**: chèn `agent` vào payload; gọi MỌI người nghe
   dù một người **ném** và một người **reject** (mỗi lỗi một dòng log, **cùng chuỗi**); `serial` bail;
   `waterfall` hợp chuỗi; carrier mới mỗi lần gọi nhưng **cùng khoá** (`carrierKeyOf`).
5. **`installModelSelection` + `installTurnArchiveAdmission`**: 9 ca pre-step (đổi route / cùng route /
   bước 1 rỗng / có thông điệp / từ chối / đã huỷ / chưa header / chưa chọn model / chỉ đổi effort) so
   **từng thông điệp** (bỏ `id` ngẫu nhiên, giữ cờ `frozen` + `source`); `prepend` chứng minh bằng
   **listener ngoài thấy quyết định TRƯỚC** thông báo; họ `turn` + `cancel({kind:"user"})`.

**C6 — DANH TÍNH** (`not.toBe`, không phải so sâu): hai sổ đăng ký trên hai context **độc lập** (cùng id
không ném); `list()` trả mảng **mới** (sửa không lan); mỗi lần gấp trả **vật mới**; hai lựa chọn model
**không chia sẻ** `assembled`.

**ĐỐI CHỨNG ÂM của chính test** (sửa một chỗ ⇒ phải có ca đỏ): bản gấp sai **đúng một chỗ** (không reset
`droppedUnrun`) bị ca so bắt; artifact bị **bỏ một tên export + thêm một tên lạ** ⇒ phép so báo đúng
`missing: ["foldConsumedWork"]` · `extra: ["extraExport"]`; manifest bị xoá peer ⇒ `peerGaps` báo đúng tên.

## 6. CHƯA làm (điều kiện chặn mount, không phải ghi chú cuối báo cáo)

- **CHƯA khai `gbh.row`** — theo luật "khai CUỐI CÙNG": khai sớm ⇒ `hygiene` đòi test + dòng §4 (đã có)
  nhưng còn **chưa mount thử**. Test có **ca canh**: `gbh.row` phải vắng mặt cho tới lượt boot của Lead.
- **CHƯA chạy `lab:row agent`** — lab cần gói đã khai `gbh.row`; lượt mount + `check:app` + đo TRƯỚC/SAU
  trên 5439 thuộc **Lead** (một cửa sổ boot, không tự bật).
- **CHƯA có ảnh A/B / đo DOM** — row host không vẽ gì lên UI, nhưng vẫn phải đo `#root`/`(5)` ở lượt mount.

## 7. Khác biệt CÓ Ý (đã đo, không phải thiếu sót)

1. **KHÔNG augment `Context`/`Events` của cordis.** Gói gốc khai `interface Context { agents: AgentRegistry }`
   và một loạt sự kiện agent; `.d.ts` đó **đã nằm trong cùng chương trình `tsc`** của repo (nhiều gói mượn
   kiểu `Agent` từ nó) ⇒ khai lại **cùng thuộc tính với lớp KHÁC** là đỏ `TS2717` (đo thật với row
   `system-prompt`, 18/10/2026). Vì vậy bề mặt context/seam ở đây khai **theo CẤU TRÚC** trong `src/types.ts`.
2. **`SessionId = string`** thay vì brand của `dsh-session` (gói **ngoài** bảng §3b): brand lạ sẽ làm id do
   kernel cấp **không gán được** vào tham số của row này. Dấu là tầng kiểu thuần, không đổi hành vi.
3. **KHÔNG ship subpath `./types`** (gói gốc có): quét toàn repo + `apps/host/node_modules` ⇒ **0 ai**
   import nó lúc chạy; bề mặt thật của row là `lib/index.js`.
4. **Thông báo đổi model đổi kiểu tại chỗ** (`ModelNoticeInput`) thay vì khai augmentation cho
   `MessageSourceMap` của `dsh-llm` — cùng lý do `TS2717` ở mục 1; hàm kernel vẫn là **cùng một hàm**.

## 8. Tái lập

```bash
cd <repo>
~/.bun/bin/bun test tests/host/agent.test.ts        # 17 test · 118 expect · 0 fail
cd packages/host/agent && ~/.bun/bin/bun run build.ts   # lib/index.js (480 dòng)
grep -c 'id: @deepseek-ai' lib/index.js             # 0
```
