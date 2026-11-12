<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 26/10/2026
 desc ADR 0028 — có nên/như thế nào áp dụng kiến trúc kernel + plugin + slots UI của
      Galaxy Blackhole (blackhole-tauri) sang VS Code extension và CLI
-->

# ADR 0028 — Áp dụng kiến trúc Galaxy Blackhole sang VS Code và CLI

- **Trạng thái:** Đã chốt **Hướng D**; lát cắt 1 đã dựng + kiểm chứng live (xem §8)
- **Ngày:** 26/10/2026
- **Liên quan:** [ARCHITECTURE.md](../ARCHITECTURE.md) · [ADR 0025](0025-cong-tac-thanh-phan-va-cai-plugin.md) · [ADR 0026](0026-tat-plugin-la-tat-that.md)

## 1. Câu hỏi

Chủ dự án hỏi: app desktop nay chỉ còn **một** bản (Tauri; repo Electron đã xoá). Vì GBH về bản chất là **kernel DSH + hệ plugin + tầng UI riêng**, có thể áp dụng **cùng giao diện và cùng phương thức** đó cho **VS Code** và **CLI** hay không?

## 2. Hiện trạng đo được (26/10/2026)

### 2.1 Thứ đang có trong repo này

| Thành phần | Bằng chứng |
|---|---|
| Kernel chạy được độc lập | `apps/cli` chỉ có 2 lệnh: `bh host` (mở host + web) và `bh doctor` (chẩn đoán) — `apps/cli/src/main.ts:20,77` |
| Host là seam-based plugin graph | `packages/host/*` (194 gói khai `gbh.row`), mount từ repo vào profile mỗi lượt boot — `apps/cli/src/mount.ts` |
| Client UI là plugin graph chạy trên trình duyệt | `packages/client/ui-*`, slot registry (`plugins.item`, `settings.launcher`…), module loader riêng (`window.__ModuleLoader__`), locale overlay |
| Đã có bundle cho chế độ **không giao diện / SDK / ACP** | `packages/host/bundle-sdk-app`, `bundle-sdk-minimal`, `bundle-acp-app` (JSON-RPC qua stdio) — **chưa** có `bundle-headless` trong repo này dù UI từng liệt kê bundle `gbh-headless` |
| Giao diện chạy được trong **trình duyệt thường** | dev host `http://127.0.0.1:5439/?token=…` đã đo nhiều lượt: 48 slot, 0 lỗi console |

### 2.2 Thứ đang có ở repo khác

| Repo | Sự thật | Ý nghĩa |
|---|---|---|
| `galaxy-vscode-extension` (tên publish: **galaxy-code-vscode 2.4.0**) | Dùng **`@galaxy-stack/ai-coder-core`** + webview React 19 + assistant-ui + Tailwind; `ARCHITECTURE.md` ghi rõ \"core là runtime dependency\"; có thêm `web-launcher.ts` mở **blackhole web** bằng tiến trình con rồi mở trình duyệt | Đây là **stack khác**: tự viết agent loop/ports, KHÔNG dùng kernel DSH/GBH. Gói `ai-coder-core` lại **bị cấm** trong repo GBH (AGENTS.md §2) |
| Vendor | `galaxy-vscode-extension/vendor/dsh-client-ui-primitives` (DSH 0.2.0-rc.2, chỉ đọc) | Extension đã **vendor primitives** của DSH để dùng icon/token ⇒ tái dùng UI đã có tiền lệ |

## 3. Ba hướng cho VS Code

### Hướng A — Webview **iframe** trỏ vào GBH web đang chạy (khuyến nghị)

```
VS Code extension (rất mỏng)
  ├─ spawn: bh host --port 0 --auto-port      (hoặc dùng host đã chạy)
  ├─ đọc ~/.galaxy/blackhole/ready-url.txt → URL có token
  └─ Webview: 1 trang bootstrap tĩnh (CSP do extension đặt)
        └─ <iframe src=\"http://127.0.0.1:PORT/?token=…\">
```

- **Ưu:** dùng **nguyên** giao diện GBH (slot, plugin, locale, panel Plugin, voice, dịch, tìm kiếm web…); không nhân đôi UI; cập nhật GBH là extension hưởng ngay.
- **Nhược:** phụ thuộc CSP của webview cho `frame-src http://127.0.0.1:*`; token phải lấy từ file và **nhúng vào URL** (điều hướng 1 lần, như trình duyệt); phím tắt/focus giữa VS Code và webview tranh nhau; không dùng được theme token của VS Code (GBH có theme riêng).
- **Khối lượng:** nhỏ. Extension chỉ cần: command \"Mở GBH\", quản lý tiến trình host (start/stop, chọn cổng, dọn khi deactivate), webview bootstrap, xử lý lỗi host không lên.
- **Rủi ro cần đo trước khi hứa:** (1) webview có cho iframe localhost không; (2) cookie/token trong iframe; (3) kích thước/focus.

