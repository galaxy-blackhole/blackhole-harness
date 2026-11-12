<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ui-settings-agent-loop cua DSH (M5, row hai mat).
-->

# @galaxy-blackhole/gbh-client-ui-settings-agent-loop

Thay row `ui-settings-agent-loop` của DSH: trang cài đặt **Agent loop** trong Settings → Plugins
(hạn mức số lời gọi tool chạy song song trong một bước).

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-settings-agent-loop` (tier T3, **đang BẬT**) | `ui-settings-agent-loop-ours` → `@galaxy-blackhole/gbh-client-ui-settings-agent-loop` |
| Package | `@deepseek-ai/dsh-client-ui-settings-agent-loop` | `@galaxy-blackhole/gbh-client-ui-settings-agent-loop` |
| Nơi đọc bản gốc (chỉ đọc) | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-settings-agent-loop/` (`lib/index.js` 12 dòng · `lib/client.js` 174 dòng · `lib/types/**` · `package.json`) | repo chưa có `vendor/dsh-reference` |
| Kích thước bản build | **186 dòng JS** (12 + 174) | `lib/index.js` 5 dòng · `lib/client.js` **183 dòng** (sinh tự động) |
| Hai mặt? | **CÓ** (`dsh.client`, nửa browser là phần có nghĩa) | có đủ hai nửa |
| `dsh.client.inject` | `@deepseek-ai/dsh-client-locale` · `@deepseek-ai/dsh-client-ui-settings` · `@deepseek-ai/dsh-client-ui-plugin-manager` | **khai y hệt** trong `package.json` ⇒ entry trong `__DSH_BOOT__` có đúng 3 mối nối đó |
| Id MODULE bản gốc đăng ký | **1** (`__ModuleLoader__.load({ id, factory })`, không có `chunk:`) | **2**: id của ta (chính, khớp manifest + `rev` HMR) + id stock (phụ, mở khoá bundle phụ thuộc) |
| Id SLOT OCCUPANT | `agent-loop` trong `ctx.slots.register({ name: "plugins.item", id: "agent-loop" })` | y hệt (id này **không** vào bảng module) |
| Mức độ dẫn xuất | — | **viết lại theo hành vi**: đọc `.d.ts` + `lib/client.js` để nắm hành vi rồi viết lại; **không chép code**. Hai ngoại lệ là DỮ LIỆU đối chiếu, không phải logic: (a) 12 chuỗi copy en/zh (ma trận ảnh A/B so từng ký tự); (b) các định danh quan sát được (nhãn hiệu ứng `ui-settings-agent-loop: …`, khoá hook `agentLoopCard`, id ô nhập `plugin-config-agent-loop-parallel`, tên trường `maxParallelToolCalls`) |

### Hành vi phải giữ (đọc từ bản gốc)

`apply(ctx)` làm đúng 4 việc, theo thứ tự:

1. `t = ctx.locale.bind("settings.agentLoop")` — bind **trước** khi đăng ký.
2. `ctx.effect(() => ctx.locale.register("settings.agentLoop", { zh, en }))` — nhãn `ui-settings-agent-loop: dictionaries`.
3. Dựng form staged: `new SettingsFormModel(ctx.configForms.get("agent-loop"), [settingsNumberField("maxParallelToolCalls")])`,
   rồi `ctx.effect(() => () => card.dispose())` — nhãn `…: form subscription`.
4. `ctx.effect(() => ctx.configForms.whileServed(["agent-loop"], () => ctx.slots.inject("plugins.item", () => ctx.slots.register({…}, AgentLoopCard))))`
   — nhãn `…: page`. Occupant: `name: "plugins.item"` · `id: "agent-loop"` · `order: 30` · `locale` · `label: () => t("title")` ·
   `inject: () => ({ hooks: { agentLoopCard: store }, …form.actions() })`.

Component: `view === "summary"` ⇒ trả `t("description")`; ngược lại render `SettingsForm` (labels từ từ điển)
bọc một `SettingsValueField` `id: "plugin-config-agent-loop-parallel"`, `numeric: true`, `disabled: !state.writable`,
spread `state.maxParallelToolCalls` **sau** `disabled`, `onEdit`/`onReset` trỏ về trường `maxParallelToolCalls`.

