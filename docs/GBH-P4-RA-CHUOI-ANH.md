<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 07/11/2026
 desc Báo cáo RÀ CHUỖI TIẾNG ANH còn hiển thị trên UI THẬT của app 5439 (ảnh + DOM), kèm truy vết gói/khoá/namespace.
-->

# Rà chuỗi tiếng Anh còn hiển thị trên UI thật (07/11/2026)

> **Cách đo**: Chrome headless CDP (cổng 9222) + script harness `/tmp/gbh-audit/scripts/cdp.ts` (rút text node đang render,
> chụp PNG, bấm theo nhãn, mở menu). Mọi kết luận dưới đây đều có **ảnh** trong `/tmp/gbh-audit/*.png` và **DOM text**
> trong `/tmp/gbh-audit/*.json`. Không suy đoán từ mã nguồn: mã nguồn chỉ dùng để **truy vết** chuỗi đã thấy trên UI.

> ⚠️ **Bài học đo quan trọng (đừng bỏ qua)**: lượt đo đầu tiên (10:52) chạy trên trang đã tải **trước** khi host 5439
> được boot lại (bundle client phục vụ theo `rev=`, xem `app.patch.yml`/`host-5439.log` 10:56). Trang cũ hiển thị
> **rất nhiều** tiếng Anh (Work details / Detailed / On completion / Read Only / Workspace Write / Sign in / Chat /
> Completed in / 1 turns 53 steps…) và cả lỗi tiếng Anh `permission catalog has no active Host connection`.
> **Sau khi reload trang**, gần như toàn bộ các chuỗi đó đã là tiếng Việt. Vì vậy báo cáo này **chỉ tính các chuỗi còn
> tiếng Anh sau reload**; phần "đã ổn sau reload" ghi ở §5 để không ai đi sửa lại chỗ đã đúng.

---

## 0. TL;DR

- Sau reload, UI **gần như đã Việt hoá hết**. Số chuỗi tiếng Anh còn hiển thị: **40** (không tính mô tả skill/nội dung).
- Nhóm nặng nhất: **Cài đặt → Agent preset** (2 nút + toàn bộ nội dung 2 hộp thoại hướng dẫn, ~20 dòng),
  **trang Plugin ở sidebar** (6 tên + 6 mô tả plugin thử nghiệm), **Cài đặt → Plugin** (6 mô tả + 1 tiêu đề).
- Có **2 loại nguyên nhân**, phải phân biệt khi sửa:
  1. **Thiếu bản dịch vi** trong từ điển của gói (chỉ có `zh`+`en`) → thêm khoá vào dict vi.
  2. **Có bản dịch vi nhưng UI vẫn hiện en** → lỗi chọn ngôn ngữ/đường lấy chuỗi (không phải thiếu dịch).
- Chuỗi "Auto"/"Max" ở chip model **không phải chuỗi từ điển**: đó là `name: Auto` của model trong
  `~/.galaxy/blackhole/app.patch.yml:64` và id effort `max` trong `reasoningEfforts`.

---

## 1. Bảng chuỗi tiếng Anh còn hiển thị (sau reload)

Cột "vi?" = từ điển tiếng Việt **đã có** bản dịch cho khoá đó hay chưa (đo bằng grep trên artefact/nguồn).
Ký hiệu: ✅ có · ❌ không có · ➖ không phải chuỗi từ điển.

### 1.1 Trang chủ / sidebar (a)

| # | Bề mặt | Chuỗi tiếng Anh | Gói | Khoá | Namespace | vi? | Ghi chú |
|---|---|---|---|---|---|---|---|
| 1 | Sidebar, nhãn nhóm dưới "Phiên mới" | `Workspace` | `packages/client/ui-workspace` | `section.workspaces` (en "Workspaces"); `groupBy.workspace` (en "Workspace") | `workspace` | ⚠️ vi **giữ nguyên** "Workspace" | Nên dịch "Không gian làm việc". Ảnh `25-hero.png` |
| 2 | Chip chọn model ở composer | `Auto` | ➖ config host | `models[].name` | — | ➖ | `~/.galaxy/blackhole/app.patch.yml:64` — **tên model**, sửa config chứ không sửa từ điển |

### 1.2 Phiên chat — khung hội thoại + thanh trạng thái (b)

