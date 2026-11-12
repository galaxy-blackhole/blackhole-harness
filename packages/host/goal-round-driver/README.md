<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row goal-round-driver cua DSH.
-->

# @galaxy-blackhole/gbh-goal-round-driver

Bộ điều khiển **vòng goal cùng phiên** (`goal-round-driver`): tự nhận **MỘT vòng kế tiếp** khi agent rảnh,
và dựng hàng rào chống tranh chấp cho **đúng bản goal/revision** đã đặt chỗ.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `goal-round-driver` (tier **T4**) | `@galaxy-blackhole/gbh-goal-round-driver` |
| Package | `@deepseek-ai/dsh-goal-round-driver` `0.2.1-alpha.4` | `@galaxy-blackhole/gbh-goal-round-driver` `0.1.0` |
| Kích thước | **377 dòng** `lib/index.js` | **632 dòng** TS (3 module) ⇒ **395 dòng** build |
| Hai mặt? | **KHÔNG** — `lib/client.js` không tồn tại, `package.json` không có khoá `dsh` (câu hỏi 5) | một mặt |
| Tập export | `apply` · `inject` · `name` · `renderGoalRoundPrompt` | **4 = 4**, 0 thiếu · 0 thừa (đo trên ARTIFACT) |
| `locale/` | `en.json` (5 dòng) · `zh.json` (6 dòng) | chép **byte-for-byte** (shasum `be59da6b…` · `63d0302a…`) |
| `config` của row | **KHÔNG CÓ** | **KHÔNG khai** (giữ nguyên) |
| `inject` của row | **KHÔNG CÓ** | **KHÔNG khai** (giữ nguyên); `inject` của PLUGIN là `["agents","goals","sessions"]` |

## 2. Row này làm gì, và 5 câu hỏi bắt buộc

Mỗi khi một agent **yên** (`agent/status` = `idle`) mà goal của nó đang `active` + `armed`, driver:

1. **checkpoint ghi bền** phần đã cam kết (`sessions.flush`) nếu có thay đổi goal chưa bền;
2. **chờ hậu duệ** (`ctx.get("subagents").waitForChildren`) — dịch vụ này **tuỳ chọn**, vắng mặt thì bỏ qua;
3. chạm trần vòng ⇒ **chặn** goal với mã `round-limit`;
4. còn lượt ⇒ dựng câu lệnh `<goal_round>` rồi `agent.followup()` **đúng MỘT** message,
   mang nguồn `{ kind: "goal", goalId, revision, round }`;
5. giữ **hàng rào** `agent/pre-step`: nếu bản goal/revision đã đổi (bị gỡ quyền, bị sửa, có prompt tranh chấp)
   thì **TỪ CHỐI** bước và **đặt lại** các message khác về `next-step` thay vì nuốt chúng;
6. mọi đường lỗi (ghi bền hỏng, xếp hàng hỏng, driver ném) đều **log rồi tự gỡ quyền** — không ném ra vòng sự kiện.

| # | Câu hỏi | Trả lời (đo được) |
|---|---|---|
| 1 | Row đang BẬT? | **CÓ.** `ours.yml` L277–278: `- id: goal-round-driver` + `name: '@deepseek-ai/dsh-goal-round-driver'`, **không** `disabled`. Bốn dump (`ours` · `oracleA` · `oracleA_nopatch` · `stock`) đều khớp cặp này. |
| 2 | Thuần host hay có mặt client? | **THUẦN HOST**: chỉ `lib/index.js`, **không** `lib/client.js`, bundle **không** có `__ModuleLoader__`, `package.json` gốc **không** có `dsh.client`. |
| 3 | Cần seam nào? | `ctx.agents` (`get`/`list`/`withoutInitiator`/`currentInitiator`) · `ctx.goals` (`get`/`disarm`/`pause`/`block`) · `ctx.sessions.flush` · `ctx.get("subagents")` (tuỳ chọn) · `ctx.effect` · `ctx.fiber.state` · `createUserMessage` của `dsh-llm`. |
| 4 | Hành vi đo được là gì? | Câu lệnh `<goal_round>` **nguyên văn từng ký tự** · nguồn message vòng goal · 3 mã chặn `round-limit`/`queue-failed`/`prompt-rejected` · quyết định hàng rào bước `{kind:"reject"}` / `{...enter, startsRequestSeries:true}` · 9 chuỗi log cảnh báo. |
| 5 | Package gốc có `dsh.client`? | **KHÔNG** (`python3 -c "…json…get('dsh')"` ⇒ `None`; `lib/client.js` không tồn tại) ⇒ **MỘT MẶT**, thay được ngay, không cần nửa client. |

