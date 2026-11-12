# Galaxy Blackhole Desktop (Tauri) — Thiết kế kiến trúc & Lộ trình

```ts
/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Thiết kế kiến trúc, lộ trình, chuẩn code và chiến lược parity cho dự án
 *      Galaxy Blackhole Desktop (Tauri) — bản desktop độc lập viết lại theo tư tưởng DSH.
 */
```

> **Trạng thái: ĐÃ DUYỆT 17/10/2026 — đang thi công M0.** Đây là bản thiết kế chốt (đóng băng kiến trúc)
> của dự án. Nhật ký tiến độ sống nằm ở [`ROADMAP.md`](ROADMAP.md); mọi thay đổi kiến trúc phải ghi vào `docs/ADR/`.
>
> **Chốt cuối 17/10/2026:** npm scope **@galaxy-blackhole/gbh-***; UI theo **đúng luật DSH** (CSS Modules +
> `clsx` + token `--dsw-*`, **không Tailwind**); **giữ SVG gốc của DSH cho mọi icon parity**, `lucide` chỉ
> dùng cho UI mới của Blackhole; thứ tự bước 2 **M4 → M5 → M6 → M3** (kernel + core làm cuối cùng).

---


> 🔴 **LỆNH KHỞI ĐỘNG DUY NHẤT: `scripts/restart-host.sh`**
> Đừng chép tay lệnh khởi động. Ba sự cố liên tiếp ngày 17/10/2026 đều do chép tay:
> `bun` không có trong PATH của shell agent · `DSH_HOME=~/.galaxy/gbh` rò từ phiên agent vào · cổng 5439 còn bị tiến trình cũ giữ.
> Script tự làm cả ba (đường dẫn tuyệt đối, gỡ hai biến home, chờ cổng nhả) rồi **tự xác minh bằng `check:app` trước khi báo xong**.
## 0. Cách đọc tài liệu

| Mục | Dành cho | Ghi chú |
|---|---|---|
| 1 | Bạn — chốt mục tiêu & nguyên tắc | Bất biến, mọi quyết định sau phải phục vụ mục này |
| 2 | Bạn + team — bằng chứng khảo sát | Số liệu đã kiểm chứng trên máy, không phải phỏng đoán |
| 3 | Team — mô hình DSH phải tái tạo | Căn cứ để viết lại từng package |
| 4–6 | Team — kiến trúc & lộ trình | Nguồn gốc của mọi task trên task board |
| 7–9 | Team — chuẩn code, môi trường, cách phối hợp | Gate tự động + quy tắc write-scope |
| 10–13 | Bạn — rủi ro, bảo mật, điểm cần chốt, tiến độ | Mục 12 là phần bạn cần trả lời |

---

## 1. Tóm tắt điều hành

### 1.1 Bốn mục tiêu tối thượng (BẤT BIẾN — in ở đầu mọi tài liệu task)

| # | Mục tiêu | Cách đo (gate) |
|---|---|---|
| **G1** | **Giống DSH nhất có thể**: UI giống hệt, cài được plugin ngoài giống DSH, dùng **bun** để tạo & build dự án | gate:visual (pixel/DOM diff so với DSH) + gate:plugin-compat (plugin ngoài cài & chạy được) + toàn bộ toolchain build bằng bun |
| **G2** | **Bảo trì được**: mỗi file **≤ ~1000 dòng**, **mọi function có mô tả**, header 4 dòng bắt buộc ở mọi file | gate:lint (file-length + header + JSDoc coverage) chạy trong CI và pre-commit |
| **G3** | **Bộ plugin ban đầu giống hệt DSH**, tách được thành **package riêng biệt** | gate:parity-matrix — mỗi dòng plugin DSH đều có bản tương ứng + test tương ứng |
| **G4** | **Mọi phần (lõi → plugin) đều đối chiếu code DSH + có test**; **lõi KHÔNG dùng ai-coder-core**; dự án **độc lập hoàn toàn** | gate:no-ai-coder-core + gate:oracle-diff + gate:independence (chạy được khi không có DSH) |

> Bốn mục tiêu này không được thoả hiệp vì tiến độ. Nếu một quyết định kỹ thuật làm hỏng một trong
> bốn gate, quyết định đó sai.

### 1.2 Sản phẩm cuối cùng

Một app desktop **độc lập** (Tauri 2) tên **Galaxy Blackhole Desktop**, trong đó:

1. **Bước 1 (tích hợp)**: app mang theo **nguyên bản DSH mới nhất** (pin version) + toàn bộ plugin
   hiện có + credentials lấy từ `~/.galaxy/credentials.yaml`. App là **vỏ Tauri** sở hữu host DSH của
   riêng nó (không trỏ vào server của ai khác), mở web surface ở **127.0.0.1:5439**.
   → Đây là **oracle**: bản tham chiếu chạy trong chính app của chúng ta, dùng để so sánh.
2. **Bước 2 (viết lại)**: thay từng package DSH bằng implementation của chúng ta
   (npm **@galaxy-blackhole/gbh-*** — scope của org galaxy-blackhole, quy đổi @deepseek-ai/dsh-<x> →
   @galaxy-blackhole/gbh-<x>), mỗi lần thay một dòng plugin là một lần chứng minh parity
   (unit + e2e + DOM/screenshot + protocol trace). Kết thúc bước 2, app **không còn phụ thuộc**
   runtime DSH nhưng **vẫn load được plugin ngoài viết cho DSH**.

### 1.3 Mười hai nguyên tắc bất di bất dịch

1. **Everything is a plugin** — không có lõi đặc quyền; mọi thứ (model adapter, tool registry,
   session log, agent loop, UI…) đều là plugin mount vào một context chung và tháo ra được.
2. **Không sửa `~/.galaxy/gbh`**, không sửa `node_modules` toàn cục, không đụng project khác.
   Mọi thử nghiệm bẩn nằm trong `~/tmp/galaxy-blackhole/` và repo mới.
3. **Không fork runtime DSH ở bước 1** — tuỳ biến bằng composition (profile + bundle + patch),
   đúng như roadmap của `gbh` đã chốt.
4. **Oracle-first**: mọi tính năng phải so được với bản DSH đang chạy ở `http://127.0.0.1:4001/`.
   Không có "chắc là giống".
5. **Một người viết / một vùng ghi**. Hai agent không bao giờ sửa cùng một package.
6. **Hợp đồng đóng băng trước, code sau**: boot injection, client module loader, RPC, format
   profile/patch, field `dsh` trong package.json — đóng băng ở M0/M2 rồi mới viết lại.
7. **Test là bằng chứng, không phải hình thức**: mỗi dòng plugin mới phải có test tương ứng và ảnh
   chụp so sánh nếu là UI.
8. **Không in/ghi secret ra log, không commit credentials.** `~/.galaxy/credentials.yaml` là tài liệu
   dùng chung — chỉ ghi khi người dùng thao tác, ghi nguyên tử + có backup.
9. **Song ngữ & thương hiệu**: UI mặc định giống DSH, nhưng brand/locale đi qua lớp patch riêng
   (đúng cách `gbh` đang làm) — không sửa bản gốc.
10. **Độc lập**: lõi dự án này **không** dùng `@galaxy-stack/ai-coder-core`; chỉ dùng thư viện MIT
    của bên thứ ba khi có lợi và ghi rõ trong `THIRD_PARTY_NOTICES`.
