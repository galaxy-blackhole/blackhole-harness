<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Quy trinh mount cho M6 (row HOST) — vi sao noi duoc tran 2 row va do gi
-->

# Quy trình mount cho M6 (row HOST)

## 1. Vì sao luật "tối đa 2 row mỗi lượt boot" KHÔNG áp nguyên cho M6

Luật đó ra đời từ một sự cố **row CLIENT**: boot 8 row client cùng lúc làm `#root` **68.760 → 2.673**
(mất **96%**), phải mất **2 lượt boot chỉ để cô lập** thủ phạm.

Nhưng **78 row của M6 là row HOST** — chúng **không có artifact client**, **không vẽ gì lên màn hình**.
⇒ **Chúng KHÔNG THỂ gây ra lớp lỗi "mất nội dung âm thầm" hay "modal bỏ mở".**

| | row CLIENT (M5) | row HOST (M6) |
|---|---|---|
| có bundle client? | **có** | **không** |
| ảnh hưởng `(8)` `#root` / lỗi console? | **có** | **không** |
| có thể gây "modal bỏ mở"? | **có** | **không** |
| rủi ro chính | **UI hỏng / mất nội dung** | **plugin không activate / boot hỏng** |
| phép đo bắt rủi ro | `(8)` `#root` + lỗi console + `overlay-probe` | `(5)` `did not activate` + entry trong manifest |

⇒ **Kết luận: với row host, nới trần lên 4–5 row mỗi lượt boot là hợp lý**, MIỄN LÀ:

1. **0 writer** trong 2 phút gần nhất (luật bất biến — một lượt boot build **TẤT CẢ** gói có `gbh.row`);
2. **`check:rows` = 0 CHẶN, đo HAI LẦN cách nhau** (cổng có thể cho dương tính giả khi có writer);
3. **mỗi row mới phải được xác nhận RIÊNG** trong manifest (xem §3) — không chỉ tin vào con số tổng;
4. nếu `(5)` `did not activate` **tăng**, **gỡ về lô trước** rồi chia nhỏ lại.

## 1c. TRƯỚC KHI KHAI `gbh.row`: đối chiếu **TẬP EXPORT** trên artifact

Row client có **slot**; row host **không có slot** ⇒ **bề mặt service của nó chính là tập export**.
Vì vậy phép kiểm tương ứng với "tập slot" ở M5 là **"tập export"** ở M6.

⚠️ **Không cổng nào bắt được lớp lỗi này**: các cổng chỉ kiểm gói **khai** `gbh.row`, còn một row
**thiếu export** thì gói khác gọi vào sẽ **hỏng lúc chạy** mà cổng vẫn xanh.

```python
# Do tren ARTIFACT cua CA HAI ben (khong doc bao cao cua cong nhan)
#   goc : apps/host/node_modules/@deepseek-ai/dsh-<row>/lib/index.js
#   ta  : packages/host/<row>/lib/index.js
# Trich: export { ... }  +  export function|const|class|let  +  export default
# Ket qua phai la: THIEU = 0  va  THUA = 0
```

**Đã đo 18/10/2026 cho 3 row đầu của M6**: `sandbox-policy` **4 = 4** · `bash-sandbox` **2 = 2** ·
`llm-retry` **5 = 5** — **0 thiếu · 0 thừa** cả ba.

⇒ **Nếu THIẾU export ⇒ KHÔNG khai `gbh.row`** cho tới khi bổ sung: mount một row thiếu bề mặt service
là tự tay tạo ra lớp lỗi *"gói khác gọi vào thì hỏng"* mà **cổng không thấy**.
## 1d. TRƯỚC KHI KHAI `gbh.row`: đối chiếu `gbh.peers` ⊆ `peerDependencies`

Recipe ghi luật: **peer luôn là `peerDependencies`** (kernel cấp **MỘT** thể hiện duy nhất).
Nhưng có **HAI danh sách** phải khớp nhau:

| danh sách | vai trò |
|---|---|
| `gbh.peers` | **metadata của ta** — dùng để sinh khối patch (danh sách `inject`) |
| `peerDependencies` | **hợp đồng với trình quản lý gói** — để kernel cấp đúng một thể hiện |

