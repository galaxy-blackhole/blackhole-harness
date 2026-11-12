<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README cua @galaxy-blackhole/gbh-client-modules — ban viet lai cua dsh-client-modules (M5, task-14)
-->

# @galaxy-blackhole/gbh-client-modules

Bản viết lại của Galaxy Blackhole cho row `modules` — **bộ nạp module phía browser**, mảnh rủi ro nhất của
M5 theo [ADR 0006 `4](../../../docs/ADR/0006-ke-hoach-M5.md) (R1). Package HAI MẶT, đúng như bản gốc:

| Nửa | Chạy ở đâu | Việc nó làm |
|---|---|---|
| Node (`lib/index.js`) | tiến trình host | quét cây plugin tìm package khai `dsh.client`, dựng đồ thị `__DSH_BOOT__`, phục vụ bundle ở route `/plugins`, giữ seam `ctx.clientModules` cho nửa HMR |
| Browser (`lib/client.js`) | trang web | bảng lazy-CJS: bundle plugin chỉ ĐĂNG KÝ factory (script classic gọi `window.__ModuleLoader__.load({id, factory})`), thân module chạy ở lần vạt chất hoá đầu tiên |

## Nguồn đối chiếu (G4)

| Hạng mục | Nguồn |
|---|---|
| Hợp đồng hành vi (nửa browser, facade, thông điệp lỗi) | [C2 — Module loader](../../../docs/contracts/C2-module-loader.md) `1–`4 (đã đóng băng) |
| Hợp đồng wire `__DSH_BOOT__` | [C1 — Boot injection](../../../docs/contracts/C1-boot-injection.md) |
| Bản gốc (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-client-modules@0.2.1-alpha.4` — `lib/index.js` (nửa node, 1.000 dòng), `lib/client.js` (nửa browser, 1.018 dòng), `lib/types/**/*.d.ts` |
| Dữ liệu thật để nghiệm thu | `tests/contract/fixtures/c1-boot-graph.json` (72 entry · 3 batch · 1 id mồ côi · 2 chu trình) + `c2-module-loader.json` (SHA-256 + 4 thông điệp lỗi của facade) |
| Row gốc trong cây | `id: modules` — `docs/PARITY-MATRIX.md` dòng 126 |
| Cơ chế mount | [ADR 0004](../../../docs/ADR/0004-mount-package-cua-ta-vao-profile.md) · công thức [HOST-ROW-REWRITE.md](../../../docs/recipes/HOST-ROW-REWRITE.md) |
| Test hành vi | `tests/client/client-modules.test.ts` (12 ca, chạy trên CHÍNH fixture C1) · `tests/client/client-modules-wire.test.ts` (13 ca, tầng wire + bản build thật) |

**Không chép code**: mã nguồn viết lại theo hợp đồng đã đọc từ bản gốc; chỉ dùng `node:` builtins và peer
`@deepseek-ai/cordis`. Khác biệt có chủ đích về kỹ thuật (hành vi giữ nguyên):

- Nửa node tách thành ba file đọc được (`combos.ts` · `sourcemap.ts` · `index.ts`) thay vì một file bundle
  1.000 dòng; hằng số, thứ tự và hình dạng wire giữ NGUYÊN để đồ thị so được với fixture.
- Source map dựng bằng cùng thuật toán Indexed v3 (section danh tính khi thiếu/hỏng map gốc), nhưng thân
  map chỉ được đọc khi endpoint map thực sự được gọi — đúng như bản gốc.
- Nửa browser: mọi bảng trạng thái và bộ máy vạt chất hoá giữ nguyên ngữ nghĩa (memoize theo id, chặn
  vòng require, chunk cục bộ qua `require.async`, tái nạp theo thế hệ, dọn style theo `data-plugin`),
  nhưng khai báo kiểu tường minh và bỏ mọi import cordis (nửa browser phải sạch node).
- Thông điệp lỗi của **facade** giữ NGUYÊN VĂN (là một phần hợp đồng C2); thông điệp của hệ module đổi
  câu chữ nhưng giữ nguyên ngữ nghĩa chẩn đoán.

## Peer: vì sao chỉ có cordis

`@deepseek-ai/cordis` là **peer** (luật `3b của [packages/README.md](../../README.md)): nửa node phải nói
chuyện với kernel qua seam `Context/Service` (`ClientModuleRegistry extends Service`, name
`clientModules`) và `ctx.inject`/`ctx.on`. Không có peer thứ hai: nửa browser cố ý không import cordis
(bundle phải tự chứa, và tầng kernel phía browser là của vỏ DSH đang chạy). Khi M3 kernel của ta phơi cùng
tên, dòng này không phải đổi.

## Mount: không sửa file dùng chung nào

Phần thay row là **dữ liệu của chính package** (trường `gbh.row`, task-13 — [ADR 0004 `11](../../../docs/ADR/0004-mount-package-cua-ta-vao-profile.md)):

    "gbh": { "row": { "id": "modules", "tests": ["tests/client/client-modules.test.ts"] } }

