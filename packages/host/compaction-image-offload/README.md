<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 21/10/2026
 desc Báo cáo port @deepseek-ai/dsh-compaction-image-offload → gbh-compaction-image-offload: de-bundle 1:1, row image-offload.
-->

# @galaxy-blackhole/gbh-compaction-image-offload — de-bundle 1:1 (task-207)

Port 1:1 `@deepseek-ai/dsh-compaction-image-offload` 0.2.1-alpha.4: chép NGUYÊN VĂN **9 tệp `lib/`** (index + types) +
**locale en/zh**, cổng byte hai chiều ĐẠT, có `.debundled`.

Row `image-offload` (dump `ours.yml` dòng 414) khai `gbh.row {id, stockId, moduleIds, aliases, tests}`;
`build.ts` dùng `copyIfDebundled`.

| Phép đo | KẾT QUẢ |
|---|---|
| artifact | **byte-identical** 9 tệp lib + 2 tệp locale |
| export | khớp stock; exports mirror stock (`.`, `./projection`, `./locale/*.json`) |
| test | **6 ca / 0 fail** |