11. **Provider `auto` là hợp đồng ẩn**: route `auto` trỏ tới **Ollama** với model
    **`deepseek-v4.1-flash:cloud`**, key lấy từ `~/.galaxy/credentials.yaml`; giao diện **không phơi**
    chi tiết này (chỉ hiện "Galaxy Blackhole auto") — y như `gbh` đang làm. Chi tiết ở §4.8.

---

12. **Tầng vận chuyển phải coi thân phản hồi là BYTE** — `Buffer.isBuffer` **hẹp hơn**
    `ArrayBuffer.isView`. Rút ra từ sự cố 17/10/2026: wrapper nén làm `Buffer.from(String(chunk))`,
    gặp `Uint8Array` thì `String()` cho ra **dãy byte thập phân** (`123,34,116,…`) ⇒ mọi RPC hỏng ⇒
    UI chết, trong khi HTTP vẫn trả **200**. Hệ quả bắt buộc: (a) mọi chỗ đọc/ghi body phải xử lý
    `Uint8Array`/`DataView`/`ArrayBuffer`; (b) test phải so **BYTE** và có ca `Uint8Array`;
    (c) **HTTP 200 không bao giờ là bằng chứng** — phải kiểm nội dung. Chi tiết: ADR 0004 §8.
## 2. Hiện trạng đã khảo sát (bằng chứng, ngày 17/10/2026)

### 2.1 DSH upstream (nguồn số 1 — ưu tiên GitHub)

| Hạng mục | Giá trị |
|---|---|
| Repo | https://github.com/deepseek-ai/deepseek-harness — **public**, license **MIT** |
| Ngôn ngữ / branch | TypeScript, master, commit mới nhất 16/10/2026 |
| Quy mô | packages/ có **340 package** (có package.json), 18.698 path; apps/ = cli, **desktop**, **desktop-host**, web, plugin-market-generator |
| Nhóm package | client 65 · experimental 47 · session 21 · util 18 · api 10 · shell 10 · host 9 · llm 9 · subagent 9 · core 8 · … · bundle 6 |
| UI packages | **55** gói packages/client/ui-* |
| npm | @deepseek-ai/dsh latest 0.2.0-rc.2 · next 0.2.1-rc.1 · alpha 0.2.1-alpha.5 |
| Tag git | tới dsh-v0.2.1-alpha.5 (đủ tag cho từng version) |
| Tài liệu upstream | docs/architecture.md, docs/cordis-primer.md, docs/api-gateway.md, docs/tool-catalog.md, docs/cordis-tutorial/, docs/glossary.md… |

**Nguồn tham chiếu theo thứ tự ưu tiên** (đúng như bạn yêu cầu):

1. GitHub (raw + clone shallow vào `~/tmp/galaxy-blackhole/dsh-upstream`, pin commit).
2. `~/.galaxy/gbh/profiles/node_modules/@deepseek-ai/*` (bản đang chạy: **0.2.0-rc.2**, JS đã transpile
   nhưng **đọc được**, kèm .d.ts đầy đủ — dùng để đối chiếu hành vi thực tế).
3. /Applications/Galaxy Blackhole.app/Contents/Resources/app/host/cli (bản CLI đóng gói).

### 2.2 Những gì đang chạy trên máy này

- http://127.0.0.1:4001/ — blackhole web. Tiến trình: `node <galaxy-code>/node_modules/@deepseek-ai/dsh/lib/bin.js
  --profile web --patch gbh-web.patch.yml --patch gbh-ui.patch.yml --patch gbh-brand.patch.yml
  --patch /tmp/gbh-alpha/gbh-overlay.patch.yml` (PID 22696), môi trường `DSH_HOME=/tmp/gbh-alpha`.
  **Version runtime thật: 0.2.1-alpha.4** (không phải 0.2.0-rc.2 — xem D2). Trả **401** nếu thiếu token.
- Máy: **macOS 26.6.2, x86_64 (Intel)**. Node có: v20.12.0, v24.4.1, **v26.9.0** (đang dùng),
  /usr/local/bin/node = v24.1.0. **Bun 1.3.14**, Rust 1.94.0, Tauri CLI có sẵn.
- **Đã kiểm chứng**: @deepseek-ai/dsh chạy được bằng **bun 1.3.14** và **node v26.9.0**;
  **node v24.1.0 thoát im lặng, không in gì** → ràng buộc runtime thật, phải bundle Node ≥ 26
  (hoặc chứng minh bun chạy được toàn bộ — xem R2).
- Rig Tauri cũ blackhole-desktop-tauri đã build được binary và có measure.sh đo RAM/thời gian
  (5 lần chạy) — **tái sử dụng thành tools/bench**.
- Electron shell cũ blackhole-desktop-electron (v2.4.0) đã chứng minh công thức: **app sở hữu host
  của nó**, bundle **Node thật** + CLI, tìm địa chỉ host bằng *marker* ?token=.

### 2.3 Hạ tầng galaxy-blackhole hiện có (tận dụng, không phá)

| Đường dẫn | Vai trò | Dùng thế nào |
|---|---|---|
| galaxy-code | blackhole CLI + web/patches/gbh-{web,ui,brand}.patch.yml | **Mẫu vàng** cho cách patch DSH mà không fork |
| gbh | orchestrator mỏng (gbh web/doctor/config) | Mẫu cho CLI của ta; giữ nguyên |
| docs-blackhole/DSH-PLUGINS.md | Bảng 285 dòng liệt kê plugin DSH (tiếng Việt) | Nguồn khởi đầu cho **parity matrix** |
| blackhole-desktop-electron | App Electron đang chạy được | Mẫu hành vi shell + prepare-host.mjs |
| blackhole-desktop-tauri | Rig đo Tauri vs Electron | Chuyển thành tools/bench |
| ~/.galaxy/gbh/gbh-overlay.patch.yml | **Ghim credentials**: credentials.config.path = ~/.galaxy/credentials.yaml | Copy nguyên xi kỹ thuật này cho app mới |

### 2.4 Kết quả --dump-config (inventory thật của profile web)

Chạy dsh --profile web --dump-config trên bản copy ~/.galaxy/gbh tại /tmp/bh-probe-home:

| Chỉ số | Giá trị |
|---|---|
| Tổng dòng YAML | **1.303** |
| Số row plugin | **294** |
| Số package duy nhất | **189** |
| Layer | dsh-base 69 · dsh-web-app 189 (+24 row bị web-app patch lại) · experimental-agent-team 3 · experimental-schedule 3 · patch người dùng 6 |
| Theo họ | client-ui 49 · tool 19 · session 13 · api 9 · client 8 · host 5 · llm 4 · subagent 3 · sandbox 2 · goal 2 · cordis 1 · khác 74 |

→ **Đây chính là danh sách "kenel, core, plugin, llm" mà bạn yêu cầu ở bước 2.** File dump lưu tại
/tmp/bh-ref/dsh-profile-web.dump.yml và sẽ vào repo thành docs/reference/dsh-profile-web.dump.yml
(kèm script tái tạo).

### 2.5 Stack UI thật của DSH (đo trực tiếp, 17/10/2026)

| Hạng mục | DSH dùng gì | Nguồn kiểm chứng |
|---|---|---|
| Framework | React (client bundle Vite) | lib/client.js của từng gói client-ui-* |
| Styling | **CSS Modules + clsx**, token **--dsw-*** (--dsw-alias-* semantic), theme do ui-theme sở hữu | docs/web-styling.md + index-BPHePDI_.css trong dsh-web-frontend/dist |
| Quy định rõ ràng | **"Use CSS Modules and clsx; do not add a component library or Tailwind"** | docs/web-styling.md, mục Component rules |
| Thư viện icon | **KHÔNG có** — toàn bộ SVG tự viết: packages/client/ui-primitives/src/icons/{index,props,shared-artwork}.tsx + LinkIcon/ReferenceIcon/PermissionIcon/FileTypeIcon/CodeFileIcon/FishLogo… | API GitHub + grep bundle (không thấy lucide/heroicons/phosphor) |
| Component dùng chung | ui-primitives là **kênh duy nhất** đi xuyên feature package | docs/web-styling.md |

→ **Hệ quả cho ta (đã chốt 17/10/2026)**: **theo đúng luật của DSH** — CSS Modules + `clsx` + token
`--dsw-*`, **không Tailwind**; **giữ nguyên SVG gốc của DSH cho toàn bộ icon** thuộc UI parity,
lucide chỉ dùng cho **UI mới của riêng Blackhole** (không có trong DSH). Chi tiết ở §4.7.

---

## 3. DSH hoạt động thế nào (mô hình bắt buộc tái tạo)

### 3.1 Kernel — Cordis ("everything is a plugin")

Cordis (@deepseek-ai/cordis 4.0.4, MIT — *không* phải của DeepSeek) là meta-framework: plugin đóng
góp **service**, **event có kiểu**, và **effect có thể đảo ngược** vào một Context chung. Service
(Service, ctx.inject, ctx.provide, ctx.effect) đăng ký qua schemastery schema; Loader dựng cây
plugin từ YAML; group/include/timer/hmr là plugin hạ tầng. Điểm mấu chốt: **không có lõi để patch** —
bạn mở rộng bằng cách mount thêm plugin, mọi đăng ký tự tháo khi plugin unload.

### 3.2 Profile → bundle → patch (cơ chế composition)

```
$DSH_HOME/profiles/<name>/
  cordis.yml          # LUÔN là [] — cây rỗng, không sửa tay
  cordis.patch.yml    # lớp patch của người dùng (nơi tùy biến)
  package.json        # dsh.profile.bundles: [ ...danh sách bundle có thứ tự ]
