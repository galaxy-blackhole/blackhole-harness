/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/11/2026
 * desc Huong dan dung cac cong lint: chay gi, mien tru the nao, them luat moi ra sao
 */

# tools/lint — cổng kiểm tra của repo

Chạy tất cả:

    bun run gate                  # header + độ dài + JSDoc + exports-targets + dep-guard + parity-matrix + deviation + typecheck + hygiene
    bun run gate --json           # kèm JSON để máy đọc (CI)
    bun run gate --only header,jsdoc
    bun run gate --strict         # cảnh báo cũng tính là vi phạm
    bun run gate --no-tests       # bỏ bun test (mặc định CÓ chạy test: "gate XANH" phải có nghĩa là test xanh)

Chạy lẻ từng cổng (mỗi cổng trả exit code != 0 khi đỏ và in `FAIL <file>:<dòng>  <lý do>`):

    bun run tools/lint/header.ts
    bun run tools/lint/file-length.ts
    bun run tools/lint/jsdoc.ts
    bun run tools/lint/dep-guard.ts
    bun run tools/lint/parity-matrix.ts          # sinh lại docs/PARITY-MATRIX.md
    bun run tools/lint/parity-matrix.ts --check  # chỉ kiểm tài liệu có lệch dữ liệu không
    bun run tools/lint/deviation-registry.ts --ratchet   # cổng sai khác cố ý (ratchet, xem §1b)

Máy dev không có `bun` trong PATH thì chạy `export PATH="$HOME/.bun/bin:$PATH"` trước (script `gate` gọi `bun` từ PATH).

## 1. Các cổng làm gì

| Cổng | Luật | Ghi chú |
|---|---|---|
| `header` | Mọi file nguồn có khối 5 dòng: author / email / create date 15/10/2026 / modify date / desc | Biến thể khối gạch chéo-sao (TS, Rust, CSS), `<!-- -->` (HTML, và .md nhận cả khối gạch chéo-sao), `#` (.yml/.toml/.sh/.py). Khối phải bắt đầu trong **10 dòng đầu** (vì `main.rs` có thuộc tính crate ở dòng 1) và phải chứa ít nhất một trường header — nhờ vậy JSDoc của hàm đầu file không bị nhầm là header |
| `file-length` | ≤ 1000 dòng/file | Vượt là phải tách module, không nới ngưỡng |
| `jsdoc` | Mọi function/arrow/class/hook/component **export** phải có mô tả; Rust: `pub fn/struct/enum/trait` phải có `///` | Thiếu mô tả là lỗi. “Nhận gì/trả gì” là **cảnh báo** (chỉ thành lỗi khi `--strict`) vì không máy móc hoá được mà không báo oan |
| `dep-guard` | Cấm `@galaxy-stack/ai-coder-core` ở **mọi tầng**: phụ thuộc trong mọi `package.json`, mọi lockfile (kể cả bắc cầu), mọi câu `import`/`require` | Nhắc tên gói trong tài liệu/chú thích chỉ ghi chú, không tính vi phạm |
| `parity-matrix` | `docs/PARITY-MATRIX.md` phải khớp snapshot `docs/contracts/data/dsh-packages.json` | Sinh lại bằng `--refresh --dump <file>` |
| `deviation` | Sai khác CỐ Ý so với gói stock phải có mục `<!-- deviation: <gói> -->` trong `docs/GBH-SAI-KHAC-CO-CHU-DICH.md` | **RATCHET**: ĐỎ khi có mục CHƯA KHAI **MỚI** ngoài `deviation-baseline.json`; nợ cũ trong baseline chỉ WARN. Xem §1b |
| `typecheck` | `tsc --noEmit` theo đúng cờ của `tsconfig.base.json` | Cần Node >= 26 (đặt `GBH_NODE` nếu PATH không có node) hoặc bun; thiếu runtime thì SKIP kèm lý do, không đỏ cổng |

### 1b. `deviation` — cổng ratchet (bật 19/11/2026)

