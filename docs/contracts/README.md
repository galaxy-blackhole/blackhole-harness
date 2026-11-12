<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Mục lục hợp đồng C1..C7 đã đóng băng: boot injection, module loader, profile/patch, RPC, session, credentials, token-icon
-->

# Hợp đồng phải đóng băng (C1–C7)

> Mỗi hợp đồng DSH mà ta **bắt buộc tái tạo** có: một tài liệu riêng (phát biểu · nguồn chứng minh · test snapshot ·
> điều gì làm nó vỡ), một **snapshot test chạy được**, và **bằng chứng đo trên cây thật**.
> Đóng băng hợp đồng rồi mới được viết lại tầng tương ứng (thứ tự T2 → T3 → T4 → T0/T1 — xem [PARITY-MATRIX](../PARITY-MATRIX.md)).
>
> **Trạng thái M2a (17/10/2026):** 7 tài liệu + 7 file test hợp đồng đã có; `bun test tests/contract` chạy **40 test pass, 1 skip (live), 5 todo (M4/M5)**.
> Bằng chứng thô được đóng băng ở `tests/contract/fixtures/` và chụp lại bằng `bun run tests/contract/capture.ts`.

## 1. Bảng hợp đồng

| # | Hợp đồng | Tài liệu | Đã đóng băng gì (bằng chứng đo được, 17/10/2026) | Test | Trạng thái |
|---|---|---|---|---|---|
| C1 | Boot injection `__DSH_BOOT__` + biến toàn cục | [C1](C1-boot-injection.md) | 4 khoá cấp cao nhất · 72 entry · 3 batch (1/57/14) · 8 biến toàn cục + boot · `inject` là gợi ý (1 mồ côi, 2 chu trình) | `c1-boot-injection.test.ts` (6 + 1 live) | 🟡 đóng băng phần shape; đổi tên `__BH_BOOT__` ở M3 |
| C2 | Module loader `window.__ModuleLoader__` | [C2](C2-module-loader.md) | Nguyên văn 22 dòng JS + SHA-256 · 4 thông điệp lỗi hợp đồng · hành vi lazy/memoize/chặn external **được thực thi trong test** | `c2-module-loader.test.ts` (7) | ✅ đóng băng |
| C3 | Profile / patch | [C3](C3-profile-patch.md) | 205 row · 195 gói · 41 row bị patch tắt · `cordis.yml` = `[]` · cây khớp Oracle A **0/0/0** (cả cấu trúc lẫn nội dung) | `c3-profile-patch.test.ts` (8) | ✅ đóng băng (kèm phát hiện bộ chuẩn hoá che nhầm id row) |
| C4 | RPC / Typert | [C4](C4-rpc-typert.md) | 3 entry gateway/remotes/connection trong đồ thị boot · 8 bề mặt Remote có row trong cây | `c4-rpc-typert.test.ts` (4 + 1 todo) | ⬜ **khung đo**, frame đo ở M4 |
| C5 | Định dạng phiên | [C5](C5-session-format.md) | `session.v4.jsonl.zstd` (JSONL nén zstd — thực tế **v4**, không phải v3 như ARCHITECTURE giả định) · header 8 khoá | `c5-session-format.test.ts` (4 + 2 todo; 1 test chỉ chạy khi máy có phiên) | 🟡 đóng băng phần trên đĩa; round-trip ở M4 |
| C6 | Credentials | [C6](C6-credentials.md) | Đúng 1 row `credentials` → `~/.galaxy/credentials.yaml` · ghim bằng patch · 0 secret trong 3 file khai báo · cách ly `~/.galaxy/gbh` | `c6-credentials.test.ts` (7) | 🟡 đóng băng phần ghim/an toàn; luồng nhập key ở M4/M5 |
| C7 | Token `--dsw-*` + icon | [C7](C7-tokens-icons.md) | Entry theme + 6 cạnh inject · 0 thư viện UI bị cấm · 0 khai báo `lucide-react` · `lucide` không có trong runtime | `c7-tokens-icons.test.ts` (4 + 2 todo) | 🟡 đóng băng luật style; danh sách token + chỉ số icon ở M5 |

Ký hiệu: ✅ đóng băng đủ · 🟡 đóng băng một phần (ghi rõ phần còn lại) · ⬜ mới là khung.

## 2. Vì sao đúng bảy hợp đồng này

- **Không copy code, copy hành vi.** Hợp đồng là *bề mặt* mà plugin ngoài và dữ liệu người dùng chạm vào. Sai một
  trong bảy bề mặt này thì hoặc plugin DSH không chạy được, hoặc dữ liệu cũ không mở lại được — dù code của ta đúng.
- **C1/C2 là cửa vào của UI**: lệch shape boot object hoặc ngữ nghĩa lazy-CJS là toàn bộ plugin UI trong cây web
  chết ngay, kể cả khi chúng được viết đúng.