## 2. Vì sao cần

Đây là một trong 54 row T3 đang bật, và là **row nhỏ thứ hai** (186 dòng bản build). Nó là màn cài đặt của
agent loop: người dùng chỉnh "Parallel tool calls" (hạn mức gọi tool song song trong một bước) trên
namespace `agent-loop` do agent loop phía Host đăng ký. Ai gọi nó: trang **Plugins** của client (slot
`plugins.item`) — trang chỉ xuất hiện khi Host đang phục vụ namespace `agent-loop`; deployment không
phơi cài đặt này thì **không có dấu vết nào** của nó.

Nửa host: `apply` **rỗng** đúng như bản gốc — nó chỉ tồn tại để Loader có một dòng entry.

## 3. Peer

**Không khai peer nào.** Bản gốc chỉ khai `@deepseek-ai/cordis` nhưng nửa host của nó không import gì;
bản của ta cũng vậy ⇒ không cần peer nào ngoài bảng §3b của `packages/README.md`.

Hai specifier mà nửa browser `require` lúc vạt chất hoá — `react/jsx-runtime` và
`@galaxy-blackhole/gbh-client-ui-primitives` — **không phải peerDependency**: chúng do **bảng module của trang**
cấp qua `require` của factory, đúng hai specifier như bản gốc (giữ nguyên khung form dùng chung của
ui-primitives để DOM không lệch). Gói không kéo thêm bất kỳ phụ thuộc runtime nào.

## 4. Bảng TRƯỚC / SAU

Đo trên **home cách ly + cổng riêng** (mục 6 của công thức), KHÔNG chạm cổng 5439 cho tới khi 0 lỗi.
Phép đo "SAU" cô lập **đúng một row của ta**: boot 1 lần để mount gói vào profile của home cách ly, rồi boot
lại với `GBH_DISABLE_REWRITES=1` + lớp overlay `--patch` chỉ chứa khối disable+insert của row này
(**không** sửa `<home>/app.patch.yml` vì `bh host` ghi đè file đó mỗi lần boot).

| Phép đo | TRƯỚC (row DSH) | SAU (chỉ row của ta) |
|---|---|---|
| Trang | 200 · **48.882 B** | 200 · **48.907 B** (**+25 B** = id mới dài hơn 7 ký tự, xuất hiện vài chỗ trong đồ thị boot) |
| Số entry trong `__DSH_BOOT__` | **72** | **72 (không đổi)** |
| Id entry của row | `@deepseek-ai/dsh-client-ui-settings-agent-loop` | `@galaxy-blackhole/gbh-client-ui-settings-agent-loop` |
| `inject` của entry | 3 id stock | **y hệt từng chữ** |
| Id stock còn trong đồ thị? | — | **không** (đúng cơ chế: `register` ném lỗi trùng id) |
| Đồ thị boot (JSON thô) | 31.387 B | 31.407 B — **chỉ 1 entry đổi tên**, không entry nào khác đổi nội dung, không batch nào đổi kích thước |
| Dòng `did not activate` | **0** | **0** |
| `__DSH_BOOT__` trên trang | có | có |

Trên **app thật 5439** (row này đã sống từ lượt boot 14:34 — xem mục 5):

| Phép đo | Kết quả |
|---|---|
| Trang | 200 · **48.623 B** · 71 entry (thiếu 1 entry của **gói khác** đang viết dở — `ui-settings-plugins`; xem mục 6) |
| `bh host --dump-config` | có `- id: ui-settings-agent-loop` (**disabled: true**) + `- id: ui-settings-agent-loop-ours` `name: '@galaxy-blackhole/gbh-client-ui-settings-agent-loop'`; tổng row thay được = **8** (trước package này là 7) |
| Boot log `~/.galaxy/blackhole/host-5439.log` | 0 dòng `did not activate` · 8 dòng `rewrite OK` |
| Byte phục vụ cho trình duyệt | combo `/plugins/??…` trả 200 · trong đó có `load({ id: "@galaxy-blackhole/gbh-client-ui-settings-agent-loop"` **và** `load({ id: "@deepseek-ai/dsh-client-ui-settings-agent-loop"` (một factory dùng chung) + `settings.agentLoop`; **0 dòng cú pháp ESM** (loader nạp bundle bằng thẻ `<script>` classic) |

