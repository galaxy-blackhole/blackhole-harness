<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README cua @galaxy-blackhole/gbh-api-session-controller — port HAI MAT: 4 artefact (host 3.367 +
      client 4.326 + typert.host 4.053 + typert.remote-client 2.013 dong); ROW CHUA KHAI (cho lab/boot)
-->

# @galaxy-blackhole/gbh-api-session-controller

Bản viết lại Galaxy Blackhole cho @deepseek-ai/dsh-api-session-controller (0.2.1-alpha.4) — dịch vụ **sessionController**:
điều khiển phiên (danh mục, lệnh, luồng trợ lý, lịch sử, tham chiếu tệp/phương tiện, chọn model, skill catalog, cổng phiên lưu trữ)
qua giao thức typert (host + remote-client).

## 1. Đo 4 bước TRƯỚC khi viết (19/10/2026)

| phép đo | kết quả |
|---|---|
| gói hai mặt? | **CÓ** — host lib/index.js **3.367 dòng**; client lib/client.js **4.325 dòng** + `dsh.client` (inject api-gateway + client-file-upload, platform web) |
| entry typert | typert.host.js **4.053 dòng** · typert.remote-client.js **2.013 dòng** |
| trùng service `sessionController`? | **KHÔNG** — không package nào của ta đăng ký tên này |
| row trong dump | `- id: session-controller` **TOP-LEVEL** (dump dòng 549) |
| id stock trong artefact | index 1 · client 1 · typert.host **57** · typert.remote-client **56** |
| độ dài id | stock **39** · ta **44** ⇒ **+5 byte/lần** (KHÔNG phải +13) |

## 2. TRƯỚC → SAU

| hạng mục | TRƯỚC | SAU |
|---|---|---|
| gói trong repo | chưa tồn tại | `packages/host/api-session-controller/` (4 bộ lát + build + tools) |
| lib/index.js | chỉ trong stock | **3.367 dòng · 132.150 B · sha256 `a9801acb577b0305…` = gốc** (byte-identical) · 15 lát |
| lib/client.js | — | **4.326 dòng · sha256 `232f69b0b42c2186…`**; chuẩn hoá id ta→stock ⇒ **byte-identical** (+5 B) · 26 lát · đúng **1** id ta, **0** id stock |
| lib/typert.host.js | — | **4.053 dòng · sha256 `846e2f020ffe5683…`**; chuẩn hoá ⇒ byte-identical (**+285 B** = 57×5) · 7 lát |
| lib/typert.remote-client.js | — | **2.013 dòng · sha256 `9c966d6400948ef1…`**; chuẩn hoá ⇒ byte-identical (**+280 B** = 56×5) · 3 lát |
| entry client | — | `src/client.ts` + **Bun.build thứ hai** ⇒ `lib/client-entry.js` (có dòng `window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-api-session-controller" … })`) |
| kiểu | lib/types của stock | chép nguyên cây + `lib/index.d.ts` + 2 tệp `typert.*.d.ts` |
| exports | — | **khớp TOÀN BỘ bản gốc**: `.` · `./types` · `./remote-events` · `./client` · `./typert` · `./remote` · `./src/*` · `./package.json` · `./locale/*.json` |
| locale | — | chép `locale/en.json` + `zh.json` từ bản gốc |
| row `session-controller` | stock | **CHƯA khai** (`gbh.draft`) — chờ lab:row + boot-smoke + README §4 của Lead |

## 3. Cổng byte / cổng ownership

- **Host**: ghép 15 lát rồi so **TỪNG BYTE** với bundle gốc — lệch 1 byte là DỪNG (báo byte lệch đầu tiên + sha256 hai bên).
- **Client + 2 typert**: artefact buộc phải khác bản gốc **đúng ở chuỗi id** (luật MỘT-ID + ownership typert). Vì vậy cổng là
  **ownership**: chuẩn hoá id của ta → id gốc rồi so byte với bản gốc, **cộng** kiểm 0 sót id stock. Hiệu số byte kỳ vọng:
  client **+5**, typert.host **+285** (57×5), typert.remote **+280** (56×5).
- `package.json` khai `exports` của gói ta khớp bản gốc, gồm cả `./typert` và `./remote`.

## 4. Test A/B

`tests/host/api-session-controller.test.ts` — **21 ca / 155 expect / 0 fail** (705 dòng): 4 ca artefact/cổng ownership · 3 ca bề mặt export +
exports package + khuôn loader client · ≥6 ca service `sessionController` trên Context cordis THẬT (tên service, Config mặc định/lỗi,
prototype, nhánh lỗi) · ≥3 ca nhánh lỗi tham số. Ca nào cần Agent/session/uplink THẬT mà không dựng nổi đều chọn nhánh
“cùng ném cùng thông điệp” và ghi lý do ngay trong tên ca.