### Hướng B — Port UI GBH thành **webview riêng của extension**

Chuyển `packages/client/*` sang chạy trong webview của extension, tự host Remote qua `postMessage`.

- **Ưu:** không cần iframe, kiểm soát CSP/theme VS Code, dùng được `asWebviewUri`.
- **Nhược:** phải viết lại **tầng vận chuyển** (Remote → postMessage), đóng gói ~40 gói client vào 1 bundle webview, mất cơ chế mount/HMR của host, phải tự lo locale/CSS token. Đây là **tháng**, không phải tuần.
- **Khi nào chọn:** nếu chủ dự án muốn GBH \"nằm trong\" VS Code như một panel native, không phải một cửa sổ web nhúng.

### Hướng C — Viết lại UI bằng API VS Code (tree view, editor, chat participant)

- **Ưu:** cảm giác native nhất, dùng Chat Participant API của VS Code.
- **Nhược:** **mất toàn bộ** hệ slot/plugin và mọi thứ đã làm (Plugin page, voice, cot-translation, bảng nhóm…); nhân đôi sản phẩm. **Không khuyến nghị.**

## 4. CLI

### 4.1 Cái đã đúng hướng

- `bh host` + `bh doctor` đã là \"phương thức GBH\" ở dạng CLI (kernel + profile + mount).
- Đã có bundle cho máy-client: `bundle-sdk-app` (JSON-RPC stdio), `bundle-acp-app` (ACP cho công cụ ngoài), `bundle-sdk-minimal`. Nghĩa là **\"CLI như một client\"** đã có đường: một tiến trình khác nói JSON-RPC với kernel, không cần UI web.

### 4.2 Cái còn thiếu

- **Chưa có TUI** (chat trong terminal): mọi `packages/client/*` đều là React DOM ⇒ không chạy trong terminal.
- `bundle-headless` (chạy một lần, không UI) có trong danh sách bundle của profile nhưng **không có thư mục nguồn** trong repo này ⇒ cần xác nhận nó đến từ đâu (kernel upstream?) trước khi tính là năng lực của ta.

### 4.3 Đề xuất cho CLI (2 bước, độc lập nhau)

