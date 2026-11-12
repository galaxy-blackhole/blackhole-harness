<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 12/11/2026
 desc Vỏ desktop Tauri: tự dò runtime Node + gốc host bằng đường dẫn tuyệt đối, cửa sổ ẩn tới khi host
      sẵn sàng (không bao giờ trắng), dọn cả nhóm tiến trình khi thoát, log đọc được khi mở từ Finder
      11/11/2026: bản dev đổi tên hiển thị "Galaxy Blackhole (Preview)" + cổng mặc định cố định 55907
      11/11/2026: màn hình chờ chỉ còn quả cầu animate + MỘT dòng trạng thái; log thô vào nút "Chi tiết"
      12/11/2026: gói 991 MB → 278 MB (bỏ kit Office + lọc kernel/prebuild/nguồn TS); §7 ghi rõ mất gì,
                  cách cài lại Excel/Word/PowerPoint
-->

# apps/desktop — vỏ Tauri của Galaxy Blackhole Desktop

Vỏ này **sở hữu host của nó**: nó spawn tiến trình host, chờ dòng marker có token, rồi trỏ cửa sổ vào
URL đã xác thực (đúng vai trò carrier mà bản desktop của DSH làm, thay Electron main bằng Rust).

## 0. Tên sản phẩm và tệp build (đổi 10/11/2026, đổi lại 11/11/2026)

Sản phẩm build là **`blackhole-desktop`**; **tên người dùng thấy là "Galaxy Blackhole (Preview)"** — đây là
**bản dev**; bản thật sau này mới tên "Galaxy Blackhole". Hai tên ấy không được lẫn nhau: mở Finder/Dock
phải thấy chữ **Preview** để biết mình đang chạy bản chưa phát hành.

| Khóa | Trước | Sau (11/11/2026) | Vì sao |
|---|---|---|---|
| `productName` | `blackhole-desktop` | **`Galaxy Blackhole (Preview)`** | Tên sản phẩm là tên người đọc; tên tệp build do `mainBinaryName` quyết định |
| `mainBinaryName` (file thực thi trong bundle) | `blackhole-desktop` | **`blackhole-desktop`** (giữ) | `Contents/MacOS/<tên>` ổn định ⇒ `smoke`, `ps`, log không đổi |
| `bundle.macOS.bundleName` | `Galaxy Blackhole` | **`Galaxy Blackhole (Preview)`** | Quyết định tên `.app` do bundler sinh ra |
| `src-tauri/Info.plist` → `CFBundleDisplayName` | `Galaxy Blackhole` | **`Galaxy Blackhole (Preview)`** | Tên Finder/Dock hiển thị |
| `src-tauri/Info.plist` → `CFBundleName` | `Galaxy Blackhole` | **`Galaxy Blackhole`** (ghim) | Giữ ổn định: menu bar/AppleScript đọc tên ngắn không đổi |
| `identifier` | `com.galaxyblackhole.desktop` | **giữ nguyên** | Dữ liệu người dùng ở `~/.galaxy/blackhole`; đổi là mất quyền TCC + tách LaunchServices |

Tauri **sinh** `Info.plist` của bundle từ `tauri.conf.json` rồi **trộn** `src-tauri/Info.plist` đè lên, nên
hai khóa trên phải sửa ở `src-tauri/Info.plist` (nguồn), không phải file đã sinh trong `target/`.

Đường dẫn sản phẩm: `src-tauri/target/release/bundle/macos/Galaxy Blackhole (Preview).app` (9,78 MiB).
Cài: `ditto "<bundle>" "/Applications/Galaxy Blackhole (Preview).app"` → `xattr -dr com.apple.quarantine` →
`lsregister -f` (đăng ký lại LaunchServices để Finder/Dock đọc tên mới).
Đóng gói: `cd apps/desktop && bunx tauri build --bundles app` (`@tauri-apps/cli` 2.12.3 đã có trong
`node_modules`, không cần cài thêm).


### Cổng mặc định CỐ ĐỊNH: 55907 (11/11/2026)

Trước 11/11/2026 vỏ đọc `GBH_PORT` với mặc định **5439** — trùng đúng host dùng chung của Lead, nên app và
host của Lead không thể chạy cùng lúc, và mọi phép đo parity đọc `ready-url.txt` đều nhìn thấy cổng đó.
Nay ba cổng có ba chủ, chạy song song được:

