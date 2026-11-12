<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bàn giao row M6 jobs-local: bảng nguồn đối chiếu G4, lý do peer, bằng chứng parity, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-jobs-local — bàn giao row ~jobs-local~ (M6)

Thay row **~jobs~** của DSH (~@deepseek-ai/dsh-jobs-local~, 868 dòng bundle MỘT FILE) bằng bản viết lại
tại ~packages/host/jobs-local/~. Vai trò: **sổ đăng ký job nền trong tiến trình**, phục vụ seam ~ctx.jobs~.

Trạng thái: **đã viết xong + test xanh + artifact sạch**. **CHƯA khai ~gbh.row~** (chờ Lead boot) ⇒ gói
**không thể mount nhầm**; ~packages/README.md~ §4 đã có dòng (chuẩn bị cho lượt khai của Lead).

## 1. Năm câu hỏi bắt buộc (mục 0 của recipe)

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row có **đang BẬT** không? | **CÓ** — ~bh host --dump-config~ thấy ~{ id: jobs, name: @deepseek-ai/dsh-jobs-local }~ và patch của oracle không tắt nó. Đây là row **nền**: ~tool-bash~ / ~tool-jobs~ / ~tool-pwsh~ / agent đều đọc ~ctx.jobs~. |
| 2 | **Thuần host** hay có mount surface client? | **Thuần host.** Gói gốc **không có khoá ~dsh~** trong ~package.json~, không có ~lib/client.js~, không có ~__ModuleLoader__~. |
| 3 | Cần **seam nào**? | ~extends Service~ (cordis, qua lớp trừu tượng ~JobRegistry~ của ~@deepseek-ai/dsh-jobs~) + ~node:crypto~. Peer ngoài cordis/schemastery: **~dsh-jobs~** (lớp nền + ~JobId~), **~dsh-scope~** (~AnonymousEntries~ / ~ScopedLayers~ / ~scopeOf~ — định tuyến theo scope), **~dsh-timeout~** (~deadline~ / ~timeoutOf~). |
| 4 | **Hành vi đo được** là gì? | 11 phương thức của ~ctx.jobs~ (~start · list · get · read · readAt · kill · wait · remove · attachController~ + ~events.subscribe~) trên bản ghi trong bộ nhớ: id ~<kind>-<16 hex>~, vòng đệm byte có chặn, hàng rào cách ly theo phiên, sự kiện ~registered/progress/stopping/settled/removed/output~, ghi vết ~job/registered~ + ~job/settled~ vào phiên, và bơm nguồn kéo. Đo được TRƯỚC/SAU bằng chính **vết sự kiện + bản chiếu + thông điệp lỗi** (xem §4). |
| 5 | Gói gốc có **~dsh.client~**? | **KHÔNG.** ~python3 -c "import json;print(bool((json.load(open('.../dsh-jobs-local/package.json')).get('dsh') or {}).get('client')))"~ ⇒ ~False~ (gói gốc **không có khoá ~dsh~** nào). ⇒ đây là **row host thuần**, KHÔNG thuộc nhóm bị chặn vì "hai mặt"; cặp disable+insert **không** làm mất nửa client nào. |

## 2. Bảng nguồn đối chiếu (G4)

| Nguồn (CHỈ ĐỌC) | Dòng | Dùng để |
|---|---|---|
| ~apps/host/node_modules/@deepseek-ai/dsh-jobs-local/lib/index.js~ | 868 | Hành vi gốc: 4 vùng ~//#region~ (events · pump · ring · index) |
| ~.../dsh-jobs-local/lib/types/{index,events,pump,ring}.d.ts~ | 177+63+50+39 | Chữ ký công khai, mô tả từng thành viên |
| ~.../dsh-jobs-local/package.json~ | — | Peer gốc: ~dsh-agent · dsh-scope · dsh-jobs · dsh-timeout · cordis~ (+ ~schemastery~ là **dependency**) |
| ~.../dsh-jobs-local/locale/{en,zh}.json~ | — | **LUẬT 000e**: gói gốc CÓ locale ⇒ ta ship lại, chép **byte-for-byte** (~shasum~ khớp: ~d1a2b4f2...~ · ~f81cdd0a...~) |
| ~apps/host/node_modules/@deepseek-ai/dsh-jobs/lib/types/{index,types,view}.d.ts~ | 148+289+94 | Hợp đồng seam: ~JobRegistry~ (abstract, ~super(ctx,'jobs')~), ~JobSpec~ / ~JobView~ / ~JobEvent~ |
| ~apps/host/node_modules/@deepseek-ai/dsh-scope/lib/types/{index,store}.d.ts~ | 110+146 | ~ScopedLayers.effect/chainLayers~ · ~AnonymousEntries.append~ · ~scopeOf~ |
| ~apps/host/node_modules/@deepseek-ai/dsh-timeout/lib/types/index.d.ts~ | 102 | ~deadline(upstream, ms, code)~ · ~timeoutOf(signal, code)~ |