1. **TUI mỏng dùng SDK JSON-RPC** (rẻ, ít rủi ro): một client terminal (Node + `ink`) nói JSON-RPC với `bundle-sdk-app`; stream sự kiện phiên để vẽ hội thoại, duyệt uỷ quyền bằng phím. Không đụng kernel.
2. **TUI như một client plugin của GBH** (đắt, đúng \"phương thức\"): thêm `packages/client/tui-*` + một \"renderer terminal\" thay cho React, dùng chung slot registry/Remote. Chỉ nên làm nếu chủ dự án muốn TUI **ngang hàng** với web UI.

## 5. Khuyến nghị

| Mục tiêu | Hướng | Vì sao |
|---|---|---|
| Đưa GBH vào VS Code **sớm, đúng giao diện** | **A** | tái dùng 100% UI + plugin, khối lượng nhỏ; đo CSP trước |
| VS Code \"native\" lâu dài | B (sau A) | cần thiết kế lại tầng vận chuyển; chỉ làm khi A bị CSP chặn hoặc cần theme VS Code |
| Chat trong terminal | **1** (TUI mỏng qua SDK), sau đó cân nhắc 2 | kernel đã có SDK/ACP; không phải viết lại runtime |

**Điều KHÔNG nên làm:** hợp nhất `galaxy-code-vscode` hiện tại (dùng `ai-coder-core`) bằng cách bê nguyên core đó vào GBH — trái luật repo (cấm `@galaxy-stack/ai-coder-core`) và tạo hai runtime song song. Nếu hợp nhất, phải **bỏ ai-coder-core**, giữ lại phần webview/React hợp lý, rồi nối vào kernel GBH.

## 6. Việc cần làm trước khi cam kết (spike 1 ngày)

1. Dựng extension tối giản: command → spawn `bh host --auto-port` → webview iframe → mở được trang GBH.
2. Đo: CSP (`frame-src`), token trong iframe, focus/phím tắt, thời gian host lên (đã đo ~0,2–3,7 s khi cold start).
3. Ghi kết quả vào ADR này rồi mới lên kế hoạch chính thức.

## 7. Bổ sung sau phản biện của chủ dự án (26/10/2026)

Chủ dự án nêu hai điểm, **cả hai đều đúng** và làm thay đổi khuyến nghị:

1. **VS Code đã mở sẵn workspace** ⇒ extension phải làm việc trên **workspace đang mở** và **liệt kê đúng các phiên của workspace đó**, không phải một app web độc lập.
2. **Iframe cả app GBH = \"web nhúng trong VS Code\"** ⇒ sai kỳ vọng; các extension AI khác dùng **shell native của VS Code** (icon ở activity bar, view ở sidebar, tab editor cho diff, command palette, status bar, notification).

### 7.1 GBH đã có sẵn mô hình workspace → phiên

| Sự thật | Bằng chứng |
|---|---|
| Thực thể workspace giữ **danh sách phiên của nó** | `WorkspaceEntity.sessionIds` — `packages/host/workspace/src/types.ts:75` |
| Có dịch vụ điều khiển workspace (feed, lệnh, chọn thư mục) | `workspaceController` — `packages/host/api-workspace-controller` |
| Có dịch vụ điều khiển phiên (danh mục, luồng trợ lý, lịch sử, tham chiếu) | `sessionController` — `packages/host/api-session-controller` |
| Thư mục làm việc là **chiếu của phiên** | `ctx.workingDirectory` — `packages/host/working-directory/src/service.ts:66` |

⇒ Yêu cầu \"mở VS Code ở thư mục nào thì thấy phiên của thư mục đó\" **không phải xây mới**: chỉ cần map `workspaceFolders[0].uri.fsPath` → workspace entity → `sessionIds`, rồi mở phiên qua `sessionController`.

### 7.2 Hướng D — shell NATIVE của VS Code + kernel GBH + tái dùng **cụm UI hội thoại** (khuyến nghị mới)

```
VS Code extension (TypeScript, native shell)          Kernel GBH (spawn \"bh host\" hoặc SDK JSON-RPC)
├─ viewsContainers.activitybar: icon Galaxy            ├─ sessionController (danh mục/luồng/lịch sử)
│   └─ views: \"Hội thoại\" (WebviewView)  ◄──────────► ├─ workspaceController (feed workspace)
├─ editor tab: diff/preview tệp do agent sửa           ├─ tool-* (đọc/ghi/bash trong workspace)
├─ notifications + QuickPick cho phép duyệt            └─ approval seam
├─ status bar: model · token · trạng thái chạy
└─ command palette: /new, /compact, chọn model, mở phiên
```

**Tái dùng cái gì (và KHÔNG tái dùng cái gì)**

| Dùng lại | Không dùng |
|---|---|
| **Kernel + plugin host** (`packages/host/*`) — 100% | **App shell**: `client-ui-layout`, `client-ui-sidebar*`, `client-ui-settings*`, trang Plugin |
| Cụm UI hội thoại: `client-ui-renderer`, `client-ui-conversation`, `client-ui-chat`, `client-ui-tool`, `client-ui-primitives`, `client-ui-attachment`, locale | Theme/CSS token của GBH (webview dùng token `--vscode-*`) |
| Slot registry + module loader **trong webview** (để giữ khả năng plugin hoá) | Cơ chế mount/HMR của host (không cần trong webview) |
| `connection`/`api-remotes` (hoặc thay bằng cầu `postMessage` qua extension host) | Toàn bộ `ui-settings-*`, `ui-brand-official`, voice/cot UI (có thể bật sau như panel phụ) |

**Bảng map contribution ↔ thành phần GBH**

| VS Code contribution | Lấy từ GBH |
|---|---|
| `viewsContainers.activitybar` (icon riêng) | icon bộ `client-ui-primitives` |
| `views` → `WebviewView` \"Hội thoại\" | `client-ui-conversation` + `client-ui-chat` + `client-ui-renderer` |
| `commands` (phiên mới, nén ngữ cảnh, chọn model, mở phiên cũ) | `sessionController` + `command-*` của kernel |
| `vscode.diff` / custom editor cho tệp agent sửa | `host-workspace-changes` + `session-turn-outline` |
| `window.showInformationMessage` + `QuickPick` cho phép duyệt | `approval` seam |
| `StatusBarItem` | `client-ui-model-selection` + `token-meter` |
| `workspace.onDidChangeWorkspaceFolders` → resolve phiên | `workspaceController` + `WorkspaceEntity.sessionIds` |

**Khối lượng & rủi ro**

- Việc lớn nhất là **đóng gói cụm UI hội thoại** thành 1 bundle webview (~8–10 gói client) + **cầu vận chuyển** (Remote ⇄ `postMessage`, vì webview không nên mở WS trực tiếp). Đây đúng là \"Hướng B\" nhưng **chỉ cho cụm hội thoại**, không phải cả app ⇒ nhỏ hơn nhiều.
- Rủi ro: (a) CSP của `WebviewView` với ảnh/font/CSS module; (b) đồng bộ theme (`--vscode-*` thay token GBH); (c) phím tắt (VS Code giữ phím, webview chỉ nhận khi focus); (d) phiên đang chạy ở app desktop và VS Code **cùng lúc** (cần chặn \"một phiên chỉ một client\" hoặc cho phép nhưng có cảnh báo).
- Ước lượng: **spike 2–3 ngày** cho hội thoại chạy được trong sidebar (chưa có diff/approval), **2–3 tuần** cho bản dùng được hằng ngày.

### 7.3 Điều chỉnh khuyến nghị

| Mục tiêu | Hướng | Ghi chú |
|---|---|---|
| Xem GBH trong VS Code **ngay hôm nay** (không phải sản phẩm) | A (iframe) | Chỉ để xem/đối chiếu, **không** gọi là tích hợp VS Code |
| **Tích hợp VS Code thật** (workspace-bound, giao diện native) | **D** | Khuyến nghị chính thức; dùng kernel GBH + cụm hội thoại + shell VS Code |
| Nếu sau này cần **toàn bộ** UI GBH trong VS Code | B | Chỉ khi D đã chạy và có nhu cầu (Plugin page, voice, dịch…) |
| Chat trong terminal | TUI mỏng qua SDK | như §4.3 |

**Chốt lại:** phản biện của chủ dự án là đúng — A không phải đích. Đích là **D**: kernel GBH giữ nguyên, UI chỉ tái dùng phần hội thoại, còn \"khung\" là của VS Code; phiên bám theo workspace đang mở thông qua `WorkspaceEntity.sessionIds`.

## 8. Trạng thái triển khai (26/10/2026) — nhánh `spike/gbh-kernel-map` trong `galaxy-vscode-extension`

Đã dựng và **kiểm chứng live** (xem `galaxy-vscode-extension/docs/SPIKE-gbh-mapping.md`):

| Việc | Trạng thái | Bằng chứng |
|---|---|---|
| Map workspace đang mở → workspace của kernel | ✅ | `WorkspaceEntity.sessionIds` + fallback `cwd`; 12 phiên cho `~/Desktop/Project/galaxy` |
| Đọc phiên qua **Remote thật** (`session.list`) | ✅ | 16 phiên từ kernel đang chạy; `POST /api/session/list` + cookie `dsh-auth-*` |
| Panel hội thoại **native** trong VS Code (`WebviewView`) | ✅ lát cắt 1 | `session.page` + `asOfSeq`; 5 tin nhắn từ phiên thật |
| Test live trong VS Code thật | ✅ | extension host `0 failure(s)`, `source === "remote"` |
| Gửi tin từ panel | ✅ | hoá ra là **unary** `session/prompt` (không phải stream): kernel nhận, đặt tiêu đề, asOfSeq 3 → 21 |
| Duyệt uỷ quyền trong VS Code | ✅ | stream `$events`: ready → waterfall `approval/request` → trả `allowed-once`/rejected qua `/api/$events/result` |
| Diff tệp agent sửa | ✅ | `git status --porcelain` + `vscode.diff` (HEAD ↔ hiện tại) |
| Deep-link `#session=` cho web | ✅ | `shell-identity.tapIndex` chèn script đọc hash (query mất qua redirect 303) → ghi lựa chọn phiên trước khi client boot; đối chứng A/B/C bằng Playwright |
| Tái dùng nguyên cụm UI web (`client-ui-conversation`…) | ⛔ chưa | chỉ cần nếu muốn giống 100% giao diện web |

Hai lỗi thật phát hiện khi chạy live **trong repo `galaxy-vscode-extension`** (đã sửa ở nhánh đó): `workspace-mcp` import tĩnh kéo zod làm extension không activate trên VS Code 1.143; và suite treo vì `await` một `showInformationMessage`.