| Bên | Cổng mặc định | Ghi đè | Tệp URL ghi ra |
|---|---|---|---|
| **App desktop (bản dev)** | **55907** | `GBH_DESKTOP_PORT` (chuẩn) · `GBH_PORT` (cờ cũ, giữ tương thích) | `~/.galaxy/blackhole/ready-url-55907.txt` |
| `blackhole web` (galaxy-code) | 55906 | `--port <n>` > `GBH_WEB_PORT` > 55906; `--port 0` = OS cấp | `ready-url-55906.txt` |
| Host dùng chung của Lead | 5439 | `bh host --port <n>` | `ready-url.txt` |

Luật: **cổng bận thì không im lặng nhảy cổng, và không giết tiến trình lạ.** Trước khi spawn, vỏ hỏi
`lsof -nP -iTCP:<cổng> -sTCP:LISTEN -t` rồi đọc dòng lệnh từng pid:

| Chủ cổng | Vỏ làm gì | Log |
|---|---|---|
| **host của chính app** (dòng lệnh có `apps/cli/src/main.ts` + `host`, hoặc node chạy `dsh/lib/bin.js` + `--port`) | host mồ côi của lượt trước ⇒ SIGTERM **cả nhóm**, chờ ≤5 s, SIGKILL nếu chưa nhả, rồi bind lại đúng 55907 | `cổng 55907: pid … là host mồ côi của chính app → dọn …` |
| **tiến trình lạ** | KHÔNG giết; đi tiếp `55908…55917` (`PORT_SCAN_SPAN`) | `cổng 55907: pid … là tiến trình LẠ → không giết, đi tiếp cổng sau …` |
| hết dải | hiện **cửa sổ lỗi** "Không còn cổng trống cho host" + nút Thử lại; app KHÔNG thoát im lặng | `LỖI: Không còn cổng trống cho host — đã thử 55907..55917…` |

Nhánh `attach_url()` (bám `ready-url*.txt` khi không thấy marker) đã bị **bỏ**: đó đúng là đường dẫn tới
cửa sổ trắng — file URL cũ trỏ vào phiên đã chết, webview điều hướng vào hư không. Nay nguồn URL duy nhất là
marker `?token=` của host do chính vỏ spawn.

## 1. Vỏ tự dò runtime và gốc host (11/11/2026: node, không bun)

**Vì sao không còn `bun run`**: harness boot bằng native addon `@deepseek-ai/dsh-app-boot` cần symbol V8
của Node; bun ném `node-addon-require-builtin unsupported` ngay lượt nạp đầu. Vỏ spawn **một runtime**:

```text
node --experimental-strip-types <host>/apps/cli/src/main.ts host --port N
```

Mọi đường dẫn đều TUYỆT ĐỐI và `current_dir` là gốc host — app mở từ Finder có `cwd = /` và
`PATH = /usr/bin:/bin:/usr/sbin:/sbin`, nên không được dựa vào cwd hay PATH của app.

| # | Runtime Node | # | Gốc host (`apps/cli/src/main.ts`) |
|---|---|---|---|
| 1 | `Contents/Resources/runtime/node` (nhúng trong gói cài) | 1 | `Contents/Resources/host` (nhúng trong gói cài) |
| 2 | `GBH_NODE` (người vận hành chỉ định; trỏ vào chỗ không có = **lỗi rõ ràng**, không đoán hộ) | 2 | `GBH_REPO` |
| 3 | bản mới nhất của nvm (`~/.nvm/versions/node/v*/bin/node`, major ≥ 26) | 3 | `GBH_CLI` (suy ra gốc host từ đường dẫn entry) |
| 4 | PATH mở rộng + `/usr/local/bin`, `/opt/homebrew/bin` | 4 | repo nhúng lúc build (`cargo:rustc-env=GBH_BUILD_REPO`) |
|  |  | 5 | dò ngược 0..5 cấp từ vị trí binary |

Tiến trình con nhận `PATH` mở rộng (thư mục runtime đứng đầu, rồi nvm, homebrew, hệ thống) và `GBH_NODE`
ghim đúng runtime đã giải — nếu không, bên trong host `bh host` lại dò ra một Node khác (hoặc không ra Node
nào) và chết trước khi in URL.