Không chép code: bản viết lại tách module theo **đúng bốn vùng của bundle gốc** (~src/events.ts~ ·
~src/pump.ts~ · ~src/ring.ts~ · ~src/registry.ts~) + ~src/types.ts~ (kiểu nội bộ) + ~src/index.ts~ (điểm vào).

## 3. Vì sao các peer này

- ~@deepseek-ai/cordis~ + ~@deepseek-ai/schemastery~: hai peer **chuẩn** (mọi gói host đều khai), do
  ~mount.ts~ tự symlink về kernel.
- ~@deepseek-ai/dsh-jobs~: **không thể tránh** — ~ctx.jobs~ là một lớp TRỪU TƯỢNG do seam này định nghĩa
  (~class LocalJobRegistry extends JobRegistry~, và ~super(ctx)~ đăng ký service ~jobs~ + gắn hai listener
  nhập học lưu trữ của Workspace). Viết lại seam đó là việc của M3, không phải M6.
- ~@deepseek-ai/dsh-scope~ · ~@deepseek-ai/dsh-timeout~: hai thư viện nội bộ **không phải row** (ROADMAP
  17/10 đã ghi nhận ~dsh-scope~ thuộc nhóm "không thay row được"). Bản gốc dùng chúng cho **định tuyến
  theo scope** và **hạn chờ có mã lỗi** — viết lại hai thứ đó bằng tay là chỗ dễ lệch ngữ nghĩa nhất
  (~chainLayers~ đi lên chuỗi scope; ~timeoutOf~ phân biệt hết hạn với bị huỷ).
- Ba peer này **không** nằm trong đồ thị cài của workspace (không có trong ~bun.lock~) nên **không khai
  ~dependencies~ / ~devDependencies~** cho chúng — chúng là **peer do kernel cấp**. Khai ở **HAI chỗ**:
  ~gbh.peers~ (để ~mount.ts~ biết đường symlink) **và** ~peerDependencies~ (**hợp đồng với trình quản lý gói**:
  kernel cấp đúng MỘT thể hiện — quy ước ~gbh.peers~ ⊆ ~peerDependencies~):

```json
"peerDependencies": {
  "@deepseek-ai/cordis": "~4.0.5",
  "@deepseek-ai/schemastery": "~3.18.5",
  "@deepseek-ai/dsh-jobs": "~0.2.1-alpha.4",
  "@deepseek-ai/dsh-scope": "~0.2.1-alpha.4",
  "@deepseek-ai/dsh-timeout": "~0.2.1-alpha.4"
},
"gbh": { "peers": ["@deepseek-ai/dsh-jobs", "@deepseek-ai/dsh-scope", "@deepseek-ai/dsh-timeout"] }
```

  ~mount.ts~ đọc ~gbh.peers~ để symlink từ ~apps/host/node_modules~ (một instance duy nhất trong tiến trình
  — ADR 0004). Khai vào ~dependencies~ sẽ kéo gói về **bản thứ hai** và phá luật một-instance.

  **Phiên bản** ~0.2.1-alpha.4~ (dải ~0.2.1-alpha.4~) — **cùng dải** các gói host khác đang dùng cho peer
  ~dsh-*~ (~user-questions~ khai đúng dải này cho ~dsh-scope~) và **khớp kernel đang chạy**
  (~apps/host/node_modules/@deepseek-ai/dsh-jobs~ = ~0.2.1-alpha.4~).

  **Quy ước đã đo trên 6 gói host đang mount được**: ~gbh.peers~ ⊆ ~peerDependencies~ (5/6 gói **0 tên lệch**;
  ~settings-controller~ là **ngoại lệ DUY NHẤT** — lệch 1 tên ~dsh-typert-protocol~). Gói này **theo quy ước,
  KHÔNG giữ ngoại lệ**. Ca test ~gbh-jobs-local · quy ước khai peer~ canh nó **theo PHẦN TỬ** (không so số
  lượng) kèm **ĐỐI CHỨNG ÂM**: xoá một peer khỏi ~peerDependencies~ ⇒ test **ĐỎ** (đã đo thật, xem §4).

