<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 12/11/2026
 desc Đóng gói .app TỰ CHỨA: runtime + host nhúng, thứ tự dò, dung lượng đo được và bằng chứng nghiệm thu
      11/11/2026: tạo mới sau khi đo được bun KHÔNG boot nổi harness (native addon cần symbol V8 của Node)
      12/11/2026: đo lại sau khi rút gọn — .app 991 MB → 278 MB (host 825 → 123 MB, 36.559 → 6.123 tệp);
      bảng loại trừ chi tiết ở §7, cách cài lại kit Office ở §8
-->

# Đóng gói tự chứa (`apps/desktop/scripts/embed.ts`)

Mục tiêu: mở `.app` từ Finder trên máy **không có** bun/node/repo checkout vẫn boot được host và render UI.

## 1. Vì sao runtime nhúng là NODE, không phải bun

Đo thật (11/11/2026, cổng 55920, HOME tạm): chạy `apps/host/node_modules/@deepseek-ai/dsh/lib/bin.js`
bằng bun ⇒ chết ngay khi chuẩn bị host:

```
gbh: fatal uncaught exception: Error: dsh: host preparation failed:
  node-addon-require-builtin unsupported: Unsupported/no-context
  (required V8 current-context symbols were not found)
```

Nguyên nhân: `@deepseek-ai/dsh-app-boot` gọi `internalModules()` → native addon `node-addon-require-builtin`
(N-API) đọc `internal/modules/{esm/loader,cjs/loader,helpers,esm/utils,esm/resolve}`, cần symbol V8 của Node.
Bun không có các symbol đó và harness **không có nhánh dự phòng**. Vì vậy:

- `Contents/Resources/runtime/node` = Node ≥ 26 (chép từ nvm/GBH_NODE) — chạy cả CLI `bh` (Node 26 strip
  type TS) lẫn harness. Đây là runtime DUY NHẤT trong gói cài.
- Không nhúng bun: app không spawn bun ở bất kỳ đâu, thêm 66 MB mà không thêm năng lực.

## 2. Thứ tự dò (host_command.rs)

| Thành phần | Thứ tự |
|---|---|
| Runtime | `Contents/Resources/runtime/node` (nhúng) → `GBH_NODE` → nvm mới nhất ≥26 → `/opt/homebrew/bin/node` `/usr/local/bin/node` → quét PATH mở rộng |
| Host | `Contents/Resources/host` (nhúng) → `GBH_REPO` → `GBH_CLI` → repo nhúng lúc build → dò ngược 0..=5 cấp từ binary |
| cwd khi spawn | gốc host đã chọn (không bao giờ là `/` của LaunchServices) |

Log mở từ Finder ghi rõ nguồn (xem `~/Library/Logs/Galaxy Blackhole/desktop-55907.log`):

```
[shell] node: /Applications/…/Contents/Resources/runtime/node (nhung) → có
[shell] host: /Applications/…/Contents/Resources/host (nhung) → có
[shell] node: … (nguon: nhung)
[shell] host: … (nguon: nhung)
[shell] spawn host pid … · cwd /Applications/…/Contents/Resources/host · …/runtime/node --experimental-strip-types …/apps/cli/src/main.ts host --port 55907
[host] [bh] ready http://127.0.0.1:55907/?token=…
```

## 3. Thư mục chép vào `Contents/Resources/host`

| Mục | Vai trò | Dung lượng (12/11/2026, sau rút gọn) |
|---|---|---|
| `apps/cli` | mã CLI `bh` (host/doctor/migrate), mount + patch | 0,2 MB |
| `apps/host` | kernel harness đã cài (`@deepseek-ai/dsh` + node_modules đã lọc) | 34,6 MB |
| `packages` | gói viết lại (`lib/` đã build + `locale/assets/runtime` + icon) | 70,9 MB |
| `profiles` | template profile để máy mới tự tạo `~/.galaxy/blackhole/profiles/blackhole` | 84 KB |
| `tools/p1b` | bước đổi id stock → GBH trong profile | 28 KB |
| `docs/PARITY-MATRIX.md` | đối chiếu row khi mount | 72 KB |
| `package.json`, `tsconfig.base.json` | ngữ cảnh gói | 16 KB |
| `.gbh-embedded` | dấu "host nhúng" ⇒ mount dùng `lib/` dựng sẵn, KHÔNG chạy `build.ts` | 226 B |
| `node_modules` | **symlink** → `apps/host/node_modules` (đủ mọi peer; bản sao đầy đủ tốn thêm 609 MB) | 0 |