Không giải được runtime/gốc host ⇒ **không thoát im lặng**: ghi log + hiện cửa sổ lỗi tiếng Việt
**"Không tìm thấy node hoặc gốc host"** kèm **mọi đường đã thử** và đường dẫn log.

## 2. Không bao giờ để cửa sổ trắng (11/11/2026)

- Cửa sổ tạo với `.visible(false)`, nạp trang splash đóng gói (`ui/index.html`, nền tối).
- Chỉ `show()` khi `on_page_load` báo URL **của host** (`http://127.0.0.1:<cổng>…`), không phải splash.
- Hết `SPLASH_REVEAL_MS` = 6 s mà host chưa xong ⇒ hiện splash: **quả cầu Galaxy Blackhole animate** ở
  giữa và **đúng MỘT dòng trạng thái** đổi theo tiến trình (`Đang khởi động…` → `Đang nạp plugin…` →
  `Đang chờ host…` → `Đang mở giao diện…`), để người dùng thấy app đang làm gì thay vì một cửa sổ trống.
  Mọi log/mốc thô (dòng log host gần nhất, cổng, pid, số giây, ghi chú chọn cổng, các đường đã thử) nằm sau
  nút **Chi tiết** ở góc dưới phải, dạng monospace cuộn được — không in ra mặt trước (11/11/2026).
- Spawn hỏng, host thoát trước khi in URL, hoặc quá `HOST_WAIT_MS` = 120 s ⇒ hiện **cửa sổ lỗi tiếng Việt**:
  tiêu đề lỗi, lý do, danh sách `ĐÃ THỬ` (đường dẫn runtime/gốc host, log, pid, cổng), đường dẫn log, và hai
  nút **Thử lại** / **Thoát**. App ở lại, không `exit`.

## 3. Log đọc được sau khi mở từ Finder

`~/Library/Logs/Galaxy Blackhole/desktop-<cổng>.log` — mọi dòng `[shell]` và `[host]`/`[host:err]` đều
được ghi ở đây (kèm stdout), xoay vòng sang `.log.1` khi vượt **5 MB**. Đây là nơi nghiệm thu đọc
`[bh] ready http://127.0.0.1:55907/?token=…`; dòng đó in NGAY SAU dòng URL nên vỏ phải **giữ ống stdout
được đọc tiếp** sau khi đã bắt được token (bản trước dừng đọc ⇒ mất đúng dòng cần đọc).

## 4. Bằng chứng (đo 11/11/2026 trên máy dev)

