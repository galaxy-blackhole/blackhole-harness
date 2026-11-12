<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Nguon doi chieu (G4) + ly do peer + TRUOC/SAU + phan CHUA lam cua goi gbh-web-runtime (row web-runtime)
-->

# @galaxy-blackhole/gbh-web-runtime

Bản viết lại của Galaxy Blackhole cho row **`web-runtime`** — tên gói gốc **`@deepseek-ai/dsh-web-app`**.
Phạm vi: **phần "keo" runtime** của bề mặt web, **MỘT MẶT**, **row ĐANG BẬT**.

## 0. Bước 0 — xác nhận cặp row (đo, không suy từ tên thư mục)

| phép đo | kết quả |
|---|---|
| cặp `- id: web-runtime` + `name: '@deepseek-ai/dsh-web-app'` trong `.parity/dumps/2026-10-17T23-54-01/ours.yml` | **CÓ**, dòng **567–575** (cùng cặp ở `oracleA.yml` dòng 537 và `stock.yml` dòng 484) |
| row đang BẬT? | **BẬT** — không có `disabled` trong cả ba dump |
| `lib/client.js` của gói gốc | **KHÔNG tồn tại** ⇒ một mặt (`lib/` chỉ có `index.js` 180 dòng · `public-url-D_dMK-yI.js` 29 dòng · `startup.js` 73 dòng · `types/`) |
| `dsh.client` trong `package.json` gói gốc | **KHÔNG** (`dsh` chỉ có `bundle.patch`) ⇒ câu hỏi thứ 5 trả lời "một mặt" |
| `locale/` trong gói gốc | **KHÔNG có** ⇒ luật **000e** không áp dụng |
| chi phí row (`bun run row:cost web-runtime`) | **181 dòng** code row · **0** inject cấp bundle · **0** primitive · **0** khoá từ điển · **không** trạng thái sống |

**`config:` của row trong oracle dump (nguyên văn):**

```yaml
- id: web-runtime
  name: '@deepseek-ai/dsh-web-app'
  inject:
    - webStartup
  config:
    openBrowser: !!js ctx.webStartup.openBrowser
    printUrl: true
    publicUrl: !!js ctx.webStartup.publicUrl
    surfaceContext: true
```

## 1. Nguồn đối chiếu (G4) — CHỈ ĐỌC

| mục | bản gốc | mức dẫn xuất |
|---|---|---|
| plugin + hành vi | `apps/host/node_modules/@deepseek-ai/dsh-web-app/lib/index.js` (180 dòng) | **viết lại theo hành vi** — cùng thứ tự kiểm, cùng thông điệp, cùng mặc định |
| `parsePublicUrl` | `…/dsh-web-app/lib/public-url-D_dMK-yI.js` (29 dòng) | **viết lại theo hành vi** — cùng thứ tự từ chối và cùng chuỗi thông điệp |
| kiểu | `…/dsh-web-app/lib/types/index.d.ts` | viết lại interface `Config` · `WebApp` trong `src/index.ts` |
| dòng URL · biến bash · bàn giao trình duyệt | `lib/index.js` mục `apply` | **viết lại theo hành vi** |
| `startup` (row **khác**: `web-startup`) | `lib/startup.js` | **KHÔNG** thuộc gói này — đã có `packages/host/web-startup` |

## 2. Năm câu hỏi

1. **Row đang bật?** Có — xem §0.
2. **Thuần host hay có mặt client?** **Thuần host** — không `lib/client.js`, không `dsh.client`; bề mặt là **service** (`webApp`) + tác dụng phụ lên seam.
3. **Seam nào?** `webServer` (khai `inject`), `shellEnv`, `connection`, `loader` (qua `ctx.get`), `launchEnvironment` (qua `ctx.get`), và **plugin con** `frontend-static` mount bằng `ctx.plugin`. Peer: xem §3.
4. **Hành vi đo được?** `webApp.getAdvertisedUrl()` · bản ghi `shellEnv.register({ name: "web-runtime", variables: { DSH_WEB_URL } })` · dòng `dsh web: <url>` trên console · lời gọi mở trình duyệt (bị triệt tiêu khi chạy qua SSH).
5. **Gói gốc có `dsh.client`?** **Không** ⇒ thay row **không** làm mất nửa browser nào.