| # | Bề mặt | Chuỗi tiếng Anh | Gói | Khoá | Namespace | vi? | Ghi chú |
|---|---|---|---|---|---|---|---|
| 3 | Thanh trên cùng phiên | `4 subagent` | `packages/client/locale` | `message.turnProcess.subagents.one` / `.other` | `chat` | ⚠️ vi = `{count} subagent` | vi cố ý giữ "subagent"; nếu muốn Việt hoá: "4 tác vụ con" |
| 4 | Chip model (góc phải composer) | `Max` (mức suy luận) | ➖ config host | `reasoningEfforts` (`off/low/high/max`) | — | ➖ | Nhãn effort lấy từ catalog model ở `app.patch.yml` |
| 5 | Chip model | `Auto` | ➖ config host | như #2 | — | ➖ | |

### 1.3 Tab "Luồng chạy" (trajectory) (b)

| # | Bề mặt | Chuỗi tiếng Anh | Gói | Khoá | Namespace | vi? | Ghi chú |
|---|---|---|---|---|---|---|---|
| 6 | Chú giải cột của bảng timeline | `Model` | `packages/client/ui-trajectory` | `column.model` (và `details.model`) | `trajectory` | ⚠️ vi = "Model" | Dict vi của gói ghi đúng chữ "Model" ⇒ nên đổi vi thành "Mô hình". Ảnh `27-chat-mid.png`, `26-trajectory.png` |

### 1.4 Menu "/" trong ô nhập (f)

| # | Bề mặt | Chuỗi / cụm | Gói | Khoá | Namespace | vi? | Ghi chú |
|---|---|---|---|---|---|---|---|
| 7 | Tiêu đề nhóm trong menu "/" | `Skill` | `packages/client/locale` (`ui-skill` cũng có `row.title`) | `skill` / `row.title` | `slash.menu` / `skill` | ⚠️ vi giữ "Skill" | Nên "Kỹ năng". Ảnh `25-slash.png`, `13-slash.png` |
| 8 | Mô tả 15 skill trong menu "/" (`banner-design`, `brand`, `design`, `design-system`, `office`, `office-docx`, `office-export-pdf`, `office-pptx`, `office-recalculate`, `office-render`, `office-xlsx`, `slides`, `ui-styling`, `ui-ux-pro-max`, `dsh-badge`→đã Việt) | vd `Create, read, edit, and validate Word documents (.docx).` | ➖ **nội dung SKILL.md** | frontmatter `description` | — | ➖ | Không phải chuỗi từ điển; muốn dịch phải sửa `SKILL.md` của từng skill (khuyến nghị: để nguyên) |

### 1.5 Menu "Thêm" (c)

| # | Bề mặt | Chuỗi | Ghi chú |
|---|---|---|---|
| — | Menu "**Thêm**" | KHÔNG còn | Sau reload: "Cài đặt · Phản hồi · Đăng nhập" (đều tiếng Việt). Ảnh `25-them-menu.png` |

### 1.6 Cài đặt → Chung (d)

| # | Bề mặt | Chuỗi tiếng Anh | Gói | Khoá | Namespace | vi? | Ghi chú |
|---|---|---|---|---|---|---|---|
| 9 | "Hành vi gửi khi đang bận" → lựa chọn thứ 2 | `Steer` | `packages/client/ui-conversation` | `settings.enter.steer` | `conversation` | ⚠️ vi = "Steer" | Từ chuyên môn; có thể giữ. Ảnh `24-menu-4.png` |
| 10 | Menu "Ngôn ngữ" | `English` | `packages/client/ui-theme`/`locale` | `locale.en` | `settings.locale` | — | **Bỏ qua** (tên ngôn ngữ bản ngữ). Ảnh `24-menu-1.png` |

### 1.7 Cài đặt → Mô hình (d + e)

| # | Bề mặt | Chuỗi tiếng Anh | Gói | Khoá | Namespace | vi? | Ghi chú |
|---|---|---|---|---|---|---|---|
| 11 | Nhà cung cấp → "Cài đặt đã tuỳ biến" → nhãn ô | `Display name` | `packages/client/ui-settings-models` | `modelName` / `customDisplayName` | `settings.models` | ❌ chỉ có zh+en | Nằm trong mục gập `<details>` "Cài đặt đã tuỳ biến" — DOM có, cần mở mới thấy. Ảnh `31-mo-hinh-sua.png` + `09-mo-hinh-sua.png` (bản mở rộng) |
| 12 | Như trên | `API protocol` | `packages/client/ui-settings-models` | `customApi` | `settings.models` | ❌ chỉ có zh+en | |