⇒ **Lệch nhau** nghĩa là: có peer được khai để **inject** mà không được khai để **kernel cấp**
⇒ nguy cơ **HAI thể hiện** hoặc **thiếu phụ thuộc lúc chạy**.

> ⚠️ **PHẢI SO **PHẦN TỬ**, KHÔNG so SỐ LƯỢNG.** Ngày 18/10/2026 tôi đã kiểm bằng cách so `len()` và kết luận
> *'5/6 gói OK'* — **đó là verdict RỖNG**: `peers=8 · peerDeps=10` **không** suy ra được `peers ⊆ peerDeps`.
> ⇒ *Một phép kiểm so số lượng có thể cho ra 'OK' vô nghĩa, và nó **nguy hiểm hơn không kiểm** vì tạo cảm giác đã kiểm.*

```python
# Voi MOI goi: doc package.json roi so TAP HOP PHAN TU
pe = set(gbh["peers"]); pd = set(peerDependencies.keys())
assert pe - pd == set(), "peer thieu trong peerDependencies: " + str(sorted(pe - pd))
```

**ĐỐI CHỨNG CHUẨN — 6 gói host ĐANG MOUNT ĐƯỢC** (đo 18/10/2026, đây là quy ước đã được chứng minh):

| gói đang chạy | `gbh.peers` ∉ `peerDependencies` |
|---|---|
| `account-controller` · `directory-picker-auto` · `open-in-app` · `plugin-inventory` · `webserver` | **KHÔNG** |
| `settings-controller` | 1 tên (`dsh-typert-protocol`) — **tiền lệ ngoại lệ** |

⇒ **Quy ước: 5/6 gói đang chạy có `gbh.peers ⊆ peerDependencies`.** Gói nào lệch thì **sửa cho khớp quy ước**,
và **ghi rõ lý do** nếu muốn giữ ngoại lệ (như `settings-controller`).

**Đã đo 18/10/2026**: `sandbox-policy` 2/2 · `bash-sandbox` 4/5 · `llm-retry` 2/2 ·
`credentials-local` 4/6 · `otel` 8/10 — **OK**; ⚠️ **`jobs-local` lệch: `gbh.peers` 3 nhưng
`peerDependencies` chỉ 2** (thiếu `@deepseek-ai/dsh-scope` · `@deepseek-ai/dsh-timeout` ·
`@deepseek-ai/dsh-jobs`).

⚠️ **Không cổng nào kiểm việc này** — nó không đối chiếu hai danh sách.
⇒ **Phải kiểm tay trước khi khai `gbh.row`.**
## 1e. PHÂN LOẠI ROW TRƯỚC KHI CHỌN: **MỘT MẶT** hay **HAI MẶT**

⚠️ **ĐO `lib/index.js` LÀ KHÔNG ĐỦ.** Ngày 18/10/2026 tôi chọn `session-inspector` vì **6 dòng** và
`cordis-client-runner` vì **11 dòng** — nhưng đó chỉ là **nửa HOST**; nửa **CLIENT** nằm ở `lib/client.js`:

| gói | `lib/index.js` | `lib/client.js` | kết luận |
|---|---|---|---|
| `dsh-experimental-session-inspector` | **6** | **4.244** | hai mặt — **đánh giá thấp 707×** |
| `dsh-cordis-client-runner` | **11** | **7.408** | hai mặt — **đánh giá thấp 673×** |
| `dsh-subagent-spawn-in-process` | 39 | — | một mặt ✓ |

⇒ **Luôn đo CẢ HAI tệp.** `lib/client.js` tồn tại ⇒ row **hai mặt** ⇒ nửa host thường **inert**
(`export { apply }` thân rỗng, 0 lần chạm `ctx`) ⇒ **công việc thật nằm ở nửa client**.

### Công thức cho row HAI MẶT (chốt 18/10/2026)

