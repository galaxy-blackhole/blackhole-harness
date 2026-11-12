<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 21/10/2026
 desc Báo cáo port @deepseek-ai/dsh-session-title-all-prompts-llm → gbh-session-title-all-prompts-llm: de-bundle 1:1, row long optional-session-title-all-prompts.
-->

# @galaxy-blackhole/gbh-session-title-all-prompts-llm — de-bundle 1:1 (task-202)

Port 1:1 `@deepseek-ai/dsh-session-title-all-prompts-llm` 0.2.1-alpha.4 (`lib/index.js` 127 dòng + `lib/types/index.d.ts`):
chép NGUYÊN VĂN cây `lib/` (cổng byte hai chiều của `tools/debundle-host.ts` ĐẠT), có dấu `.debundled`.

Row của gói là **row LONG**: `optional-session-title-all-prompts` nằm trong preset (dump `ours.yml` dòng 1507) ⇒
manifest khai **cả** `gbh.row.id` (theo yêu cầu task) **và** `gbh.nested {stockId, presets}` để registry redirect
tên lúc mount preset (cơ chế task-169).

| Phép đo | KẾT QUẢ |
|---|---|
| artifact | **byte-identical** stock (`cmp` + sha) |
| export surface | `Config` · `apply` · `name` · `inject` khớp |
| test A/B | **7 ca / 0 fail** |
| provenance | `{stock, version, sha}` |