## 4. Bằng chứng (đo trên ARTIFACT, không đọc src/)

| Phép đo | Kết quả |
|---|---|
| ~bun run build.ts~ | **601 dòng** ~lib/index.js~ (ESM, ~packages: external~) |
| ~grep -c 'id: "@deepseek-ai' lib/index.js~ | **0** (row host thuần — không có ~__ModuleLoader__~ nào) |
| Tập export artifact **của ta** | ~["LocalJobRegistry", "TASK_WAIT_TIMEOUT", "default"]~ |
| Tập export artifact **gốc** | **y hệt** (so bằng cách đọc chính hai file build + ~import()~ thật) |
| ~bun test tests/host/jobs-local.test.ts~ | **13 pass / 0 fail · 42 expect** (8 ca cũ + **5 ca quy ước peer**) |
| ~gbh.peers~ ⊆ ~peerDependencies~ | **0 tên lệch** (so **PHẦN TỬ**: ~missingPeers(manifest) === []~), cả ba peer ~~0.2.1-alpha.4~ = **đúng dải kernel** |
| **ĐỐI CHỨNG ÂM** của ca quy ước | tiêm lỗi THẬT: xoá ~@deepseek-ai/dsh-jobs~ khỏi ~peerDependencies~ ⇒ **3 test ĐỎ · exit 1**; hoàn nguyên ⇒ ~sha256~ **khớp** (~9ed90e7f…~) |
| ~bun run check:rows~ | gói **không khai ~gbh.row~** ⇒ không vào bảng; **0 dòng ở cột ~chan~** |
| ~locale/{en,zh}.json~ | ~shasum~ **khớp byte-for-byte** với bản gốc |

### Bốn ca test bắt buộc + ca thứ năm (tập export)

1. **Hành vi chính — ĐỐI CHỨNG với chính bundle gốc**: cùng một kịch bản (đăng ký · tiến độ · kết thúc ·
   ~wait~ · ~read~ x2 · ~readAt~ x2 · ghi sau khi chốt · ~kill~ · ~remove~ · ma trận 9 đường lỗi · 12 dòng
   vết sự kiện) chạy trên **cả hai bản** trong **context cordis THẬT** rồi so **từng dòng**: **bằng nhau**.
2. **Ca BYTE**: offset là **byte UTF-8**, không phải ký tự (~"ếếếế"~ ⇒ ~total=12~ trong khi số ký tự là 4);
   phần cắt đầu vẫn **an toàn theo điểm mã** (không có ~U+FFFD~); vết của ta **bằng** vết gốc ở cả ba
   bước cắt (~retainBytes: 8~).
3. **Đường lỗi (không treo)**: ~kind~ rỗng · ~label~ rỗng · ~outputLimitBytes: 0~ · ~readAt(-1)~ ·
   ~wait(0)~ · ~remove~ job còn sống · id lạ — **đúng thông điệp của gốc, từng chữ**.
4. **An ninh**: job của phiên A **không** hiện với phiên B và với người gọi không phiên; thông điệp lỗi
   **không rò nhãn job** (~bi-mat-42~).
5. **Tập export (bắt buộc thêm)**: đo trên ARTIFACT — đọc ~export {...}~ của hai file build **và** gọi
   ~import()~ thật; khẳng định ~id: "@deepseek-ai~ = 0 ở cả hai bundle.
6. **Quy ước khai peer** (5 ca): ~gbh.peers~ ⊆ ~peerDependencies~ **theo phần tử** · peer phải **có thật**
   trong kernel · **KHÔNG** nằm trong ~dependencies~ · **đối chứng âm 1**: xoá MỘT peer ⇒ báo **đúng tên đó**
   (và xoá sạch ⇒ báo **đủ cả ba**) · **đối chứng âm 2**: **thừa** tên trong ~peerDependencies~ vẫn ĐẠT
   (quy ước là ⊆, **không phải =** — nên đừng so số lượng).

Ca phụ: **bơm nguồn kéo** (nhãn luồng · nguồn mất byte ⇒ ~gapBefore~ · nguồn NÉM lỗi bị bọc),
**dọn dẹp theo owner** (scope thật của ~dsh-scope~: ~cancel("owner disposed")~ ⇒ ~settled:teardown~ ⇒
~removed~), **dọn dẹp service** (cancel ném ⇒ ép hỏng ĐÚNG bản ghi đó), **chưa gắn controller** ⇒ ~start~
từ chối, **trần job đồng thời**.