- **C3 là xương sống cấu hình**: cây plugin của ta phải compose ra **đúng** cây của DSH trước khi nói tới UI parity.
- **C6/C7 là hai hợp đồng người dùng thấy**: một cái quyết định key LLM (không được lộ, không được ghi sai chỗ),
  một cái quyết định giao diện có giống hệt hay không.

## 3. Quy ước chung của mỗi tài liệu

Mỗi file `C<n>-<tên>.md` có đúng 5 phần:

1. **Phát biểu** — hợp đồng ràng buộc cái gì, bất biến nào không được đổi.
2. **Nguồn chứng minh** — gói upstream nào + **hành vi đo được** (số liệu thật, ngày đo) + fixture + cách chụp lại.
3. **Test snapshot tương ứng** — mỗi test canh điều gì.
4. **Điều gì làm hợp đồng VỠ** — bảng thay đổi → hậu quả.
5. **Việc còn lại** — checklist có mốc (M4/M5/M3).

Danh sách: [C1](C1-boot-injection.md) · [C2](C2-module-loader.md) · [C3](C3-profile-patch.md) · [C4](C4-rpc-typert.md) ·
[C5](C5-session-format.md) · [C6](C6-credentials.md) · [C7](C7-tokens-icons.md).

Quy ước chụp bằng chứng: `bun run tests/contract/capture.ts` đọc trang đang chạy + dump của giàn parity + phiên trên đĩa,
chuẩn hoá (đường dẫn tuyệt đối, rev, token, timestamp, id phiên) rồi ghi fixture. Test **không gọi mạng**: chỉ đọc fixture;
muốn so với trang đang chạy thì đặt `GBH_CONTRACT_LIVE=1`.

## 4. Cổng tự động đang giữ phần nào của hợp đồng

| Cổng | Giữ được gì | Lệnh |
|---|---|---|
| `gate:lint` (header, độ dài, JSDoc, dep-guard, typecheck) | Luật repo: header 5 dòng, ≤1000 dòng/file, mô tả export, không `@galaxy-stack/ai-coder-core`, TS strict | `bun run gate` |
| `tests/contract` (C1–C7) | C1 boot · C2 loader · C3 cây plugin · C4 bề mặt RPC · C5 định dạng phiên · C6 credentials · C7 luật style | `bun test tests/contract` |
| `parity:dump` | C3: cây plugin của ta so với oracle (diff 0 dòng) | `bun run parity:dump` |
| `parity:shot` / `parity:report` | UI + ảnh A/B, tổng hợp PASS/FAIL | `bun run parity:report` |
| `gate:home-isolation` | C6 (an toàn): `~/.galaxy/gbh` bất biến trước/sau boot | `bun test tests/host` |
| `parity-matrix --check` | Ma trận không lệch khỏi snapshot dữ liệu thật (205 row, 12 cột) | `bun run tools/lint/parity-matrix.ts --check` |

## 5. Ngoài phạm vi (đừng đóng băng)

- **Không** đóng băng chi tiết nội bộ kernel/hạ tầng DSH (fiber, effect, importer): đó là phần ta **viết lại** ở K2,
  chỉ cần tương thích API công khai mà plugin dùng.
- **Không** đóng băng mã lỗi riêng của từng tool, chuỗi i18n của DSH, hay chữ ký telemetry: đổi được mà không phá parity hành vi.
- **Không** sao chép nội dung hội thoại trong phiên: fixture C5 chỉ giữ `type` và tên khoá.
- **Không** ghi vào `~/.galaxy/gbh/**` — cây đó thuộc bản web đang chạy, chỉ đọc để đối chiếu.

## 6. Checklist M2

- [x] C1: chụp `__DSH_BOOT__` thật, chuẩn hoá, snapshot test + test live tuỳ chọn.
- [x] C2: đóng băng bề mặt loader + thực thi hành vi (lazy, memoize, chặn external) trong test.
- [x] C3: đóng băng cây 205 row, đối chiếu Oracle A (0/0/0), kiểm mọi gói có thật trong runtime.
- [x] C5: đo định dạng trên đĩa (v4 + zstd) + header record; ghi rõ round-trip để M4.
- [x] C6: ghim đường dẫn = `~/.galaxy/credentials.yaml` + quét secret + cách ly home.
- [x] C7: luật style (không Tailwind/component lib, màu literal) + nguồn phát token.
- [x] C4: khung đo + danh sách bề mặt Remote; frame để M4.
- [ ] **M4/M5**: điền các mục `todo` trong test (trace frame, round-trip phiên, danh sách token, chỉ số icon).
- [ ] **M2 (còn lại)**: đưa diff cây app-vs-oracle vào `bun run gate` như một cổng riêng.

---

Nền tảng luật: [AGENTS.md](../../AGENTS.md) · Kiến trúc: [ARCHITECTURE.md](../ARCHITECTURE.md) · Ma trận: [PARITY-MATRIX.md](../PARITY-MATRIX.md)
