<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README cua @galaxy-blackhole/gbh-shell — port 1:1 host-only cua @deepseek-ai/dsh-shell
      (stock lib/index.js 95 dong + lib/types/*.d.ts); GBH-only, KHONG co row stock de mirror,
      chua mount/chua flip
-->

# @galaxy-blackhole/gbh-shell

Bản viết lại Galaxy Blackhole của **@deepseek-ai/dsh-shell 0.2.1-alpha.4** — gói **host-only, một mặt**:
stock chỉ có `lib/index.js` **95 dòng** và ba tệp `lib/types/*.d.ts` (72 + 227 + 40 dòng); manifest gốc
**không** có `dsh.client`, không có `lib/client.js`.

Gói là **seam trừu tượng** `ctx.shell`: một lớp `ShellExecutor` kế thừa `Service` của cordis, hai phương
thức trừu tượng `resolve`/`execute` cho executor cài đặt, getter `sandboxMode`, hằng `DSH_ENV_PREFIX`,
và hàm `parseExitStatus` tách marker trạng thái thoát khỏi kết quả tool shell đã render. Gói **không**
spawn tiến trình, không mở mạng, không đọc/ghi tệp — toàn bộ việc đó thuộc implementation của consumer.

## 0. Đối chiếu dòng (nguồn CHỈ ĐỌC)

Nguồn duy nhất: `apps/host/node_modules/@deepseek-ai/dsh-shell/` — không sửa, không copy nguyên bundle.

| nguồn stock | dòng | nội dung | đích trong gói |
|---|---:|---|---|
| `lib/index.js` | 1–2 | import `Service` (cordis) + `DSH_ENV_PREFIX` (dsh-subprocess) | `src/index.ts` 18–26 |
| `lib/index.js` | 4–10 | module doc của `render` | `src/render.ts` 11–16 |
| `lib/index.js` | 11–30 | JSDoc chi tiết của `parseExitStatus` | `src/render.ts` 35–52 |
| `lib/index.js` | 31–46 | thân `parseExitStatus` (regex + thứ tự signal → exit → 0) | `src/render.ts` 53–72 |
| `lib/index.js` | 49–54 | module doc của `index` | `src/index.ts` 11–16 |
| `lib/index.js` | 55–82 | JSDoc lớp + 5 gạch đầu dòng ngữ nghĩa implementation | `src/index.ts` 64–87 |
| `lib/index.js` | 83–93 | `class ShellExecutor extends Service`, constructor `super(ctx, "shell")`, getter `sandboxMode` | `src/index.ts` 88–103 |
| `lib/index.js` | 94 | danh sách export (4 tên runtime) | `src/index.ts` 26 · 32–55 · 123 |
| `lib/types/index.d.ts` | 1–6 | module doc của `index` | `src/index.ts` 11–16 |
| `lib/types/index.d.ts` | 7–13 | import kiểu, `export { DSH_ENV_PREFIX }`, `export type { … }` | `src/index.ts` 18–45 |
| `lib/types/index.d.ts` | 14–18 | augmentation `Context.shell: ShellExecutor` | `src/index.ts` 57–62 |
| `lib/types/index.d.ts` | 19–46 | JSDoc lớp + 5 gạch đầu dòng ngữ nghĩa implementation | `src/index.ts` 64–87 |
| `lib/types/index.d.ts` | 47–54 | khai báo lớp + getter `sandboxMode` | `src/index.ts` 88–103 |
| `lib/types/index.d.ts` | 55–70 | JSDoc + chữ ký `resolve` · `execute` trừu tượng | `src/index.ts` 105–120 |
| `lib/types/index.d.ts` | 71 | `export default ShellExecutor` | `src/index.ts` 123 |
| `lib/types/types.d.ts` | 1–227 | toàn bộ từ vựng thực thi: `ShellObservedStreams`, `ShellSandboxInfo`, `ShellExpiryPolicy`, `ShellExecRequest`, `ShellExecSpec`, `ShellRunResult`, `ShellProcessStatus`, `ShellProcessRead`, `ShellProcess`, `ShellExecution` | `src/types.ts` 11–254 |
| `lib/types/render.d.ts` | 1–7 | module doc của `render` | `src/render.ts` 11–16 |
| `lib/types/render.d.ts` | 8–18 | `ParsedExitStatus` | `src/render.ts` 18–33 |
| `lib/types/render.d.ts` | 19–39 | JSDoc + chữ ký `parseExitStatus` | `src/render.ts` 35–72 |
| `package.json` stock | 29–38 | 3 peer + 3 dev (cùng phiên bản) | `package.json` `peerDependencies` · `devDependencies` |

Không port `README.md`, `README.zh.md`, `LICENSE`: đều là tài liệu/giấy phép, không tham gia runtime.
Không có `locale/` để port (stock không có).

## 1. TRƯỚC → SAU

| hạng mục | TRƯỚC (stock) | SAU (gói này) |
|---|---|---|
| entry runtime | `lib/index.js` 95 dòng / 4.411 byte, đã gộp region `render` vào `index` | `lib/index.js` 42 dòng / 867 byte — **một** artifact, đúng một entry như stock |
| nguồn | bundle JS sinh sẵn + 3 tệp `.d.ts` | `src/index.ts` 123 dòng · `src/types.ts` 254 dòng · `src/render.ts` 72 dòng |
| build | pipeline upstream gộp region | `build.ts` gọi `Bun.build` **riêng cho từng entrypoint** (`ENTRIES`), `packages: "external"` |
| hành vi | seam `ctx.shell` + `parseExitStatus` | **không đổi** — cùng tên service, cùng lớp, cùng thứ tự prototype, cùng regex/câu trả về |
| test | — | `tests/host/shell.test.ts` · **17 ca / 170 expect** · 0 fail |

Khác biệt DUY NHẤT là đóng gói: stock ship một artifact JS đã gộp cùng các `.d.ts`; gói này ship một
artifact JS build từ ba module TS (kiểu nằm trong `src/types.ts`, hàm render nằm trong `src/render.ts`).
Hành vi quan sát được từ `exports["."]` giống hệt: cùng 4 tên runtime, cùng giá trị, cùng ngữ nghĩa.

### Hành vi giữ nguyên (11 điểm)

1. **Đăng ký service**: constructor gọi đúng `super(ctx, "shell")`; cordis đăng ký ngay và tự gỡ khi fiber
   sở hữu unload. Nạp implementation thứ hai trên cùng context ném
   `service "shell" has been registered` — cùng thông điệp như stock.
2. **Hình dạng lớp**: tên `ShellExecutor`, `length === 1`, prototype chỉ có `constructor` và
   `sandboxMode`; kế thừa **cùng một** `Service` của kernel (test so cả chuỗi prototype).
3. **`sandboxMode`**: getter chỉ có get, không set, không enumerable; trả `undefined` ở lớp trừu tượng.
   Lớp con override được như stock.
4. **Hai phương thức trừu tượng**: `resolve`/`execute` chỉ tồn tại ở tầng kiểu; TypeScript xoá chúng khi
   build, nên prototype runtime **không** có hai tên này — y stock.
5. **`DSH_ENV_PREFIX`**: tái xuất nguyên văn từ `@deepseek-ai/dsh-subprocess`; cùng binding, cùng chuỗi
   `DSH_`.
6. **`default`**: chính là lớp `ShellExecutor` của gói (`default === ShellExecutor`), không phải lớp của
   stock; stock cũng vậy.
7. **`parseExitStatus`**: hai regex nguyên văn; `[killed by signal: X]` thắng khi đứng cuối; sau đó
   `[exit code: N]`; vắng cả hai trả `{ body: text, exitCode: 0 }`. Marker tiêu thụ bị bỏ khỏi `body`;
   marker phải có newline đứng trước và khớp ở cuối chuỗi.
8. **Bề mặt kiểu**: đúng bộ tên của `lib/types/index.d.ts` — `CollectedOutput`, `DshEnvironment`,
   `DshEnvironmentKey`, `ShellExecRequest`, `ShellExecSpec`, `ShellExecution`, `ShellExpiryPolicy`,
   `ShellProcess`, `ShellProcessRead`, `ShellProcessStatus`, `ShellRunResult`, `ShellSandboxInfo`,
   `ParsedExitStatus`.
9. **Augmentation**: khai `Context.shell: ShellExecutor` như d.ts gốc. Đã đo xung đột: biên dịch cùng
   `bash-sandbox`/`shell-env` (hai gói còn import d.ts stock) **không** phát sinh TS2717 vì hai lớp
   tương thích cấu trúc; nếu sau này một bản d.ts lệch cấu trúc được nạp chung, đây là điểm phải xử lý.
10. **Peer/dev**: khai đúng ba peer của stock với đúng phiên bản (`dsh-subprocess`, `dsh-sandbox`,
    `cordis`), và `devDependencies` bằng `peerDependencies`; test so trực tiếp với manifest stock.
11. **Không tác dụng phụ**: artifact không import `node:child_process`, không gọi `Bun.spawn`, không
    `fetch`; seam chỉ là hợp đồng cho implementation.

## 2. Bề mặt

| artifact | export lúc chạy | ghi chú |
|---|---|---|
| `lib/index.js` | `DSH_ENV_PREFIX`, `ShellExecutor`, `default`, `parseExitStatus` | `Object.keys` = 4 tên, y stock |

| thành viên công khai | hành vi (nguyên văn bản gốc) |
|---|---|
| `constructor(ctx)` | đăng ký `ctx.shell`; một implementation mỗi context |
| `get sandboxMode` | chế độ sandbox mặc định, hoặc `undefined` khi không sandbox |
| `resolve(request)` | **trừu tượng** — implementation áp mặc định/trần, trả `ShellExecSpec` |
| `execute(spec)` | **trừu tượng** — implementation chuẩn bị/spawn, trả `Promise<ShellExecution>` |

**Không có `apply`, `Config`, `inject`, `dsh.client`** — stock cũng không có. Đây là **class plugin**
trừu tượng: consumer kế thừa rồi mới nạp lớp con.

`src/types.ts` phơi thêm `ShellObservedStreams` và các kiểu `SubprocessOutput*` như `types.d.ts` gốc,
nhưng entry `.` **không** tái xuất chúng — đúng danh sách của `index.d.ts` stock.

## 3. Metadata — GBH-ONLY, KHÔNG có row stock để mirror

Đo ngày **19/10/2026** trên `/tmp/dump-now2.txt` (**2.297 dòng**):

```bash
grep -nE "^[[:space:]]*- id: .*shell" /tmp/dump-now2.txt
# 251:  - id: shell-env               name: '@deepseek-ai/dsh-shell-env'
# 808:  - id: ui-settings-shell       name: '@deepseek-ai/dsh-client-ui-settings-shell'
# 1198:       - id: persistent-shell (row lồng, tool persistent)
# 1810: - id: ui-settings-shell-ours name: '@galaxy-blackhole/gbh-client-ui-settings-shell'
# 1966: - id: shell-identity         name: '@galaxy-blackhole/gbh-host-shell-identity'
# 2163: - id: shell-env-ours         name: '@galaxy-blackhole/gbh-shell-env'
grep -n "name: '@deepseek-ai/dsh-shell'" /tmp/dump-now2.txt   # 0 dòng (exit 1)
```

**Kết luận đo**: không có `- id: shell`, cũng không có row nào trỏ tới `@deepseek-ai/dsh-shell`. Các dòng
chứa chữ `shell` đều thuộc **gói khác** (`shell-env`, `shell-identity`, `ui-settings-shell`,
`persistent-shell`). Vì vậy:

- **KHÔNG khai `gbh.row`** — không có row stock nào để mirror; khai một row cho seam này sẽ khiến
  `check:rows` so với hư không.
- **KHÔNG khai `gbh.row_unmounted_ly_do`** — gói không phải "row đang park"; nó là **seam thư viện** chưa
  bao giờ có row. Lý do đo được ghi ở `gbh.draft` và mục này.
- **Chưa mount / chưa flip.** Khi nào bundle patch thật sự thêm row id `shell` (kèm dòng đo mới), mới thêm
  `gbh.row` đúng hình dạng row đó.

Vì sao seam không có row: stock `dsh-shell` được các consumer **import inline** trong cùng tiến trình
(`bash-sandbox`, `shell-env`, `tool-bash`, `tool-pwsh`, …), giống `dsh-sandbox`/`dsh-subprocess`; nó
không phải plugin mount. Consumer chuyển sang gói này là việc của từng task riêng.

## 4. Nợ

- **Test đã có**: `tests/host/shell.test.ts` — **17 ca / 170 expect / 0 fail**, **518 dòng**. Mỗi ca chạy
  **cả hai bản** trên cùng fixture: artifact của ta được build vào `mkdtemp`, `node_modules/@deepseek-ai`
  được symlink tới `apps/host/node_modules` để phân giải peer, `afterAll` dọn thư mục tạm.
- **Seam giả, không spawn, không mạng**: các ca `resolve`/`execute` dùng lớp con giả trả handle giả; không
  có tiến trình thật, không socket. Test còn kiểm **tĩnh** artifact không chứa `node:child_process`,
  `Bun.spawn`, `fetch(`.
- **Không ship `.d.ts`**: theo quy ước các gói khác của repo; `exports` trỏ thẳng `lib/index.js`. Kiểu
  công khai sống trong `src/` và được tái xuất bởi entry `.` khi consumer đọc source.
- **Rủi ro augmentation**: gói giữ `Context.shell` như stock. Hiện **không** xung đột với d.ts stock
  (đã đo cùng `bash-sandbox` + `shell-env`). Nếu tương lai một bản d.ts `ShellExecutor` khác cấu trúc
  được nạp chung, TS2717 có thể xuất hiện — khi đó phải bỏ augmentation ở đây hoặc thống nhất kiểu.
- **Chưa mount**: `check:rows`/`check:app` chưa đo gói này; không có mục `packages/README.md` §4 vì
  `gbh.row` vắng (cổng `hygiene` chỉ áp cho gói khai `gbh.row`).
- **Consumer chưa repoint**: `bash-sandbox`, `shell-env`, `tool-bash`, `tool-pwsh`, … vẫn import
  `@deepseek-ai/dsh-shell`. Chuyển từng consumer là task riêng, cần A/B và cập nhật `peerDependencies`.
- **Chỉ một entry runtime**: `render.ts`/`types.ts` là module nguồn nội bộ, bị gộp vào `lib/index.js`
  đúng như stock gộp hai region; không có artifact `lib/render.js`/`lib/types.js` để lệch bề mặt.
- **`dsh-sandbox` chỉ dùng kiểu**: artifact không import gói này; nó vẫn là peer vì d.ts và hợp đồng
  `SandboxMode`/`SandboxExecutionPolicy` cần nó. `gbh.peers` khai cả ba peer như manifest.
- **Không có locale**: stock không có `locale/`; không có chuỗi UI để chép.

## 5. Lệnh

```bash
# build (từ package) -> lib/index.js
cd galaxy-blackhole/blackhole-tauri/packages/host/shell
/Users/buitronghieu/.bun/bin/bun run build.ts

# typecheck (từ repo root)
/Users/buitronghieu/.bun/bin/bun node_modules/typescript/lib/tsc.js -p packages/host/shell

# test A/B (từ repo root) — 17 pass / 170 expect
/Users/buitronghieu/.bun/bin/bun test tests/host/shell.test.ts

# lint scoped: copy gói + test vào cây tạm rồi trỏ GBH_LINT_ROOT (bỏ node_modules/lib)
SCOPE=$(mktemp -d)
mkdir -p "$SCOPE/packages/host" "$SCOPE/tests/host"
cp -R packages/host/shell "$SCOPE/packages/host/"
rm -rf "$SCOPE/packages/host/shell/node_modules" "$SCOPE/packages/host/shell/lib"
cp tests/host/shell.test.ts "$SCOPE/tests/host/"
for t in header file-length jsdoc; do GBH_LINT_ROOT="$SCOPE" /Users/buitronghieu/.bun/bin/bun run tools/lint/$t.ts --strict; done
```

Số dòng hiện tại: `src/index.ts` 123 · `src/types.ts` 254 · `src/render.ts` 72 · `build.ts` 84 ·
`tests/host/shell.test.ts` 518 · `lib/index.js` 42 · README này 191.
