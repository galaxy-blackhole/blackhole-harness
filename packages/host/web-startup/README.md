<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại row `web-startup` (@deepseek-ai/dsh-web-app/startup): nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU và phần CHƯA làm
-->

# `@galaxy-blackhole/gbh-web-startup` — row `web-startup`

Bản viết lại **trung thành** của row **`web-startup`** → `@deepseek-ai/dsh-web-app/startup`
(**73 dòng** `lib/startup.js`, **MỘT MẶT**: đã kiểm `lib/client.js` **KHÔNG tồn tại**).

Vai trò: **bộ cấp cờ dòng lệnh của app web**. Nó parse họ cờ `dsh --profile web`
(`--host` · `--port` · `--public-url` · `--trusted-host` · `--no-open` · TLS) cùng văn bản `--help`,
rồi công bố giá trị **BẤT BIẾN** thành service cordis **`webStartup`**. Các row khác **inject**
service này rồi đọc nó từ config lười:

    # profiles/blackhole/app.patch.yml (do người khác khai, KHÔNG phải gói này)
    - id: webserver
      inject: [webStartup]
      config:
        host: !!js ctx.webStartup.host ?? '127.0.0.1'
        port: !!js ctx.webStartup.port ?? 3080
    - id: web-runtime
      inject: [webStartup]
      config:
        openBrowser: !!js ctx.webStartup.openBrowser

> `webserver` trong cây đang chạy đang **bị patch tắt** (đã thay bằng `@galaxy-blackhole/gbh-host-webserver`),
> còn `web-runtime` **đang bật** và đọc `ctx.webStartup.openBrowser` — nên đây là row **đang BẬT**.

## 1. Nguồn đối chiếu (G4) — đo trên ARTIFACT, không đọc `src/` để kết luận

| Hạng mục | Bản gốc (CHỈ ĐỌC) | Ta | Bằng chứng |
|---|---|---|---|
| Nửa host | `apps/host/node_modules/@deepseek-ai/dsh-web-app/lib/startup.js` (**73 dòng**) | `src/index.ts` | tập export **4 = 4** (`WEB_STARTUP_SERVICE` · `apply` · `inject` · `name`), đo trên `lib/index.js` |
| Chunk `public-url` | cùng thư mục, `lib/public-url-<hash>.js` (`parsePublicUrl`) | `src/public-url.ts` | 14 giá trị (5 hợp lệ + 9 lớp lỗi) ⇒ cùng `href` hoặc **cùng thông điệp lỗi từng chữ** |
| Nửa client | **KHÔNG CÓ** `lib/client.js` · `dsh.client` = `False` | — | row **MỘT MẶT** ⇒ disable+insert không làm mất nửa client |
| `locale/` (000e) | `locale/startup/{en,zh}.json` của gói gốc | `locale/{en,zh}.json` | **byte-for-byte** (sha256 khớp từng tệp) — xem ghi chú dưới bảng |
| Hằng số | `name = "web-startup"` · `inject = ["cmdlineArgs"]` · `WEB_STARTUP_SERVICE = "webStartup"` | y nguyên | ca test so **từng chữ** với bản gốc |

> **Vì sao `locale/` của row nằm ở `locale/startup/`:** row này là **subpath** `@deepseek-ai/dsh-web-app/startup`,
> nên bộ đọc metadata của kernel (`readPluginMeta`, `dsh-app-boot`) giải `<specifier>/locale/en.json` thành
> **`locale/startup/en.json`** — đo bằng resolver thật, không suy đoán. Bản ta **không có subpath**, nên hai tệp đó
> phải nằm ngay `locale/` thì màn Plugins mới hiện **cùng tiêu đề** (`web-app/startup` · `Web 启动配置`).
> `locale/en.json` **ở gốc gói** (tiêu đề `"web-app"`) thuộc row **bundle** `@deepseek-ai/dsh-web-app`, **KHÔNG** chép vào đây —
> chép vào là tự đổi tiêu đề của row mình.

Hai bản cài trên đĩa **KHÁC phiên bản** và điều đó đã cắn thật: bản trong
`/Applications/Galaxy Blackhole.app/…/host/cli/node_modules` là `0.2.0-rc.2` (**52 dòng**, không có TLS/`public-url`),
còn bản **runtime của app** trong `apps/host/node_modules` là `0.2.1-alpha.4` (**73 dòng**, có TLS + `public-url` +
`isWildcardHost`). **Nguồn sự thật là bản `apps/host`** — test đối chứng với chính nó, nên lệch phiên bản là **ĐỎ ngay**.
(Bài học: đọc sai bản ⇒ viết thiếu 3 cờ và 1 nhánh lỗi mà **cổng nào cũng xanh**.)

## 2. Năm câu hỏi bắt buộc

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row có **đang BẬT**? | **CÓ** — `.parity/dumps/2026-10-17T23-54-01/ours.yml` dòng **551–552**: `- id: web-startup` + `name: '@deepseek-ai/dsh-web-app/startup'`, **không** `disabled` |
| 2 | Thuần host hay có mặt client? | **Thuần host** — không `lib/client.js`, không `dsh.client` |
| 3 | Cần **seam** nào? | `cmdlineArgs` (service kernel cấp) + helper `parseCmdline` của `@deepseek-ai/dsh-cmdline` + `isWildcardHost` của `@deepseek-ai/dsh-host-webserver` (để từ chối `0.0.0.0`/`::`/`::ffff:0.0.0.0`) + `commander` (thư viện CLI **chính kernel dùng**) |
| 4 | Hành vi **đo được**? | Giá trị service `webStartup` cấp cho kernel từ một argv: `{openBrowser, host?, port?, publicUrl?, tls?, trustedHosts}` — đây là thứ `webserver`/`web-runtime` đọc qua `!!js` |
| 5 | Gói gốc có `dsh.client`? | **KHÔNG** — `package.json` chỉ có `dsh.bundle.patch` ⇒ row một mặt |

