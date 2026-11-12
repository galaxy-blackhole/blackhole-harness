<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Cong thuc chuan de thay MOT row cua DSH bang package cua ta — ap dung cho M4/M5/M6
-->

# Công thức: thay một row DSH bằng package của ta

> Viết ngày 17/10/2026, sau khi hoàn thành 3 gói host đầu tiên. Mục đích: bất kỳ ai (kể cả phiên sau)
> cũng làm đúng ngay từ lần đầu, không phải phát minh lại quy trình.


> 🔴 **LỆNH KHỞI ĐỘNG DUY NHẤT: `scripts/restart-host.sh`**
> Đừng chép tay lệnh khởi động. Ba sự cố liên tiếp ngày 17/10/2026 đều do chép tay:
> `bun` không có trong PATH của shell agent · `DSH_HOME=~/.galaxy/gbh` rò từ phiên agent vào · cổng 5439 còn bị tiến trình cũ giữ.
> Script tự làm cả ba (đường dẫn tuyệt đối, gỡ hai biến home, chờ cổng nhả) rồi **tự xác minh bằng `check:app` trước khi báo xong**.
## ✅ BẮT ĐẦU Ở ĐÂY — checklist 12 bước cho MỘT row

Tài liệu này 400+ dòng vì mỗi mục là một sự cố thật. Nhưng khi làm một row, bạn chỉ cần đi theo 12 bước dưới;
mỗi bước có link tới mục giải thích đầy đủ. **Đừng đọc tuần tự từ đầu.**

> ## ⚠️ GỠ MOUNT: `gbh.row_unmounted_ly_do` LƯU DẠNG `{ ly_do, row }` — ĐỌC `ly_do` TRƯỚC KHI ĐỔI
>
> Khi phải gỡ mount một row (row làm app hỏng, hoặc nửa UI chưa xong), khuôn là: **chuyển `gbh.row` → `gbh.row_unmounted_ly_do`** với giá trị là **một object `{ ly_do, row }`** — `row` giữ **nguyên** nội dung row cũ để mount lại là **một dòng**, còn `ly_do` là **chỗ chứa chẩn đoán của người gỡ mount**.
>
> ⚠️ **HAI BẪY ĐÃ CẮN THẬT (17-18/10/2026)**:
> 1. **Đổi sang dạng `row` trần** (không bọc `{ ly_do, row }`) ⇒ `lab:row` báo *'chưa khai `gbh.row`'* và người sau **mất chẩn đoán** (tm-ui-features vấp đúng ca này).
> 2. **Đọc `gbh.row` mà không phòng `undefined`** ⇒ test đỏ bằng `TypeError` (Lead gỡ mount lần hai làm ca test `meta.gbh.row.moduleIds` nổ). ⇒ Test phải đọc **cả hai dạng**: `meta.gbh.row ?? meta.gbh.row_unmounted_ly_do?.row`, và khẳng định *'gỡ mount KHÔNG được phép phá hợp đồng `moduleIds`/`aliases`'*.
>
> **Trước khi đổi khoá, ĐỌC `ly_do`** — nó thường nói rõ điều kiện mount lại (ví dụ: *'mount lại khi `lab:row` 0 lỗi console VÀ 7 file UI điền xong'*). Ca thật: chính `ly_do` đó giúp tm-ui-features đọc được chẩn đoán `React #130` của người gỡ mount trước.

> ## ⚠️ LUẬT VÀNG (thêm 17/10/2026): **LAND = CHẠY `lab:row` TRƯỚC, RỒI MỚI BÁO.**
>
> Lý do có SỐ: `ui-settings-general` land mốc *khung + wiring* mà **không chạy lab** ⇒ gói đã khai `gbh.row` ⇒ **được mount** ⇒ 7 file UI còn rỗng (`() => null`) ⇒ slot renderer ném **`React #130`** ⇒ **màn Settings hỏng**, app phải **gỡ mount** và tốn **một cửa sổ boot của Lead** để phát hiện điều `lab:row` đã nói được **ngay tại máy người viết**.
>
> Và một luật liền kề, cùng sự cố đó: **KHAI `gbh.row` = NHẬN RỦI RO MOUNT.** Chỉ khai khi `apply` chạy sạch **trong lab**. Gói chưa khai `gbh.row` thì **không thể làm hỏng app** — đó là trạng thái an toàn để viết dở (tm-client giữ `file-upload` ở trạng thái này suốt nhiều vòng).
>
> Hệ quả cho row chiếm slot: `slots.register` cho slot **kiểu list** **BẮT BUỘC có `id`** — và **id phải lấy NGUYÊN VĂN từ bundle bản gốc**, không tự đặt tên (ca thật: `shell.overlay` cần `id: "host-release-change"`; đặt sai id của row khác ⇒ `list slot … requires options.id` ⇒ `apply` ném ⇒ cả trang chết).