### 1.8 Cài đặt → Plugin (i)

| # | Bề mặt | Chuỗi tiếng Anh | Gói | Khoá | Namespace | vi? | Ghi chú |
|---|---|---|---|---|---|---|---|
| 13 | Card `gbh-tool-schedule` | `Model-facing reminder management tools (schedule_create, …) over the Host ctx.schedule service` | ➖ `packages/host/tool-schedule/package.json` `description` | — | — | ✅ **UI-plugin-manager ĐÃ có vi** nhưng không dùng | Gốc: `ui-settings-plugin-inventory/src/inventory-model.ts:111` lấy `row.meta.description` (từ package.json host); bảng `PLUGIN_DESCRIPTIONS` (ui-plugin-manager) vi = "Bộ công cụ quản lý nhắc hẹn cho mô hình: …" không được lấy |
| 14 | Card `gbh-command-goal` | `Human-facing slash command for persisted same-session goals` | `packages/host/command-goal/package.json` | — | — | ✅ có vi ở ui-plugin-manager | |
| 15 | Card `gbh-host-tool-ask-user` | `The ask-user tool: lets the agent ask the user a question mid-turn, registered through the tools service.` | `packages/host/host-tool-ask-user/package.json` | — | — | ✅ có vi ở ui-plugin-manager | |
| 16 | Card `gbh-host-tool-present` | `The present tool: lets the agent hand the user a file as a deliverable, registered through the tools service.` | `packages/host/host-tool-present/package.json` | — | — | ✅ có vi ở ui-plugin-manager | |
| 17 | Card `gbh-plan-mode` | `Logged per-agent plan mode with deployment guidance, a direct slash command, and a user-reviewed exit` | `packages/host/plan-mode/package.json` | — | — | ✅ có vi ở ui-plugin-manager | |
| 18 | Card `gbh-command-compact` | `Human-facing slash command for explicit session compaction` | `packages/host/command-compact/package.json` | — | — | ✅ có vi ở ui-plugin-manager | |
| 19 | Tiêu đề card thời gian | `Time awareness` | `packages/host/time-context/locale/vi.json` | `meta.title` | — | ⚠️ vi = "Time awareness" | Chính **file vi** chưa dịch ⇒ sửa thành "Nhận biết thời gian". Ảnh `24-tab-plugin.png`, `07-plugin-tab2.png` |

### 1.9 Cài đặt → Agent preset (d)

| # | Bề mặt | Chuỗi tiếng Anh | Gói | Khoá | Namespace | vi? | Ghi chú |
|---|---|---|---|---|---|---|---|
| 20 | Nút dưới mỗi preset | `Mode details` | `packages/client/ui-agent-preset` | `modeExplanation` | `agentPreset` | ❌ chỉ zh+en | Ảnh `24-tab-agent-preset.png` |
| 21 | Nút dưới mỗi preset | `How to use` | `packages/client/ui-agent-preset` | `howToUse` | `agentPreset` | ❌ chỉ zh+en | |
| 22 | **Toàn bộ** hộp thoại "Mode details" | `What you can create` / `Plugins and modes` / `How the result takes effect` / `Creator mode includes the standard task tools plus runtime inspection, persistent plugin management, and guidance for authoring Cordis plugins and agent presets…` / `A plugin adds capabilities to DSH, such as a tool, a service connection, or a UI entry…` / `Ask the agent to install and verify the result, not just generate source code…` | `packages/client/ui-agent-preset` | `guide*` (markdown) | `agentPreset` | ❌ chỉ en (dòng 771-784 của `lib/client.js`), **không có vi** | Ảnh `24-mode-details.png`, `08-mode-details.png` |
| 23 | **Toàn bộ** hộp thoại "How to use" | `Choose Creator mode for a new task. Describe the capability you want, where it should appear, and how you will verify it.` · `Add a UI` · `Example task` · `Create a DSH plugin that adds a project notes entry to the sidebar…` · `Expected output: an installed plugin with a working entry and preview page…` · `Add a tool` · `Create a plugin with a tool that reads this project's test report…` · `Expected output: a plugin with a callable tool and a verified sample call.` · `Create my own mode` · `Create a "Code review" mode based on Standard mode…` · `Expected output: a custom preset for new tasks…` | `packages/client/ui-agent-preset` | `guideIntro` + nội dung guide | `agentPreset` | ❌ chỉ en | Ảnh `24-how-to-use.png`, `08-how-to-use.png` |

