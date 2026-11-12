<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Hop dong C1: boot injection — shape cua __DSH_BOOT__ va cac bien toan cuc ma trang web nhan duoc
-->

# C1 — Boot injection: `__DSH_BOOT__` + biến toàn cục

> **Trạng thái: ĐÓNG BĂNG MỘT PHẦN (có test).** Phần shape/khoá/đồ thị đã đóng băng bằng fixture.
> Việc còn lại: đổi tên thành `__BH_BOOT__` (kèm tên cũ) — để **M3**, khi ta sở hữu loader.

## 1. Phát biểu hợp đồng

Khi host phục vụ HTML cho client, nó phải chèn **trước mọi script plugin**:

1. `globalThis["__DSH_BOOT__"]` — đồ thị entry client: khoá cấp cao nhất `batches, entries, release, rev`;
   mỗi entry có `id, url, rev, inject[], immediately` và có thể có thêm `external`;
   mỗi batch có `phase, url, rev, entries[]`.
2. Các biến cấu hình nhỏ dạng `globalThis["__DSH_*__"]` cho từng plugin (shortcut, document preview, onboarding, remote access…).
3. Biến riêng của Blackhole: `globalThis["__GBH_HAS_KEY__"]` — trạng thái đã có API key để UI biết có phải mở luồng nhập key không.

Bất biến: boot object **phải có mặt trước script bootstrap** (`dsh-client-modules/client.js`); script đó chỉ *đăng ký* vào hàng đợi, hệ module thật chỉ được tạo khi `__ModuleLoader__.create()` được gọi (xem [C2](C2-module-loader.md)).

## 2. Nguồn chứng minh

| Nguồn | Chi tiết |
|---|---|
| Upstream (gói đã cài) | `apps/host/node_modules/@deepseek-ai/dsh-client-modules` — nửa node dựng đồ thị `__DSH_BOOT__` và tap `index.html`; `dsh-host-webserver` — route + tap biến đổi index; `dsh-web-app` — lớp patch web |
| Hành vi đo được (17/10/2026, app @5439, harness `0.2.1-alpha.4`, commit `cc6a8f5`) | 8 biến toàn cục + boot = 9; boot có 4 khoá; **72 entry**; 3 batch: `bootstrap:1`, `application:57`, `application:14`; 5 entry có `external: true` |
| Fixture đóng băng | `tests/contract/fixtures/c1-boot-graph.json` · `c1-page-globals.json` |
| Test | `tests/contract/c1-boot-injection.test.ts` — 6 test chạy mặc định + 1 test live (`GBH_CONTRACT_LIVE=1`) |
| Cách chụp lại | `bun run tests/contract/capture.ts` (đọc `~/.galaxy/blackhole/ready-url.txt` hoặc `--url`) |

### Sự thật quan trọng: `inject` là GỢI Ý thứ tự, KHÔNG phải DAG

Đo được trên cây thật:

- **1 id được inject nhưng không có entry riêng**: `@deepseek-ai/dsh-client-ui-primitives` (bundle gộp — 4 entry cùng inject nó).
- **2 chu trình**: `client-ui-conversation → client-ui-workspace → client-ui-conversation` và `client-ui-workspace → client-ui-sidebar → client-ui-workspace`.
- 5 entry đánh dấu `external: true` (các controller API) — bundle của chúng không phục vụ qua route plugin thường.

Nghĩa là loader của ta **phải chịu được** tham chiếu mồ côi và chu trình. Nếu viết loader đòi topological sort nghiêm ngặt thì **vỡ hợp đồng** ngay.

## 3. Test snapshot tương ứng

`tests/contract/c1-boot-injection.test.ts`:

| Test | Canh điều gì |
|---|---|
| khoá cấp cao nhất + bản phát hành | `batches/entries/release/rev` và `release.version`/`release.commit` |
| entry: id duy nhất, có url, có rev | mỗi entry trỏ đúng `<id>/client.js`, rev đã chuẩn hoá |
| chẩn đoán đồ thị khớp fixture | tham chiếu mồ côi + chu trình **đúng như đã đo** (không được sửa cho đẹp) |
| batch đầu là bootstrap | `bootstrap` chỉ chứa `dsh-client-modules`; mọi id trong batch đều có entry |
| biến toàn cục | có biến riêng của Blackhole, `__DSH_BOOT__` nằm ở fixture riêng, giá trị ổn định (`stopSequenceMs=500`, `backoffBaseMs=500`) |
| không rò token/đường dẫn | fixture không chứa `token=ey` hay `/Users/` |
| (live) so với trang đang chạy | khi `GBH_CONTRACT_LIVE=1`: danh sách id và chẩn đoán đồ thị phải khớp |

## 4. Điều gì làm hợp đồng VỠ

| Thay đổi | Hậu quả |
|---|---|
| Đổi tên biến (`__DSH_BOOT__` sang tên khác) mà không giữ alias | Toàn bộ plugin UI của DSH chết ở lượt nạp đầu |
| Bỏ/đổi tên khoá trong entry (`inject`, `immediately`, `rev`) | Loader không biết thứ tự nạp; bundle sai rev bị cache |
| Bỏ `batches` | Mất khả năng nạp theo pha (bootstrap rồi application) |
| Chèn boot **sau** script bootstrap | Hàng đợi rỗng, không có gì để `create()` |
| Đổi `__GBH_HAS_KEY__` thành kiểu khác (chuỗi thay vì boolean) | UI onboarding key hiểu sai trạng thái |
| Dọn dẹp đồ thị inject (bỏ entry mồ côi/chu trình) | Lệch khỏi cây thật, parity hỏng dù trông sạch hơn |

## 5. Việc còn lại

- [ ] **M3**: phát `__BH_BOOT__` song song `__DSH_BOOT__` (alias) rồi mới chuyển hẳn; cập nhật fixture + test.
- [ ] Chụp boot trong CI (không cần server) bằng fixture tái tạo từ dump + danh sách bundle; hiện chụp bằng `capture.ts`.
- [ ] Đóng băng cả thứ tự byte của khối script (hiện chỉ đóng băng nội dung).