### `config` + `inject` GỐC (lấy từ row ĐANG CHẠY `ours.yml`, KHÔNG phải `oracleA_nopatch.yml`)

```yaml
- id: goal-round-driver
  name: '@deepseek-ai/dsh-goal-round-driver'
```

**Không `config`, không `inject`, không `disabled`** — đã kiểm ở **cả bốn** dump của
`.parity/dumps/2026-10-18T01-31-57/` (`ours.yml` L277 · `oracleA.yml` L251 · `oracleA_nopatch.yml` L214 ·
`stock.yml` L211). Vì **không có `config`**, luật *"`config` dùng `!!js ctx.<X>` thì `inject` phải chứa `<X>`"*
**không áp dụng** — đã kiểm chứ không bỏ qua.

## 3. Peer — vì sao, và vì sao CHỈ có một

| Peer | Vai trò | Vì sao không thể tự viết |
|---|---|---|
| `@deepseek-ai/dsh-llm` | **chạy thật** (`createUserMessage`) | factory message của kernel = `deepFreeze(structuredClone({…, id: randomUUID()}))`. Tự dựng ⇒ **định danh message khác định dạng kernel**, lệch log phiên và lệch mọi phép so với bản gốc. Bảng §3b **bậc 2** đã cho phép `dsh-llm`. |

- `@deepseek-ai/dsh-llm` nằm ở **`peerDependencies`** (một thể hiện do kernel cấp) **và** trong `gbh.peers`;
  **KHÔNG** khai `dependencies` (tạo thể hiện thứ hai). `gbh.peers ⊆ peerDependencies` **1/1 (so PHẦN TỬ)**,
  có **ĐỐI CHỨNG ÂM** (xoá một tên · xoá sạch · thừa tên).
- `@deepseek-ai/cordis` · `dsh-agent` · `dsh-goal` · `dsh-session` · `dsh-subagent` **chỉ mượn KIỂU**
  (`import type`, bị `Bun.build` xoá khỏi artifact) nên nằm ở **`devDependencies`** + symlink trong
  `node_modules/` của chính package — **tiền lệ `approval`** (`dsh-agent` chỉ mượn kiểu) và `workflow`.
  Đây cũng là lý do **không shim ambient** (luật `000d`).

## 4. Bảng TRƯỚC / SAU

| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| `renderGoalRoundPrompt` trên 5 tổ hợp | 1 khối `text` | **trùng từng ký tự** + trùng `JSON.stringify` |
| 17 kịch bản vòng đời (idle · trần vòng · checkpoint hỏng · prompt tranh chấp · 4 nhánh hàng rào bước · `turn/end` · `goal/changed` · `subagents` · fiber ≠ ACTIVE · dỡ plugin) | — | **ảnh chụp giàn giống nhau TỪNG PHẦN TỬ** (cùng log · cùng mã chặn · cùng revision · cùng inbox) |
| Tập export trên ARTIFACT | 4 | **4 = 4** (0 thiếu · 0 thừa), `apply.length` 1 · `renderGoalRoundPrompt.length` 2 |
| `grep -c "id: @deepseek-ai" lib/index.js` | — | **0** |
| `bun test tests/host/goal-round-driver.test.ts` | — | **28 pass · 0 fail · 127 expect** |
| `check:rows` | 98 package **0 chặn** | **99 package · 0 chặn** (gói này KHÔNG khai `gbh.row` ⇒ không vào sổ mount) |
| `gate --no-tests` | 7/7 XANH | **7/7 XANH** (typecheck của cổng tự SKIP vì `ETIMEDOUT` trên 1.394 file; ta chạy `tsc` RIÊNG trên 5 file của gói ⇒ **0 vi phạm**) |

Lệnh tái lập:

```bash
cd packages/host/goal-round-driver && bun run build.ts && grep -c 'id: "@deepseek-ai' lib/index.js   # 0
bun test tests/host/goal-round-driver.test.ts                                                      # 28 pass
bun run check:rows | grep -c "| chan |"                                                            # 0
```

