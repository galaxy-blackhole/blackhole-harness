<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho row ui-plugin-market của DSH (tab Discover của trang Plugins)
-->

# @galaxy-blackhole/gbh-client-ui-plugin-market

Tab **Discover** của trang Plugins: duyệt các chỉ mục (index) plugin market mà người dùng cấu hình và cài
một phiên bản qua hộp thoại cài của chính trang đó.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-plugin-market` (tier T3) | `client/ui-plugin-market` |
| Package | `@deepseek-ai/dsh-client-ui-plugin-market` (0.2.1-alpha.4) | `@galaxy-blackhole/gbh-client-ui-plugin-market` |
| Kích thước bản build | **1.636 dòng JS** (`lib/client.js`) + 5 dòng `lib/index.js` | 1.537 dòng `lib/client.js` |
| Nửa host | `lib/index.js` chỉ có `apply()` rỗng | `src/index.ts` — `apply()` rỗng y hệt |
| Hai mặt? | **CÓ** (`dsh.client`, `platform: web`) | có: `src/client.ts` + `exports["./client"]` |
| `dsh.client.inject` | `@deepseek-ai/dsh-api-remotes` · `@deepseek-ai/dsh-client-locale` · `@deepseek-ai/dsh-client-ui-plugin-manager` | **giữ nguyên ba id** |
| Slot chiếm | `plugins.tab` — **slot LIST**, occupant `id: "discover"` | nguyên văn `name` + `id` |
| Namespace từ điển | `pluginMarket` (78 khoá, zh là nguồn sự thật về khoá) | `src/locales.ts` — **nguyên văn 78 khoá** |
| Locale tệp rời | **không có** `locale/*.json` (từ điển nằm trong bundle) | không ship `locale/` — đúng như gốc |
| Id module bundle tự khai | `@deepseek-ai/dsh-client-ui-plugin-market` | `@galaxy-blackhole/gbh-client-ui-plugin-market` (**một id**; id gốc ở `gbh.row.aliases`) |

Đối chiếu hành vi đọc từ `lib/types/client/*.d.ts` của gói gốc (`market-store.d.ts` · `presentation.d.ts` ·
`DiscoverSection.d.ts` · `locales.d.ts`) và từ chính bundle `lib/client.js` (CHỈ ĐỌC).

## 2. Vì sao cần

Trang Plugins có tab **Installed** do `ui-plugin-manager` dựng; plugin market (dịch vụ `pluginMarket` phía Host)
chỉ có thể duyệt được nếu có một tab thứ hai đăng ký vào slot `plugins.tab`. Row này chính là tab đó:
nó đọc danh sách nguồn chỉ mục qua `remote.pluginMarket`, phân trang kết quả, mở trang chi tiết một plugin
(nguồn cài, dữ kiện, danh sách phiên bản) và xin trang cài đúng một phiên bản qua `install` của owner.

## 3. Peer / seam

Không thêm peer mới. Row chỉ dùng những gì bảng module đã cấp (đúng như bản gốc):

| Module require | Vì sao |
|---|---|
| `react` · `react/jsx-runtime` | hook (useState/useEffect/useMemo) + hàm dựng element; **jsx/jsxs chỉ có ở `react/jsx-runtime`** |
| `@galaxy-blackhole/gbh-client-ui-primitives` | Button · Tag · Menu · Input · Modal · Pill · Tooltip · StateDot · PluginArtworkDefault + 6 icon |
| `@galaxy-blackhole/gbh-client-store` | `createSnapshotStore` cho trạng thái Discover |
| `slots` · `locale` · `remote` · `remote.pluginMarket` | seam của kernel (khai ở `inject` của plugin) |

## 4. Bảng TRƯỚC / SAU

| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| id module trong artifact | `@deepseek-ai/…plugin-market` (1 id) | `@galaxy-blackhole/gbh-client-ui-plugin-market` (1 id) · **id gốc = 0** |
| Slot `plugins.tab` | occupant `id: "discover"` + từ điển `pluginMarket` | **y nguyên** (`name`/`id`/`locale`/`label`/`inject`) |
| Từ điển | 78 khoá (zh · en) trong bundle | **78 khoá nguyên văn** trong `src/locales.ts` |
| Bundle client | 1.636 dòng | 1.537 dòng, MỘT lời gọi `load()` |
| `check:rows` | — | 0 chặn, 0 cảnh báo (sau khi mount) |
| `gate --no-tests` | — | 7/7 xanh |
| Test của gói | — | 17 ca (`bun test tests/client/ui-plugin-market.test.ts`) |

Lệnh tái lập:

```bash
cd galaxy-blackhole/blackhole-tauri
bun run packages/client/ui-plugin-market/build.ts
grep -c 'id: "@deepseek-ai' packages/client/ui-plugin-market/lib/client.js   # phải = 0
grep -c 'id: "@galaxy-blackhole' packages/client/ui-plugin-market/lib/client.js  # phải = 1
bun test tests/client/ui-plugin-market.test.ts
bun run check:rows | grep ui-plugin-market
bun run lab:row ui-plugin-market
```

## 5. Chưa làm (nói thẳng)

- **Chưa đo A/B pixel và phần tử lạ** với oracle cho màn `plugins-discover`: cần một chỉ mục thật
  (`https://…/index.json`) trong hồ sơ lab, mà lab hiện chưa seed chỉ mục nào ⇒ tab render nhánh
  "chưa có plugin market". Phép đo parity đầy đủ phải chạy sau khi Lead mount và có chỉ mục.
- **Chưa có test render bằng React thật**: ca render trong bộ test dùng runtime jsx giả (ghi lại cây),
  nên nó bắt được "cây có đúng gốc `data-plugin-tab`" chứ không bắt được lỗi hook/commit của React.
  Đây là lý do vẫn phải có phép đo phía trang ở `lab:row`.
- Chưa kiểm chứng hành vi `install` thật (mở hộp thoại cài của trang) — cần một chỉ mục có plugin cài được.
