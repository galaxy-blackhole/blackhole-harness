<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port dsh-tool-present → @galaxy-blackhole/gbh-host-tool-present: row LỒNG entry `present` trong 3 preset (preset-minimal KHÔNG có), KHÔNG có row stock top-level trong dump-now2 ⇒ chỉ khai gbh.nested, CHƯA mount/flip; test A/B 27 ca/300 expect, tsc + lint scoped 0 lỗi.
-->

# @galaxy-blackhole/gbh-host-tool-present — row LỒNG trong preset (dsh-tool-present)

Port 1:1 `@deepseek-ai/dsh-tool-present` (`lib/index.js` **127 dòng**, 4 export `Config · apply · inject · name`;
tool `present`) thành `src/index.ts` **284 dòng**, build MỘT entry ra `lib/index.js` **4.415 B**. Giữ nguyên văn
`description`/`parameters`/`output` và đúng thứ tự kiểm của bản gốc; `locale/en.json` + `locale/zh.json`
byte-identical stock (48 B / 138 B).

## Vị trí trong dump — ĐO, không đoán
Nguồn: `/tmp/dump-now2.txt` (2.297 dòng, mtime 19/10/2026 12:55; **385 row top-level**, **511** dòng `- id:`
trong đó **126 entry lồng**). Script đo: cắt block theo thụt lề, dựng chuỗi cha từ các dòng `- id:` gần nhất.

| Vị trí | Dòng `- id:` | Dòng `name:` | Thụt lề | Depth | Cha | `disabled` | `config` | `inject` |
|---|---|---|---|---|---|---|---|---|
| TOP-LEVEL `tool-present` | không có | không có | — | 0 | — | — | — | — |
| TOP-LEVEL `present` | không có | không có | — | 0 | — | — | — | — |
| `preset-standard` | **991** | 992 | 6 | 1 | `config.plugins` | không khai | không khai | không khai |
| `preset-ptc` | **1161** | 1162 | 6 | 1 | `config.plugins` | không khai | không khai | không khai |
| `preset-cordis` | **1429** | 1430 | 6 | 1 | `config.plugins` | không khai | không khai | không khai |
| `preset-minimal` | không có | không có | — | — | — | — | — | — |

- **Không có row stock top-level**: 0 dòng `- id: present` / `- id: tool-present` ở thụt lề 0;
  0 dòng `name: '@deepseek-ai/dsh-tool-present'` ở thụt lề 0. Đây là nhánh **GBH-only nested** —
  không có row để park (`gbh.row_unmounted_ly_do`) và cũng không được bịa row.
- Cả 3 entry lồng chỉ có MỘT khoá `name` (2 dòng/entry); **không entry nào khai `disabled`/`config`/`inject`**
  ⇒ cả 3 preset giống nhau, **không có disabled khác nhau để mirror**; `preset-minimal` không có entry nào.
- id entry lồng trong dump là `present`; tên plugin là `tool-present`; tên package stock là
  `@deepseek-ai/dsh-tool-present`.

## Metadata — CHỈ `gbh.nested`, KHÔNG row
```json
{
  "gbh": {
    "nested": {
      "kind": "preset",
      "pluginId": "tool-present",
      "stockId": "@deepseek-ai/dsh-tool-present",
      "presets": ["preset-standard", "preset-ptc", "preset-cordis"]
    },
    "tests": ["tests/host/tool-present.test.ts"]
  }
}
```

- `pluginId` = tên thư mục package (`tool-present`) — đúng kỳ vọng của cổng parity mới
  `tests/host/row-config-parity.test.ts` (dòng 328).
- **Không** khai `gbh.row` và **không** khai `gbh.row_unmounted_ly_do`: dump-now2 không có row top-level
  nên khai row sẽ là bịa. Không flip, không mount.
- `presets` là **số đo mô tả** (3 preset có entry). Cơ chế redirect hiện thay tên theo `stockId` ở mọi preset
  (`rewriteNestedNames` bỏ qua `presetId` — `packages/host/agent-preset-registry/src/nested-mount.ts:137`);
  danh sách này không phải bộ lọc và không đổi hành vi.
