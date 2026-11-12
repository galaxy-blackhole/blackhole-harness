<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 25/10/2026
 desc ADR 0026 — bundle lõi KHÔNG còn chứa patch thử nghiệm: tắt một plugin là row của nó biến mất thật
-->
# ADR 0026 — Tắt plugin thử nghiệm phải tắt thật các thành phần

## Bối cảnh

Người dùng tắt "Worktree Git" nhưng trang chi tiết vẫn hiện **2 thành phần "Đang chạy"** (ảnh chụp 25/10/2026),
trong khi bản DSH hiện **Off**. Nguyên nhân: `packages/host/bundle/package.json` khai **17** patch, trong đó
11 patch thử nghiệm (agent-team, terminal, session-search, inspector, auto-review, tool-worktree, plugin-market,
cot-translation, ralph, session-titles, voice-input). Bundle lõi luôn bật ⇒ row của các tính năng đó **luôn được
cắm** bất kể công tắc riêng; công tắc chỉ là hình thức.

## Quyết định

1. `packages/host/bundle/package.json`: bỏ **toàn bộ** `./experimental/*.patch.yml` (17 → 6 patch lõi).
   Mỗi tính năng chỉ còn **một** nguồn cắm row: bundle của chính nó (`packages/host/bundle-*`).
2. `apps/cli/src/profile.ts`: thêm `DEFAULT_FEATURE_BUNDLES` (11 bundle tính năng, **không** có voice-input) và
   chỉ seed danh sách này cho hồ sơ **mới tạo**. Hồ sơ đã tồn tại không bị thêm lại ⇒ người dùng tắt là tắt luôn.
3. Hồ sơ đang dùng trên máy dev: thêm 5 bundle còn thiếu vào `dsh.profile.bundles` (plugin-market,
   tool-worktree, cot-translation, ralph, session-titles) để giữ nguyên trạng thái BẬT như trước.

## Bằng chứng (đo trên app đang chạy)

| Thao tác | Bundle | Row đang chạy |
|---|---|---|
| trước khi tắt Worktree Git | `tool-worktree-bundle=true` | `include:worktree`, `include:tool-worktree` |
| bấm TẮT | `false` | **không còn row nào** (`live: []`) |
| bấm BẬT lại | `true` | hai row trở lại |
| tắt "Nhóm agent" | `agent-team-profile=false` | chỉ còn row worktree; row `agent-team/tool-agent-team/ui-agent-team` biến mất |
| bật lại | `true` | cả ba row trở lại |

`check:app`: 76 entry (giảm 1 so với 77 do bỏ lớp patch trùng), (5) = 0 "(did not activate)", (8) ĐẠT, (9) 0/80.
