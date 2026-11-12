<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README gói @galaxy-blackhole/gbh-session-inspector (HAI MẶT): nguồn đối chiếu, lý do peer, cách de-bundle
      nửa client 4.244 dòng thành 6 lát + 1 module CSS, bảng TRƯỚC/SAU, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-session-inspector

Bản viết lại của Galaxy Blackhole cho **HAI MẶT** của row **`session-inspector`** của DSH
(`@deepseek-ai/dsh-experimental-session-inspector`, tier T5 — experimental). Nửa host của bản gốc
chỉ là **entry khám phá KHÔNG làm gì** (6 dòng build); toàn bộ bề mặt thanh tra phiên nằm ở **nửa CLIENT**
(4.244 dòng) — nay đã **de-bundle NGUYÊN VĂN** thành **6 lát + 1 module CSS**, thân factory byte-identical (§6).

## 1. Nguồn đối chiếu (G4)

| # | Nguồn (CHỈ ĐỌC) | Đọc gì | Mức dẫn xuất |
|---|---|---|---|
| 1 | `apps/host/node_modules/@deepseek-ai/dsh-experimental-session-inspector/lib/index.js` (**6 dòng**) | toàn bộ thân: `function apply() {}` + `export { apply }` | **viết lại trung thành từng hành vi** (một hàm rỗng, không tham số) |
| 2 | `…/lib/types/index.d.ts` (4 dòng) | hợp đồng công khai: `apply(): void` | tham chiếu |
| 3 | `…/lib/client.js` (**4.244 dòng**) | bán kính nổ: bundle đăng ký **MỘT** id module (`@deepseek-ai/dsh-experimental-session-inspector`), 17 primitive, ~52 khoá từ điển, có trạng thái sống | **CHỈ ĐỌC để đo** — KHÔNG viết lại ở M6 (§6) |
| 4 | `…/package.json` | `dsh.client` **CÓ** (`inject` 5 gói, `platform: "web"`), peer duy nhất `@deepseek-ai/cordis`, `exports` có `./client` + `./locale/*.json` | tham chiếu |
| 5 | `…/locale/{en,zh}.json` | `meta.title` ("Session Log" / "会话数据诊断") dùng làm tiêu đề hàng ở màn Plugins | **chép byte-for-byte** — sha256 khớp: `c6c2f5f0…` · `9a872809…` |
| 6 | `docs/PARITY-MATRIX.md` dòng 251 (row 197) · `docs/contracts/data/dsh-packages.json` dòng 4342 | row ↔ gói gốc; `disabled: false` | tham chiếu |
| 7 | `.parity/dumps/2026-10-17T23-25-26/{ours,oracleA}.yml` dòng 1367/1347 | **xác nhận cặp row**: `- id: session-inspector` + `name: '@deepseek-ai/dsh-experimental-session-inspector'` | bằng chứng bước 0 (đã khớp, không phải bẫy định danh) |

Đối chiếu **từng phần** của nửa host:

| Phần | Bản gốc | Bản của ta | Kết quả (đo trên ARTIFACT) |
|---|---|---|---|
| Tập export | `apply` (1 tên) | `apply` (1 tên) | **bằng** — 1 = 1, 0 thiếu · 0 thừa |
| Thân `apply` | rỗng, **0 tham số**, không đọc `ctx`/`config` | y hệt | `apply.length` **0 = 0**; Proxy đếm **0 lần chạm** ở cả hai bên |
| Tác dụng phụ | không service/slot/route/event/tệp/log | y hệt | artifact: **0** `require` · **0** `__ModuleLoader__` · 0 id module |
| `dsh.client` | **CÓ** (nửa browser) | **KHÔNG** — thiếu **CÓ CHỦ Ý** | xem §6: row hai mặt ⇒ chưa mount được |
| `locale/*.json` | en + zh | chép **byte-for-byte** | sha256 khớp cả hai |
| Peer | `@deepseek-ai/cordis` | **không cần** | §2 |

## 2. Peer — vì sao (không) cần, và đối chứng luật 1d

Nửa host **không import gì**: không `extends Service`, không seam, không `node:` builtin. Vì vậy gói khai
`"gbh": { "peers": [] }`, **không** có `peerDependencies` và **không** có `dependencies` — cả ba là khẳng định
**CÓ TEST** (ca 5), để lần sau không ai thêm một peer "cho chắc" mà không có lý do.

**Đối chứng chuẩn (M6-MOUNT-PLAN §1d) — so PHẦN TỬ, đo 18/10/2026:**

| gói | `gbh.peers` | `peerDependencies` | thiếu |
|---|---|---|---|
| `account-controller` | 1 | 2 | **0** |
| `directory-picker-auto` | 0 | 1 | **0** |
| `open-in-app` | 0 | 2 | **0** |
| `plugin-inventory` | 1 | 2 | **0** |
| `webserver` | 0 | 2 | **0** |
| `settings-controller` | 1 | 0 | **1** — ngoại lệ **đã ghi** (`@deepseek-ai/dsh-typert-protocol`) |
| **`session-inspector` (gói này)** | **0** | **0** | **0** |

