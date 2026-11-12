<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của gói viết lại row `credentials`: bảng nguồn đối chiếu G4, lý do peer, bằng chứng
-->

# `galaxy-blackhole/gbh-credentials-local` — row `credentials`

Bản viết lại của Galaxy Blackhole cho row **`credentials`** của DSH
(`@deepseek-ai/dsh-credentials-local`, bundle một tệp **756 dòng**). Vai trò: **provider thông tin
xác thực cục bộ** — đọc/ghi MỘT tài liệu YAML, mặc định `<home harness>/.credentials.yaml`; trong
app Galaxy, `bh host` ghim `config.path` về **`~/.galaxy/credentials.yaml`** (yêu cầu G1), nên
đường dẫn đó là do lớp CLI pin chứ không phải do gói tự đoán.

**Trạng thái: ĐÃ VIẾT XONG, CHƯA khai `gbh.row`** (chờ Lead boot và đo — luật "khai `gbh.row` =
nhận rủi ro mount"). Có **test canh** khẳng định gói chưa khai `gbh.row`; khi Lead mount xong thì
xoá/đảo test canh đó.

## 1. Nguồn đối chiếu (G4) — từng phần của bản gốc ứng với đâu

| Phần của bản gốc | Ở đâu trong gói này | Ghi chú |
|---|---|---|
| `CREDENTIALS_FILENAME` | `src/spec.ts` | hằng số, giữ nguyên giá trị `.credentials.yaml` |
| `resolveSpec()` | `src/spec.ts` | `path` thắng, nếu không thì `<home>/.credentials.yaml`; `watch` mặc định true, `debounceMs` mặc định 100 |
| `assertOwnerOnly()`, `isENOENT()` | `src/spec.ts` | từ chối tệp có bit quyền nhóm/khác TRƯỚC khi đọc; chỉ POSIX |
| `DOCUMENT_VERSION`, `parseCredentialsDocument()` | `src/document.ts` | hai không gian khoá `refs`/`records`, mọi mục sai bị TỪ CHỐI chứ không bỏ qua |
| `renderFlatLayoutMigration()` | `src/render.ts` | nâng cấp bố cục phẳng thời tiền phát hành, lồng nguyên văn từng dòng |
| `renderRef()`, `renderRecord()`, `deleteSectionEntry()` | `src/render.ts` | sửa MỘT mục, giữ chú thích và định dạng của mọi mục không bị chạm |
| `LocalCredentialProvider` (lớp service) | `src/provider.ts` | kế thừa `CredentialProvider` của seam; `static Config` y bản gốc; vòng đời `[Service.init]` |
| `launchEnvironmentOf()` (gói `dsh-launch-environment`) | `src/environment.ts` | **tự viết** theo hình dạng thật của launcher (xem §2) |
| `resolveDshHome()`, `canonicalizeWatchPath()` (gói `dsh-home-paths`) | `src/paths.ts` | **tự viết** theo đúng đặc tả trong `.d.ts` của gói gốc |
| `locale/en.json`, `locale/zh.json` | `locale/` | chép **byte-for-byte** (shasum khớp), luật 000e |

Không chép mã: mọi hàm được viết lại từ việc đọc `.d.ts` + `lib/index.js` gốc (chỉ đọc), giữ
nguyên **bề mặt service**, **tên sự kiện**, **lược đồ `Config`** và **thông điệp lỗi**.

## 2. Peer — vì sao, và cái gì đã TỰ VIẾT thay vì lấy peer

Recipe §3b giới hạn peer ở seam của kernel. Row này cần 4 gói ngoài bảng đó; mỗi gói có lý do
riêng, và hai helper nhỏ đã được **tự viết** đúng theo tiền lệ của `packages/host/directory-picker-auto`:

| Peer | Vì sao KHÔNG tự viết |
|---|---|
| `@deepseek-ai/dsh-credentials` | **SEAM**: lớp nền `CredentialProvider` + hai hàm đóng dấu `credentialRef`/`parseCredentialKey`. Đây là hợp đồng `ctx.credentials` mà 6+ row khác inject; viết lại là phá seam. |
| `@deepseek-ai/dsh-atomic-write` | Khoá người ghi liên tiến trình + thay tệp nguyên tử. **Cùng một tài liệu** còn được các công cụ khác của hệ Galaxy ghi (CLI/extension), nên định dạng tệp khoá `<tệp>.lock` phải là **một** giao thức, không phải hai bản cài cạnh nhau. |
| `yaml` | Bản gốc dựa vào cây tài liệu giữ chú thích của `yaml` (`parseDocument`/`setIn`/`deleteIn`). Tự viết YAML là bịa lại định dạng người dùng. |
| `chokidar` | Watcher theo dõi **thư mục cha** nên sống sót qua thay thế nguyên tử (đổi inode) — `fs.watch` trên chính tệp sẽ chết sau lần ghi nguyên tử đầu tiên. |
| `@deepseek-ai/cordis`, `@deepseek-ai/schemastery` | Hai peer **tự động** của mọi gói (mount luôn symlink), không phải lựa chọn của gói này. |

Hai gói DSH còn lại của bản gốc đã **tự viết** để giảm phụ thuộc: `dsh-launch-environment` →
`src/environment.ts` (chỉ lớp `process` khi host không cấp ảnh chụp) và `dsh-home-paths` →
`src/paths.ts`. **Cần Lead xác nhận** danh sách peer này (khai ở `gbh.peers`) trước khi mount.

## 3. Bằng chứng đối chứng (đo trên ARTIFACT và trên chính bundle gốc)

| Phép đo | Kết quả |
|---|---|
| Tập export trên **ARTIFACT** (`lib/index.js`) vs bundle gốc | **BẰNG NHAU, 7 tên**: `CREDENTIALS_FILENAME` · `DOCUMENT_VERSION` · `LocalCredentialProvider` · `default` · `parseCredentialsDocument` · `renderFlatLayoutMigration` · `resolveSpec` |
| `parseCredentialsDocument` trên 5 tài liệu hợp lệ | `refs` · `records` · `ignoredKeys` **trùng** từng mục |
| 15 tài liệu SAI (bố cục phẳng · sai version · gốc không phải ánh xạ · giá trị sai kiểu/rỗng · khoá sai grammar · khoá trùng · thẻ lạ · trường lạ · thiếu payload · env sai · YAML hỏng) | **cùng tên lớp lỗi + cùng thông điệp**; chẩn đoán **không chứa** giá trị bí mật |
| `renderFlatLayoutMigration` trên 8 văn bản | **trùng TỪNG BYTE**, kể cả chú thích/dòng trống/dòng cuối |
| **Cùng một kịch bản dịch vụ** chạy trên hai thực thể (đặt/ghi đè/gỡ tham chiếu · 4 lối ghi bản ghi · lỗi rỗng · lỗi payload vô hạn · dispose) | bản ghi kết quả **bằng nhau**, **sự kiện phát ra bằng nhau**, và **văn bản tài liệu còn lại trên đĩa trùng từng byte** (chú thích của mục không bị chạm còn nguyên) |
| Tệp `0644` | **cả hai** từ chối với đúng thông điệp `is readable beyond its owner (mode 644)`; `chmod 600` rồi thì cả hai nhận |
| Vòng đời thật qua `[Service.init]` | đăng ký service tên `credentials`; sửa tệp từ ngoài ⇒ `resolve()` trả giá trị mới; **0 cảnh báo** |
| `grep -c 'id: "@deepseek-ai' lib/index.js` | **0** (row host thuần, không có bảng module) |

Chạy lại: `bun test tests/host/credentials-local.test.ts` ⇒ **9 test / 102 expect · 0 fail**.

## 4. TRƯỚC/SAU — phần đo được ngay, phần chờ Lead

| Phép đo | TRƯỚC (row stock) | SAU (row của ta) |
|---|---|---|
| Tập export của artifact | 7 tên | **7 tên, y hệt** |
| Định dạng tài liệu `~/.galaxy/credentials.yaml` | bố cục version 1, `refs` + `records` | **y hệt** (đối chứng từng byte trong test) |
| Thông điệp lỗi / quyền tệp / sự kiện seam | — | **y hệt** (đối chứng trực tiếp) |
| App 5439 (số entry, RPC `credentials/describe`, `bh doctor`) |  | **CHƯA ĐO — thuộc lượt boot của Lead** |

Vì gói **chưa khai `gbh.row`**, chưa có lượt mount nào; mọi phép đo phía app (bao gồm đường nền
A/B và `check:app`) **phải do Lead chạy** sau khi khai `gbh.row` với
`id: "credentials"` + `aliases` rỗng (row host thuần, đo được **0** bundle `require` id stock
trong cây) + `peers` như §2.

## 5. Vì sao row này là HOST THUẦN (câu hỏi #5 của recipe)

`python3 -c "import json;print(bool((json.load(open('apps/host/node_modules/@deepseek-ai/dsh-credentials-local/package.json')).get('dsh') or {}).get('client')))"`
⇒ **False**: gói gốc **không có khoá `dsh`**, nên cặp disable+insert **không** xoá nửa client nào
khỏi đồ thị boot. Gói của ta vì vậy **không** khai `dsh.client` và **không** ship `lib/client.js`.

## 6. Phần CHƯA làm / khác có ý (nói thẳng)

1. **Ảnh chụp môi trường**: khi host **không** cấp khoá `launchEnvironment`, ảnh chụp dựng tại chỗ
   chỉ có lớp `process` (bản gốc, qua peer `dsh-launch-environment`, dựng đủ ba lớp nhờ launcher).
   Trong app thật launcher **luôn** cấp ảnh chụp trước khi row mount, nên nhánh này chỉ chạy khi
   harness được nhúng bằng composition không qua CLI sản phẩm.
2. **Watcher**: dùng `chokidar` (peer) thay vì tự viết; xem lý do ở §2.
3. **Chưa mount** ⇒ chưa có phép đo phía app; xem §4.
4. Bố cục **phẳng thời tiền phát hành** vẫn được nâng cấp tại chỗ y bản gốc (bản gốc ghi rõ "gỡ bỏ
   cùng lập trường tiền phát hành ở lần phát hành đầu tiên"); ta giữ đúng hành vi đó.

## 7. Lệnh tái lập

`@bash
bun run packages/host/credentials-local/build.ts
grep -c 'id: "@deepseek-ai' packages/host/credentials-local/lib/index.js   # phải = 0
bun test tests/host/credentials-local.test.ts                              # 9 pass / 0 fail
bun run check:rows | grep -c '| chan |'                                    # phải = 0
bun run gate --no-tests                                                    # các cổng thuộc gói này XANH
`@