```

Áp theo thứ tự lên **danh sách rỗng**: (1) các bundle của profile → (2) cordis.patch.yml của profile
→ (3) home patch → (4) các --patch overlay. Mỗi **bundle** khai báo dsh.bundle.patch trỏ tới file
patch của nó; patch **nhắm theo id** để thay config / disable / chèn row mới. Preset áp cùng phép
toán đó bên trong config.plugins.

→ Nghĩa là: **mọi thứ trong DSH đều thay được bằng YAML**, kể cả agent loop. Đây là lý do bước 1
khả thi: ta không sửa DSH, ta xếp lớp.

### 3.3 Host & API

- dsh-host-webserver: plugin đăng ký route HTTP + upgrade, "structured index injections" (dữ liệu
  JSON thuần, một bảng cho hai renderer: bản serve động và bản static worker), fallback static dist.
  Nó **không biết gì** về khái niệm harness.
- dsh-host-frontend-static + dsh-web-frontend: dist/index.html + assets (Vite build).
- dsh-api-gateway + dsh-api-remotes + dsh-api-*-controller: Remote BFF, Typert RPC (session,
  workspace, settings, jobs, terminal, files…).
- dsh-client-connection: transport RPC đã xác thực (token) + vòng đời generation.

### 3.4 Client plugin (đây là phần UI "giống hệt")

Mỗi gói UI khai báo trong package.json:

```json
"dsh": { "client": { "inject": ["@deepseek-ai/dsh-...", "..."], "platform": "web" } }
```

và ship lib/client.js là bundle **rolldown** ở dạng *lazy CJS factory*:

```js
window.__ModuleLoader__.load({ id: "@deepseek-ai/dsh-client-ui-chat", factory: (require) => { /* ... */ } });
```

- **Thực thi script chỉ ĐĂNG KÝ factory**; mọi side effect (kể cả chèn CSS) nằm trong closure và chạy
  khi materialize (lần require đầu tiên), có memoize.
- Bộ nạp là dsh-client-modules: nửa Node dựng đồ thị entry __DSH_BOOT__ (quét dsh.client tăng dần,
  route bundle, tap index, service webPlugins); nửa browser là bảng CJS lười mà Loader cordis dùng
  làm seam internal.
- Vòng đời plugin (fiber, inject, update/refresh) do **cordis phía client** giữ.

→ Muốn UI giống hệt và load được plugin UI ngoài, ta phải tái tạo **đúng ba thứ**: shape của
window.__DSH_BOOT__, window.__ModuleLoader__.load(...), và semantics inject/fiber của cordis client.
Đây là **hợp đồng đóng băng số 1**.

### 3.5 Home & credentials

- Home: $DSH_HOME (mặc định ~/.dsh; hệ sinh thái này dùng ~/.galaxy/gbh).
- dsh-credentials-local: provider file-backed trên **$DSH_HOME/.credentials.yaml**, thứ tự tin cậy:
  **env tiến trình (chỉ đọc, thắng)** > $DSH_HOME/.credentials.yaml (ghi được) > <cwd>/.env >
  $DSH_HOME/.env. Ghi qua writeFileAtomic + withFileLock (đã có lock).
- Nhưng hệ sinh thái Galaxy muốn **một tài liệu chung**: ~/.galaxy/gbh/gbh-overlay.patch.yml ghim
  credentials.config.path: /Users/…/.galaxy/credentials.yaml. → App mới **thừa hưởng đúng cách này**,
  để CLI/extension/GUI cùng một gốc.

### 3.6 Desktop reference của chính DSH (khuôn mẫu ta bám theo)

apps/desktop (Electron) + apps/desktop-host ("Private Node-mode host process"):

- Electron khởi động **Desktop Host** ở Node mode → host gọi CLI profile runner + **toàn bộ Web app**.
- Cửa sổ **load ngay assets đã đóng gói**, chờ **boot injections** rồi mới kích hoạt client plugin
  **trong cùng document**.
- Web giữ RPC và stream; desktop carrier nối trang local với Host đã xác thực; **Node IPC** mang boot
  injections, readiness, fatal errors, shutdown.
- Desktop sở hữu **$DSH_HOME/profiles/desktop** (tách khỏi profile của CLI), port do OS cấp mặc định,
  profile có thể override. App đóng gói runtime DSH production đã ký.
- Shell-owned UI chạy giao dịch plugin qua pnpm bundle sẵn.

→ **Kết luận kiến trúc**: vỏ Tauri của ta phải làm đúng vai trò "carrier" này, chỉ thay Electron-main
bằng Rust và Node IPC bằng Tauri IPC + HTTP/WS đã xác thực.

---

## 4. Kiến trúc đề xuất

### 4.1 Mô hình tiến trình

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Galaxy Blackhole Desktop (Tauri 2)                                      │
│                                                                          │
│  ┌─────────────────────────┐        ┌────────────────────────────────┐  │
│  │ Rust shell (main proc)  │  IPC   │  Host process (Node >= 26)     │  │
│  │ • window + webview      │<──────>│  • kernel (cordis-compatible)  │  │
│  │ • tray / single-inst    │  HTTP  │  • host plugins (webserver…)   │  │
│  │ • supervisor: spawn,    │   WS   │  • core spine (agent/session)  │  │
│  │   health, port, token   │        │  • client bundles + boot inj.  │  │
│  │ • native caps: fs sand- │        │  • listen 127.0.0.1:5439       │  │
│  │   box, PTY, picker,     │        └────────────────────────────────┘  │
│  │   keychain, sqlite idx  │                    ▲                        │
│  │ • updater, deep-link    │                    │ spawn/attach           │
│  └───────────┬─────────────┘        ┌───────────┴────────────────────┐   │
│              │                      │  Native sidecars (tuỳ chọn)     │   │
│              │                      │  • bh-native (Rust, N-API)      │   │
│              ▼                      │  • python lane (office/ML)     │   │
│     WebView (WKWebView/WebView2)    └────────────────────────────────┘   │
│     load http://127.0.0.1:5439/?token=…                                  │
└──────────────────────────────────────────────────────────────────────────┘
        ▲ bước 1: host chạy runtime DSH nguyên bản (oracle)
        ▲ bước 2: host chạy runtime của ta (@galaxy-blackhole/gbh-*), vẫn load plugin DSH
```