Test có **đối chứng âm** (một tên trong `gbh.peers` mà không có trong `peerDependencies` **phải bị bắt**),
**đối chứng dương** trên gói đang chạy có peer thật (`account-controller`), và vòng kiểm trên **cả 6 gói đang chạy**.

## 3. Bề mặt phải khớp (đo trên ARTIFACT `lib/index.js`)

| Hạng mục | Giá trị |
|---|---|
| Export | `apply` — **đúng một tên**, không `default` (bản gốc cũng không có) |
| Chữ ký | `apply(): void` — **0 tham số**, trả `undefined`, không đọc `ctx`/`config` |
| Tác dụng phụ | **không** — 0 service · 0 slot · 0 route · 0 event · 0 tệp · 0 log |
| Id module | **0** — nửa host không đăng ký id nào (`__ModuleLoader__` không xuất hiện) |
| Locale | `locale/en.json` · `locale/zh.json` byte-for-byte, khai `exports["./locale/*.json"]` |

## 4. TRƯỚC/SAU và lệnh tái lập

| Phép đo | TRƯỚC (bản gốc) | SAU (bản của ta) |
|---|---|---|
| Tập export trên artifact | `apply` | **`apply` — y hệt** |
| `Object.keys(await import(artifact))` | `["apply"]` | **`["apply"]`** |
| `apply.length` | 0 | **0** |
| Số lần đọc `ctx` khi gọi `apply(proxy, config)` | 0 | **0** |
| `grep -c 'id: @deepseek-ai' lib/index.js` | 0 (nửa host) | **0** |
| `grep -c 'id: @galaxy-blackhole' lib/index.js` | — | **0** |
| `locale/{en,zh}.json` sha256 | `c6c2f5f0…` · `9a872809…` | **khớp từng byte** |

```bash
cd packages/host/session-inspector && bun run build.ts     # ⇒ lib/index.js (ESM, 5 dòng)
grep -c 'id: @deepseek-ai' lib/index.js                     # ⇒ 0
cd ../../.. && bun test tests/host/session-inspector.test.ts  # ⇒ 6 pass / 0 fail / 47 expect
bun run check:rows                                         # gói này: 0 dòng (chưa khai gbh.row), 0 dòng chan
bun run tools/lint/gate.ts --no-tests                       # các cổng của gói này XANH
```

**Vì sao KHÔNG có bảng TRƯỚC/SAU trên app 5439**: gói CHƯA khai `gbh.row` (§6) nên chưa mount; và row này
**hai mặt**, nên mount bản chỉ-có-host sẽ **làm mất** màn Session Log. Mọi phép đo ở trên đều trên **artifact**
hoặc **đối chứng trực tiếp với chính bundle gốc**.

## 5. Test

`tests/host/session-inspector.test.ts` — **18 ca / 122 expect**, 0 fail; mọi phép so đều chạy **cả hai bản**:

1. **ARTIFACT (host)**: build bằng chính `build.ts` ra thư mục tạm, so **tập export** với bundle gốc bằng **đúng
   bốn khuôn regex của `tools/check/rows.ts`**, so `Object.keys` của module đã nạp ⇒ `[apply]`, không `default`.
2. **Hành vi host**: `apply()` là **inert** — `apply.length` 0 = 0, Proxy NÉM nếu bị đọc/ghi `ctx` ⇒ 0 lần chạm,
   gọi nhiều lần liên tiếp đều `undefined`, nhận cả `null` · số · `Symbol` · `bigint` mà không ném.
3. **KHAI BÁO ROW**: `gbh.row` đủ `id/aliases/moduleIds/tests` (**KHÔNG còn `moved`**), id stock **chỉ** ở `aliases`;
   `dsh.client.inject` = **đúng 5 id module của gói gốc** + `platform: "web"`; `exports["./client"]` có mặt.
4. **LUẬT MỘT id**: artifact client có **đúng 1** lời gọi `load()`, id = **tên package** = `moduleIds[0]`;
   `grep -c "id: @deepseek-ai" lib/client.js` = **0**.
5. **LUẬT 000e**: `locale/*.json` sha256 **khớp gốc**, JSON bằng nhau, `meta.title` = "Session Log".
6. **Luật peer 1d**: gói này 0 ⊆ 0; **đối chứng âm** (tên lạ **bị bắt**); vòng kiểm **6 gói đang chạy**.
7. **DE-BUNDLE byte-identical**: 6 lát ≤1000 dòng, ghép lại ⇒ thân factory **4.238 dòng · 167.963 byte ·
   SHA-256 `048c62c0…6cc36e5`** = bản gốc; artifact chứa thân ấy **nguyên văn liền mạch**; **1 khối CSS**
   bằng từng byte (6.679 byte) và điểm thay thế xuất hiện đúng 1 lần.
8. **ĐỐI CHỨNG ÂM**: đổi 1 ký tự **GIỮ NGUYÊN ĐỘ DÀI** trong một lát ⇒ **SHA ĐỎ** (phép so độ dài vẫn xanh);
   hoàn nguyên ⇒ xanh. Đã chạy cả **trên đĩa**: `50`→`51` ở part-04 ⇒ 3 ca đỏ (byte + artifact + đối chứng),
   `cp` bản gốc lại ⇒ **18 pass**.