## 4b. Sự cố THẬT khi boot-smoke (19/10/2026) — thiếu `dsh.client`

- **Triệu chứng**: boot-smoke #root **6.402** (cần ≥20.000) · 1 lỗi console · HOST 0 did-not-activate nhưng **web boot: 58 entries
  did not activate**, tất cả `pending (waiting for service: sessions)`.
- **Nguyên nhân gốc** (đo, không đoán): service client `sessions` CHỈ do nửa client của chính gói này cấp
  (`provide("sessions", this, undefined)`, 49 lần trong bundle). `client-modules` dựng bảng web từ package khai **`dsh.client`** —
  mà `package.json` của ta lúc đó chỉ copy `exports`, **thiếu `dsh.client`** ⇒ nửa client không vào bảng web ⇒ không ai cấp `sessions`
  ⇒ 58 consumer pending. **Không phải lỗi artefact** (id đăng ký đúng, 1 id ta, 0 id stock).
- **Sửa**: thêm `dsh.client` khớp tuyệt đối bản gốc (inject api-gateway + client-file-upload · external api-gateway/client · platform web).
- **Ca chống hồi quy** trong test: “gói hai mặt: package.json có `dsh.client` KHỚP bản gốc + export `./client`”.
- **Bài học chung cho mọi gói HAI MẶT**: `exports["./client"]` + `dsh.client` + bundle client khai **đúng 1 id của ta** là BỘ BA bắt buộc;
  thiếu `dsh.client` thì host vẫn xanh nhưng web chết chùm.

## 4c. Vì sao smoke cần promote khối park (C1, Lead duyệt)

`client-modules` đọc alias client từ **`gbh.row.aliases`**, không đọc `row_unmounted_ly_do` ⇒ row park thì alias không được phát và smoke
đo oan (58 entry pending như trên). Vì vậy `tools/check/boot-smoke.ts` nay **promote khối park thành `gbh.row` CHỈ trong bản copy
package.json của home cách ly** (log `[smoke] promote park -> gbh.row cho … (chi trong home cach ly)`), fail-soft, không chạm repo/app.
## 5. Kỹ thuật đáng lưu ý

1. **typert.host.js KHÔNG cắt được bằng splitter chuẩn**: `export const TYPERT = {` dài **2.041 dòng**, không có dòng cấp 0 ở giữa ⇒
   buộc cắt GIỮA câu lệnh và dùng quy ước **dấu mảnh nằm CUỐI DÒNG** (`… // __GBH_FRAGMENT_BEGIN__`) như `cordis-client-runner`.
   Vì vậy có riêng `src/assemble-typert.ts` (gỡ **cả dòng** có dấu), không dùng `src/assemble.ts` (so khớp nguyên dòng).
2. **Bẫy newline ranh giới lát**: nối chuỗi từng lát sẽ mất newline ⇒ dính `…$valueconst _deepseek…` (−9 B); cắt dòng trống hai đầu lát
   sẽ thừa (+4/+8 B). Đúng: gom dòng của mọi lát rồi `join(EOL)` **một lần**, gỡ đúng 1 dòng trống sau `// @ts-nocheck` và 1 dòng trống
   trước `export {};`, giữ nguyên dòng trống bên trong thân.
3. `lib/types` chép nguyên cây từ bản gốc; thêm 2 tệp `typert.host.d.ts` / `typert.remote-client.d.ts` cho consumer.

## 6. Nợ / việc còn lại

1. **Khai `gbh.row`** (id `session-controller`, aliases stock, moduleIds = tên gói) chỉ sau khi: test A/B xanh → Lead chạy
   `lab:row api-session-controller` + `boot-smoke api-session-controller` ĐẠT → Lead thêm dòng `packages/README.md §4`.
2. `tools/lint/gate.ts` cần mở rộng `FRAGMENT_PATH` cho `src/parts-host/` + `src/parts-typert-*/` (hiện chỉ miễn `/src/parts/`) —
   sửa ở tệp dùng chung, cần Lead duyệt; hiện các lát vẫn typecheck PASS nhờ quy ước dấu cuối dòng.
3. ~~`exports` thiếu `./remote-events` + `./locale/*.json`~~ → **ĐÃ khớp toàn bộ** (remote-events trỏ vào cây `lib/types` chép từ gốc; locale chép nguyên 2 tệp).
4. Symlink peer hiện chỉ 5 (`cordis · dsh-agent · dsh-session · dsh-typert-protocol · dsh-tools`); bundle host import thêm
   schemastery/zod/mime-types/dsh-llm/dsh-fs/… ⇒ muốn import artefact trong test/lab phải link thêm (test dùng đường dẫn trực tiếp nên không cần).