## 5. Phần CHƯA làm (nói thẳng)

- **CHƯA khai `gbh.row`** — theo luật *"khai `gbh.row` = nhận rủi ro mount"*, việc khai thuộc **Lead** ở lượt boot.
  `tests/host/goal-round-driver.test.ts` có **TEST CANH** khẳng định gói **KHÔNG** có `gbh.row`;
  **khi Lead khai thì XOÁ ca đó**, đừng sửa thành `true`.
- **CHƯA chạy `lab:row` · CHƯA mount · CHƯA có `check:app` / A/B** trên app 5439 (thuộc lượt boot của Lead).
- **KHÔNG ship `lib/types/*.d.ts`**: bản gốc có (`./types` qua `types`), ta dùng `import type` từ kernel nên
  không phát sinh bề mặt kiểu riêng; đo được **0** người tiêu thụ `@deepseek-ai/dsh-goal-round-driver/lib/types`.

## 6. Bằng chứng đo được (mọi con số đều đo trên máy này)

- **Tập export**: `apply` · `inject` · `name` · `renderGoalRoundPrompt` — **4 = 4** trên artifact của CẢ HAI bên;
  `"default" in artifact === false`; `inject` trùng **cả phần tử lẫn thứ tự** `["agents","goals","sessions"]`.
- **Đối chứng hành vi**: mỗi ca dựng **HAI giàn giống hệt nhau** rồi chạy **cả hai bản cài**; so ảnh chụp gồm
  `goalCalls` · `flushes` · `logs` · `effectLabels` · `followups` (nguồn + câu lệnh) · `cancels` ·
  `subagentWaits` · `removals` · trạng thái goal · hai ranh giới inbox. **0 lệch** trên cả 17 kịch bản.
- **Ba chi tiết dễ viết sai, đều có ca riêng**:
  1. `disarm` là thao tác **phạm vi tiến trình** ⇒ **KHÔNG đổi `revision`** (khác `pause`/`block`);
     giàn giả của test mô phỏng đúng như vậy, nên ca "revision 3" mới có nghĩa;
  2. `roundsStarted` là dữ kiện **dẫn xuất** (gấp từ log phiên) ⇒ vòng được nhận **không** đổi revision;
     hàng rào sau quyết định kiểm `source.round === roundsStarted + 1` **trước** khi vòng vào phiên;
  3. hàng rào `agent/pre-step` **đặt lại** message KHÁC về `next-step` nhưng **KHÔNG** gọi `inbox.remove`.
- **C6 (danh tính)**: mỗi lượt `renderGoalRoundPrompt` trả **mảng + khối MỚI** (sửa bản này không lan sang bản kia);
  hai giàn riêng cho hai sổ goal độc lập; hai vòng liên tiếp cho **hai message riêng** (`randomUUID` khác nhau).
- **`000e`**: `locale/en.json` + `locale/zh.json` **byte-for-byte** (`shasum` khớp từng file).
- **`000d`**: không thêm `*.d.ts` ambient nào; mọi kiểu kernel lấy qua `import type` + symlink peer trong package.

## 7. Ghi chú kỹ thuật cho người sau

- `ctx.fiber.state === 2` được giữ **nguyên dạng số** như bản gốc: `FiberState` là `const enum` khai trong `.d.ts`
  nên **không có mặt lúc chạy** — `import` nó sẽ làm bundle ném `ReferenceError`.
- `ctx.get("subagents")` trả `any` (cordis) ⇒ ta **ép về mặt cắt hẹp** `SubagentSeam` (một phương thức),
  đúng hình dạng `waitForChildren(parent: Agent): Promise<boolean>` của `@deepseek-ai/dsh-subagent`.
- `agent/created` của kernel khai kiểu trả `undefined | Promise<undefined>` (KHÔNG phải `void`) ⇒ listener phải
  `return undefined;` tường minh, nếu không `tsc --strict` đỏ.
- Test **không** `import` kiểu `@deepseek-ai/*` (thư mục `tests/` không resolve): kiểu của ta suy ra từ
  **chính chữ ký** `Parameters<typeof apply>[0]` / `Parameters<typeof renderGoalRoundPrompt>[0]`.