Hai chế độ chạy, **cùng một UI**:

| Chế độ | Lệnh | Dùng khi |
|---|---|---|
| App | bun run dev / bh-desktop | Người dùng cuối; tray; đóng cửa sổ vẫn giữ host (tuỳ chọn) |
| Web-only | scripts/restart-host.sh / bh host --port 5439 | Dev, chụp ảnh, so sánh, CI, dùng từ trình duyệt |

### 4.2 Bố cục repo & package map

Tên đề xuất: **galaxy-blackhole/blackhole-tauri** (codename bh-tauri, npm **@galaxy-blackhole/gbh-***).
Quy đổi tên gói: @deepseek-ai/dsh-<x> → **@galaxy-blackhole/gbh-<x>** (ví dụ dsh-client-ui-chat →
**gbh-client-ui-chat**, dsh-session → **gbh-session**).
*(Bạn có thể đổi tên — xem mục 12; đổi trước khi viết code là miễn phí.)*

```
blackhole-tauri/
├─ apps/
│  ├─ desktop/              # vỏ Tauri (Rust + webview boot) — .app/.dmg/.msi/AppImage
│  ├─ host/                 # host process Node-mode (tương đương dsh-desktop-host)
│  └─ cli/                  # bh — launcher profile, quản lý plugin, doctor, config (bun)
├─ crates/                  # Rust workspace
│  ├─ bh-shell/             # window, tray, single-instance, updater, deep-link
│  ├─ bh-supervisor/        # spawn host, health-check, tranh chấp port, token, restart
│  ├─ bh-native/            # capability native: fs sandbox, PTY, picker, keychain, sqlite (N-API)
│  └─ bh-bridge/            # Tauri commands + hợp đồng IPC có kiểu (sinh type cho TS)
├─ packages/
│  ├─ kernel/               # @galaxy-blackhole/gbh-kernel  (Context/Service/effect/Loader)
│  ├─ compat/               # shim @deepseek-ai/cordis + schemastery cho plugin ngoài
│  ├─ core/                 # session, agent, agent-loop, tools, system-prompt, scope
│  ├─ host/                 # webserver, frontend-static, directory-picker, open-in-app
│  ├─ api/                  # gateway, remotes, *-controller
│  ├─ llm/                  # llm service, provider adapters, retry
│  ├─ client/               # connection, modules, resources, hmr, locale, store
│  ├─ client-ui/            # 49–55 plugin UI (mỗi cái một package riêng — G3)
│  ├─ tool/                 # 19 tool plugin (bash, fs, web, todo, skill, goal, jobs…)
│  ├─ bundle/               # base, web-app, desktop (các lớp patch)
│  └─ <family>/             # sandbox, subagent, goal, schedule, workflow, mcp, terminal…
├─ ui/                      # Vite shell: index.html + boot injection + HMR receiver
├─ profiles/                # template profile (cordis.yml + patch layers)
├─ tools/
│  ├─ parity/               # oracle harness: dump-config diff, protocol trace, DOM/shot diff
│  ├─ lint/                 # header, 1000-line, JSDoc coverage, no-ai-coder-core, dep guard
│  └─ bench/                # measure.sh (RAM/thời gian) — kế thừa từ rig cũ
├─ docs/                    # ARCHITECTURE.md, ROADMAP.md, PARITY-MATRIX.md, ADR/, reference/
├─ vendor/dsh-reference/    # upstream DSH pin commit — CHỈ ĐỌC (không build, không sửa)
└─ .parity/                 # ảnh & trace sinh ra (gitignore)
```

### 4.3 Hợp đồng phải đóng băng trước khi viết lại (M0/M2)

| # | Hợp đồng | Nơi chứng minh |
|---|---|---|
| C1 | window.__BH_BOOT__ (tương đương __DSH_BOOT__) — shape, thứ tự, tap index | docs/contracts/boot-injection.md + snapshot test |
| C2 | window.__ModuleLoader__.load({id, factory}) + semantics lazy-CJS + memoize | test tải plugin thật của DSH |
| C3 | Định dạng profile/cordis.yml/patch theo id + field dsh.profile / dsh.bundle / dsh.client | --dump-config diff 0 dòng với DSH (cùng cây) |
| C4 | RPC/Typert: tên namespace, method, payload, stream | trace so sánh từng frame |
| C5 | Format phiên: **session.v4.jsonl.zstd — v4 + nén zstd** (đo 17/10/2026, khác bản nháp đầu) + bảng migration v0→v4 | mở lại được phiên do DSH tạo |
| C6 | Credentials: thứ tự lớp + `path` override | test đọc/ghi ~/.galaxy/credentials.yaml |
| C7 | Token `--dsw-*` + bộ icon (SVG gốc DSH cho UI parity) | `gate:style` + chỉ số icon |

> **Đo được ở M2 (17/10/2026) — phải nhớ khi viết kernel ở M3:** đồ thị `inject` của boot **KHÔNG phải DAG**:
> 1 id mồ côi (`dsh-client-ui-primitives`, do bundle gộp), **2 chu trình**, và 5 entry đánh dấu `external`.
> Loader của ta phải chịu được cấu trúc này; bắt topological sort nghiêm là vỡ hợp đồng C1.
>
> **Bài học về giàn đo:** bộ chuẩn hoá dump từng coi mọi chuỗi ≥32 ký tự là secret, khiến 3 id row thật bị che
> thành `<secret>` — diff có thể **che mất khác biệt thật mà vẫn báo PASS**. Mọi cơ chế che dấu vết trong giàn đo
> phải có test hồi quy: id dài KHÔNG bị che, secret thật PHẢI bị che.

### 4.4 Lựa chọn công nghệ & lý do