`bh host` quét `packages/**` rồi tự sinh khối `disable + insert`:

    - id: modules
      disabled: true
    - insert:
        - id: modules-ours
          name: '@galaxy-blackhole/gbh-client-modules'

Row của ta KHÔNG khai `inject`/`config` để thân row giống hệt row stock (điều kiện để giàn parity coi đây
là MỘT row đã thay chứ không phải lệch hành vi — `sameRowBody` trong `tools/parity/lib/dump-core.ts`).
`dsh.client` của package giữ đúng khuôn DSH: `platform: "web"`, `inject: []`, `immediately: true`.

## Bài học bắt buộc cho mọi row HAI MẶT (đã trả giá ngày 17/10/2026)

Id của row trong `__DSH_BOOT__` là **TÊN PACKAGE** mà row trỏ tới, KHÔNG phải id row. Nên khi thay một row
mà package gốc có khai `dsh.client` (`@deepseek-ai/dsh-api-gateway` là ví dụ), việc tắt row stock sẽ xoá
luôn **nửa CLIENT** khỏi đồ thị: mọi bundle `require("<pkg>/client")` trượt bảng module và cả cây client
chết theo dây chuyền (đo được: 63/72 entry không activate). Row hai mặt phải **phục vụ cả hai nửa**: hoặc
giữ row stock cho nửa client, hoặc package mới cũng khai `dsh.client` + export `./client` đăng ký đúng id
package của mình.

## Bằng chứng đã đo

| Việc | Số liệu |
|---|---|
| Test hành vi trên fixture thật | **25 test xanh** (12 ca hành vi + 13 ca wire/build) |
| Nạp đủ entry | 72/72 dòng vạt chất hoá đúng một lần; batch không bao giờ chạy hai lần |
| Chu trình | 2 chu trình qua `inject` (conversation↔workspace, workspace↔sidebar) đi qua không lỗi — Loader chờ service nên chu trình `inject` là hợp lệ |
| Id mồ côi | `@galaxy-blackhole/gbh-client-ui-primitives` (4 dòng inject nó, nó KHÔNG phải row): đi qua không lỗi; gọi nó như một dòng thì báo lỗi rõ ràng, không treo |
| Chia combo | 57 entry của pha application bị chia dưới ngưỡng 3 KiB; thứ tự và thành viên giữ nguyên |
| Byte thân phản hồi | thân combo so **byte-for-byte** với kỳ vọng (ghép đúng thứ tự, bỏ vết `sourceURL`/`sourceMappingURL`) — ca theo ADR 0004 `8 |
| Facade C2 | chạy thật trong `window` giả, ném ĐÚNG 4 thông điệp của hợp đồng (đã đối chiếu `c2-module-loader.json`) |
| **Chạy thật trên cây app** (home cách ly `/tmp/gbh-m5b` + cổng 5452, cùng cây package) | `__DSH_BOOT__` **72 entry · 3 batch** · `__ModuleLoader__.mode = "live"` · **0 lỗi console** (không có `did not activate`) · `#root` render đủ **89.015 ký tự** |

Cách chạy lại bài đo cuối:

    # home cách ly, không đụng app 5439
    GBH_HOME=/tmp/gbh-check bun run apps/cli/src/main.ts host --port 5452
    curl -sL "$(cat /tmp/gbh-check/ready-url.txt)"   # 200

## Test

    bun test tests/client/            # 25 ca, không cần server

## Tình trạng

- M5 đợt 1 (17/10/2026): thay row `modules` theo cặp disable + insert; nửa node + nửa browser chạy thật.
- License: MIT (theo repo).

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-modules` (shasum `en a975cfde9abe...` · `zh 19e5f7ee70a3...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