- Cổng parity mới có fallback tìm entry lồng theo dòng `name:` khi dump không có `id: tool-present`
  (dòng 282–294 của test) — đo được `indented = true`, `name = '@deepseek-ai/dsh-tool-present'`, `config = {}`.

## Số đo (19/10/2026)
| Phép đo | Kết quả |
|---|---|
| build entry duy nhất `src/index.ts` → `lib/index.js` | **4.415 B** · sha256 `62ba99a74823c17e3748135d84de0d2e22d2e0eb16665b3779d13c4c9e44b81a` · 4 export |
| stock `lib/index.js` (đối chứng) | 4.239 B · sha256 `b4944a5a114ebf528542775f222125afa331c47e061b481adfcacd7e06bfb5ce` · 127 dòng |
| test A/B | **27 ca / 300 expect / 0 fail** (`bun test tests/host/tool-present.test.ts`) |
| cổng parity mới | **58 pass / 0 fail / 139 expect** (`tests/host/row-config-parity.test.ts`; 2 ca `tool-present`; đo 19/10/2026 15:02) |
| tsc scoped | `src/index.ts` + `build.ts` + `tests/host/tool-present.test.ts`: **0 lỗi** |
| lint scoped | header 0 · file-length 0 (test 959 dòng) · jsdoc 0 vi phạm · dep-guard 0 |
| locale | `en.json` 48 B · `zh.json` 138 B — byte-identical stock |

Cùng một fixture cho CẢ HAI bên: mỗi ca cài stock và bản ta lên cùng một giàn cấu trúc, so tập export,
`Config` (14 đầu vào hợp lệ + 10 đầu vào lỗi + `~standard.validate`), định nghĩa tool, `render`, mọi nhánh
`execute` thành công/lỗi/thiếu service/abort, và sự kiện `deliverables/presented`. Không mạng, không audio,
không shell thật.

## CHƯA mount / CHƯA flip (trong phạm vi task này)
- **Không** khai `gbh.row`; **không** khai `gbh.row_unmounted_ly_do` (không có row top-level để park).
- Task này **KHÔNG** chạy `--dump-config`/`lab:row`/`boot-smoke`, **KHÔNG** restart host 5439, **KHÔNG** sửa
  `app.patch.yml`.
- **Bằng chứng môi trường (đo được, KHÔNG do task này tạo):** profile đã có bản copy
  `~/.galaxy/blackhole/profiles/node_modules/@galaxy-blackhole/gbh-host-tool-present` (mtime **15:01**;
  `package.json` + `lib/index.js` **byte-identical** tệp này, sha256 `62ba99…`), và `~/.galaxy/blackhole/host-5439.log` (mtime
  **14:45**) đã ghi 3 dòng
  `agent-preset[standard|ptc|cordis] redirect row long: present @deepseek-ai/dsh-tool-present -> @galaxy-blackhole/gbh-host-tool-present`.
  ⇒ Cơ chế nested **đã redirect trong lượt probe** của phiên khác; đây **không phải** flip `gbh.row`.
  Lead cần xác nhận trước khi coi là mount chính thức.
- Dump-now2 (mtime **12:55**) có TRƯỚC bản copy profile (15:01) nên vẫn ghi tên stock — đúng thứ tự đo,
  không mâu thuẫn với log redirect.

## Đường lùi
1. Bỏ `gbh.nested` trong `package.json`.
2. `bun run apps/cli/src/main.ts host --dump-config` (BẮT BUỘC — patch regen).
3. `scripts/restart-host.sh`.

## Nợ kỹ thuật
- `lib/index.js` là artefact sinh tự động (`bun run build.ts`); không copy `lib/types/*`. Stock có subpath
  `./types` + `./src/*`; gói ta mirror `.`, `./locale/*.json`, `./package.json` như khuôn batch nested —
  root import là đường duy nhất đang dùng.
- `peerDependencies` giữ khuôn batch task-127 (6 mục, trong đó `dsh-credentials`/`dsh-launch-environment`/
  `dsh-timeout` không dùng trong mã); không sửa trong task metadata này để diff tối thiểu — Lead quyết khi mount.
- Chưa có boot-smoke riêng cho row lồng; bằng chứng mount phải là log `redirect row long` của phiên thật (Lead).