Tổng host: **105,8 MB** (`du` 123 MB) · runtime node 142,3 MB (`du` 143 MB) · `.app` sau khi nhúng
**260,9 MB** theo byte (`du -sm`: **278 MB**), **6.123 tệp**. Trước khi nhúng: 9,9 MB.
`Contents/Resources` = `host` · `runtime` · `icon.icns`.
Bảng "đã bỏ gì" ở §7 — mọi con số đều do `embed` ĐO lại mỗi lượt, không chép tay.

## 4. Profile trên máy mới

`~/.galaxy/blackhole` vẫn là home của người dùng. Home trống ⇒ `ensureProfile` tạo profile từ
`profiles/blackhole` **trong gói cài** (đo được: boot trên `HOME` tạm đạt `ready` sau ~20 s, trang render
38 slot). Mount ghi `lib/` dựng sẵn vào `profiles/node_modules` nhờ dấu `.gbh-embedded`, nên boot đầu
tiên không phải chạy `build.ts` cho ~190 gói.

## 5. Lệnh

```bash
cd apps/desktop
bun run bundle     # tauri build + nhúng runtime/host + ký ad-hoc
bun run embed      # chỉ nhúng vào .app đã cài (/Applications/…) hoặc bản build gần nhất
bun run embed --app '/Applications/Galaxy Blackhole (Preview).app' --binary <path>

# cờ lọc cây host (mặc định: bỏ kit Office + lọc kernel theo phép đo boot)
bun run embed --keep-libreoffice     # ĐÓNG KÈM bộ LibreOffice (thêm ~155 MB); tên cũ: --keep-office
bun run embed --kernel-all           # giữ NGUYÊN apps/host/node_modules (debug "thiếu module")
bun run embed --tree /tmp/host-thu   # chỉ dựng cây host để đo/boot thử, không đụng .app
```

`embed` chép runtime + host, ghi `.gbh-embedded`, nối symlink `node_modules`, chép binary shell, rồi
`codesign --force --deep --sign -` (mọi thay đổi trong gói đều làm chữ ký cũ mất hiệu lực).

## 6. Bằng chứng nghiệm thu 11/11/2026

```bash
env -i HOME=$HOME PATH=/usr/bin:/bin:/usr/sbin:/sbin open -a '/Applications/Galaxy Blackhole (Preview).app'
# ~90 s sau: pgrep = 1 · lsof -ti tcp:55907 = 2 (shell + host) · ready-url-55907.txt có token
bun run tools/check/probe-once.ts "$(cat ~/.galaxy/blackhole/ready-url-55907.txt)"
# {"rootChars":533762,"slotCount":371,…}  (ngưỡng nghiệm thu: > 400000)
osascript -e 'quit app "Galaxy Blackhole (Preview)"' ; sleep 5 ; lsof -ti tcp:55907 | wc -l
# 0 — host con bị dọn theo process group
```

Lưu ý khi đo lại: lượt boot ĐẦU TIÊN sau khi nhúng phải chép `lib/` dựng sẵn vào profile (~15–20 s);
các lượt sau bỏ qua nên nhanh hơn. Cổng test dùng 55907/55920, không đụng host 5439.

## 6b. Bằng chứng nghiệm thu 12/11/2026 (sau rút gọn 991 → 278 MB)

Đo trên ĐÚNG bản đã cài `/Applications/Galaxy Blackhole (Preview).app` (HOME thật, hồ sơ thật):

