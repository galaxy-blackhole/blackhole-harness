<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 02/11/2026
 desc Kiểm kê tên gói DSH còn được tham chiếu và lộ trình đổi hết sang @galaxy-blackhole/gbh-* (P1)
-->

# Kiểm kê đổi tên DSH sang GBH (P1)

Số đo 02/11/2026, sinh bằng cách quét `packages/*/*/package.json`.

- Tên gói stock còn được tham chiếu: **229**
- Đã có gói GBH tương ứng: **228**
- **Chưa có gói GBH**: **1**

## 1. Chưa có gói GBH

| Tên stock | Số tham chiếu | Có trong kernel? |
|---|---:|---|
| `@deepseek-ai/dsh-host-product-telemetry-otel` | 1 | có |

## 2. Đã port trong các chặng vừa qua

| Tên stock | Gói GBH |
|---|---|
| `@deepseek-ai/cordis` | `@galaxy-blackhole/gbh-cordis` |
| `@deepseek-ai/schemastery` | `@galaxy-blackhole/gbh-schemastery` |
| `@deepseek-ai/cordis-plugin-loader` | `@galaxy-blackhole/gbh-cordis-plugin-loader` |
| `@deepseek-ai/cordis-plugin-include` | `@galaxy-blackhole/gbh-cordis-plugin-include` |
| `@deepseek-ai/cordis-plugin-timer` | `@galaxy-blackhole/gbh-cordis-plugin-timer` |
| `@deepseek-ai/cosmokit` | `@galaxy-blackhole/gbh-cosmokit` |
| `@deepseek-ai/node-addon-system` | `@galaxy-blackhole/gbh-node-addon-system` |
| `@deepseek-ai/libreoffice-kit` | `@galaxy-blackhole/gbh-libreoffice-kit` |
| `@deepseek-ai/dsh-user-approval` | `@galaxy-blackhole/gbh-user-approval` |
| `@deepseek-ai/dsh-experimental-worktree` | `@galaxy-blackhole/gbh-experimental-worktree` |
| `@deepseek-ai/dsh-permission-presets` | `@galaxy-blackhole/gbh-permission-presets` |
| `@deepseek-ai/dsh-web-app` | `@galaxy-blackhole/gbh-web-app` |

## 3. Chặng tiếp theo (P1b): ĐỔI TÊN, không chỉ tạo gói

### 3.1 Phát hiện 02/11/2026 — đổi tên KHÔNG THỂ làm lẻ

Đã thử đổi tên cho một nhóm 8 gói nhỏ (`goal`, `timer`, `timeout-policy`, `atomic-write`, `chunked-list`,
`deque`, `util-values`, `session-format`) bằng công cụ `tools/rename-specifiers.ts`:

| Bước | Kết quả |
|---|---|
| Đổi specifier trong `src/**` + `package.json` (deps/peers/devDeps) + `gbh.peers` | 62 lần thay, build lại 8 gói OK |
| Test riêng của 8 gói | xanh sau khi cập nhật kỳ vọng |
| **`gate typecheck`** | **ĐỎ: 9 vi phạm** |

Nguyên nhân: `gbh-cordis` là **bản sao vật lý** của `@deepseek-ai/cordis`, nên `Service`/`Context` của nó là
**lớp TypeScript KHÁC** với bản kernel. Gói vừa đổi tên (dùng type của `gbh-cordis`) nhận `ctx` kiểu kernel
⇒ `TS2345` / `TS7016` ở `packages/host/goal/src/*.ts`.

⇒ **Đổi tên phải NGUYÊN TỬ trên toàn repo** (cả 2.430 chỗ trong 799 tệp cùng lúc), hoặc phải port kernel
trước để chỉ còn MỘT thể hiện. Đã revert thí điểm, cây trở lại 8/8 cổng XANH.

### 3.2 Công cụ đã sẵn sàng cho lần đổi nguyên tử

| Tệp | Việc |
|---|---|
| `tools/rename-specifiers.ts` | Đổi specifier cho một gói: `src/**` + `package.json` (deps/peers/devDeps + `gbh.peers`), GIỮ `gbh.provenance.stock` và `gbh.row.aliases`; cập nhật kỳ vọng trong test của chính gói (bỏ qua dòng trỏ `apps/host/node_modules`). |
| `tests/lib/peer-kernel.ts` | `stockNameOf(peer)` — quy tên peer GBH về tên gốc để tra kernel trong các cổng quy ước peer. |
| điều kiện `types` trong `exports` | đã thêm cho 14 gói có `lib/types/index.d.ts` (trước đó thiếu ⇒ TS7016 khi đổi tên). |



Đã thử đổi toàn bộ 1.243 chỗ import `@deepseek-ai/cordis` sang `gbh-cordis` thì **232 test đỏ**, vì kernel (`apps/host`) vẫn dùng bản stock nên có hai thể hiện lớp/Symbol. Vì vậy bước đổi tên phải làm **cùng lúc** với kernel.

## 4. Việc còn lại (P2 - P4)

- P2: profile chỉ mount GBH, bỏ bảng alias `@deepseek-ai` sang `gbh`.
- P3: đổi id CSS-module (87 gói) + `GUIDE_ID` (3 chỗ) + specifier còn trong `lib/`, sinh lại hash CSS và re-baseline parity byte.
- P4: quyết định giữ hay xoá `apps/host/node_modules` (oracle stock).