| Tầng | Chọn | Vì sao |
|---|---|---|
| Vỏ desktop | **Tauri 2 (Rust)** | Yêu cầu của bạn; nhẹ RAM hơn Electron (rig cũ đã đo được) |
| Build/dev | **bun** (workspace, script, test, bundler) | Yêu cầu G1; bun 1.3.14 **đã chạy được DSH CLI** |
| Host runtime | **Node >= 26 bundled** (bun là phương án B — xem R2) | Native addon (node-addon-system, N-API) + node-addon-require-builtin; node v24 hỏng im lặng |
| Kernel + plugin | **TypeScript** | Để load được plugin DSH (JS) và giữ parity hành vi |
| Hot path native | **Rust** (N-API qua bh-native) | fs/PTY/sandbox/sqlite: nhanh + an toàn, không phá contract JS |
| Python | **chỉ khi cần** (office/ML/voice) | Không bắt buộc; lane riêng, không nằm trên đường tới hạn |
| UI | **React 19 + Vite + CSS Modules + clsx + token `--dsw-*`** (đúng luật DSH, §4.7); lucide-react chỉ cho UI mới | Tailwind bị loại bỏ vì DSH cấm rõ ràng và parity pixel là mục tiêu G1 |

### 4.5 Vai trò từng ngôn ngữ (không nhất thiết dùng đủ cả ba)

- **TypeScript**: kernel, host, plugin, UI — *xương sống*, vì toàn bộ hệ sinh thái plugin DSH là JS.
- **Rust**: vỏ app + capability native + supervisor + hiệu năng cao (PTY, sandbox, index).
- **Python**: lane phụ trợ (xử lý tài liệu, ML cục bộ, speech) — bật khi có nhu cầu thật, test riêng.

### 4.6 Chiến lược kernel (K1 → K2)

| Pha | Nội dung | Ưu / nhược |
|---|---|---|
| **K1** | Kernel của ta bọc & tái xuất API tương thích cordis (cordis là MIT của cordiverse, **không phải ai-coder-core**) | Nhanh, tương thích plugin ngoài gần như tuyệt đối; vẫn là "của ta" ở tầng API/loader/patch |
| **K2** | Viết lại ruột kernel (fiber/effect/importer) bằng TS (+ tuỳ chọn Rust cho hot path) | Độc lập tuyệt đối, kiểm soát hiệu năng; rủi ro parity cao hơn |

**Đề xuất**: giữ **K1 suốt bước 2** (bọc cordis MIT) và **chỉ viết lại kernel/core ở M3 — tức là làm
CUỐI CÙNG** (§6), sau khi mọi thứ khác đã ổn định và có test parity. K2 chỉ bắt đầu sau khi M3 xong.
Kernel K1 vẫn do ta sở hữu: interface, loader, patch semantics, chính sách effect/tháo gỡ đều nằm
trong `packages/kernel` — nên "K1" không phải là phụ thuộc mù.

### 4.7 UI: theo đúng luật của DSH (CSS Modules + clsx) — và vai trò của lucide

**Quyết định chốt 17/10/2026**: giữ nguyên luật của DSH. `docs/web-styling.md` của DSH ghi rõ
*"Use CSS Modules and clsx; do not add a component library or Tailwind"*, và lý do rất cụ thể:
muốn pixel-parity với DSH thì lớp style phải **cùng cơ chế**, nếu không mỗi lần so ảnh sẽ phải đi truy
nguyên nhân lệch trong hai hệ CSS khác nhau. Vì vậy **Tailwind bị loại bỏ khỏi UI parity**.

| # | Quy tắc |
|---|---|
| R1 | **Token `--dsw-*` là nguồn giá trị duy nhất.** `gbh-client-ui-theme` phát ra đúng bộ biến `--dsw-*` (static scale + semantic alias) như DSH, để **plugin UI ngoài của DSH render đúng** trên app của ta |
| R2 | **CSS Modules + `clsx`**, component style nằm cạnh component; không thêm thư viện component, **không Tailwind** |
| R3 | **Cấm màu/số literal** trong component; chỉ dùng token `--dsw-alias-*` (`gate:style` kiểm tra) |
| R4 | **Icon: giữ nguyên SVG gốc của DSH** cho toàn bộ icon thuộc UI parity (nguồn chuẩn: `packages/client/ui-primitives/src/icons/` + các `*Icon.tsx`). **lucide-react CHỈ dùng cho UI mới của riêng Blackhole** (không tồn tại trong DSH) |
| R5 | Icon mới của Blackhole bọc trong primitive `GbhIcon` để sau này đổi bộ icon chỉ ở một chỗ |
| R6 | Thứ tự chuyển: shell + layout trước, rồi từng plugin UI; mỗi lần chuyển **phải có ảnh A/B** |

> Hệ quả: G1 (UI giống hệt) không còn phải "cân" với một sai lệch style nữa — bài toán parity trở lại
> thuần tuý: cùng DOM, cùng CSS, cùng token.

### 4.8 LLM & provider `auto`

- **Key**: đọc từ **`~/.galaxy/credentials.yaml`** qua lớp credentials của DSH (`config.path` ghim),
  env tiến trình vẫn thắng. Route này **không có UI nhập baseUrl/model**.
- **Route `auto`** = **Ollama** + model **`deepseek-v4.1-flash:cloud`**; giao diện chỉ hiển thị
  "Galaxy Blackhole auto" và ẩn fold "Customized settings". Chi tiết dây (đọc từ `gbh-web.patch.yml`
  của oracle): route id `auto`, `api: openai-completions`, `baseURL: https://ollama.com/v1`,
  `apiKeyEnv: GBH_GALAXY_API_KEY`, `defaultContextWindow: 655360`, `defaultMaxTokens: 32768`,
  và row `llm-deepseek` bị **disable** để trang Models chỉ hiện route Galaxy.
- **Test bắt buộc cho hợp đồng ẩn này**: (a) `auto` resolve đúng provider/model; (b) thiếu key → cảnh
  báo rõ + mở luồng nhập key; (c) DOM/i18n **không lộ** tên provider thật; (d) **tôi tự gọi LLM** bằng key
  sẵn có để chạy turn thật (chi phí nhỏ) và ghi token usage vào báo cáo parity.

---

## 5. Chiến lược parity & bằng chứng (trái tim của dự án)

### 5.1 Oracle

- **Oracle A**: http://127.0.0.1:4001/ — blackhole web/DSH hiện tại của bạn (đang chạy).
- **Oracle B**: app của ta ở **bước 1**, chạy runtime DSH **pin cùng version**, cùng profile, cùng
  credentials → chứng minh vỏ Tauri không làm lệch hành vi.
- **Oracle C**: bản build từ vendor/dsh-reference (cùng commit) chạy headless — cho test tự động,
  không cần UI.

### 5.2 Bốn cổng gate (tự động, chạy trước mọi lần báo "xong")

| Gate | Nội dung | Ngưỡng đạt |
|---|---|---|
| gate:lint | header 4 dòng · <=1000 dòng/file · JSDoc cho mọi function/hook xuất khẩu | 100%, 0 vi phạm |
| gate:style | không màu/số literal trong component; chỉ token `--dsw-*`; **không Tailwind**; icon parity phải là **SVG gốc của DSH** | 0 vi phạm; mọi icon parity truy được về file gốc |
| gate:no-ai-coder-core | quét toàn bộ dependency (trực tiếp + transitive trong lockfile) | 0 lần xuất hiện |
| gate:parity | --dump-config diff, protocol trace diff, session round-trip, DOM/shot diff | 0 dòng với config; <=0.1% pixel với UI |
| gate:independence | chạy test suite **khi đã gỡ DSH khỏi node_modules** (bước 2) | pass 100% |