1. nửa **host** → viết lại như row thường (nó **inert**, rẻ);
2. nửa **client** -> **DE-BUNDLE NGUYÊN VĂN**.

   > ⚠️ **18/10/2026 — SỬA: `tools/split-stock-bundle.ts` được dẫn ở đây nhưng **KHÔNG TỒN TẠI** trong checkout**
   > (công nhân row `api-remotes` phát hiện: `find tools -name split-stock-bundle*` = **0 hit**).
   >
   > Cách **THẬT SỰ** đã de-bundle thành công **HAI** row (`cordis-client-runner` · `session-inspector`), cả hai **byte-identical**:
   > 1. đọc `lib/client.js` gốc, cắt theo **chính các mốc `//#region` của nó** thành `src/parts/*.ts` + `src/styles/*.module.css`;
   > 2. `src/manifest.ts` khai lại thứ tự part để `build.ts` ghép lại **nguyên văn**;
   > 3. **CHỈ ĐỔI MỘT CHỖ DUY NHẤT**: `__ModuleLoader__.load({ id: "@deepseek-ai/…" })` -> `id: "@galaxy-blackhole/gbh-…"`;
   > 4. nghiệm thu bằng **SHA-256 của thân factory + CSS** so bản gốc ⇒ phải **BẰNG NHAU**.
   >
   > ⇒ **Cần de-bundle row thứ ba thì làm đúng 4 bước trên; ĐỪNG đi tìm `split-stock-bundle.ts`.**
   **byte-identical** factory body + CSS ở `ui-conversation` 20.064 dòng · `ui-schedule` · `ui-trajectory`)
   rồi đổi **header `load({id})`** sang id của ta;
3. khai **`gbh.row.moved: true`** — ngoại lệ CÓ TÊN của cổng `hygiene` (`hygiene.ts:55-58`:
   *"gói `moved: true` là DI CHUYỂN (chưa viết lại) — đổi tên nó sẽ phá id bundle"*);
4. kiểm bằng **entry + `(5)` 0 + `(10)` file khớp repo**.

⚠️ **VÌ SAO KHÔNG được mount nửa host rồi bỏ nửa client**: mount sẽ **tắt row stock** ⇒ **mất entry client**
⇒ dịch vụ mà nó cấp **không còn ai cấp**, mà row khác **đang gọi vào** (vd `dsh-client-ui-cordis/lib/client.js:1385`
gọi `ctx.dynamicCordisRunner`) ⇒ **mất chức năng ÂM THẦM**: **0 bundle nào `require` `.../client`** nên
**0 lỗi console**, và **không cổng nào bắt**.
## 2. Trước khi boot

```bash
# 1. Khong co writer nao trong 2 phut gan nhat
find packages tests -newermt '-2 minutes' -type f -not -path '*/node_modules/*' -not -path '*/lib/*' | wc -l
# 2. Cong chan mount: phai 0, va do HAI LAN cach nhau ~20s
bun run check:rows 2>&1 | grep -c '| chan |'
# 3. Liet ke row SE mount moi (doc gbh.row cua cac goi vua sua)
```

## 3. Sau khi boot — xác nhận TỪNG row, không tin số tổng

### ⚠️ CHỈ SỐ `(6)` VÀ `(10)` **KHÔNG** DÙNG ĐƯỢC ĐỂ XÁC NHẬN TỪNG ROW (chốt 18/10/2026)

Đã ba lần tôi đọc sai **đơn vị** của một con số trong cùng một ngày:

| lần | tôi tưởng | thực tế |
|---|---|---|
| 1 | so `len(peers)` là kiểm được `peers ⊆ peerDeps` | phải so **PHẦN TỬ** (*lần này cho verdict RỖNG*) |
| 2 | `(10)` tăng `+2` = đúng 2 gói mới | `(10)` đếm **FILE**, không đếm gói |
| 3 | `(6)` không tăng = row chưa mount | `(6)` đếm **TÊN**: **THAY THẾ 1-1** không làm số đếm đổi |

⇒ **Lần thứ ba là báo động sai thật**: `session-inspector` **đã mount** (tên của ta có trong trang),
nhưng `(6)` vẫn **52** và `(10)` vẫn **135** vì đó là **thay thế**, không phải **thêm** — và tầng nạp còn
sinh **entry alias** cho id gốc nên **cả hai tên** đều có mặt.

### Phép xác nhận TỪNG ROW — dùng ĐÚNG BỐN phép này

| # | phép | đạt khi |
|---|---|---|
| **a** | **tên CỦA TA có trong trang** | `curl` trang (có cookie jar) rồi `grep gbh-<row>` ≥ 1 |
| **b** | **cặp patch** | `- id: <row>` + `disabled: true` **và** `- insert: - id: <row>-ours` |
| **c** | **thư mục profile** | `profiles/node_modules/@galaxy-blackhole/gbh-<row>/lib/` tồn tại (**+ `lib/client.js` nếu row hai mặt**) |
| **d** | **sổ mount** | `check:rows` **và** `hygiene` **+1** so với trước khi khai `gbh.row` |

