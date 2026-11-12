<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 20/10/2026
 desc So sánh phiên bản DSH — đo trực tiếp từ npm registry + node_modules thật (20/10/2026)
-->

# So sánh phiên bản DSH (đo 20/10/2026)

## 1. Số đo trực tiếp

| nguồn | phiên bản DSH | cách đo |
|---|---|---|
| `blackhole-desktop-electron/host/cli/node_modules/@deepseek-ai/dsh` | **`0.2.0-rc.2`** | đọc `package.json` (278/289 gói cùng bản) |
| `blackhole-tauri/apps/host` (harness của ta) | **`0.2.1-alpha.4`** | đọc `package.json` (304 gói) |
| **npm `dist-tags.latest`** | **`0.2.1-rc.2`** | `curl registry.npmjs.org/@deepseek-ai%2Fdsh` |

```
dist-tags: { "latest": "0.2.1-rc.2", "alpha": "0.2.1-alpha.5", "next": "0.2.1-rc.2" }
```

## 2. Mốc phát hành (từ npm `time`)

| phiên bản | thời điểm |
|---|---|
| `0.2.0-rc.2` | (bản electron đang dùng) |
| `0.2.1-alpha.3` | 2026-10-14 12:35 |
| **`0.2.1-alpha.4`** | **2026-10-15 13:08** ← ta đang dùng |
| `0.2.1-alpha.5` | 2026-10-16 12:31 |
| `0.2.1-rc.1` | 2026-10-17 03:17 |
| **`0.2.1-rc.2`** | **2026-10-17 08:36** ← mới nhất |

## 3. Khác biệt danh sách gói

| so sánh | kết quả |
|---|---|
| `0.2.0-rc.2` → `0.2.1-rc.2` | **+10 gói mới · −6 gói bỏ** |
| `0.2.1-alpha.4` → `0.2.1-rc.2` | **+0 · −0** (cùng danh sách gói, chỉ khác nội dung) |

### 10 gói MỚI (có ở 0.2.1, không có ở 0.2.0)

| gói | ý nghĩa |
|---|---|
| `dsh-tool-schedule` | công cụ lịch (thay `experimental-schedule-bundle`) |
| `dsh-experimental-ralph-bundle` | (thay `dsh-tool-ralph`) |
| `dsh-experimental-session-search` | tìm kiếm phiên |
| `dsh-experimental-session-titles-bundle` | tiêu đề phiên tự sinh |
| `dsh-experimental-terminal-bundle` | terminal |
| `dsh-experimental-tool-worktree` | worktree |
| `dsh-experimental-inspector-profile` | inspector |
| `dsh-experimental-plugin-market-bundle` | chợ plugin |
| `dsh-experimental-cot-translation-bundle` | dịch chain-of-thought |
| `dsh-experimental-badge-skill-bundle` | badge skill |

### 6 gói BỎ

| gói | thay bằng |
|---|---|
| `dsh-experimental-schedule-bundle` | `dsh-tool-schedule` |
| `dsh-tool-ralph` | `dsh-experimental-ralph-bundle` |
| `dsh-hooks-claude-code` | (bỏ) |
| `dsh-hooks-codex` | (bỏ) |
| `dsh-webhook` | (bỏ) |
| `dsh-webhook-github` | (bỏ) |

## 4. Việc cần làm

### (a) Cho `blackhole-desktop-electron` — nâng `0.2.0-rc.2` → `0.2.1-rc.2`
- Cập nhật 289 gói `@deepseek-ai/*` trong `host/cli/node_modules` lên `0.2.1-rc.2`.
- **Thay đổi hành vi cần kiểm**: `dsh-webhook` + `dsh-webhook-github` **bị bỏ** ⇒ nếu electron dùng webhook thì phải viết lại.
- `dsh-hooks-claude-code` + `dsh-hooks-codex` **bị bỏ** ⇒ nếu có dùng thì mất.
- `dsh-experimental-schedule-bundle` → `dsh-tool-schedule` ⇒ đổi id trong patch/profile.

### (b) Cho `blackhole-tauri` — nâng `0.2.1-alpha.4` → `0.2.1-rc.2`
- **Không thêm/bớt gói nào** ⇒ chỉ cần `bun run host:install` với version mới.
- Rủi ro thấp, nhưng **phải chạy lại `check:app` + `gate`** để xác nhận.

## 5. Cách nâng harness của ta

```bash
cd galaxy-blackhole/blackhole-tauri
# sửa apps/host/package.json: mọi @deepseek-ai/* 0.2.1-alpha.4 -> 0.2.1-rc.2
bun run host:install
bun run gate            # 8 cổng, có test
bun run check:app       # (5)(8)(9)(10)(11)
```