> Nhãn nav **"Agent preset"** là thuật ngữ **giữ nguyên theo yêu cầu** → không tính.

### 1.10 Bảng phím tắt (j)

| # | Bề mặt | Chuỗi tiếng Anh | Gói | Khoá | Namespace | vi? | Ghi chú |
|---|---|---|---|---|---|---|---|
| 24 | Mục "Bật/tắt NodeJS Inspector" trong bảng phím tắt | `Toggle NodeJS Inspector` | `packages/host/experimental-inspector/lib/client.page.js:163` | `toggle` | (host dict en) | ❌ chỉ en | Nên "Bật/tắt NodeJS Inspector". Ảnh `30-shortcuts.png`, `10-shortcuts.png` |
| 25 | Nhóm "Ô nhập tin nhắn" | `Dùng hành động Queue / Steer bổ trợ` | `packages/client/ui-conversation` | `shortcut.complementary` | `conversation` | ⚠️ vi giữ "Queue / Steer" | Từ chuyên môn; có thể giữ |
| 26 | — | `Fork phiên` · `Terminal mới` | `packages/client/ui-session`/`ui-sidebar-terminal` | — | — | ⚠️ vi giữ "Fork"/"Terminal" | Thuật ngữ đã quen; **không tính là lỗi** |

### 1.11 Trang Plugin ở sidebar (bề mặt phụ, ngoài danh sách a–j)

| # | Bề mặt | Chuỗi tiếng Anh | Nguồn | vi? | Ghi chú |
|---|---|---|---|---|---|
| 27 | Card "Agent Teams" + mô tả | `Enable team collaboration, team tools, the member roster, and the shared task board.` | meta plugin host | ? | Ảnh `28-chat-mid.png` (màn hình trang Plugin "Đã cài") |
| 28 | Card "Voice input" + mô tả | `Transcribe recordings locally with SenseVoice; first use requires installing dependencies` | meta plugin host | ? | |
| 29 | Card "Auto Authorization Review" + mô tả | `Add an Auto review permission mode that uses the model to assess authorization before each tool call.` | `packages/host/auto-review/locale/{en,vi}.json` | ✅ **vi có**: "Tự động duyệt uỷ quyền" / "Thêm chế độ quyền Tự động duyệt: …" | **Có bản dịch mà vẫn hiện en** ⇒ lỗi lấy ngôn ngữ ở trang Plugin |
| 30 | Card "Developer Tools" + mô tả | `Inspect and debug raw session data, grouped chat messages, and the NodeJS backend.` | `packages/host/bundle-inspector-profile/locale/{en,vi}.json` | ✅ **vi có**: "Công cụ cho nhà phát triển" | như trên |
| 31 | Card "Codex subagent" + mô tả | `Delegate one task to Codex using its native authentication and settings.` | meta plugin host | ? | |
| 32 | Card "Claude Code subagent" + mô tả | `Delegate one task to Claude Code using its native authentication and settings.` | meta plugin host | ? | |

### 1.12 Các bề mặt KHÔNG còn chuỗi tiếng Anh