### Lệnh tái lập

```bash
# (1) hành vi + khuôn hai id — không cần app: build thật trong thư mục tạm rồi nạp vào window giả
bun test tests/client/ui-settings-agent-loop.test.ts      # 12 pass · 102 expect

# (2) TRƯỚC: home cách ly, MỌI row còn là stock
GBH_DISABLE_REWRITES=1 GBH_HOME=/tmp/gbh-al-before bun run apps/cli/src/main.ts host --port 5455

# (3) SAU (cô lập đúng row này): mount một lần, rồi boot lại với overlay
GBH_HOME=/tmp/gbh-al-mine bun run apps/cli/src/main.ts host --port 5456 --dump-config
GBH_DISABLE_REWRITES=1 GBH_HOME=/tmp/gbh-al-mine bun run apps/cli/src/main.ts host --port 5456 \
  --patch <file overlay: disable ui-settings-agent-loop + insert ui-settings-agent-loop-ours>

# (4) sức khoẻ app thật (mục 4b)
URL=$(cat ~/.galaxy/blackhole/ready-url.txt); curl -sL -c /tmp/j -b /tmp/j "$URL" | wc -c   # ≈ 48.9 KB
grep -c 'did not activate' ~/.galaxy/blackhole/host-5439.log                              # 0
bun run apps/cli/src/main.ts host --dump-config | grep -c 'ui-settings-agent-loop-ours'   # 1
bun run check:rows && bun run gate                                                         # sạch · 6/6
```

Lưới an toàn: `GBH_DISABLE_REWRITES=1 bh host` trả về row DSH trong 1 lệnh, không phải sửa tay patch.

## 5. Nghiệm thu sức khoẻ toàn app (mục 4b)

| Dấu hiệu | Kết quả |
|---|---|
| (1) Trang sống | 200 · 48.623 B (app thật) · 48.907 B (home cách ly) — không có ca teo 68 B / 12 KB |
| (2) `did not activate` trong log boot | **0** |
| (3) `__DSH_BOOT__` trên trang | **1** |
| (4) Row của ta có mặt | `-ours` xuất hiện trong dump, row stock `disabled: true`, tổng row thay **+1** |
| Nửa client thật sự được phục vụ | combo `/plugins` (200) chứa **cả hai** id đăng ký + `settings.agentLoop` + nhãn hiệu ứng `ui-settings-agent-loop: page` |

## 6. Phần CHƯA làm / giới hạn

- **Chưa có ảnh A/B riêng cho màn Plugins → mục "Agent loop"** (giàn `parity:shot` của tm-ui-features phụ
  trách). Bằng chứng hiện có cho nửa UI là: bundle phục vụ thật trên 5439 chứa đúng phần đăng ký slot,
  test hành vi (đăng ký occupant `plugins.item`/`agent-loop`/`order 30`, hook `agentLoopCard`, labels,
  render form), và entry có đủ 3 mối nối `inject` nên `slots`/`locale`/`configForms` chắc chắn có mặt
  trước khi `apply` chạy.
- **Ca BYTE không áp dụng**: row này không có thân phản hồi byte nào (không route, không RPC). Thay vào đó
  có ca khuôn bundle: `lib/client.js` phải là **script classic** (không cú pháp ESM) và đăng ký **đúng 2 id**
  bằng **cùng một factory** — thiếu/sai là SyntaxError lúc nạp hoặc trượt bảng module.
- **Trang 5439 đang thiếu 1 entry của gói KHÁC** (`ui-settings-plugins` của tm-m5b, đang viết dở): entry
  biến mất khỏi đồ thị ⇒ tính năng biến mất mà log **không có dòng lỗi nào**. Đã báo Lead; không liên quan
  tới row này (đo cô lập ở mục 4 cho 72/72 entry).

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-settings-agent-loop` (shasum `en 2ce4e10e5f68...` · `zh 38267c078c96...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