| # | Việc | Ở đâu |
|---|---|---|
| 0 | Đo **hồ sơ chi phí** trước khi nhận: `bun run row:cost <row-id>` ⇒ primitive · khoá từ điển · có trạng thái sống không. **Xếp lịch theo điểm, không theo số dòng** | [Ước lượng theo hồ sơ chi phí](#-ước-lượng-theo-hồ-sơ-chi-phí-không-theo-số-dòng--lệnh-bun-run-rowcost-row) |
| 1 | Trả lời **5 câu hỏi** (câu 5: package gốc có `dsh.client` không?) | [mục 0](#0-trước-khi-viết--4-câu-phải-trả-lời-được) |
| 2 | `bun run new:row <row-id>` — khung **không** tự khai `gbh.row`; an toàn cho tới khi bạn chủ động bật | [mục 1](#1-tạo-package-không-chạm-file-dùng-chung-nào) |
| 3 | Đọc bản gốc **CHỈ ĐỌC** (`.d.ts` + `lib/*.js`), đo bản đồ hành vi, rồi **viết lại** — không chép code | [mục 0](#0-trước-khi-viết--4-câu-phải-trả-lời-được) |
| 4 | Viết nửa client: **id module = id bundle tự khai**; bundle phải nạp được bằng **thẻ script** (CJS bọc `__ModuleLoader__.load`, KHÔNG ESM); khai `moduleIds` nếu dùng khuôn CJS-bọc-IIFE | [mục 6](#6-nếu-sai-thì-gỡ-được-trong-1-lệnh) |
| 5 | Viết test: tối thiểu 4 ca; **stub phải có ĐÚNG hình dạng module thật** (rộng hơn là che lỗi); với row thuật toán, **đối chứng với chính bundle gốc** | [mục 3](#3-test--tối-thiểu-4-ca) |
| 6 | `bun run check:rows` **sạch** + `bun run gate` **XANH 6/6** | [mục 00](#00-trước-khi-mount--chạy-hai-lệnh-này-bắt-buộc) |
| 7 | Boot thử **home tạm + cổng riêng** (không đụng app thật); kiểm `did not activate` = 0, `#root` bằng đường nền, 0 lỗi console | [mục 4b](#4b-nghiệm-thu-phải-gồm-sức-khoẻ-toàn-app-không-chỉ-ma-trận-của-gói) |
| 8 | Mount thật: `bh host` **tách khỏi phiên** (`nohup … & disown`), rồi `bun run check:app` — **đọc cả chỉ số (8)(9)(10)** | [mục 000](#000-vận-hành-app-5439-phải-sống-ngoài-phiên-agent-bài-học-17102026) |
| 9 | Chạy **CẢ HAI lớp đo**: pixel A/B + chỉ số *phần tử lạ*. Bề mặt chỉ-hiện-theo-trạng-thái ⇒ tự dựng trạng thái rồi soát DOM, và **dán nhãn 'không so với oracle'** | [hai lớp đo](#-hai-lớp-đo-bổ-sung-nhau--phải-chạy-cả-hai-trước-khi-báo-xong-row-client) |
| 10 | Ghi tài liệu: README gói (G4 + TRƯỚC/SAU + phần **chưa làm**) · `packages/README.md` §4 · 1 dòng ROADMAP | [mục 4](#4-mount-và-đo--bảng-trướcssau-là-thứ-bắt-buộc) |
| 11 | Complete task kèm bàn giao. **Trước khi báo một vi phạm cho người khác, chạy lại lệnh ngay lúc đó** | — |

**Nếu row chưa xong bề mặt**: gỡ `gbh.row` + viết **test canh** (khẳng định gói KHÔNG có `gbh.row`) rồi mới viết tiếp — xem [mục 7](#-khi-row-chưa-xong-bề-mặt-gỡ-khai-báo--viết-test-canh-mẫu-17102026).

---
## 000. VẬN HÀNH: app 5439 phải SỐNG NGOÀI PHIÊN AGENT (bài học 17/10/2026)

Sự cố thật: host 5439 được khởi động như **background job của một phiên agent**; khi phiên đó kết thúc, host **chết theo** ⇒ app mất, mọi phép đo sau đó vô nghĩa. Không ai nhận ra cho tới khi `check:app` báo đỏ toàn bộ.

**Luật**: mọi lần khởi động host phải **tách khỏi phiên**:
```bash
cd <repo>
P=$(lsof -ti tcp:5439 2>/dev/null | head -1); [ -n "$P" ] && kill $P
for n in $(seq 1 15); do lsof -ti tcp:5439 >/dev/null 2>&1 || break; sleep 1; done
nohup env -u DSH_HOME -u GBH_HOME ~/.bun/bin/scripts/restart-host.sh > /tmp/host5439.log 2>&1 &
disown 2>/dev/null || true
```
rồi chờ ~80 giây tới khi `bun run check:app` trả **10/10 ĐẠT** mới báo xong. Đừng để app phụ thuộc vào vòng đời

> 🔴 **BẢN CŨ CỦA LỆNH NÀY ĐÃ LÀM CHẾT APP (17/10/2026).** Câu lệnh ghi `nohup scripts/restart-host.sh` — nhưng **`bun` KHÔNG có trong PATH** của shell agent.
> Một thành viên chép đúng tài liệu này ⇒ dòng lỗi duy nhất trong log là `nohup: bun: No such file or directory` ⇒ app chết ~10 phút.
> **Ba thứ bắt buộc**: (a) đường dẫn **tuyệt đối** `~/.bun/bin/bun`; (b) `env -u DSH_HOME -u GBH_HOME` (biến `DSH_HOME=~/.galaxy/gbh` có sẵn trong phiên agent là home **chỉ-đọc** ⇒ `profile "blackhole" does not exist` ⇒ app chết); (c) chờ cổng nhả **trước khi** bật, không thì `exit code 3`.
> **Bài học**: khi một sự cố lặp lại ba lần, hãy đọc lại TÀI LIỆU mình đã viết trước khi đi tìm ai chép sai. của một phiên agent.

### Hai bẫy nữa của row client (đã gặp thật, mỗi cái làm entry chết)

3. **Cú pháp ESM trong bundle client ⇒ `SyntaxError`** khi bộ nạp tải bằng thẻ `<script>`. Cách chữa: để `src/client.ts` chỉ còn hai lời gọi đăng ký + `export {};`, tách hằng số/factory sang `src/plugin.ts`, và build nửa browser sang **CJS**.
4. **Package trong `profiles/node_modules` phải nằm ĐÚNG TÊN PACKAGE**, không phải tên thư mục row. Sai tên ⇒ `Cannot find package` ⇒ entry chết. (Kiểm bằng `ls <profile>/node_modules/@galaxy-blackhole/`.)
## 000b. 🔴 LUẬT RESTART: KHÔNG ai tự tắt app 5439 — và `bun` KHÔNG có trong PATH

**Sự cố 17/10/2026 (lần thứ BA trong một phiên):** một thành viên tắt app để lấy "cửa sổ mount", rồi khởi động lại bằng `nohup scripts/restart-host.sh`. Nhưng `bun` **không có trong PATH** của shell ⇒ dòng lỗi duy nhất trong log là `nohup: bun: No such file or directory`, app **chết hẳn**, và log cũ bị ghi đè nên mất luôn dấu vết phiên đang chạy.

### Luật
1. **Không ai tự tắt app 5439.** Cần mount thì nhắn Lead (hoặc người đang giữ lượt restart) — không tự làm.
2. Nếu bạn *được* giao restart, dùng **đường dẫn tuyệt đối tới bun** và gỡ hai biến home:
```bash
cd <repo>
P=$(lsof -ti tcp:5439 2>/dev/null | head -1); [ -n "$P" ] && kill $P
for n in $(seq 1 15); do lsof -ti tcp:5439 >/dev/null 2>&1 || break; sleep 1; done
nohup env -u DSH_HOME -u GBH_HOME /Users/<ban>/.bun/bin/scripts/restart-host.sh > /tmp/host5439.log 2>&1 &
disown 2>/dev/null || true
```
3. **Ghi log ra file KHÁC nếu bạn không phải người restart** — đừng `>` vào `/tmp/host5439.log`.
4. Sau ~80 giây: `bun run check:app` phải trả **10/10 ĐẠT**. Chưa ĐẠT thì **báo ngay**, đừng im lặng làm việc khác — người dùng đang mở app.

### Vì sao `env -u DSH_HOME -u GBH_HOME`
Phiên agent chạy **bên trong một DSH host** đã có sẵn `DSH_HOME=~/.galaxy/gbh` (home **chỉ-đọc** của kernel, có cổng `gate:home-isolation` canh). Biến đó rò vào lệnh khởi động ⇒ app đi tìm profile trong home chỉ-đọc ⇒ `Error: dsh: profile "blackhole" does not exist` ⇒ **app chết**. Đã xảy ra thật và tốn 6 phút. **Một biến môi trường có sẵn trong phiên KHÔNG phải là cấu hình của app.**

### Và: lab KHÔNG dùng `bh host`
`bh host` **luôn nhắm home thật của app** — nó là công cụ khởi động app, không phải công cụ lab. Muốn lab cách ly thì chạy **harness trực tiếp** với `DSH_HOME=<home lab>` (mục 000).

---
## 000c. 🧪 PHÒNG LAB MỘT LỆNH: `bun run lab:row <row-id>`

Từ 17/10/2026 không phải dựng lab bằng tay nữa. Lệnh này làm hết:
1. tạo home tạm `/tmp/gbh-lab-<row-id>`; 2. seed profile `blackhole` vào đó (qua `GBH_HOME`);
3. build gói rồi copy vào `profiles/node_modules/<TÊN PACKAGE>`; 4. sinh overlay tắt row stock + chèn row của ta;
5. boot harness ở **cổng riêng 5460**; 6. in URL và lệnh dọn.

```bash
bun run lab:row ui-goal
# LAB SAN SANG
#   home  : /tmp/gbh-lab-ui-goal
#   goi   : @galaxy-blackhole/gbh-client-ui-goal  (thay row ui-goal -> ui-goal)
#   URL   : http://127.0.0.1:5460/?token=...
#   don dep: kill $(lsof -ti tcp:5460) ; rm -rf /tmp/gbh-lab-ui-goal
```

**Ba bảo đảm của công cụ**: (a) **không đụng app thật** — nó đặt `GBH_HOME` và `DSH_HOME` về home lab, nên cả `ready-url.txt` lẫn profile đều nằm trong lab; (b) **không cần bật `gbh.row` trên repo** — đây là lý do nó tồn tại; (c) gói được copy **đúng tên package** (sai tên là entry chết).

Đã kiểm chứng: lab `ui-goal` trả trang **49.359 byte**, **id của ta có (1)**, **id gốc mất (0)**.

⚠️ Lab cần gói đã **khai `gbh.row`** (nó lấy `gbh.row.id` làm mốc để tắt row stock). Gói chưa khai thì dùng overlay tay như mục dưới.

---
**Hai điều tm-parity-b gặp thật khi dùng `lab:row` (17/10/2026):**
1. **`lab:row` tìm theo TÊN THƯ MỤC package**, không phải row id: `bun run lab:row directory-picker-auto` ✅ — `bun run lab:row directory-picker` ❌ (báo 'chua khai gbh.row' dù gói có).
2. **Overlay của lab có thể TRÙNG** với khối disable+insert mà `app.patch.yml` đã sinh ⇒ sinh thêm một row `-ours` thứ hai ở trạng thái `failed` (hai instance cùng package). Đó là **artefact của lab**, không phải lỗi gói — app thật chỉ có MỘT row và nó active. Nếu nghi ngờ, so với cây của `app.patch.yml`.
## 000d. 🧨 LUẬT: `*.d.ts` KHAI BÁO AMBIENT LÀ **TOÀN CỤC** — đừng dùng nó làm shim

**Sự cố 17/10/2026, mất hai người một vòng.** Một gói thêm `src/schemastery.d.ts` để shim một peer không resolve được. Hệ quả:
· khai báo ambient **toàn cục** ⇒ nó **đè type thật** của cùng module ở **mọi gói khác** trong chương trình;
· `typecheck` nhảy từ 0 lên **18 vi phạm** ở những file **không ai đụng tới** (`packages/host/webserver` · `open-in-app`);
· triệu chứng **lúc đỏ lúc xanh**, phụ thuộc **thứ tự file** mà `tsc` đọc ⇒ trông y như **lỗi ngẫu nhiên**;
· Lead và chủ hai gói host mất trọn một vòng đi tìm nguyên nhân **trong hai file hoàn toàn đúng**.

**Cách đúng**: tạo **symlink (hoặc cài) peer thật** trong `node_modules` của **chính package** đó — theo đúng quy ước bun workspace của repo. Không shim ambient, không `declare module` toàn cục.

**Dấu hiệu nhận biết sớm**: typecheck đỏ ở file bạn không sửa, hoặc đỏ/xanh thay đổi giữa hai lần chạy mà `git status` sạch ⇒ **nghi ngay một `*.d.ts` ambient mới được thêm ở đâu đó**. Tìm bằng:
```bash
find . -name '*.d.ts' -not -path '*/node_modules/*' -not -path '*/target/*'
```

---
## 000e. 📄 LUẬT: gói PHẢI ship `locale/en.json` + `locale/zh.json` (nếu bản gốc có)

**Phát hiện 17/10/2026 (tm-lint-docs), đo lại bằng số**: bản gốc ship `locale/*.json` cho **60** gói client;
ta có **1/31**. File này chứa `meta.title`, và runtime dùng nó làm **tiêu đề hàng trong màn Plugins**:
```js
pkg.meta?.title === undefined ? pkg.name : resolveText(...)
```
Thiếu file ⇒ tiêu đề rơi về **tên package của ta** ⇒ **KHÁC oracle** ở màn `plugins-installed`.

⚠️ **`parity:dump` KHÔNG bắt được lỗi này** (nó so danh sách row trong config, không so chữ trên UI).
Chỉ **A/B pixel + phần tử lạ** trên màn `plugins-installed` mới thấy.

**Việc bắt buộc cho mọi row**:
```bash
ls <gói-gốc>/locale/                      # bản gốc có không?
cp <gói-gốc>/locale/{en,zh}.json packages/client/<gói>/locale/
shasum packages/client/<gói>/locale/*.json   # phải KHỚP byte-for-byte với bản gốc
```
và thêm `"./locale/*.json"` vào `exports` của `package.json`.

---
## 00. TRƯỚC KHI MOUNT — chạy hai lệnh này (bắt buộc)

```bash
bun run check:rows     # moi package co gbh.row phai: build duoc · import duoc · DU EXPORT ma ban goc co · nua client co dang ky id
bun run check:app      # 6 chi so suc khoe cua app dang chay + goi nao CUA TA dang chay that
```

**Vì sao bắt buộc**: `bh host` sinh patch từ **MỌI** package có `gbh.row` trong repo. Nghĩa là **một gói viết dở cũng đủ làm hỏng app ở lần restart tiếp theo của bất kỳ ai** — không chỉ của người viết nó. `check:rows` bắt được trước khi điều đó xảy ra (nó vừa bắt đúng 1 gói thiếu `apply`).

**Phân biệt hai loại cổng** (dễ nhầm): `check:rows` chỉ nói *"mount KHÔNG làm hỏng app"* — `Bun.build` bỏ kiểu nên **một gói có thể ĐẠT `check:rows` mà vẫn còn lỗi typecheck**. Vì vậy **vẫn phải chạy `bun run gate`** trước khi báo xong. Hai lệnh trả lời hai câu hỏi khác nhau: `check:rows` = *có làm hỏng app không?* · `gate` = *code có sạch không?*

**Luật**: chỉ khai `gbh.row` khi gói **đã chạy được**. Đang viết dở thì **gỡ khai báo** — gói vẫn nằm trong repo, chỉ không được mount.

**Bài học khi viết công cụ kiểm tra**: một phép kiểm **im lặng bỏ qua** còn tệ hơn không có phép kiểm. Bản đầu của `check:rows` tra sai đường dẫn gói gốc nên **bỏ qua cả 8 gói** mà vẫn in *'tất cả đạt'* — kết luận vô nghĩa mà trông như thành công. Nay nó **báo rõ** khi không tra được bản gốc.
## 0. Trước khi viết — 4 câu phải trả lời được

| # | Câu hỏi | Cách trả lời |
|---|---|---|
| 1 | Row này có **đang BẬT** không? | `bh host --dump-config` — nhiều row bị patch của oracle tắt (`disabled: !!js …`) |
| 2 | Nó **thuần host** hay có mount surface client? | Đọc `.d.ts` + tìm `loader.create/resolve` — nếu có surface thì **hoãn sang M5** |
| 3 | Nó cần **seam nào**? | `extends Service` (cordis) · `TypertRemoteService` (typert) · `node:` builtins. Ngoài bảng §3b ⇒ **dừng, hỏi Lead** |
| 4 | **Hành vi đo được là gì**? | Một route HTTP · một RPC · một tệp nó ghi · một dòng log. Phải đo được TRƯỚC và SAU |

### ⚠️ CÂU HỎI THỨ 5 (bắt buộc, phát hiện 17/10/2026): package gốc có `dsh.client` không?

```bash
python3 -c "import json;print(bool((json.load(open('<gói>/package.json')).get('dsh') or {}).get('client')))"
```

**Vì sao quan trọng**: id entry trong `__DSH_BOOT__` là **TÊN PACKAGE mà row trỏ tới**, KHÔNG phải id row. Nếu package gốc là **hai mặt** (`dsh.client` = có nửa browser), thì cặp disable+insert sẽ **xoá luôn nửa client khỏi đồ thị boot** ⇒ mọi bundle `require("<gói gốc>/client")` trượt bảng module ⇒ **UI chết**.

Sự cố thật đã xảy ra: thay row `typert-gateway` ⇒ mất nửa client của `@deepseek-ai/dsh-api-gateway` ⇒ **63 entry pending** ⇒ trang teo từ 48.882 B xuống **68 B**.

**Quy mô (đo trên 205 row)**:

| Tier | Một mặt (thay được ngay) | **Hai mặt (bị chặn)** |
|---|---|---|
| T2 host/API | 8 | **8** |
| T3 client/UI | 0 | **58** |
| T4 | 71 | 2 |
| T1 | 31 | 1 |
| T5 | 6 | 4 |

⇒ Mọi row UI (T3) đều hai mặt, nên **M5 phải tự giải bài toán nửa client** — nó chính là công việc của M5.

**Cách xử lý** (chọn 1):
1. **Hoãn row** tới khi ta có nửa client của mình (mặc định).
2. Package của ta **khai `dsh.client`** và nửa client **đăng ký ĐÚNG MỘT id: id CỦA TA** (`window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-<vai trò>", factory })`). Id gói gốc **KHÔNG** đăng ký trong bundle — nó thuộc **`gbh.row.aliases`**, và tầng nạp tự sinh entry alias trỏ về **CÙNG URL bundle** để các bundle phụ thuộc tìm thấy. ⇒ **Xem §8** (đính chính 17/10/2026: đăng ký id stock ở đây làm bundle chạy HAI lần ⇒ `duplicate factory registration` / `service … has been registered` ⇒ app trắng).
## 1. Tạo package (không chạm file dùng chung nào)

```text
packages/<nhóm>/<tên>/
  package.json   ← tên @galaxy-blackhole/gbh-<nhóm>-<tên> + peer (chỉ 3 gói seam) + khối gbh.row
  build.ts       ← build ra lib/index.js (ESM, node, packages: external)
  src/index.ts   ← plugin
  README.md      ← BẢNG NGUỒN ĐỐI CHIẾU (G4) + lý do peer + bảng TRƯỚC/SAU
```

Khối metadata trong `package.json` — đây là thứ khiến `bh host` tự sinh khối patch:

```json
"gbh": {
  "row": {
    "id": "<id row stock bi tat>",
    "inject": ["…"],
    "config": { "field": "literal", "expr": { "js": "ctx.something ?? 1" } },
    "tests": ["tests/host/<tên>.test.ts"]
  },
  "peers": ["@deepseek-ai/dsh-typert-protocol"]
}
```

`tests` không phải trang trí: nó nối ràng buộc G4 (*row đã thay phải có bằng chứng hành vi*) vào dữ liệu máy kiểm được.

### 1b. KHUNG MẪU — sao chép từ gói host ĐANG CHẠY, đừng tự dựng lại

Mục 1 ở trên cho **cấu trúc thư mục**; còn **hình dạng thật** của `package.json`/`build.ts`/`src/index.ts`
thì **đã có sẵn trong repo** — 7 gói host đang chạy thật:

| gói | dùng làm mẫu khi |
|---|---|
| `packages/host/open-in-app` | **row nhỏ nhất** — mẫu gọn nhất để bắt đầu |
| `packages/host/directory-picker-auto` | row nhỏ, có seam |
| `packages/host/settings-controller` | row có **schema Config** + nhiều bề mặt service |
| `packages/host/account-controller` | row có **peers** (`gbh.peers`) |
| `packages/host/plugin-inventory` | row đọc/ghi **kho plugin** |
| `packages/host/typert-gateway` | **RPC/typert** — xem thêm mục *"Nếu row là một RPC (typert)"* |
| `packages/host/webserver` | row thay **tầng HTTP** |

⇒ **Cách làm nhanh nhất**: mở gói mẫu gần row của bạn nhất, **đọc `package.json` + `build.ts` + `src/index.ts`**
của nó, rồi viết gói mới theo **đúng hình dạng đó**. Đừng phát minh lại cấu trúc —
các cổng (`hygiene`, `check:rows`, `dep-guard`) đã được thiết kế quanh hình dạng ấy.

⚠️ **Nhưng KHÔNG chép nội dung nghiệp vụ** — chỉ chép **hình dạng**. Nội dung phải đối chiếu
với **bundle gốc của chính row bạn** (mục 2 dưới đây).
## 2. Viết plugin — luật bất biến

1. **Không chép code.** Đọc `.d.ts` + `lib/*.js` của gói gốc trong `apps/host/node_modules` (chỉ đọc) để nắm HÀNH VI, rồi viết lại.
2. **Chỉ `node:` builtins** + peer trong bảng §3b. Peer luôn là **peerDependencies** (một instance do kernel cấp).
3. Giữ nguyên **bề mặt service**, tên event, schema `Config`.
4. **Tầng vận chuyển phải coi thân phản hồi là BYTE** — `Buffer.isBuffer` **hẹp hơn** `ArrayBuffer.isView`.
   Đây là bài học đắt nhất của dự án (bug `String(Uint8Array)` phá mọi RPC, ADR 0004 §8).
5. Header 5 dòng · file ≤1000 dòng · mọi function export có mô tả (làm gì · nhận gì · trả gì).

### Nếu row là một RPC (typert)

```text
endpoint  = namespace + "/" + (exportName ?? method)     // vd pluginInventory/list
discovery = ctx.reflect.props → type==="service" → ctx.get(key) → originalOf()
            → Reflect.get(original, "typertRemote")  (namespace phải là string)
            → remoteMethods(original)
gắn vào transport = ctx.inject(["connection"], c => c.connection.rpc.intercept("/api", claim, dispatch))
```

Ma trận lỗi đã đo (mốc chuẩn — đừng tự phát minh mã lỗi khác):

| Tầng | Ca | Kết quả |
|---|---|---|
| Vận chuyển | JSON hỏng | **400** + text thuần `body is not JSON` |
| Vận chuyển | `content-type` sai | **415** + text thuần `content type must be application/json` |
| Vận chuyển | GET thay POST | **404** `not found` |
| Giao thức | `type`/`rpcId`/`method`/`payload` sai | **HTTP 200** + `gateway/bad-request` |
| Giao thức | `payload` rỗng / nhiều trường / `args` không phải object | **HTTP 200** + `gateway/internal` |

### ⚠️ Ranh giới tầng: row gateway KHÔNG tự parse envelope

Đo được khi viết `typert-gateway` (17/10/2026) — **đọc kỹ trước khi viết một row RPC**, nếu không sẽ viết thừa một tầng:

Chữ ký thật của điểm gắn vào tầng vận chuyển:
```js
ctx.inject(["connection"], (c) => {
  c.connection.rpc.intercept("/api",
    (endpoint) => claim,                                   // endpoint ĐÃ BÓC
    (endpoint, payload, signal, peer) => dispatch);        // payload ĐÃ BÓC
});
```

⇒ **Seam `connection` (vẫn là của DSH) tự parse envelope** rồi mới đưa cặp `(endpoint, payload)` cho gateway. Hệ quả cho ma trận 12 ca:

| Ca | Việc của ai |
|---|---|
| 2 · 3 · 4 (`type`/`rpcId`/`method`/`payload` sai ⇒ `gateway/bad-request`) | **seam `connection`** — chưa phải của ta cho tới M6 |
| 8 · 9 · 11 (400 `body is not JSON` · 415 content type · 404 `not found`) | **seam `connection`** — như trên |
| 5 · 6 · 7 (`payload` rỗng / nhiều trường / `args` không phải object ⇒ `gateway/internal`) | **row gateway** |
| 10 (method không khớp endpoint) · 12 (echo `rpcId`) · 1 (ok) | **row gateway** |

Vậy `gateway.ts` chỉ gồm: kiểm `payload.args` ⇒ `gateway/internal` · discovery · dispatch (nhánh local trước, rồi quét; không khớp ⇒ `gateway/invocation-unavailable`; binding lệch ⇒ `gateway/binding-invalid`) · encode `server-response` bằng `wire.ts`.
**Không viết lại nửa vận chuyển.** Ghi rõ trong README package: *"6/12 ca thuộc seam connection, chưa phải của ta cho tới M6"* — để người sau không tưởng ta đang sở hữu phần đó.

Một chi tiết nữa: `originalOf(receiver)` **không import từ đâu** — nó là helper nội bộ của gateway:
`Reflect.get(receiver, symbols.original) ?? receiver`, với `symbols` import từ `@deepseek-ai/cordis` (peer hợp lệ). Dùng đúng cách đó, không cần gói mới.
### 2b. PEER CHO NHÓM ROW **T4 EXECUTOR** (chốt 18/10/2026, theo đề nghị của row `bash-sandbox`)

Các row **executor** (`bash-sandbox` · `pwsh-sandbox` · `tool-*`) **không thể** chỉ dựa vào bảng §3b,
vì chúng **kế thừa lớp cha thật** của DSH và **gọi seam của row khác**.

**Nhóm peer đã được cấp phép** (ma trận `PARITY-MATRIX.md` dòng 42, cột *Phụ thuộc*):

| row | peer bắt buộc | vì sao |
|---|---|---|
| `bash-sandbox` | `dsh-bash-local` | **kế thừa** `LocalBashExecutor` — phải là **CÙNG một lớp**, không phải bản sao |
| `bash-sandbox` · `pwsh-sandbox` | `dsh-sandbox` | gọi `ctx.sandbox.confine` |
| `bash-sandbox` · `pwsh-sandbox` | `dsh-sandbox-policy` | gọi `ctx.sandboxPolicy` |
| `bash-sandbox` · `pwsh-sandbox` | `dsh-shell` | seam `ctx.shell` |
| `tool-*` | `dsh-tools` + seam của tool | đăng ký tool vào sổ tool |

⇒ **Cách kiểm quan hệ kế thừa** (đã dùng thật cho `bash-sandbox`):

```js
Object.getPrototypeOf(OurClass) === Object.getPrototypeOf(StockClass)   // phải TRUE
```

⇒ Nếu **FALSE** thì ta đang có **hai lớp cha khác nhau** ⇒ hành vi sẽ lệch và **cổng không thấy**.

⚠️ **Nhóm peer này KHÔNG được khai vào `dependencies`** — phải là `peerDependencies` + `gbh.peers`
(một thể hiện do kernel cấp; xem mục *'KHUNG MẪU'* và `M6-MOUNT-PLAN.md` mục `1d`).
### §3b. BẢNG PEER ĐƯỢC PHÉP (tạo 18/10/2026 — TRƯỚC ĐÓ BẢNG NÀY KHÔNG TỒN TẠI)

⚠️ **LỖI TÀI LIỆU ĐÃ SỬA**: tài liệu này **nhắc `§3b` ba lần** (*'Chỉ `node:` builtins + peer trong bảng §3b'* …)
nhưng **bảng chưa bao giờ được viết** — công nhân row `web-startup` phát hiện:
*"bảng §3b được nhắc 3 lần trong `HOST-ROW-REWRITE.md` nhưng KHÔNG tồn tại trong tài liệu"*.
Bảng dưới đây được **dựng từ bằng chứng**: đếm `gbh.peers` của **mọi gói host đang có trong repo**.

**Bậc 1 — KERNEL/CORE, luôn được phép**

| peer | dùng ở |
|---|---|
| `@deepseek-ai/cordis` | **8 gói** — kernel, mọi plugin đều cần |
| `@deepseek-ai/schemastery` | 3 gói — schema `Config` |

**Bậc 2 — SEAM DỊCH VỤ CỦA DSH, được phép khi row thật sự gọi seam đó**

| peer | dùng ở | lý do điển hình |
|---|---|---|
| `dsh-llm` | 6 | `HarnessError`/`LlmError` — cần **cùng lớp** (`instanceof`) |
| `dsh-typert-protocol` | 4 | `TypertRemoteService` + `@Remote` |
| `dsh-tools` | 3 | đăng ký tool vào `ctx.tools` |
| `dsh-scope` | 2 | `scopeTarget`/`carrierKeyOf` — vật mang **không thể tự chế** |
| `dsh-subagent` | 2 | `registerProvider` (nhóm T4 executor, xem `2b`) |
| `dsh-shell` | 2 | seam `ctx.shell` |
| `dsh-credentials` | 2 | `CredentialProvider` |
| `dsh-jobs` · `dsh-timeout` · `dsh-session-projection` · `dsh-system-prompt` · `dsh-working-directory` · `dsh-fs` · `dsh-otel` · `dsh-web-app` | 1 mỗi cái | seam tương ứng |
| `dsh-bash-local` · `dsh-sandbox` · `dsh-sandbox-policy` | 1 mỗi cái | nhóm executor — xem `2b` |
| `dsh-home-paths` · `dsh-atomic-write` | 1 mỗi cái | tiện ích hạ tầng của DSH |

**Bậc 3 — THƯ VIỆN BÊN THỨ BA (npm thật, phải có trong `peerDependencies`)**

| peer | ghi chú |
|---|---|
| `chokidar` · `yaml` · `commander` · `got` · `zod` (`zod/v4`) | thư viện thường |
| `@opentelemetry/{api,api-logs,core,otlp-exporter-base,otlp-transformer,resources,sdk-logs}` | chỉ trong row telemetry |

⇒ **LUẬT**: peer **ngoài bảng** ⇒ **xin Lead duyệt** và **ghi một dòng lý do ĐO ĐƯỢC** trong `README.md` của gói
(*'cần `instanceof` của kernel'* · *'vật mang `carrierKeyOf` không thể tự chế'* · …).
⇒ **Peer LUÔN là `peerDependencies`** (một thể hiện do kernel cấp) **và** phải có trong `gbh.peers`;
**KHÔNG** khai vào `dependencies` (tạo thể hiện thứ hai). Kiểm bằng `M6-MOUNT-PLAN.md` mục `1d` — **so PHẦN TỬ**.
## 3. Test — tối thiểu 4 ca

1. **Hành vi chính**: cùng input → cùng output như bản gốc.
2. **Ca byte**: thân đi qua `Uint8Array`/`DataView`/`ArrayBuffer` phải đọc đúng byte (khẳng định `String(view)` KHÁC bản đúng).
3. **Đường lỗi**: input sai → đúng mã lỗi, **không treo**.
4. **An ninh** (nếu có route): không cookie ⇒ 401; và phải xác nhận **không rò dữ liệu** trong thân phản hồi lỗi.

## 4. Mount và đo — bảng TRƯỚC/SAU là thứ bắt buộc

```bash
cd <repo> && scripts/restart-host.sh        # mount + boot; xác nhận 200 rồi mới báo xong
bh doctor                            # xem dòng rewrite + brand
bun run gate && bun test tests/host
```

Đo **cùng một phép đo** trước và sau, và ghi vào README package:

| Ví dụ (gói `plugin-inventory`) | TRƯỚC | SAU |
|---|---|---|
| `pluginInventory/list` | 200 · 215 entry · active 178 | 200 · **216 entry** · active **178 (không đổi)** |
| `enabled: false` | 37 | 38 |
| Diễn giải | — | +1 = row của ta; +1 disabled = row stock bị tắt |

**Nguyên tắc đọc số**: mọi chênh lệch phải **giải thích được bằng đúng cơ chế disable+insert**. Số đang chạy (`active`) không được đổi.

## 4b. NGHIỆM THU phải gồm SỨC KHOẺ TOÀN APP, không chỉ ma trận của gói

Bài học 17/10/2026 (sự cố UI chết): gói `typert-gateway` mount xong, **7/7 ca hành vi khớp oracle** — nhưng **app chết**: trang teo từ 48.882 B xuống **68 B**, 63 entry pending.
Nghiệm thu khi đó chỉ kiểm *tính năng của gói* mà không kiểm *app còn sống không*. Đó là lỗ hổng của tiêu chí, không phải của người làm.

**Từ nay, mỗi lần mount phải đo đủ 4 dấu hiệu sức khoẻ** trước khi nói 'xong':

```bash
bun run check:app        # in 1 bang 5 chi so va ket luan 'app LANH' / 'KHONG LANH'
```

Lệnh này (`tools/check/app-health.ts`) là **thước đo chung của cả team** — đừng mỗi người tự ghép lệnh `curl`. Nó kiểm: (1) trang trả về (ngưỡng 40 KB) · (2) có `__DSH_BOOT__` · (3) số entry ≥ 70 · (4) số batch + release · (5) số dòng `did not activate` = 0. Thoát mã 0 khi app lành, 1 khi không — dùng được trong script.

Kiểm thêm bằng mắt hai thứ mà lệnh không tự biết: **row của ta có mặt trong cây** (`bh host --dump-config | grep '<id>-ours'`) và **chỉ số 'đã thay N row' tăng đúng 1**.

Và **trước khi chạm cổng 5439**, mọi thay đổi rủi ro phải chạy thử trên **home cách ly + cổng riêng** (như tm-client đã làm với `/tmp/gbh-m5b` + cổng 5452): đếm entry trong `__DSH_BOOT__`, đếm lỗi console, xem UI render đủ. Chỉ khi 0 lỗi mới mount thật.
## 5. Kiểm tra lần cuối — 4 dấu hiệu

1. `parity:dump` → `THÊM 0 · THIẾU 0 · ĐỔI 0` và **`đã thay N row` tăng đúng 1**.
2. Log boot có dòng `[bh] rewrite OK @galaxy-blackhole/gbh-…` và **0 dòng lỗi**.
3. `parity:trace` sạch (nếu row phục vụ route/RPC).
4. Ma trận ảnh A/B không hồi quy (nếu row ảnh hưởng UI).

## 6. Nếu sai thì gỡ được trong 1 lệnh

```bash
GBH_DISABLE_REWRITES=1 scripts/restart-host.sh   # bỏ MỌI mount, quay về row DSH; app vẫn boot
```

Đây là lưới an toàn cho mọi thử nghiệm. Đừng bao giờ sửa tay file patch để gỡ.

### ⚠️ ĐẾM ĐÚNG SỐ ID MODULE — đừng nhầm với id của slot occupant

**ĐÍNH CHÍNH 17/10/2026**: bản đầu của mục này nói *'bundle gốc đăng ký id package + id CHUNK'* — **SAI**, do đọc nhầm một `id:` trong `ctx.slots.register(...)` thành id module.

Quy tắc đúng:

| Loại id | Ở đâu | Có vào bảng module không? |
|---|---|---|
| **id module** | trong `__ModuleLoader__.load({ id: …, factory })` | **CÓ** — nhưng bundle của TA đăng ký **ĐÚNG MỘT** id (id của ta); id stock đi qua `gbh.row.aliases` ⇒ xem §8 |
| **id slot occupant** | trong `ctx.slots.register({ name, id })` | **KHÔNG** — chỉ là định danh occupant trong slot |

· Bundle gốc **thường đăng ký MỘT id module**. Một số bundle có **chunk thật** (thêm tham số `chunk:`) thì đăng ký thêm — phải đọc bản gốc để biết, đừng đoán.
· Bản viết lại đăng ký **MỘT id module: id CỦA TA** (id CHÍNH, cho HMR `rev`). Id stock **KHÔNG** đăng ký trong bundle — khai nó ở **`gbh.row.aliases`** để tầng nạp phát entry alias dùng cùng URL (một bundle ⇒ một plugin). ⚠️ **ĐÍNH CHÍNH 17/10/2026**: bản đầu của mục này viết *'cần 2 id module'* — đó là **nguồn sinh** của lớp lỗi hai-id; chính `tools/scaffold/new-row.ts` chép theo câu đó. Xem **§8**.
· Các `id` trong `slots.register` **vẫn phải tái hiện y như gốc**, nhưng ở đúng chỗ của nó — không liên quan tới bảng module.

Cách tìm đúng: đếm **mọi** lời gọi `__ModuleLoader__.load({ ... })` trong bundle gốc (không chỉ lời gọi đầu), và **đừng** đếm các `id:` nằm trong `slots.register` / `inject` / cấu hình khác.
Phép đếm này cho biết **những id nào bundle GỐC phục vụ** — để ta khai chúng ở **`gbh.row.aliases`** (nếu gói khác cần), **KHÔNG** phải để thêm lời gọi `load()` vào bundle của ta.
### ⚠️ NỬA CLIENT PHẢI LÀ MODULE (có `import`/`export`), nếu không sẽ đụng biến toàn cục

Phát hiện 17/10/2026 khi kiểm công cụ sinh khung: file `.ts` **không có `import`/`export` nào** bị TypeScript coi là **SCRIPT TOÀN CỤC** ⇒ mọi `const` ở cấp cao nhất trở thành **biến toàn cục**, và hai package client khác nhau khai cùng tên (ví dụ `factory`, `loader`) sẽ **đụng nhau**: `TS2451 Cannot redeclare block-scoped variable`.

Với ~59 row client của M5, đây là lỗi sẽ xuất hiện **hàng loạt** và rất khó hiểu (file này báo lỗi vì file kia).

**Luật**: mọi file nửa client phải kết thúc bằng `export {};` (hoặc có `import`/`export` thật) để được coi là module.
### ⚠️ Bundle nửa client phải nạp được bằng THẺ SCRIPT (không phải ESM import)

Phát hiện 17/10/2026 (tm-m5a): bộ nạp nạp bundle client bằng **thẻ `<script>`**, nên file build ra phải là **CJS/script classic**, KHÔNG được chứa cú pháp ESM.

Cái bẫy tinh vi: `Bun.build` với `format: "esm"` **BỎ** `export {}` khi file không export gì thật ⇒ bản build trông 'sạch' và chạy được. Nhưng hễ nửa client export một thứ THẬT (`export function apply` hoặc `export const createPlugin`) thì ESM sinh ra `export {…}` ⇒ **SyntaxError** khi nạp bằng thẻ `<script>`.

Vì vậy với row client, hãy build nửa browser sang **CJS** rồi bọc đăng ký `__ModuleLoader__.load({id, factory})` — đừng dựa vào việc 'bản build hiện chưa có cú pháp ESM'.

### Độ tin cậy của `check:rows` — nó đọc VĂN BẢN, nên có thể báo oan

Phép so slot tìm tên slot bằng mẫu văn bản (`slots.inject("X")` / `slots.register({ name: "X" })`). Nếu bạn khai tên slot qua **hằng số** (`const SLOT_NAME = "plugins.item"` rồi truyền biến), công cụ **sẽ không thấy** và báo thiếu ⇒ **dương tính giả**.

**Quy ước**: viết tên slot **nguyên văn tại chỗ đăng ký**. Nếu buộc phải dùng hằng số, hãy kiểm bằng tay (payload `/plugins` của app phục vụ thật + log boot) trước khi kết luận gói mình sai.
### 🔒 Khi row CHƯA xong bề mặt: gỡ khai báo + viết TEST CANH (mẫu 17/10/2026)

Một package đang viết dở mà **đã khai `gbh.row`** sẽ làm patch tắt row stock ⇒ tính năng biến mất ở lần restart kế tiếp, **kể cả khi không ai định mount nó**.

Mẫu đúng (tm-client dùng cho row `ui-settings-web-search`):
1. **Gỡ khối `gbh.row`** khỏi `package.json` — gói vẫn nằm trong repo, chỉ không được mount. An toàn cho mọi lượt restart của người khác.
2. **Viết một test canh**: khẳng định gói **KHÔNG có `gbh.row`** khi bề mặt chưa xong. Nếu ai đó bật sớm, test đỏ ngay — biến kỷ luật thành thứ MÁY kiểm được, không dựa vào việc người sau nhớ.
3. Viết xong bề mặt (đủ slot/export như bản gốc, `check:rows` sạch, lab 0 lỗi) thì **bật lại `gbh.row`** và **xoá test canh** (hoặc đổi nó thành khẳng định ngược lại).

Đây là cách trả lời câu hỏi *'làm sao để một người đang viết dở không làm hỏng app của người khác'* mà không cần ai giám sát ai.
### 🧨 LUẬT: id module = id BUNDLE TỰ KHAI — KHÔNG phải tên package do ta đặt (bài học 17/10/2026)

Ca thật làm **app chết hoàn toàn** (`#root` 620 ký tự, người dùng thấy thẻ lỗi) trong khi mọi chỉ số phía server đều xanh:
khi DI CHUYỂN gói `brand` vào repo, ta **đổi tên package** thành `@galaxy-blackhole/gbh-client-ui-brand`, nhưng bundle (code galaxy-code) **tự khai** id `@galaxy-stack/gbh-brand`.
Bảng module khoá theo **id bundle tự khai**; Loader lại import theo **tên package mà row trỏ tới** ⇒ lệch nhau ⇒ `import failed` ⇒ UI không render.

**Quy tắc**: với gói có nửa client, id module CHÍNH là id mà bundle tự khai. Nếu buộc phải dùng tên package khác, phải khai `gbh.row.aliases` cho id bundle khai (xem mục 6) **hoặc** sửa chính bundle. Khi DI CHUYỂN code có sẵn: **tốt nhất là đừng đổi tên package**.

### 🔍 `check:app` phải đo PHÍA TRANG — HTTP 200 không bao giờ là bằng chứng

Sự cố trên khiến tôi phải thêm **chỉ số (8)**: `check:app` nạp trang bằng **Chrome headless**, bắt lỗi console và đo `#root`.
· Ngưỡng: `#root` ≥ 60.000 ký tự **và** 0 lỗi console. Thẻ lỗi của DSH chỉ ~620 ký tự, nên ngưỡng này phân biệt được ngay.
· Vì sao cần: các chỉ số (1)(2)(3) (HTTP 200 · có `__DSH_BOOT__` · đủ 72 entry) **đều XANH** trong khi UI chết. Số 72 entry chỉ nói *'row có mặt trong đồ thị'*, không nói *'entry activate được'*.
· Chạy kèm: `bun run check:app` (tự bỏ qua chỉ số 8 nếu thiếu `playwright-core`, kèm ghi chú `BO QUA`).
### 🎭 Nửa client: KHÔNG dựng PLACEHOLDER bằng primitive khác (bài học 17/10/2026)

Ca thật: tác giả chưa biết API của primitive `toast` nên dựng tạm một `UploadToast` bằng một primitive khác + truyền `hidden`. Hệ quả: **một phần tử hiện chữ *'Could not save preference'* thường trực**, kể cả khi không có gì để báo. Không cổng nào bắt được — chỉ **phép đo A/B pixel** mới lộ (388 px, và truy ra đúng cụm `aria-label`).

**Luật**: nếu CHƯA biết API của primitive cần dùng, **tạm chỉ đăng ký phần đã chắc** (slot + dictionaries) và **ghi rõ phần còn thiếu ở README**. Tuyệt đối không dựng placeholder bằng primitive khác — placeholder sẽ render ra phần tử SAI và nằm im trong UI cho tới khi ai đó đo ảnh.

Đây là bản sao ở tầng UI của luật *'gỡ khai báo + TEST CANH'* (mục 7): thà thiếu một phần đã khai báo, còn hơn có một phần sai không ai biết.

### 📏 Nguồn khai báo id module (bổ sung mục 6)

`check:rows` đọc id bằng hai nguồn: (a) quét `id: "@scope/name"` trong `src/**` + `build.ts`; (b) **khai tường minh `gbh.row.moduleIds: ["…"]`**.
Khuôn CJS-bọc-IIFE sinh id qua `JSON.stringify` nên nguồn (a) **mù** — mọi gói theo khuôn đó PHẢI khai `moduleIds`, nếu không sẽ chỉ nhận cảnh báo và **mất phép kiểm bắt được lỗi làm chết app**.
### 🧪 STUB trong test phải có ĐÚNG hình dạng module thật (bài học 17/10/2026)

Ca thật: test của row `ui-sidebar` dùng stub `react` **có** `jsx`/`jsxs`, trong khi module React thật **không có** (hai hàm đó nằm ở `react/jsx-runtime`). Vì stub *rộng hơn* thực tế nên test **XANH** trong khi app thật nổ `TypeError: react.jsx is not a function` — thanh bên biến mất, `#root` rơi từ 99.183 xuống 49.046 ký tự.

**Luật**: stub phải **hẹp bằng hoặc hẹp hơn** module thật — chỉ chứa đúng những gì module thật cung cấp. Stub có thêm thứ mà module thật không có là **che lỗi**, và đó là loại test tệ nhất: nó cho ta cảm giác an toàn ở đúng chỗ nguy hiểm nhất.

Cách kiểm: nếu một ca test chỉ xanh vì stub của bạn cung cấp thứ gì đó, hãy hỏi *'module thật có thứ này không?'*. Với `react`: hook ở `react`, hàm dựng element ở `react/jsx-runtime`.

### 🕵️ Phép kiểm tĩnh: gọi `.jsx(`/`.jsxs(` trên namespace React

`check:rows` cũng bắt lớp lỗi này ở dạng trực tiếp: nếu một binding lấy từ `require("react")` / `import * as X from "react"` bị gọi `.jsx(`/`.jsxs(` ⇒ `chan`.
Giới hạn đã biết: nếu gói **tự gộp** một object (ví dụ `const react = { ...hooks, jsx, jsxs }`) thì phép kiểm tĩnh không thấy — lỗi nằm ở chỗ `jsx` lấy từ nguồn nào, và chỉ **test ở tầng chạy** hoặc **đo phía trang** mới bắt được.
### 📐 Chỉ số (9): chữ ký HÌNH HỌC so với đường nền — bắt lỗi BỐ CỤC

Bài học 17/10/2026: một hồi quy **bố cục** thanh bên (các mục điều hướng nằm cùng một dòng thay vì hai dòng dọc, nút mất padding, khối trên bị dồn lên 40–100 px) mà `#root` vẫn **99.183** và **0 lỗi console** ⇒ chỉ số (8) KHÔNG thấy. Chỉ phép đo A/B pixel của giàn parity mới lộ (5.437 px = 0,486%).

`check:app` giờ có chỉ số (9): chụp `{tag, x, y, w, h}` của 80 phần tử hiển thị đầu tiên dưới `#root` và so với `.parity/layout-baseline.json`; lệch > 2% ⇒ ĐỎ, kèm 2 khác biệt đầu tiên dạng `tag (x,y,w×h -> x,y,w×h)`.

**CÁCH GHI ĐƯỜNG NỀN — QUAN TRỌNG**: `bun run tools/check/probe-once.ts "<url>" --save` chỉ được chạy khi app **ĐÃ ĐÚNG** (đã đối chiếu oracle / đã đo A/B). Ghi đường nền lúc app đang có hồi quy là **đóng băng cái sai** rồi mọi lần sau đều báo 'khớp'.
### 📊 Ước lượng theo HO SƠ CHI PHÍ, không theo số dòng — lệnh `bun run row:cost <row>`

Bài học 17/10/2026 (tm-host-api): *646 dòng* của `ui-jobs` hoá ra cần **7 primitive** (menu bung + định vị neo + đóng khi bấm ngoài + khối terminal thu/mở + 2 icon), **40 khoá từ điển** (10 khoá có tham số nội suy, phải đúng cả en lẫn zh) và **trạng thái sống** (`watchRows`/`observe`). Số dòng build **không tỉ lệ** với công viết lại.

**Bước bắt buộc khi recon** (rẻ, vài giây — đừng bỏ qua):
```
bun run row:cost <row-id>
```
In ra: số dòng build · số inject · **số primitive** · **số khoá từ điển** · **có trạng thái sống không**.
· Ghi **3 con số đó vào mô tả task** trước khi nhận, để lập lịch theo độ phức tạp thật.
· Ví dụ đối chiếu: `ui-jobs` 659 dòng ⇒ **9 primitive · 40 khoá · có trạng thái sống** (đắt); `ui-secret-mask` 711 dòng ⇒ **1 primitive · 2 khoá · không trạng thái sống** (rẻ). Cùng cỡ dòng, khác hạng công việc.
### 🔎 HAI LỚP ĐO BỔ SUNG NHAU — phải chạy CẢ HAI trước khi báo xong row client

**Lớp DOM — 'phần tử lạ so với ref'** (rig của tm-ui-features): so hai bên theo khoá `tag|role|aria-label|data-testid`, **bỏ chữ nội dung** (chữ đổi theo trạng thái sống).
```bash
bun run tools/features/run.ts --ids <màn> --no-doc
```
Đọc dòng `phần tử lạ so với ref: ours +N · ref +M`. Ca không có trạng thái đặc biệt ⇒ kỳ vọng **0/0**; thấy N>0 thì **in toạ độ ra và giải trình từng phần tử** trước khi báo xong.

**Lớp pixel — A/B ảnh**: bắt *sai BỐ CỤC* (phần tử vẫn đủ nhưng đặt sai chỗ).

Hai lớp **không thay thế nhau**, và điều này đã được chứng minh trên dữ liệu lịch sử:
· cụm **388 px** (toast placeholder của row `ui-settings-session-log`) bị **lớp DOM** bắt: `ours +1 [('button|switch|Could not save preference|', 0, 0, 36, 20)]` — mà không cần một pixel nào;
· cụm **5.437 px** (CSS thanh bên bị vỡ khi trích) **KHÔNG** bị lớp DOM bắt — phần tử vẫn đủ, chỉ sai bố cục ⇒ phải có lớp pixel.

Khi báo xong một row, **nói rõ đã chạy lớp nào**. Chạy một lớp rồi kết luận là tự tạo cảm giác an toàn sai chỗ.
### ⌨️ ĐO RENDER cho bề mặt chỉ-hiện-khi-có-dữ-liệu: phải NHẬP THẬT bằng bàn phím

Nhiều bề mặt chỉ render khi có dữ liệu sống (credential, mục tiêu, job…). Muốn đo chúng phải **tự dựng trạng thái trong lab** — và ở đó có hai cái bẫy đã làm cả nhóm suýt kết luận sai:

1. **Sự kiện nhập GIẢ không vào được state.** Ô soạn tin là `contenteditable` có mô hình trạng thái riêng: gán `element.textContent` rồi bắn `new Event("input")` **không** làm app cập nhật ⇒ đo ra `0 phần tử` và dễ kết luận sai là 'không render'. Phải dùng **bàn phím thật**: `page.keyboard.type(...)` + `page.keyboard.press("Enter")`.
2. **Click có thể bị modal một-lần nuốt.** Modal `aria-modal="true"` (ví dụ 'Get started') chặn sự kiện chuột ⇒ phải **liệt kê nút trong modal và bấm Continue**, rồi **`element.focus()` bằng JS** (không click) trước khi gõ.

**Và phải dán nhãn đúng loại phép đo**: trạng thái tự dựng trong lab ⇒ **KHÔNG phải A/B với oracle**. Ghi rõ trong README: *'trạng thái do TA TỰ DỰNG, không đối chiếu oracle'*. Một phép đo mạnh nhưng dán nhãn sai loại thì tệ hơn một phép đo yếu được dán nhãn đúng.

Ví dụ đạt được bằng cách này (row `ui-secret-mask`, 17/10/2026): gửi một tin chứa `sk-…` ⇒ DOM có `1 node [data-secret]` với `sk-A1b2C3***************`, nút `Show secret`/`aria-pressed=false`, 0 lỗi console — chứng minh đầu-cuối luật UserText → renderer → che chữ, lớp mà **không cổng server-side nào và không ảnh A/B nào thấy được**.
## 7. Ghi lại — bắt buộc

- README package: bảng nguồn đối chiếu G4 · lý do peer · bảng TRƯỚC/SAU + lệnh tái lập · **phần CHƯA làm** (nếu có, nói thẳng).
- `packages/README.md` §4: cập nhật bảng trạng thái.
- `docs/ROADMAP.md`: 1 dòng nhật ký.

## 6b. Công thức cho row HAI MẶT (đã chứng minh trong phòng thí nghiệm cách ly, 17/10/2026)

Áp dụng khi package gốc có `dsh.client` (nửa browser). Kiểm bằng **câu hỏi thứ 5** ở mục 0.

### Cơ chế (đọc từ `dsh-client-modules/lib/client.js`)

- Bảng factory khoá theo **id mà BUNDLE tự khai** trong `__ModuleLoader__.load({ id, factory })`, sau khi bỏ hậu tố `/client` — KHÔNG bị ép theo tên package của row.
- Vì vậy bundle của ta **được phép đăng ký id của package gốc**, mở khoá mọi bundle phụ thuộc `require("<gói gốc>/client")`.
- ⚠️ `register` **ném lỗi trùng id** ⇒ vẫn phải disable row stock.
- ⚠️ `rev` của HMR tra theo ownerId ⇒ khai **id CỦA TA làm id chính** (để khớp manifest) và id stock là đăng ký PHỤ.

### Khuôn bundle client

```js
// lib/client.js của package ta — chạy trong browser, chỉ ĐĂNG KÝ factory
window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-<vai trò>", factory: ourFactory });   // MOT id duy nhat
// ⚠️ ĐÍNH CHÍNH 17/10/2026 — bản đầu của mục này in THÊM một dòng `load({ id: gói gốc })`.
//    DÒNG ĐÓ SAI và đã gây sự cố app trắng: đăng ký id stock ở đây ⇒ bundle chạy HAI lần ⇒
//    `duplicate factory registration` / `service ... has been registered`. Id stock KHÔNG thuộc
//    bundle — nó thuộc `gbh.row.aliases`, và TẦNG NẠP tự sinh entry alias trỏ về CÙNG URL bundle.
//    (Đo được: 16/28 gói còn dạng cũ; và chính `tools/scaffold/new-row.ts` từng sinh dòng sai đó.)
//    ⇒ Xem mục 8 để biết dạng đúng + dấu hiệu nhận biết ca sai. MỘT BUNDLE ⇒ MỘT ID.
```

Package của ta phải khai `dsh.client` (inject/platform/immediately **y như bản gốc**) + `exports["./client"]`.

### Khai báo alias trong metadata (thay vì mỗi row tự xử)

Từ 17/10/2026, id alias là **khai báo của row** — tên trường là **`aliases`**:

    "gbh": {
      "row": {
        "id": "ui-settings-session-log",
        "aliases": ["@deepseek-ai/dsh-client-ui-settings-session-log"],
        "tests": ["tests/client/ui-settings-session-log.test.ts"]
      }
    }

`bh host` phát danh sách này vào wire (`aliases` trên dòng của đồ thị); bộ nạp client
(`packages/client/modules`) tự: copy `rev` của row cho khoá alias · xoá khoá alias khi `invalidate` row ·
giữ alias theo owner khi `prune` · memoize về ĐÚNG MỘT instance. Bundle của row **vẫn** gọi `load()` hai
lần (id ta + id alias) — đó là cách bảng module có cả hai khoá; row KHÔNG tự viết logic HMR.

Row không có consumer require module (ví dụ `resources`: 5 row inject ở tầng DỊCH VỤ, 0 row require) thì
khai `aliases: []` cho nhất quán — nhưng khi thay row đó vẫn phải giữ NGUYÊN TÊN SERVICE và hook mà các
row kia chờ (`resources` + hook gốc `resource` trên `slots`).
### Phép thử cách ly (BẮT BUỘC trước khi chạm app thật)

1. Home riêng + cổng riêng: `GBH_HOME=/tmp/gbh-m6lab bh host --port 5452`.
2. ⚠️ **`bh host` tự GHI ĐÈ `<home>/app.patch.yml` mỗi lần boot** — đừng chèn khối lab vào file đó (sẽ mất). Dùng lớp overlay: `--patch /tmp/gbh-m6lab/lab.patch.yml` (áp SAU cùng).
3. Đo: số entry/id trong `__DSH_BOOT__` · số dòng `did not activate` trong log · kích thước trang · 2 ca RPC.

**Cách chạy lab TỐT HƠN (không để lại dấu vết lên app thật)** — chạy thẳng harness, đừng qua `bh host`, vì `bh host` sẽ ghi đè `~/.galaxy/blackhole/ready-url.txt` của app đang chạy:
```bash
DSH_HOME=/tmp/gbh-exp node apps/host/node_modules/@deepseek-ai/dsh/lib/bin.js \
  --profile blackhole --patch /tmp/gbh-exp/app.patch.yml --port 54xx
```
Rồi đọc bằng Chrome headless: `entries` · `mode` · số ký tự `#root` render · số lỗi console.
**Bốn chỉ số phải đạt** trước khi mount thật: `entries` đủ (72) · `mode = "live"` · `#root` render đủ (≈80.000+ ký tự) · **0 lỗi console**.

### Kết quả đo được (row `typert-gateway`, thí nghiệm ngày 17/10/2026)

| Chỉ số | Kết quả |
|---|---|
| Trang | 200 · **49.032 B** |
| Id trong payload | **75** · có CẢ `@deepseek-ai/dsh-api-gateway` **và** id gói lab ⇒ **hai id cùng tồn tại, không có lỗi trùng** |
| RPC qua gateway của ta | `200 · ok=true` (discovery + dispatch chạy thật) |
| Entry không activate | **1** — `api-remotes: TypeError: ctx.typertGateway.registerRemoteEvents is not a function` |

### Kết luận rút ra (quan trọng cho M5/M6)

1. **Cơ chế nửa client CHẠY ĐƯỢC**: hai id cùng vào bảng module, trang render, RPC hoạt động — nghĩa là bài toán 'nửa client' của M5 giải được bằng khuôn trên.
2. **Nhưng row vẫn KHÔNG giữ được** nếu nửa HOST thiếu API: lỗi duy nhất còn lại là `registerRemoteEvents` mà `api-remotes` gọi. Đây chính là ranh giới M6 (cùng với nhánh STREAM và 2.186 dòng browser RPC).
3. Thí nghiệm này **không** tính vào chỉ số 'đã thay N row': row lab không có `gbh.row`, chỉ tồn tại trong home cách ly và đã được tắt sau khi đo.

### ⚠️ `loading` ≠ chờ service — HAI cơ chế inject khác nhau (phát hiện 17/10/2026, tiết kiệm 2 vòng lab)

Một entry client đứng ở `loading` có thể do hai cơ chế hoàn toàn khác nhau. Đừng bisect danh sách service (tôi từng mất 2 vòng lab mà sai hướng):

| Cơ chế | Khai ở đâu | Chờ cái gì |
|---|---|---|
| `inject` **service** | trong bundle: `exports.inject = ["slots", …]` | service do plugin khác cấp (fiber cordis chưa ACTIVE) |
| `dsh.client.inject` **id module cấp row** | `package.json` → `dsh.client.inject` | các **id module** phải có mặt trong bảng module trước khi entry được kích hoạt |

**Phép thử tách bạch (mỗi phép 1 lượt lab, hoàn nguyên ngay sau đó):**

    # 1. thu inject SERVICE ve toi thieu
    export const inject = ["slots", "locale"];
    #   => VẪN `loading`  ⇒ nguyên nhân KHÔNG nằm ở service (đừng bisect 8 service nữa)
    #
    # 2. thu dsh.client.inject ve rong (package.json)
    "dsh": { "client": { "platform": "web", "inject": [] } }
    #   => entry QUA cổng kích hoạt (mất `loading`, có thể lộ lỗi kế tiếp)
    #   ⇒ nguyên nhân nằm ở danh sách id module cấp row

**Quy tắc an toàn khi thử**: mọi phép thử trên làm **trong lab** (`bun run lab:row <pkg>`, hoặc overlay `--patch` + tự đưa gói vào `profiles/node_modules/<TÊN PACKAGE>`), **hoàn nguyên file ngay trong cùng lượt**, và **không để `gbh.row` được khai** khi row chưa nghiệm thu — khai mà chưa mount xong là lấy mất row stock của mọi người.

**Cách đọc lỗi để biết lỗi thuộc row nào**: `invalid plugin, expect function or object with an "apply" method, received object` là lỗi của **bundle export sai dạng**, không phải lỗi chờ. Muốn biết bundle của mình có `apply` không, nạp nó trong window giả rồi in `Object.keys(exports)` + `typeof exports.apply` (rẻ hơn 1 lượt lab).


### ⚠️ Lỗi trong `apply` bị cordis NUỐT — audit của vỏ chỉ báo `loading` (phát hiện 17/10/2026, task-24)

Triệu chứng: entry mãi ở `loading`, **không có lỗi nào trong console**, và mọi phép thử inject đều không đổi kết quả.
Sự thật: `apply` **ném lỗi** ⇒ fiber thành **FAILED (3)**, nhưng audit của vỏ lấy mẫu trạng thái *trước* thời điểm đó ⇒ in `loading`.

**Ba bẫy đã cắn thật, theo thứ tự:**
1. `ctx.fiber.inject` hiện `{slots: null, locale: null}` **trước khi service được giải** ⇒ ĐỪNG kết luận 'thiếu service' từ đó. Kiểm thật bằng `typeof ctx.slots` / `typeof ctx.locale` **bên trong** `apply`.
2. Lỗi bị nuốt ⇒ lab trông như lỗi của gói khác. Phải đo trên **lab sạch** (không row nào khác hỏng) rồi mới kết luận.
3. Sai API service là nguyên nhân thật của task-24: bản gốc dùng
   `const inputTriggers = ctx.get("inputTriggers"); … inputTriggers.registerSource(source);` (trong `ctx.effect`, kèm `ctx.on("connection/reset", clearAll)`),
   KHÔNG phải `ctx.inputTriggers.register(source)`. Sai một chữ ⇒ fiber FAILED, audit báo `loading`.

**Hai cách moi lỗi (đều rẻ, đều 1 lượt lab):**

    // 1. boc apply trong try/catch co log — vua lay thong diep vua lam fiber ACTIVE
    export function apply(ctx) { try { applyInner(ctx); } catch (e) { console.log("LOI:", e.message, e.stack.slice(0, 200)); } }

    // 2. do quy dao trang thai fiber: 0 pending · 1 loading · 2 ACTIVE · 3 FAILED · 4 disposed · 5 unloading
    for (const ms of [200, 1000, 3000, 7000]) setTimeout(() => console.log("state=" + ctx.fiber.state), ms);

Chỉ khi thấy `state=2` ổn định và **0 dòng `did not activate`** thì row mới coi là activate được.

## 8. KHAI ID MODULE — id stock CHỈ ở `aliases` (lớp lỗi "hai chỗ", 17/10/2026)

**Dạng khai CŨ (đừng viết cho gói mới):** id stock nằm ở **cả hai** chỗ —

    "moduleIds": ["@galaxy-blackhole/gbh-client-<x>", "@deepseek-ai/dsh-client-<x>"],
    "aliases":   ["@deepseek-ai/dsh-client-<x>"]

**Dạng ĐÚNG:**

    "moduleIds": ["@galaxy-blackhole/gbh-client-<x>"],   // CHỈ id của ta
    "aliases":   ["@deepseek-ai/dsh-client-<x>"],        // id stock ở ĐÚNG MỘT chỗ

và bundle vẫn đăng ký **MỘT** id (`__ModuleLoader__.load({ id: <id của ta>, factory })`).

**Vì sao dạng cũ nay VÔ HẠI (không phải lỗi đang chạy):** sau các bản sửa tầng nạp 17/10/2026 —
`readAliases` trả **HỢP** của `aliases` ∪ `moduleIds` (đã lọc id của chính package), `aliasView` bảo đảm
**một bundle ⇒ một plugin**, và nửa browser **khử trùng theo URL đã thực thi** — nên khai trùng chỉ còn là
**hai nguồn sự thật**, không còn sinh lần nạp thứ hai.

**Trước bản sửa đó thì nó LÀ lỗi thật:** host nạp bundle **một lần cho mỗi id** trong `moduleIds` ⇒ bundle
chạy hai lần ⇒ Loader ném `duplicate factory registration for "…" (bundle executed twice without invalidate?)`
⇒ app trắng. Vì vậy **gói mới luôn dùng dạng đúng** — đừng hồi sinh dạng cũ.

**Số đo (17/10/2026, quét 28 gói có `gbh.row`):** **16 gói ở dạng cũ** — 6 gói trùng ở *cả hai* chỗ
(`locale` · `ui-layout` · `ui-settings` · `ui-settings-plugins` · `ui-workflow-run` · `ui-settings-session-log`)
và 10 gói để id stock trong `moduleIds` với `aliases` rỗng; **12 gói đúng khuôn**.

**Câu chốt:** *hôm nay nó là **DƯ THỪA**, không phải lỗi.* App 5439 vẫn LÀNH 11/11 với 26 gói active, trong đó
có cả gói thuộc nhóm dạng cũ.

### ⚠️ PHÂN BIỆT HAI TẦNG: "KHAI BÁO (metadata)" vs "BUNDLE đăng ký" — đừng đọc lướt mục này

Dạng khai cũ (id stock ở **cả** `moduleIds` **và** `aliases`) nay là **DƯ THỪA, KHÔNG phải lỗi** — vì
`readAliases` trả **HỢP** hai nguồn. **NHƯNG điều đó CHỈ đúng cho KHAI BÁO METADATA.**

Ở tầng **BUNDLE** thì luật **NGƯỢC LẠI** và **cổng `check:rows` CHẶN**: bundle phải đăng ký **ĐÚNG MỘT id —
id CỦA TA**; `load({ id: <gói gốc> })` trong bundle là **SAI** (bundle chạy hai lần ⇒ `duplicate factory
registration` / `service … has been registered` ⇒ app trắng). Id gốc **chỉ** khai ở `gbh.row.aliases`; tầng
nạp tự sinh entry alias trỏ về **CÙNG URL bundle**.

**Bằng chứng sống (17/10/2026):** chính người viết mục này đã **bật lại** `load({ id: STOCK })` ở gói
`connection` khi tầng nạp **chưa** có `aliasView` (hồi đó cần thật), rồi **bị cổng mới bắt đúng** và phải gỡ.
⇒ Nếu chỉ đọc câu "DƯ THỪA" ở trên mà bỏ đoạn này, người sau sẽ tưởng **đăng ký 2 id trong bundle là vô hại**.

**Khi nào cần dọn:** khi có **lý do khác** (ví dụ muốn một nguồn sự thật duy nhất để đọc metadata), **không
phải vì "trông sai"**. Khi dọn: **một lượt riêng, một người, một khuôn**, và **đo `parity:graph` trước/sau** —
kỳ vọng **KHÔNG ĐỔI** (thu hẹp nguồn sự thật, không đổi ngữ nghĩa); nếu nó **đổi** thì đó là dữ kiện thật, báo Lead.

**Nhận biết nhanh (1 lệnh, khỏi đọc 28 file):**

    bun -e 'const fs=require("node:fs");for(const n of fs.readdirSync("packages/client")){const p="packages/client/"+n+"/package.json";if(!fs.existsSync(p))continue;const r=JSON.parse(fs.readFileSync(p,"utf8")).gbh?.row;if(!r)continue;const i=(r.moduleIds??[]).filter(x=>x.startsWith("@deepseek-ai/"));if(i.length)console.log(n,i)}'

## 000d-2. LUAT CHINH XAC ve ambient `declare module` (chot 18/10/2026)

Muc 000d cam dung ambient lam shim. Nhung CAM TRAN LAN se vo ly, vi co ten **khong ton tai o dau**
(do **bang module cua vo cap luc chay**). Luat chinh xac la:

### CAM: `declare module "x";` KHONG THAN khi `x` LA MODULE CO THAT

`x` la "co that" neu **tim thay tren dia** trong repo (`node_modules` bat ky cap, ke ca
`apps/host/node_modules`), hoac `package.json` cua no khai `types`/`typings`.

⇒ Khai ambient cho no se **DE kieu that** o **MOI file trong cung chuong trinh `tsc`** ⇒ dung su co
000d. **Cach dung: SYMLINK peer that** vao `node_modules` cua **chinh package** dang import.

**Bang chung do duoc (18/10/2026)**: mot ambient cho `@deepseek-ai/schemastery` (goi **CO** `.d.ts` that)
lam `typecheck` di tu **5 -> 53 vi pham o 13+ goi** chi trong vai phut.

### CHO PHEP: ambient KHONG THAN khi `x` KHONG TON TAI O DAU trong repo

Do la cac **seed nen tang** ma **bang module cua vo** cap luc chay — vi du `react`, `react/jsx-runtime`,
`react-dom`, `@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-primitives`,
`@deepseek-ai/dsh-client-ui-dockkit` (da kiem 18/10/2026: **khong ten nao co tren dia**, ke ca `@types/react`).

⇒ Voi nhom nay ambient la **khong tranh duoc**. Nhung **BAT BUOC**:

1. **Moi ten mot dong ly do** ngay canh no (vi sao no khong the resolve duoc).
2. **Ghi ngay do de kiem**: `find . -maxdepth 4 -path "*/node_modules/<ten>"` ⇒ phai ra **rong**.
3. Neu sau nay **co ai cai that** ten do (vi du them `@types/react`) ⇒ **PHAI XOA ambient** ngay,
   neu khong no se **de kieu that** va gay lai dung su co 000d.

### ⛔ TUYET DOI CAM: `declare module "*";`

No khop **MOI** specifier ⇒ lam rong **toan bo** chuong trinh ⇒ che het moi loi.

### CHO PHEP (hep): MAU WILDCARD cho truy van cua Bun

`declare module "*?partial" { ... }` — dung cho `import "./x.ts?partial"` (Bun nap **the hien moi**)
ma `tsc` khong giai duoc, va **khong the** `declare module` cho **duong dan tuong doi** (TS2436).

Mau nay **chi khop specifier KET THUC bang `?<truy van>`** ⇒ **khong module that nao co ten nhu vay**
⇒ **khong the de kieu cua ai**. Da do: `typecheck` 4 -> 0, phan bo loi theo goi **khong tang**.

⚠️ **Moi lan them truy van moi trong test, phai them mot mau.** Do cac truy van dang dung:
`grep -o "?[a-z-]*" tests/client/ui-workspace.test.ts | sort -u`

### 💡 SU THAT VE CONG (do 18/10/2026, hai nguoi do doc lap)

**`tsconfig.json` KHONG cuu duoc cong**: cong goi `tsc <co> <DANH SACH FILE>`, va **`tsc` BO QUA
`tsconfig.json` khi co danh sach file** ⇒ moi cach sua bang `paths` deu **vo hieu voi cong**.
⇒ Do la ly do **symlink** (khong phai `paths`) la cach dung.

⚠️ Nhung **`node_modules/` bi `.gitignore`** ⇒ symlink **khong di theo ban sao khac** ⇒ voi goi co `.d.ts` that
ma muon chac chan, hoac (a) them buoc setup tao symlink, hoac (b) **khai bao CO THAN dung be mat do duoc**.

### Cach kiem nhanh mot ambient co dang de kieu that khong

```bash
# 1. Liet ke moi .d.ts khong nam trong node_modules
find . -name '*.d.ts' -not -path '*/node_modules/*' -not -path '*/target/*'
# 2. Voi moi ten duoc khai, kiem no co that tren dia khong
#    -> CO THAT  => phai doi sang symlink (CAM ambient)
#    -> KHONG CO => duoc giu ambient, nhung phai co dong ly do
```