### 5.3 Tháp test

1. **Unit** (bun test) — kernel, patch engine, schema, parser, store, tool logic.
2. **Contract** — sinh từ .d.ts của DSH + snapshot boot injection + snapshot dump-config.
3. **Integration** — host + webserver + api: bật server thật, gọi RPC thật.
4. **E2E app** — --smoke (in một dòng JSON các mark như rig cũ) + mở phiên thật, chạy 1 turn.
5. **Visual parity** — Playwright (dùng **Google Chrome có sẵn**, không tải browser) chụp cùng
   viewport/kích thước/seed cho 4001 và 5439 → pixelmatch → ảnh side-by-side + diff.
6. **Protocol parity** — ghi trace WS/HTTP hai bên, chuẩn hoá (bỏ token, timestamp, id) rồi diff.
7. **Plugin compat** — cài một plugin ngoài (topic dsh-plugin) và một plugin tự viết → chạy cả hai bên.
8. **Rust** — cargo test cho supervisor/native; test tranh chấp port, token, restart.
9. **Bench** — tools/bench so RAM/thời gian khởi động Tauri vs Electron (kế thừa rig cũ).

### 5.4 Công cụ parity cụ thể (deliverable của M0)

```bash
bun run parity:dump      # dump-config hai bên → diff YAML (chuẩn hoá path)
bun run parity:shot      # chụp 4001 vs 5439 (nhiều route/size) → .parity/shots/<ts>/
bun run parity:dom       # DOM + a11y tree đã chuẩn hoá → diff
bun run parity:trace     # trace RPC hai bên → diff frame
bun run parity:report    # tổng hợp MD/HTML: mỗi hạng mục PASS/FAIL + ảnh
```

Có parity:shot thì **tôi tự chụp ảnh và tự so sánh được** — đúng yêu cầu của bạn, không cần bạn làm
hộ. Ảnh lưu trong .parity/, không commit.

### 5.5 Ma trận parity theo tầng (dùng để xếp thứ tự viết lại)

| Tầng | Nội dung | Số package | Thứ tự | Test bắt buộc |
|---|---|---|---|---|
| **T2** | Host/API: webserver, frontend-static, connection, gateway, controllers | 9 + 10 | **1** | integration + protocol trace |
| **T3** | Client shell + UI plugins | 8 + 49 | **2** | DOM/shot diff từng plugin |
| **T4** | Tool/LLM/sandbox/shell/fs/subagent/goal/schedule/workflow/mcp/terminal | ~60 | **3** | unit + e2e |
| **T0** | Kernel: Context/Service/effect/Loader/patch/HMR | 1 + 6 hạ tầng | **4 (cuối)** | unit + contract + dump-config |
| **T1** | Core spine: session, agent, agent-loop, tools, system-prompt, scope | 8 | **5 (cuối)** | unit + integration + 1 turn thật |
| **T5** | experimental (47 gói) | 47 | 6 (hoặc bỏ) | quyết định sau |

> **Thứ tự thực thi bước 2: T2 → T3 → T4 → T0/T1** — kernel và core viết CUỐI (§6), vì chúng ổn định
> nhất và là nền cho mọi thứ khác chạy trong lúc ta thay các tầng bên trên.

> Nguyên tắc: **parity theo hành vi, không theo file**. Không cần copy từng dòng; cần cùng hành vi,
> cùng hợp đồng, cùng giao diện — và có bằng chứng.

---

## 6. Lộ trình

### M0 — Khung dự án & giàn parity (0.5–1 ngày)

- Tạo repo blackhole-tauri (bun workspace), Rust workspace, app Tauri khởi động được.
- Clone upstream **pin commit** vào ~/tmp/galaxy-blackhole/dsh-upstream (shallow) + copy vào
  vendor/dsh-reference (chỉ đọc).
- Host 5439 chạy được + HMR 3 tầng + parity:shot / parity:dump ra kết quả đầu tiên.
- Lint gate (header/1000 dòng/JSDoc/no-ai-coder-core) chạy được.
- **Acceptance**: bun run dev mở app; http://127.0.0.1:5439/ trả UI; parity:report sinh ảnh A/B đầu
  tiên; bun run gate xanh; dump-config 2 bên giống nhau.

### M1 — BƯỚC 1: tích hợp trọn DSH vào app Tauri ⛳ *(checkpoint báo cáo, không chặn tiến độ)*

- Runtime DSH pin (0.2.x) + **toàn bộ 294 row / 189 package** của profile web (đủ plugin hiện có).
- Profile riêng desktop/blackhole + bundle + patch riêng (kế thừa kỹ thuật gbh-*.patch.yml).
- **Credentials**: credentials.config.path = ~/.galaxy/credentials.yaml (một gốc cho mọi dự án).
- Home riêng ~/.galaxy/blackhole — **tuyệt đối không ghi vào ~/.galaxy/gbh**. Gate đo bằng **nhân quả**
  (không writer mới · `profiles/**` bất biến · không fd nào dưới gbh · vẫn assert hash+mtime khi cây tĩnh)
  vì cây đó đang bị các harness khác ghi liên tục — xem [ADR 0002](ADR/0002-home-isolation-and-generated-patch-layer.md).
- Vỏ Tauri: spawn Node thật (bundle), health-check, token, port 5439, tray, chống mở trùng.
- Checklist parity đầy đủ: chat, tool, session, settings, models, plugin manager, goal, schedule,
  subagent, workflow, plan, approval, jobs, terminal, sidebar, files, deliverables, commands, skill,
  MCP… → mỗi mục có ảnh + test.
- **Acceptance**: parity:report xanh toàn bộ (trừ khác biệt brand có chủ ý); app cài được trên máy
  này; web 5439 luôn bật.

**⛳ CHECKPOINT 1 (không chặn tiến độ)**: bàn giao bản chạy được + báo cáo parity kèm ảnh A/B, rồi
**tôi tự đi tiếp**: tự tạo input kiểm thử, tự gọi LLM bằng key sẵn có (route `auto`) để chạy turn thật —
không cần bạn viết prompt. Bạn xem báo cáo lúc nào cũng được, có phản hồi thì tôi điều chỉnh ngay.

### M2 — Liệt kê & đóng băng hợp đồng (1–2 ngày)