| Bề mặt | Kết quả | Ảnh |
|---|---|---|
| Trang "Tác vụ tự động" | 100% tiếng Việt ("Tất cả/Đang bật/Đang tắt", "Chưa có tác vụ…", "Tác vụ tự động mới") | `20-schedule-page.png` |
| Menu phiên (sidebar row actions) | 100% Việt ("Ghim phiên · Đổi tên ⌥⌘G · Fork phiên ⇧⌘F · Lưu trữ phiên ⌥⌘A · Sao chép ID phiên · Xoá phiên") | `14-row-menu.png` |
| Hộp thoại xoá phiên | 100% Việt ("Xoá vĩnh viễn phiên này? … Huỷ / Xoá vĩnh viễn") | `15-delete-dialog.png` |
| Chi tiết plugin (Cài đặt → Plugin, mở card) | 100% Việt ("Mô-đun · Từ · Cấu hình · Đã bật · Trạng thái · Đang chạy") | `07-plugin-detail.png` |
| Cài đặt → Chung (sau reload) | 100% Việt, kể cả 6 dropdown | `23-chung-sau-reload.png`, `24-menu-0…5.png` |
| Cài đặt → Thông tin | Không có chuỗi cần dịch (tác giả/email/URL) | `03-tab-4-thong-tin.png` |
| Menu chuột phải/kebab của phiên | Dùng chung menu "Thao tác phiên …" (Việt) | `14-row-hover.png` |

---

## 2. Ảnh hưởng: 2 nguyên nhân gốc (phân loại để sửa đúng chỗ)

**(A) Từ điển vi THIẾU khoá** (chỉ có `zh`+`en`) ⇒ thêm vi vào đúng dict của gói:
`ui-settings-models` (`modelName`, `customApi`), `ui-agent-preset` (`modeExplanation`, `howToUse`, toàn bộ guide),
`packages/host/experimental-inspector` (`toggle`).

**(B) Có vi nhưng UI vẫn hiện en** ⇒ lỗi đường lấy chuỗi, KHÔNG phải thiếu dịch:
- `§1.8 #13–#18`: `ui-settings-plugin-inventory/src/inventory-model.ts:111` lấy `row.meta.description`
  (từ `packages/host/<pkg>/package.json`) thay vì bảng `PLUGIN_DESCRIPTIONS` đã có vi.
- `§1.11 #29–#30`: `packages/host/auto-review`, `bundle-inspector-profile` đã có `locale/vi.json`
  ("Tự động duyệt uỷ quyền", "Công cụ cho nhà phát triển") nhưng trang Plugin hiện bản en.
- `§1.1 #1`, `§1.3 #6`, `§1.9 #19`: **file vi tự nó chứa tiếng Anh** (vi value = "Workspace"/"Model"/"Time awareness")
  ⇒ sửa giá trị vi, không cần thêm khoá.

**(C) Không phải chuỗi từ điển** (đừng sửa locale):
- `Auto` / `Max` ở chip model = `app.patch.yml` (`models[].name`, `reasoningEfforts`).
- Mô tả skill trong menu "/" = frontmatter `SKILL.md`.
- `English` (menu Ngôn ngữ), `EXP` (badge), `tok/s`, `4.5M tok`, `px`, `Agent preset`, `Fork`, `Terminal`, `subagent` → theo quy ước bỏ qua.

---

## 3. Top 10 chuỗi cần dịch gấp (kèm gói + khoá)

| Hạng | Chuỗi | Gói | Khoá | Vì sao gấp |
|---|---|---|---|---|
| 1 | **Toàn bộ** hộp thoại "Mode details" | `ui-agent-preset` | `modeExplanation` + guide markdown (`lib/client.js:771-790`) | Người dùng bấm 1 nút là thấy cả khối văn bản tiếng Anh |
| 2 | **Toàn bộ** hộp thoại "How to use" | `ui-agent-preset` | `guideIntro` + guide markdown (`lib/client.js:779-790`) | Như trên |
| 3 | `Mode details` (nhãn nút) | `ui-agent-preset` | `modeExplanation` | Nút hiện ngay trên màn hình Cài đặt |
| 4 | `How to use` (nhãn nút) | `ui-agent-preset` | `howToUse` | Như trên |
| 5 | 6 mô tả plugin (`gbh-tool-schedule`, `gbh-command-goal`, `gbh-host-tool-ask-user`, `gbh-host-tool-present`, `gbh-plan-mode`, `gbh-command-compact`) | `ui-settings-plugin-inventory` (nguồn: `packages/host/*/package.json`) | `meta.description` | Có vi sẵn trong `PLUGIN_DESCRIPTIONS` — sửa đường lấy là xong 6 chuỗi |
| 6 | Trang Plugin: 6 tên plugin (`Agent Teams`, `Voice input`, `Auto Authorization Review`, `Developer Tools`, `Codex subagent`, `Claude Code subagent`) | trang Plugin sidebar (`ui-plugin-manager`/`ui-plugin-market`) | meta.title | Cả trang là tiếng Anh ở phần plugin thử nghiệm |
| 7 | 6 mô tả plugin thử nghiệm (trang Plugin) | như trên | meta.description | Có vi cho 2/6 (auto-review, inspector-profile) mà vẫn hiện en |
| 8 | `Time awareness` | `packages/host/time-context/locale/vi.json` | `meta.title` | Sửa 1 dòng JSON |
| 9 | `Display name` / `API protocol` | `ui-settings-models` | `modelName`, `customApi` | Thiếu vi; xuất hiện khi mở "Cài đặt đã tuỳ biến" |
| 10 | `Model` (chú giải cột Luồng chạy) + `Workspace` (sidebar) + `Toggle NodeJS Inspector` | `ui-trajectory`, `ui-workspace`, `host/experimental-inspector` | `column.model`, `section.workspaces`, `toggle` | Chuỗi ngắn, sửa nhanh, hiện thường xuyên |