### Bảng TRƯỚC/SAU

| Chỉ số | TRƯỚC (row gốc) | SAU (row của ta) |
|---|---|---|
| Vết 19 dòng của kịch bản vòng đời | (chuẩn) | **giống từng dòng** |
| Vết 6 dòng của kịch bản byte | (chuẩn) | **giống từng dòng** |
| Vết 2 dòng của kịch bản bơm | (chuẩn) | **giống từng dòng** |
| Tập export artifact | ~LocalJobRegistry · TASK_WAIT_TIMEOUT · default~ | **y hệt** |
| ~gbh.peers~ ⊆ ~peerDependencies~ | (gốc khai 5 peer) | **0 tên lệch** (3 peer seam, ~~0.2.1-alpha.4~) |
| Trên **app 5439** | — | **CHƯA ĐO** (chưa mount — xem §5) |

Lệnh tái lập:

```bash
cd galaxy-blackhole/blackhole-tauri
bun run packages/host/jobs-local/build.ts     # build artifact
bun test tests/host/jobs-local.test.ts        # 13 pass / 0 fail
grep -c 'id: "@deepseek-ai' packages/host/jobs-local/lib/index.js   # 0
```

## 5. Phần CHƯA làm (điều kiện chặn mount)

- **CHƯA khai ~gbh.row~** — đúng luật: chỉ Lead khai sau khi boot và đo. Gói **không thể mount nhầm**;
  ~package.json~ hiện chỉ có ~gbh.peers~ (chưa có ~gbh.row~).
- **CHƯA chạy ~lab:row~ / ~scripts/restart-host.sh~** và **CHƯA có TRƯỚC/SAU trên app 5439** (5439 do Lead
  giữ; người viết không được tự boot). ⇒ Nghiệm thu còn thiếu: ~check:app~ 11 chỉ số · số entry ·
  ~did not activate~ = 0 · chỉ số (8) ~#root~ · (9) bố cục.
- **CHƯA có bằng chứng "hai lần chạy" trên app thật** cho chuỗi ~registered → output → settled~ của
  ~tool-bash~ (đó là phép đo mạnh nhất cho row NỀN này: chạy một job thật rồi ~job_output~ / ~job_kill~).
  Trong phòng test thì đã đối chứng từng dòng với bundle gốc.
- **~Config~ vẫn do Schemastery cấp** (4 khoá: ~maxConcurrentJobsPerOwner~ · ~retainBytes~ ·
  ~settledRetainBytes~ · ~pumpPollMs~) — nếu Lead khai ~gbh.row.config~ thì phải khai **đúng bốn khoá kiểu
  số** này, sai kiểu là ~start~ không chạy.
- Chưa đo **rò bộ nhớ dài hạn** (bản ghi sống tới khi ~remove~ / dọn dẹp — y bản gốc).

## 6. Ghi chú kỹ thuật đáng nhớ cho người sau

- **Một điểm KHÁC HÌNH DẠNG có ý**: bản gốc dùng cú pháp ~using~ (~__addDisposableResource~) để giải phóng
  deadline; bản viết lại gọi ~[Symbol.dispose]~ qua một helper nội bộ (~disposeDeadline~) trong ~finally~.
  Ngữ nghĩa y hệt (xoá hẹn giờ ở nhánh ~finally~) nhưng **không phụ thuộc lib chuẩn của chương trình có
  khai báo ~Symbol.dispose~ hay không**.
- **Bẫy đã cắn thật khi test**: một producer có ~done~ **không bao giờ thoả** và ~cancel~ không làm gì ⇒
  ~disposeOwned~ / ~disposeAll~ **treo** (đúng như mô tả "a cancel that returns without settling … may
  stall"). Ca test vì vậy dùng producer **tuân thủ** (cancel ⇒ ~done~ thoả).
- **Context trong test là context cordis THẬT** nạp theo đường dẫn (~apps/host/node_modules/...~) — cùng
  **một instance** với ~dsh-jobs~ / ~dsh-scope~ mà artifact import, nên không có bản cordis thứ hai.
- **~ctx.get("agents")~** trong ~resolveOwner~ là chủ ý (không đọc thuộc tính) — giống bản gốc; job có chủ
  cần sổ agent đang sống.
