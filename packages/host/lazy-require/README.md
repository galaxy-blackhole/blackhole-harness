<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Bản sao 1:1 @deepseek-ai/dsh-lazy-require (25 dòng) — createLazyRequire
-->

# @galaxy-blackhole/gbh-lazy-require

Bản gốc: `@deepseek-ai/dsh-lazy-require` @0.2.1-alpha.4 · `lib/index.js` **25 dòng** · export **`createLazyRequire`**.

Hành vi 1:1: loader KHÔNG tham số; lần gọi đầu `require(specifier)` rồi **cache THÀNH CÔNG**; nếu ném thì **KHÔNG cache** (lần sau thử lại) — đây là hành vi dễ lệch nhất và có test A/B riêng.

Test: `tests/host/bundle-extra-packages.test.ts` (A/B với module gốc: tập export · cache thành công gọi require 1 lần · lỗi KHÔNG cache gọi require 2 lần).