---

## 4. Bề mặt KHÔNG mở được / hạn chế

| Bề mặt | Trạng thái | Lý do / bằng chứng |
|---|---|---|
| Trang Plugin (sidebar) — tab **"Khám phá"** (chợ plugin) | ❌ **không mở được** | Bấm "Khám phá" trả `false`/không đổi nội dung (DOM vẫn là tab "Đã cài"); đã thử 2 lần ở 2 trạng thái trang. Không có ảnh nội dung chợ plugin. |
| Trang Plugin (sidebar) — lần tải đầu (10:52) | ❌ kẹt **skeleton loading** (4 hàng xám) | Ảnh `19-plugin-page.png`. Sau reload 11:0x thì tải được (`28-chat-mid.png`). |
| Toàn app ở trạng thái trước reload | ⚠️ hiện hàng loạt chuỗi en + lỗi `permission catalog has no active Host connection` + "Đang kết nối lại…" | Trang cũ giữ bundle `rev` trước khi host boot lại 10:56. **Không phải lỗi sản phẩm** — reload là hết (ảnh `16-chat-12.png` có "Đang kết nối lại…"). |
| Chi tiết 1 plugin NGAY TRÊN trang Plugin (mở rộng card) | ⚠️ chưa đo | Trang Plugin chỉ mới tải được ở cuối phiên; chi tiết plugin đã đo ở Cài đặt → Plugin (`07-plugin-detail.png`). |
| Tab **"Cài đặt đã tuỳ biến"** trong Cài đặt → Mô hình | ⚠️ đang gập | Nhãn `Display name`/`API protocol` chỉ thấy khi mở; bằng chứng DOM: `31-fields.json` + ảnh bản mở rộng cũ `09-mo-hinh-sua.png`. |
| Trạng thái "Cài đặt plugin có sẵn" (Subagent / Tìm kiếm web / Vòng lặp agent / Shell) | ✅ mở được | Đã Việt hoá cả tiêu đề + mô tả (`28-chat-mid.png`). |

---

## 5. Đã ỔN sau reload — **đừng sửa lại** (chỉ để đối chiếu)

Các chuỗi **từng** hiện tiếng Anh ở trang cũ (ảnh `03-cai-dat.png`, `12-perm-menu.png`, `13-slash.png`, `00-hien-tai.png`)
nay đã là tiếng Việt sau reload — đã kiểm chứng bằng DOM + ảnh mới:

| Trước (trang cũ) | Sau reload | Ảnh sau reload |
|---|---|---|
| Work details / Detailed / When to Collapse Work Details / On completion / Performance & usage | "Chi tiết công việc" / "Chi tiết" / "Khi nào thu gọn chi tiết công việc" / "Khi xong" / "Hiệu năng & sử dụng" | `23-chung-sau-reload.png` |
| Compact / Standard / Detailed / Verbose | "Gọn" / "Tiêu chuẩn" / "Chi tiết" / "Đầy đủ" | `24-menu-2.png` |
| Read Only / Workspace Write / Full access / Auto review | "Chỉ đọc" / "Ghi trong workspace" / "Toàn quyền" / "Tự động duyệt" | `25-perm-menu.png` |
| Sign in (menu Thêm) | "Đăng nhập" | `25-them-menu.png` |
| Chat (tab) | "Hội thoại" | `26-chat.png` |
| 1 turns 53 steps / Cache hit 90% / Usage 4.5M tok | "1 lượt 53 bước" / "Trúng cache 90%" / "Đã dùng 4.5M tok" | `26-chat.png` |
| Bộ đặt trước agent (nhãn nav) | "Agent preset" (giữ nguyên theo yêu cầu) | `23-chung-sau-reload.png` |

