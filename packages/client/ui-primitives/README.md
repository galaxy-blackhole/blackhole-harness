<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README goi ui-primitives: bo icon GBH qua GbhIcon, asset thuong hieu, trang thai mount va rang buoc
-->

# `@galaxy-blackhole/gbh-client-ui-primitives`

Bộ **icon GBH** dùng qua primitive **`GbhIcon`** (C7 §1.5) + **asset thương hiệu Galaxy Blackhole**.
Đây là bản thay cho module `@galaxy-blackhole/gbh-client-ui-primitives` (module do **vỏ web** cấp, không phải gói npm).

## 1. Nội dung

| phần | xuất khẩu | ghi chú |
|---|---|---|
| bộ icon | `GBH_ICONS` (189 icon + 12 entry họ tổ hợp), `DSH_TO_GBH_ICON`, `SHIELD_OUTLINE_PATH` | hình giữ **1:1** nguồn DSH (C7 §1.4) |
| primitive | `createGbhIcon(jsxRuntime)`, `renderGbhIcon`, `renderGbhArtwork`, `findGbhIconSpec` | nhận jsx runtime qua **tham số** — không import React (bundle client tự require) |
| artwork | `GBH_ARTWORKS` (103 entry), `resolveGbhArtwork` | 100 artwork tĩnh + 3 động + 2 alias |
| thương hiệu | `createGbhLogo`, `createGbhWordmark`, `GBH_LOGO_ARTWORK`, `GBH_FAVICON_ARTWORK`, `GBH_WORDMARK_*` | thay fish/wordmark DSH |
| nguồn gốc | `GBH_LOGO_SOURCE_*`, `DSH_ARTWORK_SOURCE` | G4: truy ngược được |

## 2. Trạng thái mount — QUAN TRỌNG

- Gói **KHÔNG khai `gbh.row`** và **KHÔNG có `dsh.client`** ⇒ **không mount**, **không có entry trong `--dump-config`**,
  không đổi UI đang chạy.
- Muốn **thay nguồn** 89 icon mà 53 bundle đang `require("@galaxy-blackhole/gbh-client-ui-primitives")` thì phải cấp module này
  ở **bảng `staticModules` của vỏ/modules** (xem `docs/reports/asset-plan.md` §5, pha 4). **Không** đổi require trong bundle trước.

## 3. Dùng trong bundle client khác

```ts
// build-time: ui-brand-official import nguồn của gói này (Bun inline vào bundle của nó, không phát sinh require mới)
import { createGbhLogo, createGbhWordmark, GBH_ICONS } from "../../ui-primitives/src/index.ts";

const runtime = requireFn("react/jsx-runtime") as GbhJsxRuntime;
const GbhLogo = createGbhLogo(runtime);
```

## 4. Kiểm

```bash
bun test tests/client/ui-primitives.test.ts
bun run build.ts            # lib/index.js (ESM)
```