## 3. Vì sao các peer này (và trạng thái trong bảng §3b)

| peer | vì sao ĐO ĐƯỢC | §3b |
|---|---|---|
| `@deepseek-ai/cordis` | kiểu `Context`; kernel cấp một thể hiện | **Bậc 1** |
| `@deepseek-ai/schemastery` | schema `Config` — `String(Config)` phải trùng bản gốc | **Bậc 1** |
| `@deepseek-ai/dsh-host-webserver` | `bindUrlHost`/`isLoopbackHost` là hàm THUẦN của seam mà row đọc; tiền lệ: `packages/host/web-startup` cũng peer gói này | **ngoài bảng** — cần Lead duyệt |
| `@deepseek-ai/dsh-host-frontend-static` | bản gốc `ctx.plugin(FrontendStatic, { distIndex })` — chủ sở hữu ghế fallback; không có row riêng nên **phải** mount từ đây | **ngoài bảng** — cần Lead duyệt |
| `@deepseek-ai/dsh-launch-environment` | `launchEnvironmentOf`/`launchedThroughSsh` quyết định **có mở trình duyệt hay không**; tiền lệ: `packages/host/llm-deepseek` | **ngoài bảng** — cần Lead duyệt |
| `@deepseek-ai/dsh-subprocess` | `scrubbedParentEnv()` — tiến trình mở trình duyệt **không** được mang thông tin xác thực của Harness | **ngoài bảng** — cần Lead duyệt |
| `@deepseek-ai/dsh-app-boot` | `auditStartupEntries` — chỉ báo "ready" SAU khi cây Loader yên và audit đạt; tiền lệ: `packages/host/hmr` | **ngoài bảng** — cần Lead duyệt |
| `open` (npm 11) | trình mở trình duyệt của nền tảng, phân giải bằng `import.meta.resolve("open")` như bản gốc | **Bậc 3** nhưng **không có trong bảng** — cần Lead duyệt |

`gbh.peers` **BẰNG ĐÚNG** tập khoá của `peerDependencies` (kiểm bằng phép so **PHẦN TỬ**, có **đối chứng âm** trong test).

**Một khác biệt CÓ CHỦ Ý**: gói này **KHÔNG** khai `declare module "@deepseek-ai/cordis"` để thêm `webApp`
vào `Context` như `.d.ts` gốc — khai trùng kiểu đó với `.d.ts` gốc đang có trong chương trình `tsc` sẽ
sinh lỗi "subsequent property declarations must have the same type" (luật 000d). Chỗ dùng được **thu hẹp**
bằng interface cục bộ (`ShellEnvRegistrar`, `Connection`, `Loader`) thay vì `any`.

## 4. Hành vi giữ nguyên (đo trên artifact)

- `name` = **`web-app`** (tên plugin, KHÔNG phải id row) · `inject` = `["webServer"]`.
- `Config`: `openBrowser`/`printUrl`/`surfaceContext` mặc định `true`; `publicUrl` đi qua `parsePublicUrl`
  ⇒ chuẩn hoá pathname kết thúc `/`; `String(Config)` **trùng từng ký tự** với bản gốc.
- `apply`: (1) kiểm `bindUrlHost` khi KHÔNG có `publicUrl` ⇒ ném đúng thông điệp zone-id; (2) cảnh báo
  phơi HTTP ngoài loopback; (3) `handoffBrowser = openBrowser && !launchedThroughSsh(...)`;
  (4) `ctx.provide("webApp", { getAdvertisedUrl })`; (5) mount `FrontendStatic` với
  `internals.resolveDistIndex()`; (6) `surfaceContext` ⇒ `shellEnv.register`; (7) `printUrl || handoffBrowser`
  ⇒ chờ `loader.await()`, `auditStartupEntries`, rồi in `dsh web: <url đã ký>` **một lần cho mỗi root**.