⇒ `(6)` và `(10)` là **phép kiểm TỔNG THỂ** (*không phục vụ code cũ · không có file lạc*) —
**không** phải phép kiểm từng row.
⚠️ **Bài học thật**: chỉ số `(6)` *'gói CỦA TA đang chạy thật'* là một **PHÉP QUÉT TÊN**
(`tools/check/app-health.ts:131` — `raw.match(/@galaxy-blackhole\/[a-z0-9-]+/g)`), **không** kiểm trạng thái.
⇒ Một gói **có thể đang chạy mà không được đếm**, và một tên **có thể được đếm dù gói đã chết**.

```bash
# Doc payload that, kiem TUNG row moi co entry va co active khong
U=$(cat ~/.galaxy/blackhole/ready-url.txt)
curl -sL -c /tmp/ck.txt -b /tmp/ck.txt "$U"   # PHAI co cookie jar; curl tran luon 401
```

Hoặc dùng `bun run check:app` cho các chỉ số `(5)` · `(6)` · `(8)`, rồi **đọc payload** để xác nhận tên gói mới.

## 4. Bảng nghiệm thu mỗi lượt boot M6

| chỉ số | ngưỡng |
|---|---|
| `(5)` dòng `did not activate` | **0** (hoặc **không tăng** so với lượt trước) |
| `(8)` lỗi console | **0** |
| `(8)` `#root` | **≥ 68.000** — *lưu ý: mốc này dùng để bắt **mất nội dung THẬT**; row host không được làm nó đổi* |
| entry của **từng row mới** trong manifest | **có** |
| `check:rows` | **0 CHẶN** |

## 5. Nếu app hỏng

1. **Gỡ về lô trước** (một dòng `gbh.row_unmounted_ly_do` mỗi row — ghi `ly_do` kèm **số đo**).
2. Boot lại, xác nhận app lành.
3. **Chia lô nhỏ hơn** rồi thử lại — **đừng** thử lại y nguyên lô vừa hỏng.

### ⚠️ HẠNG MỤC M4 — BẪY "NHIỀU ROW DÙNG CHUNG MỘT GÓI" (ghi 18/10/2026)

Ví dụ điển hình: gói `@deepseek-ai/dsh-agent-preset` sinh ra **BỐN row**:
`preset-standard` · `preset-ptc` · `preset-minimal` · `preset-cordis` (ours.yml L777–1379).

**Vì sao `gbh.row` đơn không giải được**: `gbh.row` là **MỘT** cặp `id` + `specifier`,
nên nó chỉ tắt được **MỘT** row stock. Tạo bốn gói `packages/host/agent-preset-*` thì mỗi gói lại
là **bundle thứ hai cho CÙNG một tên package** ⇒ vi phạm **"một bundle ⇒ một id"** và vẫn
không tắt được cả bốn row stock.

**Đường đi đúng**: mở rộng metadata thành **`gbh.rows: [...]`** (mảng), rồi sửa **bốn chỗ**:

| # | chỗ | việc |
|---|---|---|
| 1 | `apps/cli/src/rewrite-metadata.ts` | `parseGbhMetadata` trả `rows: GbhRowMetadata[]`; `renderRewriteBlock` sinh **N khối** |
| 2 | `tools/check/rows.ts` | duyệt **mọi** row trong `gbh.rows`, không chỉ `gbh.row` |
| 3 | `tools/lint/hygiene.ts` | "có test + có dòng §4" áp cho **mỗi** row |
| 4 | `tools/lint/row-ids.ts` + `parity-matrix` | liệt kê đủ N row |

**Kiểm chứng bắt buộc**: sau khi làm, `app.patch.yml` phải có **đủ 4 cặp**
`- id: preset-<x>` + `disabled: true` **và** 4 khối `insert` — và `(6)` phải **tăng đúng số** row mới.

**Cho đến khi có cơ chế đó**: bốn row `preset-*` **ở lại bản gốc** (gói `packages/host/agent-preset`
đã viết xong nhưng **chưa khai `gbh.row`**).