```text
$ du -sm '/Applications/Galaxy Blackhole (Preview).app'
278                                  # trước: 991

$ bun run embed --app '/Applications/Galaxy Blackhole (Preview).app'
[embed] dung luong: 218.6 MB → 260.9 MB · 6123 tệp
[embed] runtime node v26.9.0 (142.3 MB · binary đơn (không có npm/npx/corepack); CLI không dùng npm)
[embed] host … (105.8 MB · 6118 tệp · kernel bỏ 656 gói 386.8 MB)

$ env -i HOME=$HOME PATH=/usr/bin:/bin:/usr/sbin:/sbin open -a '/Applications/Galaxy Blackhole (Preview).app'
# ~40 s sau (lượt ĐẦU sau khi nhúng phải chép lib/ dựng sẵn vào profile):
app_pid=50099                       # Contents/MacOS/blackhole-desktop
lsof_55907=2                       # shell + host (host pid 50107)
ready_url=http://127.0.0.1:55907/?token=3TVgdYz6…
$ grep -c '\[bh\] ready' '~/Library/Logs/Galaxy Blackhole/desktop-55907.log'
1
$ bun run tools/check/probe-once.ts "$(cat ~/.galaxy/blackhole/ready-url-55907.txt)"
{"rootChars":635028,"slotCount":357,…}   # ngưỡng nghiệm thu > 400000 ⇒ ĐẠT (1,59×)
$ osascript -e 'quit app "Galaxy Blackhole (Preview)"'
port_after_quit=0 · app_pid_after=0
```

218 row mount được (bằng bản không rút gọn), 0 dòng "khong mount duoc", `errors`/`pageErrors` rỗng.

## 7. Danh sách loại trừ (đo bằng chính `embed`, in ra mỗi lượt)

`embed` áp luật NGAY trong `cpSync` (filter) nên **idempotent**: chạy lại luôn ra đúng cây đó, không sót tệp
cũ, không ai phải cắt tay. Bảng dưới là số đo trên cây nguồn trong một lượt `bun run embed` (12/11/2026):

| # | Nhóm bị loại | Quy tắc | MB | Tệp |
|---|---|---|---:|---:|
| 1 | Bộ LibreOffice | `packages/host/gbh-libreoffice-kit-darwin-x64/**` (cờ `--keep-libreoffice` để giữ) | 155,4 | 738 |
| 2 | Gói kernel ngoài đường boot | `apps/host/node_modules/<gói>` không nằm trong danh sách đo `NODE_V8_COVERAGE` + peer + ngoại lệ | 386,8 | 18.741 |
| 3 | Nguồn/thử nghiệm/tài liệu của gói ta | `packages/**/{src,test,tests,__tests__,docs}` | 32,7 | 2.585 |
| 4 | Khai báo kiểu | `**/*.d.ts`, `*.d.mts`, `*.d.cts` | 19,2 | 4.904 |
| 5 | Source map | `**/*.map`, `**/*.tsbuildinfo` | 17,9 | 1.767 |
| 6 | README/CHANGELOG/HISTORY | `**/README*`, `**/CHANGELOG*`, `**/HISTORY*` | 5,3 | 747 |
| 7 | Nguồn TS không phải entry | `apps/host/node_modules/**`, `packages/**` — TRỪ tệp mà `main`/`module`/`bin`/`exports` trỏ tới | 3,4 | 616 |
| 8 | Stamp/log/rác | `.gbh-*`, `*.debundled`, `*.log`, `.DS_Store`, `*.truoc-vi` | 1,7 | 150 |
| 9 | `docs/`, `test/` trong node_modules | `apps/host/node_modules/**/{docs,test,tests,__tests__}` | 1,5 | 219 |
| 10 | Markdown khác | `**/*.md` trong hai cây trên | 0,5 | 311 |
| 11 | Prebuild của nền tảng khác | `**/prebuilds/<platform>-<arch>` ≠ `${process.platform}-${process.arch}` (máy này: `darwin-x64`; giữ thêm bản `universal`) | 0 * | 0 * |
| | **TỔNG đã loại** | | **624,4** | **30.778** |

\* Nhóm 11 bằng 0 ở chế độ mặc định vì `node-pty` (gói mang prebuild win32/linux) đã bị nhóm 2 loại; luật
vẫn chạy và có tác dụng khi `--kernel-all` (đo trên cây đầy đủ: `node-pty/prebuilds/win32-*` 24 MB).

Ba điều KHÔNG bị cắt, và lý do:

- **`.ts` trong `apps/cli`** — vỏ Tauri chạy `node --experimental-strip-types apps/cli/src/main.ts`, tức
  .ts ở đó LÀ mã chạy. Luật bỏ `.ts` chỉ áp cho `apps/host/node_modules/` và `packages/`.
- **`docs/PARITY-MATRIX.md`** (cấp repo) — dữ liệu của cổng mount, nằm NGOÀI hai cây bị lọc.
- **`.gbh-embedded`** — dấu "host nhúng" để mount dùng `lib/` dựng sẵn; `skipReason` miễn trừ tường minh.

## 8. Bộ Office (LibreOffice kit) không nằm trong gói — cách cài lại

Từ 12/11/2026 `.app` **không kèm** `gbh-libreoffice-kit-darwin-x64` (155 MB): nó chỉ phục vụ
"office → pdf" (row `office-to-pdf`), không nằm trên đường boot + render. Hệ quả: mở tệp **.docx/.xlsx/
.pptx** trong app sẽ báo **thiếu kit** (row `office-to-pdf` không chuyển được), mọi tính năng khác
(chat, tool, terminal, preview PDF/ảnh) vẫn nguyên.

Ba cách lấy lại:

```bash
# (1) đóng gói kèm kit ngay từ đầu (+155 MB)
cd apps/desktop && bun run embed --keep-libreoffice --app '/Applications/Galaxy Blackhole (Preview).app'

# (2) cài kit vào kernel của bản cài rồi nhúng lại (không cần build lại Tauri)
cd apps/host && bun add @deepseek-ai/libreoffice-kit-darwin-x64

# (3) cài thủ công vào profile đang chạy (không đụng .app)
cd ~/.galaxy/blackhole/profiles && bun add @deepseek-ai/libreoffice-kit-darwin-x64
```

Kiểm tra sau khi cài: `bh doctor` (hoặc log host) phải thấy `link addon native: … libreoffice-kit-darwin-x64`;
mở một tệp .docx trong app phải ra PDF. Nhúng lại bằng (1) là cách bền nhất vì `embed` là nguồn duy nhất
của cây host trong gói.

## 9. Ghi chú kỹ thuật của lượt rút gọn 12/11/2026

- **Runtime `node` (142,3 MB) không cắt được**: `Contents/Resources/runtime/node` là MỘT binary tĩnh
  (`Mach-O 64-bit executable x86_64`, 149.186.368 B). Node phát hành cho macOS không kèm
  `lib/node_modules/npm`, `bin/npx`, `lib/node_modules/corepack` — ba thứ đó chỉ có khi nhúng cả cây cài
  đặt. CLI `bh` cũng KHÔNG chạy npm/npx lúc boot (chỉ nhắc trong chú thích mã) ⇒ quyết định: **giữ nguyên
  binary, không cần npm**. `embed.ts` vẫn có nhánh phòng thủ: nếu nguồn runtime là THƯ MỤC thì bỏ
  `lib/node_modules/{npm,corepack}` + `bin/{npm,npx}` (log sẽ ghi "cây cài đặt: bỏ …").
- **`gbh.peers` của row `llm-pi-ai`**: thêm `@earendil-works/pi-ai` (12/11/2026). Đây là *dependency* runtime
  của gói nhưng trước đó không khai là peer, nên mount không tạo symlink
  `<profile>/node_modules/@earendil-works/pi-ai`; với kernel ĐÃ LỌC, import của row chết với
  `ERR_MODULE_NOT_FOUND: Cannot find package '@earendil-works/pi-ai'` và app báo "1 entry did not activate".
  Khai peer là đúng quy ước của repo (20 gói khác khai `zod`, nhiều gói khai `chokidar`/`yaml`/`undici`…).
  Sau khi khai: `failed to import` = 0, vẫn 218 row, `rootChars` 635.028.
- **Đo lại khi kernel đổi phiên bản**: danh sách `KERNEL_BOOT_PACKAGES` là HỢP ĐỒNG với kernel. Kernel mới
  ⇒ phải đo lại bằng `NODE_V8_COVERAGE` (thiếu gói thì boot chết ngay dòng đầu với "Cannot find module");
  muốn tắt hẳn bộ lọc thì `--kernel-all`.