- `internals` = `{ resolveDistIndex, openBrowser }` — `apply` gọi **qua** `internals` như bản gốc (móc thử).

## 5. Bảng TRƯỚC/SAU

| phép đo | TRƯỚC (row gốc) | SAU |
|---|---|---|
| row trong cây plugin | `web-runtime` → `@deepseek-ai/dsh-web-app` | **ĐÃ ĐỔI** — `gbh.row` do **LEAD** khai 18/10/2026 (**không phải phiên viết gói này**); patch đang chạy `~/.galaxy/blackhole/app.patch.yml` có `- id: web-runtime / disabled: true` + `- insert: - id: web-runtime-ours / name: '@galaxy-blackhole/gbh-web-runtime'` với **đúng 4 giá trị config của oracle** |
| `webApp.getAdvertisedUrl()` | origin của listener (hoặc `publicUrl`) | hành vi **y hệt**, chứng minh bằng test đối chứng |
| dòng `dsh web: <url>` | in sau audit | **y hệt** |
| `DSH_WEB_URL` | tên `web-runtime`, mô tả nguyên văn | **y hệt** |

## 6. Test — `tests/host/web-runtime.test.ts` (**12 test · 64 expect**)

1. **Artifact**: tập export của ta **BẰNG** tập export bản gốc (`Config, apply, inject, internals, name`), không `default`; `build.ts` có `process.argv[2]`.
2. **Bề mặt**: `name`/`inject`/`Config`/`internals` + `resolveDistIndex()` trùng bản gốc.
3. **Hành vi chính**: cấp `webApp`, mount `FrontendStatic`, đăng ký `DSH_WEB_URL`, in URL.
4. **Chờ Loader**: chưa in trước khi cây yên; **chỉ một dòng cho mỗi root** (WeakSet).
5. **Bàn giao trình duyệt**: mở đúng URL **đã ký**; hai dòng log khớp bản gốc.
6. **publicUrl**: transform + 4 bẫy bị từ chối, **cùng thông điệp** với bản gốc.
7. **Đường lỗi**: zone-id ném **trước** mọi tác dụng phụ; có `publicUrl` thì đi tiếp; cảnh báo HTTP **một dòng**; HTTPS im lặng; tắt cờ ⇒ không đăng ký/không in.
8. **metadata**: `gbh.peers ⊆ peerDependencies` so **phần tử**, kèm **đối chứng âm**; khẳng định **chưa** có `gbh.row`.
9. **C6 danh tính**: hai lượt `apply` ⇒ hai `webApp`, hai closure, hai bảng biến **không** chia sẻ tham chiếu.

## 7. CHƯA làm / điều kiện mount (nói thẳng)

- **`gbh.row` do LEAD khai** (18/10/2026) trong lúc phiên này đang viết gói — phiên này **KHÔNG tự khai**
  (đúng chỉ đạo). Test đọc **cả hai dạng** `gbh.row` / `gbh.row_unmounted_ly_do.row` và khẳng định id +
  4 giá trị config khớp oracle dump.
- **CHƯA có phép đo lab của chính phiên này** (`#root` · `did not activate` · lỗi console) — patch đang chạy
  chứng minh **đã mount**, nhưng số đo sức khoẻ app thuộc **lượt boot của Lead**, không phải số của gói này.
- **Peer ngoài bảng §3b** (6 tên + `open`) — vẫn **cần Lead duyệt** dù row đã mount; lý do đo được ở §3.
- `webApp` **chưa** được khai vào kiểu `Context` toàn cục (lý do ở §3) ⇒ row nào muốn `ctx.webApp` có kiểu
  phải tự khai, hoặc ta khai **sau** khi thống nhất với Lead cách tránh trùng `.d.ts`.