- Sinh **parity matrix** đầy đủ từ upstream + dump-config + .d.ts + DSH-PLUGINS.md.
- Viết docs/contracts/*.md cho C1–C6, kèm test snapshot.
- Đóng băng thêm **C7: lớp token `--dsw-*` + bảng ánh xạ icon DSH → lucide** (§4.7) — đây là điều kiện
  để plugin UI ngoài của DSH render đúng trên UI Tailwind của ta.
- Chốt ngưỡng diff cho từng loại test; chốt thứ tự tầng (**T2 → T3 → T4 → T0/T1**).
- **Acceptance**: mỗi package DSH có một dòng trong matrix: vai trò, ctx key, phụ thuộc, tầng, test
  tương ứng, trạng thái, người phụ trách.

### Thứ tự thực thi bước 2 (chốt theo phản hồi 17/10/2026)

**M4 → M5 → M6 → M3 → M7.**

Lý do: **kernel + core (T0/T1) là phần ổn định nhất** của DSH, ít thay đổi nhất; ta giữ nó làm nền để
mọi thứ khác chạy trong lúc thay các tầng bên trên, và **chỉ viết lại khi tất cả phần còn lại đã ổn
định** + có test parity đầy đủ. Đây cũng là cách giảm rủi ro lớn nhất: **thay tim sau cùng**, khi lưới
an toàn đã dày.

### M4 — Viết lại T2: Host/API *(làm ĐẦU TIÊN)*

webserver, frontend-static, index injection, connection, gateway, api-*-controller, workspace files.
Không đụng kernel/core: các package mới của ta vẫn nói chuyện với core DSH qua hợp đồng đã đóng băng
ở M2. Mỗi lần thay một row = 1 PR kèm dump-config diff + protocol trace diff + test.

### M5 — Viết lại T3: client shell + 49 plugin UI *(thứ hai)*

Viết lại theo đúng luật DSH (§4.7): React 19 + Vite + **CSS Modules + clsx** + token `--dsw-*`,
**giữ SVG gốc của DSH cho mọi icon parity**. Mỗi plugin UI: tái tạo DOM/slot/inject + CSS, chứng minh
bằng ảnh chụp nhiều trạng thái (rỗng, đang chạy, lỗi, vi, en, theme sáng/tối, nhiều kích thước màn hình)
và bởi một **plugin UI ngoài của DSH cài vào vẫn chạy**.

### M6 — Viết lại T4: tool/LLM/sandbox/subagent/goal/schedule/workflow/mcp/terminal *(thứ ba)*

Bao gồm provider `auto` == Ollama + `deepseek-v4.1-flash:cloud` (§4.8) và toàn bộ 19 tool plugin.

### M3 — Viết lại T0 + T1: kernel & core spine *(LÀM CUỐI)*

Chỉ bắt đầu khi T2/T3/T4 đã xanh. Thay dần từng row plugin bằng implementation của ta, mỗi lần thay =
1 PR có bằng chứng parity (dump-config + test + trace). Kết thúc M3: cây plugin chạy trên kernel của ta,
agent chạy 1 turn thật, và **gate:independence bắt đầu có ý nghĩa**. Sau M3 mới cân nhắc K2.

### M7 — Độc lập & phát hành

Gỡ hẳn runtime DSH → gate:independence xanh; plugin compat suite (plugin ngoài + plugin tự viết);
đóng gói dmg/msi/AppImage; updater; docs; THIRD_PARTY_NOTICES.

---

## 7. Chuẩn code & gate tự động

### 7.1 Header bắt buộc (mọi file, mọi ngôn ngữ)

```ts
/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 15/10/2026
 * desc [mô tả cụ thể file này làm gì]
 */