## 3. Peer — và vì sao `gbh.peers ⊆ peerDependencies`

| peer | vì sao | ghi chú |
|---|---|---|
| `@deepseek-ai/cordis` | `ctx.provide` / `Context` | chuẩn mọi gói |
| `@deepseek-ai/dsh-cmdline` | `parseCmdline` — **seam** cấp `cmdlineArgs`/`appExit` và bọc exit-override | **ngoài bảng §3b** (bảng đó hiện **không tồn tại** trong `HOST-ROW-REWRITE.md` — chỉ có 3 chỗ *nhắc* tới nó) ⇒ **cần Lead xác nhận** |
| `@deepseek-ai/dsh-host-webserver` | `isWildcardHost` — **cùng một định nghĩa** "mọi giao diện" với row `webserver`, không chép lại | seam T2, bản gốc cũng import đúng gói này |
| `commander` ^15 | `Command` — thư viện CLI mà kernel dùng; viết lại bộ parse là **tự tạo lệch hành vi** (`--help`, mã thoát, câu lỗi) | **ngoài bảng §3b** (không phải gói DSH) ⇒ **cần Lead xác nhận** |

`gbh.peers` **=** 4 tên trên, và cả 4 đều có trong `peerDependencies` ⇒ **tập con, so PHẦN TỬ**
(có ca **ĐỐI CHỨNG ÂM**: thiếu 1 tên ⇒ phép kiểm **PHẢI** bắt; cùng số lượng mà lệch phần tử cũng **PHẢI** đỏ).

## 4. Bảng TRƯỚC/SAU (đo trên **cùng một argv**)

| Phép đo | TRƯỚC (bản gốc) | SAU (ta) |
|---|---|---|
| Tập export trên artifact | `["WEB_STARTUP_SERVICE","apply","inject","name"]` | **y hệt** |
| `[]` | `{openBrowser:true, trustedHosts:[]}` | **y hệt** (2 khoá, không có `host`/`port`) |
| `--host 127.0.0.1 --port 8080 --no-open --trusted-host a --trusted-host b:1` | `{openBrowser:false, host:"127.0.0.1", port:8080, trustedHosts:["a","b:1"]}` | **y hệt** |
| `--port 0` | `{openBrowser:true, port:0, …}` | **y hệt** |
| `--tls-cert chain.pem --tls-key key.pem` | `tls:{certFile,keyFile}` | **y hệt** (chỉ nêu một nửa ⇒ lỗi cách dùng, **không** cấp service) |
| `--public-url https://app.example/ui` | `publicUrl` = **chuỗi thô** (kiểm chỉ để từ chối) | **y hệt** |
| `--help` | in nguyên văn trợ giúp, thoát **0**, không cấp service | **từng ký tự y hệt** |
| `--host 0.0.0.0` · `--host ::` · `--port abc` · cờ lạ | stderr + thoát **1**, không cấp service | **y hệt từng chữ** |
| Artifact tự khai id module | 0 (row host-only) | `grep -c "id: @deepseek-ai" lib/index.js` = **0** |

Tái lập:

    cd packages/host/web-startup && ~/.bun/bin/bun run build.ts
    cd ../../.. && ~/.bun/bin/bun test tests/host/web-startup.test.ts

## 5. C6 — vật thể cấp cho service phải **ĐỘC LẬP** (kiểm bằng DANH TÍNH)

`apply` cấp một **vật thể mới** mỗi lượt cài, và mảng `trustedHosts` (kể cả mảng **rỗng** khi không nêu cờ)
cũng là **vật thể mới**. Hai ca test khẳng định bằng `toBe`/`not.toBe` chứ **không** so sâu:
sửa `trustedHosts` của thực thể này **không lan** sang thực thể kia — và bản gốc cũng vậy.

## 6. CHƯA làm (điều kiện chặn mount, không phải ghi chú cuối báo cáo)

- **KHÔNG khai `gbh.row`** ⇒ gói **không thể** làm hỏng app (trạng thái an toàn). Khai là việc của Lead **sau** lượt boot lab.
- **CHƯA** `lab:row` / mount vào profile / `check:app` / `parity:dump` — chưa có lượt boot nào của Lead cho row này.
- **CHƯA** đo 4 phép xác nhận từng row của `M6-MOUNT-PLAN.md` §3 (tên trong trang · cặp patch · thư mục profile · sổ mount).
- **Nợ kỹ thuật**: `isWildcardHost` đang lấy từ **bản DSH** `@deepseek-ai/dsh-host-webserver` (đúng như bản gốc).
  Khi row `webserver` của ta lên thay hoàn toàn, **xem lại** xem có nên trỏ sang `@galaxy-blackhole/gbh-host-webserver`
  (phải là **cùng một định nghĩa**, nếu không hai bên sẽ từ chối hai tập địa chỉ khác nhau).