9. **CHẠY THẬT trong `window` giả**: artifact đăng ký **1** factory, `exports = [apply, inject]`,
   `inject` **6 service** = gốc; bản gốc chạy cùng giàn cho kết quả **bằng hệt** (đối chứng dương).
10. **ĐỐI CHIẾU EXPORT/SLOT** (task-16, bảng kỳ vọng dựng từ **bundle đang cài**; đọc **mọi** file `.js` trong
   `lib/` của gốc — cùng phạm vi `readStockClient` của `tools/check/rows.ts`, không chỉ `lib/client.js`):

   | Bảng kỳ vọng (đo từ gói gốc) | Gói gốc | Ta (src) | Ta (artifact) |
   |---|---|---|---|
   | export nửa host | `[apply]` | `[apply]` (`src/index.ts`) | `[apply]` (`lib/index.js`) |
   | export nửa client | `[apply, inject]` | — | `[apply, inject]` |
   | slot | `[sidebar.right.pane.tab]` | **= gốc** | **= gốc** |
   | id module tĩnh | 1 (id gốc) | — | **1** = tên package ta |

   ⇒ **ĐÃ BỎ `gbh.row.moved: true`** nên `check:rows` **CHẠY đối chiếu thật** cho gói này (trước đó cờ
   `moved` làm cổng **bỏ qua toàn bộ** phép so export/slot). Đo lại: **0 dòng `chan`**, chỉ còn cảnh báo
   "bản mount cũ hơn mã nguồn" (chờ lượt boot của Lead).

## 6. Nửa client — ĐÃ XONG (de-bundle NGUYÊN VĂN); còn lại là MOUNT

1. ✅ **Nửa CLIENT đã có**: `lib/client.js` sinh từ **6 lát** `src/parts/*.ts` (≤881 dòng/lát, cắt đúng
   `//#region` của tsdown) + **1 module CSS** `src/styles/inspector.module.css` (6.679 byte, giữ hash lớp
   `GTtnTq_*`), ghép theo `src/manifest.ts`. Thân factory **TRÙNG TỪNG BYTE** bản gốc
   (**4.238 dòng · 167.963 byte · SHA-256 `048c62c05f3d97ee8e83d3feae39e625f6292e22ff9530ad5a157fb186cc36e5`**),
   và artifact chứa thân ấy như một chuỗi con LIỀN MẠCH (không thụt lề lại) — test khẳng định.
2. ✅ **ĐÚNG MỘT id**: `window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-session-inspector" })`;
   id gốc **CHỈ** ở `gbh.row.aliases`. `dsh.client.inject` (5 id) + `platform: "web"` y bản gốc.
3. ✅ **Đã khai `gbh.row`** — **18/10/2026 (task-16): BỎ `moved: true`** vì gói đã có `src/` + `build.ts`
   để đối chiếu; giữ cờ đó chỉ làm `check:rows` bỏ qua phép so export/slot. Nay cổng chạy đủ và **0 `chan`**.
   **21 test / 130 expect**, gồm ĐỐI CHỨNG ÂM: đổi 1 ký tự **giữ nguyên độ dài** trong một lát ⇒ SHA ĐỎ
   (phép so độ dài vẫn xanh).
4. ⬜ **CHƯA mount · CHƯA `lab:row` · CHƯA TRƯỚC/SAU trên app 5439** (`check:app` 11 chỉ số · parity 0/0/0)
   — thuộc lượt boot của Lead.

## 7. Năm câu hỏi bắt buộc (mục 0 của công thức)

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row có đang BẬT không? | **CÓ** — `docs/contracts/data/dsh-packages.json` dòng 4342: `"disabled": false`; `oracleA.yml` dòng 1347 **không** có dòng `disabled:` (đo trên dữ liệu đã trích; KHÔNG chạy `bh host --dump-config` vì lệnh đó ghi lại patch của app đang chạy) |
| 2 | Thuần host hay có mount surface client? | **HAI MẶT** — nửa host **6 dòng, inert**; nửa client **4.244 dòng** (thanh tra log phiên + Chat group/node) |
| 3 | Cần seam nào? | Nửa host: **KHÔNG**. Nửa client: module loader của trình duyệt + 5 `inject` (`locale` · `ui-conversation` · `ui-sidebar-right` · `ui-session` · `ui-renderer`) — thuộc M5, không phải M6 |
| 4 | Hành vi đo được là gì? | Nửa host: **entry activate KHÔNG tác dụng phụ** — đo bằng `apply.length` = 0, **0 lần chạm `ctx`**, 0 export thừa, 0 id module. Toàn bộ hành vi nhìn thấy được (màn *Session Log*) nằm ở **nửa client — CHƯA có** |
| 5 | Gói gốc có `dsh.client` không? | **CÓ** (`inject` 5 gói, `platform: "web"`) ⇒ **hai mặt** ⇒ luật §0 câu 5: cặp disable+insert **xoá nửa client** khỏi đồ thị boot. Đây là lý do gói này **chưa được mount** (§6) |
