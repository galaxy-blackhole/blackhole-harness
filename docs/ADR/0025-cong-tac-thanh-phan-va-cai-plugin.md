<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 25/10/2026
 desc ADR 0025 — công tắc THÀNH PHẦN addressable + cài plugin stock bằng pnpm (-w) + giữ bundle stock trong profile
-->
# ADR 0025 — Bật/tắt từng thành phần plugin, và cài plugin từ registry

## Bối cảnh

1. Trang chi tiết bundle hiện công tắc từng thành phần nhưng **luôn TẮT và bị khoá** dù row đang chạy
   (`readOnlyReason: "unaddressable"`, `patchId: undefined`).
2. Bấm "Claude Code (agent con)" / "Codex (agent con)" hiện **"Cài plugin thất bại"**.
3. Cài xong (nếu được) thì **boot sau hai bundle biến mất** khỏi danh sách.

## Nguyên nhân (đo thật 25/10/2026)

| # | Nguyên nhân |
|---|---|
| 1 | `listPlugins` so `candidates.length > 1` với danh sách row bị TRÙNG 2–4 lần (patch hồ sơ + patch bundle + danh sách bundle gộp thêm) ⇒ mọi row thành "unaddressable". Ngoài ra tên patch và tên module lệch nhau khi gói bị quy tên (`dsh-tool-subagent` → `gbh-host-tool-subagent`) |
| 2 | Máy chưa có `pnpm` (ENOENT); sau khi cài pnpm thì pnpm từ chối `pnpm add` vì hồ sơ có `pnpm-workspace.yaml` (**ERR_PNPM_ADDING_TO_ROOT**) |
| 3 | `ensureProfile` lọc BỎ mọi bundle `@deepseek-ai/dsh-*` (vì ta thay bằng bundle của mình) ⇒ bundle stock người dùng cài thật bị xoá mỗi lần boot |

## Quyết định

1. `listPlugins`: gộp trùng theo id (lớp sau thắng), bỏ điều kiện `parent === "include"`, và so tên qua
   `quyTen` ở cả hai phía. Gộp thêm row của mọi bundle đang chọn (đọc thẳng `<profile>/node_modules/<bundle>`).
2. `installBundle`: thêm cờ `-w` cho `pnpm add` (hồ sơ là workspace root).
3. `ensureProfile`: giữ lại `@deepseek-ai/dsh-subagent-claude-code` và `...-codex` (bundle stock **chưa port**, người
   dùng cài từ registry), chỉ lọc các bundle stock mà ta đã thay thế.
4. Cài `pnpm@9` vào máy dev và khởi động host với PATH có `pnpm` (điều kiện cần để "Cài plugin" hoạt động).

## Bằng chứng

- Cả 4 row của hai bundle stock: `live: true`, `readOnlyReason: undefined`.
- `pnpm add @deepseek-ai/dsh-subagent-claude-code@0.2.1-alpha.4 -w` → thêm dependency + bundle; boot lại vẫn còn.
- Công tắc thành phần của bundle ta (`agent-team`, `auto-review`, `worktree`) đều `aria-checked="true"`, bấm được.