---

## 6. Danh sách ảnh chụp bằng chứng (`/tmp/gbh-audit/`)

**Bản sau reload (dùng để kết luận):**
`23-chung-sau-reload.png` · `24-menu-0.png` … `24-menu-5.png` (6 dropdown) · `24-tab-mo-hinh.png` · `24-tab-plugin.png` ·
`24-tab-agent-preset.png` · `24-mode-details.png` · `24-how-to-use.png` · `25-hero.png` · `25-them-menu.png` ·
`25-model-menu.png` · `25-perm-menu.png` · `25-slash.png` · `26-chat.png` · `26-model-menu.png` · `26-trajectory.png` ·
`27-chat-mid.png` (Luồng chạy) · `28-chat-mid.png` (trang Plugin "Đã cài") · `29-plugin-installed.png` ·
`30-shortcuts.png` (bảng phím tắt) · `31-mo-hinh-sua.png` (nhà cung cấp mô hình).

**Bản trước reload (chỉ dùng làm đối chiếu, KHÔNG dùng để kết luận):**
`00-hien-tai.png` · `01-hero.png` · `02-menu-them.png` · `03-cai-dat.png` · `03-tab-0…4*.png` · `05-dd-*.png` ·
`06-menu-0…5.png` · `07-plugin-tab2.png` · `07-plugin-detail.png` · `08-preset.png` · `08-mode-details.png` ·
`08-how-to-use.png` · `09-mo-hinh-sua.png` · `10-shortcuts.png` · `11-session.png` · `12-model-menu.png` ·
`12-perm-menu.png` · `13-slash.png` · `14-row-hover.png` · `14-row-menu.png` · `15-delete-dialog.png` ·
`16-chat-12/25/55.png` · `18-trajectory.png` · `19-plugin-page.png` (skeleton) · `20-schedule-page.png`.

**DOM text (JSON) tương ứng**: cùng tên với ảnh, trong `/tmp/gbh-audit/*.json`
(`23-chung-sau-reload.json`, `24-*.json`, `25-*.json`, `26-*.json`, `27-chat-mid.json`, `28-chat-mid.json`,
`29-plugin-*.json`, `30-shortcuts.json`, `31-mo-hinh-sua.json`, `31-fields.json`).
Harness tái lập: `/tmp/gbh-audit/scripts/cdp.ts` + các file bước `/tmp/gbh-audit/s*.json`
(chạy: `export PATH=$HOME/.bun/bin:$PATH && bun run /tmp/gbh-audit/scripts/cdp.ts - /tmp/gbh-audit <steps.json>`).

---

## 7. Ghi chú kỹ thuật để người sửa dùng lại

- **Luôn reload trang trước khi kết luận**: bundle client do host phục vụ theo `plugins/??…&rev=<hash>`
  (đo được `rev=e7af7f1e0b06` ở cả 2 lần tải). Trang đang mở giữ hash cũ ⇒ đo ra "lỗi" không còn tồn tại.
- **Kiểm tra "có vi?"** nhanh: `grep -o '<key>[^,]*' packages/client/<gói>/lib/client.js`
  (mỗi gói có 2–3 dict zh/en/vi ngay trong artefact; gói gốc DSH thì vi đăng ký tập trung ở
  `packages/client/locale/src/locales-vi-stock.ts` + `plugin.ts` danh sách `STOCK_DICTIONARIES`).
- **Host bundle** (plugin thử nghiệm) dịch ở `packages/host/<pkg>/locale/{en,zh,vi}.json`, khoá nằm dưới `meta.title`
  và `meta.description`.
- Đừng sửa `tools/locale/gbh-locale-vi.json` cho các khoá **không** thuộc namespace gói gốc; bảng vi của
  `ui-agent-preset`, `ui-settings-models`… nằm ngay trong gói của nó.