`deviation-registry.ts` so artefact (`lib/index.js`, `lib/client.js`) với bundle stock trong
`apps/host/node_modules/@deepseek-ai/*` sau khi áp các lớp chuẩn hoá khai trong danh mục, rồi so bề mặt exports.
Cổng A = gói khai `gbh.parity: "byte"` (hoặc `build.ts` có cổng byte); cổng B = phần còn lại.
Đo 19/11/2026: **193 gói mount · so được 176 · khớp 13 · 28 mục chưa khai** (A 19 · B 9) — 28 mục này đóng băng trong
`tools/lint/deviation-baseline.json`. Mục **mới** ⇒ cổng ĐỎ; mục trong baseline ⇒ WARN; mục đã hết lệch ⇒ WARN nhắc cập nhật.

    bun run tools/lint/deviation-registry.ts --list            # in: <cổng>|<gói>|<loại>
    bun run tools/lint/deviation-registry.ts --update-baseline # ghi lại baseline (CHỈ khi nợ đã khai/đã khớp)
    bun run tools/lint/deviation-registry.ts                   # chế độ KHOÁ CỨNG: ĐỎ nếu còn bất kỳ mục chưa khai

Lưu ý: `packages/*/*/lib/` bị `.gitignore` ⇒ trên checkout sạch cổng chỉ so được phần đã build và tự in WARN phủ sóng;
XANH khi đó chỉ có nghĩa "không phát sinh mục mới trên phần so được". CI: `.github/workflows/gate.yml`.

## 2. Miễn trừ

Mọi miễn trừ nằm ở `exemptions.ts` và **bắt buộc kèm lý do**:

- `.json` (manifest do công cụ đọc), lockfile, `.svg` (icon parity phải giữ nguyên byte), tệp nhị phân, tệp cấu hình VCS.
- `docs/contracts/data/**`: dữ liệu tham chiếu sinh tự động (snapshot cây plugin + metadata package).
- Thư mục không duyệt: `node_modules`, `.git`, `dist`, `target`, `gen`, `coverage`, `.parity`, `vendor`.

Đuôi file không nằm trong bảng `HEADER_RULES` bị **bỏ qua** (không phải mã nguồn); con số bỏ qua được in ra ở mỗi lần chạy để không ai tưởng là đã kiểm.

## 3. Thêm một luật mới

1. Viết `ten-luat.ts`, export hàm `runTenLuatCheck(): CheckResult` (dùng `createResult`, `partitionFiles`, `printResult` ở `shared.ts`).
2. Thêm tên vào `GATE_ORDER` và một nhánh trong `runGate()` ở `gate.ts`.
3. Thêm script `lint:ten-luat` vào `package.json` ở root (chỉ Lead sửa file này).
4. Tự kiểm bằng thử phá: tạo file vi phạm trong /tmp rồi chạy `GBH_LINT_ROOT=/tmp/thu-pha bun run gate --only ten-luat` — cổng phải ĐỎ. (`GBH_LINT_ROOT` là hook trỏ cổng vào cây khác; không dùng khi chạy thật.)

## 4. Ma trận parity

`parity-matrix.ts` sinh `docs/PARITY-MATRIX.md` từ snapshot dữ liệu: tên DSH, tên gbh tương ứng, vai trò tiếng Việt (ở `parity-roles.ts`), tầng T0–T5, id row trong cây, mốc thi công, trạng thái.

Làm mới dữ liệu từ một dump thật:

    bun run tools/lint/parity-matrix.ts --refresh --dump /tmp/bh-ref/dsh-profile-web.dump.yml --upstream ~/tmp/galaxy-blackhole/dsh-upstream/packages

Quy tắc đếm (xem đầu tài liệu ma trận): **row** = số dòng `- id:` thụt lề 0; **package gốc** = tên gói duy nhất sau khi gộp subpath. Con số lớn hơn (tổng dòng `- id:` kể cả entry lồng trong `config:`) **không phải** số row — đừng dùng để đếm tiến độ.