| Phép đo | Kết quả |
|---|---|
| `.app` cài ở `/Applications`, mở bằng LaunchServices (`open -a`), PATH tối thiểu | app sống, log ghi `HOME=… · PATH=/usr/bin:/bin:/usr/sbin:/sbin`, `cwd /`; splash hiện sau 6 s với `Đang chờ host…` |
| Boot xong | `lsof -ti tcp:55907` > 0 (node của harness), `~/.galaxy/blackhole/ready-url-55907.txt` được ghi, `probe-once.ts` → `rootChars 533762 · slotCount 371` |
| Thoát app (Cmd+Q qua AppleScript) | log `dọn host pid … · nhóm …` → `host đã thoát` → `đã dọn xong`; sau 5 s `lsof -ti tcp:55907` = **rỗng** |
| `kill -TERM <app>` (không kịp destructor) | handler SIGTERM chỉ dùng hàm async-signal-safe: sau **0,6 s** app mất và cổng 55909 nhả |
| Không có runtime (gói cài thiếu `Contents/Resources/runtime/node` + `host`) | cửa sổ lỗi "Host thoát trước khi sẵn sàng" + danh sách đã thử 10 dòng + nút **Thử lại**/**Thoát**; app vẫn sống |
| `bun run gate --no-tests` | **XANH 8/8** |
| `cargo test` (apps/desktop/src-tauri) | **29 test, 0 hỏng** (`main.rs` 950 dòng ≤ 1000) |

## 5. Giới hạn — ĐỌC TRƯỚC KHI NÓI "đã cài được ở máy bất kỳ"

Từ 12/11/2026 gói **đã self-contained thật**: `Contents/Resources/runtime/node` + `Contents/Resources/host`
(treesize 105,9 MB, chép thật chứ không symlink ra repo) + binary shell đã ký ad-hoc. Đo 12/11/2026:
`.app` **278 MB** / 6.123 tệp, mở từ Finder bằng `env -i` (không có PATH của shell dev) vẫn boot và render
357 slot (`rootChars` 635.028). Hai giới hạn còn lại:

- **Kiến trúc**: runtime nhúng là `darwin-x64` (đúng máy build). Máy Apple Silicon chạy qua Rosetta hoặc
  phải build lại trên arm64 (`--keep-libreoffice`/`--kernel-all` không liên quan).
- **Bộ Office không kèm** — xem §7. PDF/ảnh/Excel-preview vẫn có; chỉ chuyển .docx/.xlsx/.pptx → PDF là
  thiếu kit.

## 6. Chi tiết vận hành đáng nhớ

- **Nhóm tiến trình**: host chạy trong process group riêng (`setpgid`); cổng do tiến trình CON (node của
  harness) giữ, nên phải ký tín hiệu cho CẢ NHÓM. Ba đường dọn, tất cả qua một `Once`: `RunEvent::Exit`
  (Cmd+Q), `HostGuard` (Drop), và handler SIGTERM/SIGINT/SIGHUP khi app bị `kill` — handler chỉ gọi
  `kill`/`nanosleep`/`_exit` (async-signal-safe), không log, không cấp phát.
- **Điều kiện dừng khi dọn là CỔNG ĐÃ NHẢ**, không phải "tiến trình con đã thoát": harness đóng phiên có thể
  lâu hơn 3 s, mà cái người dùng thấy là app treo. Nhả cổng là xong; phần còn lại SIGKILL dọn nốt.
- **Watchdog của `--smoke`** = `HOST_WAIT_MS + 30 s` (150 s): dài hơn ngân sách chờ host + nạp trang.
- **PATH của phiên agent**: `cargo`/`bun`/`node` đều không có trong PATH ⇒ dùng
  `$HOME/.cargo/bin/cargo`, `$HOME/.bun/bin/bun`, `$HOME/.nvm/versions/node/v26.9.0/bin/node`.
- `cargo test` KHÔNG liên kết lại binary chính — muốn chạy `--smoke` với code mới thì `cargo build` trước.

## 7. Kích thước gói và bộ Office (12/11/2026)

```text
991 MB → 278 MB   (du -sm; 36.559 → 6.123 tệp)
  ├ runtime/node        142,3 MB  ← KHÔNG cắt được (một binary Node ≥ 26, không chứa npm/npx/corepack)
  ├ host                123 MB   ← 825 MB trước khi lọc (105,8 MB theo byte, 6.118 tệp)
  ├ Contents/MacOS       10 MB   ← binary shell
  ├ _CodeSignature        3 MB   ← ký ad-hoc (trước: 14 MB vì 36k tệp)
  └ icon.icns             1 MB
```

`bun run embed` áp danh sách loại trừ ngay trong lúc chép (idempotent, không cắt tay). Bảng đầy đủ 11 nhóm
+ số đo từng nhóm ở [`PACKAGING.md`](PACKAGING.md) §7. Ba cờ đáng nhớ:

```bash
cd apps/desktop
bun run embed                       # mặc định: bỏ kit Office + lọc kernel theo phép đo boot
bun run embed --keep-libreoffice    # ĐÓNG KÈM bộ LibreOffice (+155 MB)
bun run embed --kernel-all          # giữ nguyên apps/host/node_modules (để debug "thiếu module")
```

**Mất gì khi bỏ kit Office**: row `office-to-pdf` không chuyển được **.docx/.xlsx/.pptx** sang PDF; app báo
thiếu kit khi bạn mở tệp đó. Chat, tool, terminal, xem PDF/ảnh, preview bảng tính dạng client vẫn nguyên.
Cài lại (một trong ba cách, chi tiết ở `PACKAGING.md` §8):

```bash
cd apps/desktop && bun run embed --keep-libreoffice --app '/Applications/Galaxy Blackhole (Preview).app'
cd apps/host && bun add @deepseek-ai/libreoffice-kit-darwin-x64          # rồi nhúng lại
cd ~/.galaxy/blackhole/profiles && bun add @deepseek-ai/libreoffice-kit-darwin-x64   # chỉ cho profile đang chạy
```

Phép kiểm sau khi cài lại: log host có `link addon native: … libreoffice-kit-darwin-x64`; mở .docx phải ra PDF.