```

- create date: **15/10/2026** — ngày khởi động dự án (D0), cố định cho mọi file (theo đúng mẫu bạn đưa).
  (Nếu bạn muốn dùng ngày tạo thật thì nói ở D3.)
- modify date: ngày sửa cuối, **hook tự cập nhật** khi commit.
- Biến thể: <!-- --> cho .md/.html, # cho .yml/.toml/.sh, // cho .rs. Nội dung 5 dòng giữ nguyên.

### 7.2 Luật code

| Luật | Cách thực thi |
|---|---|
| <= ~1000 dòng/file | tools/lint/file-length; file dài hơn phải tách module (không nới ngưỡng) |
| Mọi function có mô tả | tools/lint/jsdoc-coverage — mọi hàm/hook/component export đều có mô tả *làm gì, nhận gì, trả gì* |
| Không dùng ai-coder-core | tools/lint/dep-guard (quét dependency trực tiếp + lockfile) |
| Không import chéo tầng | kernel không import core; core không import client-ui; kiểm bằng dependency-cruiser |
| Không sửa vendor/dsh-reference | git hook + CI |
| TS strict, không any ngầm | tsc --noEmit + oxlint/eslint |
| Tên & cấu trúc package | **@galaxy-blackhole/gbh-<vai trò>** (quy đổi 1-1 từ @deepseek-ai/dsh-<vai trò>) |
| Style | **CSS Modules + `clsx`**, chỉ dùng token `--dsw-*`, cấm màu/số literal, **không Tailwind** (đúng luật DSH) |
| Icon | UI parity **giữ SVG gốc của DSH** (nguồn: `packages/client/ui-primitives/src/icons/`); lucide-react **chỉ** cho UI mới của Blackhole; wrapper `GbhIcon` để đổi về sau nếu cần |

### 7.3 Lệnh chuẩn hoá

```bash
bun install
bun run dev            # app Tauri + host 5439 + HMR
scripts/restart-host.sh        # chỉ host + UI (không cửa sổ) — dùng để chụp ảnh
bun run gate           # lint + typecheck + unit + e2e + parity
bun run parity:report  # báo cáo parity kèm ảnh
```

---

## 8. Môi trường dev: 5439, HMR, vòng lặp chụp ảnh

| Yêu cầu của bạn | Cách làm |
|---|---|
| Luôn bật web 127.0.0.1:5439 | Host bind 5439 mặc định; nếu bận → cổng OS + in URL rõ; có chế độ bh host --port 5439 chạy nền (kèm launchd plist tuỳ chọn) |
| Luôn bật HMR | 3 tầng: (1) tauri dev reload vỏ Rust; (2) Vite HMR cho UI/client bundle; (3) dsh-hmr + dsh-client-hmr reload plugin theo patch YAML (patchReload: live đã bật trong profile) |
| Tôi tự chụp ảnh so sánh | parity:shot (Playwright + Chrome có sẵn) chụp cả 4001 và 5439; tôi đọc ảnh bằng công cụ ảnh để so bằng mắt và bằng pixel-diff |
| Không đụng ~/.galaxy/gbh | Home mới ~/.galaxy/blackhole; test gate:home-isolation so hash/mtime cây ~/.galaxy/gbh trước–sau mỗi e2e |
| An toàn sandbox | Mọi thử nghiệm trong repo mới + ~/tmp/galaxy-blackhole; clone upstream chỉ đọc; không cài global |

---

## 9. Tổ chức team agent / subagent / goal

### 9.1 Vai trò (mở sau khi bạn duyệt)

| Thành viên | Vùng ghi (write scope) | Trách nhiệm |
|---|---|---|
| **Lead (tôi)** | crates/, apps/, packages/kernel/, docs/ROADMAP.md | Kiến trúc, hợp đồng, tích hợp, gate cuối, trả lời bạn |
| tm-kernel-core | packages/kernel/, packages/core/, packages/compat/ | T0 + T1 — **chỉ bật từ M3 (giai đoạn cuối)** |
| tm-host-api | packages/host/, packages/api/, packages/llm/ | T2 + LLM — **bật ngay từ M4 (đầu tiên)** |
| tm-client-ui | packages/client/, packages/client-ui/, ui/ | T3 |
| tm-tools | packages/tool/ + packages/{sandbox,subagent,goal,schedule,workflow,mcp,terminal,session}/ | T4 |
| tm-parity | tools/parity/, .parity/, tests/e2e/ | Giàn oracle, ảnh, trace, báo cáo — **không sửa code sản phẩm** |
| tm-docs | docs/PARITY-MATRIX.md, docs/contracts/ | Ma trận & hợp đồng (ROADMAP do Lead giữ) |

**Luật phối hợp**: mỗi task trên board ghi rõ write_scopes; không hai agent ghi cùng package; thay đổi
hợp đồng (C1–C6) phải qua Lead; tm-parity là bên phán xử "đạt/không đạt".

### 9.2 Subagent cho việc cần đào sâu (chạy nền, không giữ context chính)

- "Trích hợp đồng loader/patch của cordis từ upstream" → docs/contracts
- "Kiểm tra tương thích WKWebView của web UI DSH" (R1)
- "Đo bun vs node làm host runtime" (R2)
- "Harvest .d.ts → ma trận API T1/T2"
- "Nghiên cứu plugin ngoài trên topic dsh-plugin" (chứng minh G1)

### 9.3 Goal & nhịp báo cáo

- Tạo **goal** "Blackhole Desktop Tauri" với max_goal_rounds đủ lớn; **mỗi khi số round tiến gần giới
  hạn, tôi tự tăng cap** (update_goal edit) chứ không dừng giữa đường — đúng ý bạn.
- Báo tiến độ: (a) khi xong mỗi milestone; (b) nhắc định kỳ **90 phút** trong lúc chạy goal
  (schedule_create) — tắt được bất cứ lúc nào.

---

## 10. Rủi ro & đối sách

| # | Rủi ro | Mức | Đối sách |
|---|---|---|---|
| **R1** | **WKWebView != Chromium**: DSH UI build cho Chromium (Electron); Tauri trên macOS dùng WKWebView → có thể lệch render/API | **Cao** | Spike ngay M0: mở UI DSH trong Tauri, chạy checklist API (CSS :has, dialog, clipboard, worker, IndexedDB, showDirectoryPicker…). Có polyfill/shape-patch. Nếu vẫn lệch lớn: web surface vẫn là **canonical** (chụp ảnh qua Chrome), cửa sổ Tauri dùng cho trải nghiệm app; hoặc chọn webview khác — sẽ báo bạn trước khi đổi hướng |
| **R2** | **Runtime host**: node v24 hỏng im lặng; native addon N-API; bun chưa chắc chạy full | Cao | Bundle **Node >= 26** (đúng cách app Electron cũ làm); spike "bun làm host" song song; pin version |
| **R3** | DSH là *developer preview*, breaking changes liên tục | Cao | Pin commit/tag; UPSTREAM.md ghi version; job đồng bộ định kỳ + chạy lại toàn bộ parity trước khi nhảy |
| **R4** | 340 package upstream → nguy cơ "đuối" | Cao | Ma trận tầng T0–T5, parity theo hành vi, quyết định "bỏ" rõ ràng cho T5 |
| **R5** | 1000 dòng/file vs code sinh tự động/bundle | Trung | Không viết tay bundle; tách module; lint bỏ qua dist/, vendor/ |
| **R6** | credentials.yaml dùng chung nhiều app → tranh chấp ghi | Trung | DSH đã có atomic write + file lock; ta thêm: chỉ ghi khi người dùng thao tác, backup trước khi ghi |
| **R7** | License/attribution khi dẫn xuất code MIT | Trung | Giữ LICENSE, THIRD_PARTY_NOTICES, ghi rõ nguồn từng package; giữ header gốc nếu copy |
| **R8** | HMR nhiều tầng → tưởng đã đổi mà bundle cũ | Trung | Parity harness luôn hard-reload + ghi hash bundle vào báo cáo |
| **R9** | Port 5439 bị chiếm / token lộ | Trung | Tranh chấp cổng có báo lỗi rõ; bind 127.0.0.1; token trong URL như DSH; không log secret |
| **R10** | Nhiều agent ghi đè nhau | Trung | Task board + write_scopes + một người viết một package; Lead review diff cuối |
| **R11** | Kỳ vọng "giống hệt" tuyệt đối về pixel | Trung | Chốt ngưỡng ngay M2: config **0 dòng**, DOM tương đương, pixel **<=0.1%** (bỏ vùng brand) |

---

## 11. Bảo mật, credentials, license

- **Credentials**: một gốc ~/.galaxy/credentials.yaml cho tất cả dự án. App đọc qua lớp credentials
  của DSH với config.path ghim vào file này; env tiến trình vẫn thắng (đúng semantics DSH). Không bao
  giờ in giá trị secret; test chỉ kiểm tra *khoá tồn tại*.
- **Sandbox**: host bind 127.0.0.1; mọi route cần token; không mở cổng ra ngoài; native capability
  đi qua bh-native có kiểm soát đường dẫn (deny-by-default như DSH).
- **License**: DSH và cordis/schemastery là **MIT** → được phép dẫn xuất, **phải giữ thông báo bản
  quyền**. Ta ghi THIRD_PARTY_NOTICES.md + nêu rõ package nào dẫn xuất từ package nào.
  @galaxy-stack/ai-coder-core **bị cấm** trong toàn bộ dependency graph.

---

## 12. Quyết định: đã chốt & còn lại

### 12.1 Đã chốt theo phản hồi của bạn (17/10/2026)

| # | Nội dung đã chốt |
|---|---|
| D1 | npm scope là **@galaxy-blackhole/gbh-*** (org `galaxy-blackhole`): quy đổi `@deepseek-ai/dsh-<x>` → `@galaxy-blackhole/gbh-<x>`. Repo/thư mục: `galaxy-blackhole/blackhole-tauri` |
| D2 | Bước 1 pin **0.2.1-alpha.4** — đúng version oracle 4001 đang chạy (đã kiểm chứng 17/10). Làn nâng cấp (0.2.1-rc.1 = mới nhất, 0.2.1-alpha.5) sẽ được đo tách biến version/patch rồi trình bạn chọn ở checkpoint M1 |
| D3 | **Theo luật DSH**: CSS Modules + `clsx` + token `--dsw-*`; **không Tailwind** (chốt 17/10, sau khi xác minh `docs/web-styling.md`) |
| D4 | **Giữ SVG gốc của DSH cho toàn bộ icon parity**; lucide-react chỉ dùng cho UI mới của Blackhole (§4.7) |
| D5 | Thứ tự bước 2: **M4 → M5 → M6 → M3** — kernel + core viết **cuối cùng** |
| D6 | Provider **auto** = Ollama + `deepseek-v4.1-flash:cloud`, key từ `~/.galaxy/credentials.yaml`, **không phơi trên UI** (§4.8) |
| D7 | Tôi **tự tạo input và tự gọi LLM** để kiểm thử — không cần bạn viết prompt; sau M1 chỉ báo cáo + ảnh, **không chặn tiến độ** |
| D8 | `create date` cố định **15/10/2026** cho mọi file; `modify date` = ngày sửa thật (hook tự cập nhật) |

### 12.2 Còn lại (tôi đề xuất, bạn phủ quyết bất cứ lúc nào)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| D9 | Ngưỡng parity UI | config **0 dòng**; pixel **≤0.1%** (loại vùng brand/logo); DOM tương đương |
| D10 | Kernel K1/K2 | **K1** (bọc cordis MIT) suốt bước 2; **K2 chỉ sau M3** và khi parity đã dày |
| D11 | Cổng 5439 | Cố định 5439; bận thì fallback cổng OS + in URL; có chế độ chạy nền nếu muốn "luôn bật" kể cả khi không mở app |
| D12 | Nhắc tiến độ | Báo khi xong milestone + nhắc định kỳ 90 phút trong lúc chạy goal (tắt được) |
| D13 | T5 (47 gói experimental) | Hoãn sau M7; vẫn liệt kê đủ trong parity matrix |