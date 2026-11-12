<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 25/10/2026
 desc Bundle patch cho "Worktree Git" — chỉ cordis.patch.yml + package.json, không có mã chạy
-->
# @galaxy-blackhole/gbh-tool-worktree-bundle — bundle patch (KHÔNG mã chạy)

Bản gốc: `@deepseek-ai/dsh-experimental-tool-worktree` @0.2.1-alpha.4 · hai row: `worktree`, `tool-worktree`.

## Vì sao cần gói này

Giống `gbh-auto-review-bundle`: `DOI_TEN` trước đây trỏ tên bundle stock sang row package nên bật công tắc
trong *Plugin thử nghiệm* báo "Bật thất bại" (`not-bundle`). Gói bundle mỏng này cắm hai row của ta:
`@galaxy-blackhole/gbh-worktree` và `@galaxy-blackhole/gbh-tool-worktree`.
