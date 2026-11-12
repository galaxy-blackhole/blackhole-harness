<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc QUY TẮC bắt buộc khi rà soát/phát triển package GBH + quy trình 3 chữ ký + cách ghi sổ tiến độ.
-->

# Quy tắc package GBH (áp dụng cho mọi teammate)

## 1. Sáu quy tắc kiểm (review kiểm bằng ĐỌC MÃ, KHÔNG dùng tool so sánh)

| # | Quy tắc | Cách kiểm đúng |
|---|---|---|
| R1 | **Header 5 dòng** ở đầu mọi file `.ts/.tsx/.sh/.rs`: `author`, `email`, `create date 15/10/2026`, `modify date`, `desc` | mở file, đọc 10 dòng đầu. Tệp tài liệu (`.md`) KHÔNG cần |
| R2 | **JSDoc** cho mọi function/hook/component export: làm gì · nhận gì · trả gì | đọc chữ ký hàm và khối `/** */` ngay trên nó |
| R3 | **≤ ~1000 dòng/tệp** | đếm bằng mắt theo vùng, không cần chính xác tuyệt đối; > 1100 dòng là vi phạm |
| R4 | **Không còn dấu vết DSH** trong mã/UI/export: `deepseek-ai`, `dsh`, `DeepSeek Harness` | đọc mã. NGOẠI LỆ hợp lệ: `gbh.provenance.stock` trong `package.json` (sổ di trú — PHẢI giữ), JSDoc ghi chú lịch sử, harness đối chứng A/B trong `tests/` |
| R5 | **Đủ số function tương đương bản gốc DSH** | đọc danh sách export của gói ta và của bản gốc (đọc mã nguồn thật, không chạy script so sánh) |
| R6 | **peerDependencies**: nếu mã cần `@deepseek-ai/<x>` thì phải dùng gói GBH tương ứng | đọc import; nếu thiếu gói GBH tương ứng ⇒ DỪNG, báo Lead cấp ngân sách phát triển gói đó |

## 2. Quy trình 3 chữ ký (không đủ 3 chữ ký thì KHÔNG backup, KHÔNG coi là xong)

1. **Dev** sửa cho đúng 6 quy tắc → chạy self-test nhỏ (vd `bun test ./tests/host/<goi>.test.ts` hoặc build gói) → ghi chữ ký.
2. **Review** đọc lại mã của đúng gói đó (KHÔNG dùng tool so sánh), nếu đạt thì ghi chữ ký.
3. **Tester** chạy test liên quan; xanh thì ghi chữ ký, đỏ thì báo Lead (Lead yêu cầu dev sửa lại, KHÔNG revert ngay).
4. **Lead** kiểm ảnh chụp + `bun run check:app` + `bun run gate`; nếu app xanh và đủ 3 chữ ký ⇒ chạy
   `bash tools/tien-do/backup-package.sh <tầng>/<thư-mục> "dev-N+review+tester"` ⇒ gói vào SỔ TIẾN ĐỘ và **ĐÓNG BĂNG**.

Mỗi người ghi chữ ký vào **file riêng** (tránh xung đột ghi): `docs/tien-do/chu-ky-dev-N.md`, `chu-ky-review.md`, `chu-ky-tester.md`.

Định dạng một chữ ký (một dòng):

```
| <goi> | <vai> | <YYYY-MM-DD HH:mm> | <lenh da chay> | <ket qua tom tat> |
```

## 3. Quy tắc ĐÓNG BĂNG (chống mất việc đã fix)

- Gói đã có dòng trong `docs/tien-do/SO-TIEN-DO.md` là **hoàn chỉnh**: KHÔNG sửa nữa.
- Nếu buộc phải sửa: ghi lý do vào cột chữ ký của dòng mới (`dev-N (mo lai: <ly do>)`) và báo Lead.
- Tuyệt đối KHÔNG khôi phục cả cây `packages/` từ backup cũ khi chỉ hỏng một gói — chỉ khôi phục ĐÚNG gói hỏng từ
  `/tmp/gbh-pkg/<ten>-<ts>/` (bản sao theo gói, có `SHA256SUMS`).

## 4. Chia việc

- 6 dev: mỗi người một batch `docs/tien-do/batch-dev-N.txt` (56 gói/batch, batch 6 có 52).
- Dev được dùng tối đa 3 subagent song song; dev chỉ tổng hợp + ký, subagent làm việc nặng.
- Review + Tester: kiểm theo yêu cầu của Lead, ưu tiên các gói dev vừa ký.
## 2b. CHỐT R6 (Lead, 08/11/2026) — hai mức, áp dụng thống nhất

Đo được: `@galaxy-blackhole/gbh-cordis` là **bản port đầy đủ** (implementation riêng, chỉ phụ thuộc
`@deepseek-ai/cosmokit`), **không** phải re-export của kernel. Đổi import sang nó ⇒ runtime có **hai instance
cordis** ⇒ Context không khớp ⇒ plugin không nạp (đúng lớp sự cố đã làm sập app 08/11). Vì vậy:

- **R6a — bắt buộc ngay (row seam):** import/peer tới `@deepseek-ai/dsh-<x>` mà đã có gói GBH **có `gbh.row`**
  thay thế ⇒ **vi phạm**, dev phải đổi sang id GBH.
- **R6b — hoãn có kiểm soát (kernel seam):** `@deepseek-ai/cordis`, `schemastery`, `cosmokit`, `dsh-llm`,
  `dsh-scope`, `dsh-typert-protocol`, `dsh-client-ui-primitives` được phép giữ trong phase này; dev ghi vào
  báo cáo dòng `NO KERNEL SEAM: <id> × <số lần>` để Lead mở phase B.
- Dev **không được thêm** import `@deepseek-ai` mới ngoài danh sách seam trên.
- Chuỗi **attribution/bản quyền** (vd `DSH 0.2.0-rc.2, MIT`) KHÔNG tính vi phạm R4; nhưng **tên hằng/biến/export**
  chứa `dsh`/`deepseek` **tính là vi phạm** ⇒ phải đổi tên.

**Phase B** (chỉ mở khi có ngân sách + kiểm chứng instance): hoặc (B1) `gbh-<x>` thành lớp mỏng re-export từ kernel
rồi đổi import toàn bộ, hoặc (B2) mount alias id stock → thư mục GBH ở profile rồi boot lại kiểm tra. Pilot ở
**một** gói (`host/agent`), Lead chụp ảnh + `check:app` + `gate` xanh rồi mới cho áp hàng loạt.
## 2c. CHỐT R6b mở rộng (Lead, 08/11/2026) — nhóm id mang AUGMENTATION

Bằng chứng đo được (dev-5, thí điểm `host/tool-working-directory`): đổi `@deepseek-ai/dsh-tools` →
`@galaxy-blackhole/gbh-host-tools` thì `bun test` **vẫn xanh** nhưng `tsc` **ĐỎ**: `TS2339 Property 'tools' does
not exist on type 'Context'`. Nguyên nhân: `@deepseek-ai/dsh-tools` mang `declare module '@deepseek-ai/cordis'`
để bơm `Context.tools`; gói GBH `packages/host/tools` **cố ý không port augmentation** (ADR 000d: cấm augment
module) mà khai seam theo CẤU TRÚC. Vì thế R6a **không thể** "chỉ đổi tên import" cho nhóm id này.

**Quyết định:** các id sau thuộc **R6b (hoãn)** — dev ghi `R6b (hoãn, augmentation)` và ĐƯỢC KÝ:
`@deepseek-ai/dsh-tools`, `dsh-agent`, `dsh-session`, `dsh-scope`, `dsh-llm`, `dsh-typert-protocol`,
`dsh-client-ui-primitives`, `cordis`, `schemastery`, `cosmokit`, `dsh-sandbox`, `dsh-web` (nếu mang augmentation).
Review **không** được TRA LAI vì các id này.

**Phase B (việc thật, cần ngân sách riêng):** refactor consumer sang seam CẤU TRÚC (như `WorkingDirectoryLike`)
hoặc mở ngoại lệ ADR 000d cho đúng một augmentation trong `packages/host/tools`. Pilot 1 gói rồi mới áp 12 gói
tool-*. Người nhận: teammate rảnh sau khi xong batch (Lead điều phối).
## 2d. CHỐT R4b + peerDependencies (Lead, 08/11/2026)

**R4b — MIỄN R4 cho LÁT NGUYÊN VĂN (generated verbatim):** tệp sinh tự động mang marker
`LÁT NGUYÊN VĂN ... KHÔNG sửa tay` + `@ts-nocheck`, thuộc `src/parts/**`, `src/client-parts/**`,
`src/parts-*/**`, `src/*-slice*.ts` được MIỄN quy tắc R4 dù còn định danh `_deepseek_ai_dsh_*`
(326 tệp / 73 gói). Review ghi nhận `R4b <tệp> × <số định danh>` và ĐƯỢC KÝ.
VẪN TÍNH VI PHẠM: mã TAY (tệp không mang marker) có tên hằng/biến/hàm/export chứa `dsh`/`deepseek`, và mọi
chuỗi hiển thị cho người dùng. **Phase B**: sửa ở tầng GENERATOR (`tools/gen-client-parts.ts`) để đổi định danh
khi sinh + cập nhật cổng byte trong `build.ts` — không sửa tay từng lát.

**peerDependencies:** tính là "import/peer" của R6 ⇒ peer tới id **row-seam** là R6a (phải đổi); peer tới id
**kernel seam/augmentation** (§2b, §2c) là R6b (hoãn). Id mà gói GBH tương ứng **không khai `gbh.row`** ⇒ ngoài R6a
(ghi `NO-KERNEL-SEAM`).

**Đóng băng locale:** trong lượt rà soát này KHÔNG ai thêm/sửa/xoá tệp dưới `locale/**` (trừ khi chính test của
gói yêu cầu và được Lead duyệt từng ca). Lý do: đã xảy ra ghi chồng (77 `locale/vi.json` mới + 2 tệp goal bị xoá).
## 5. Cách Lead XÁC THỰC theo lô khi cả team đang sửa song song (08/11/2026)

Gate TOÀN CÂY chỉ dùng ở **cửa sổ yên tĩnh** (cuối một vòng), vì bất kỳ gói nào đang sửa dở cũng làm typecheck đỏ.
Mỗi lô xác thực theo 4 bước (đều phạm vi hẹp, không phụ thuộc gói khác):

1. `GBH_LINT_ROOT=packages/<tầng>/<gói> bun run tools/lint/{header,jsdoc,file-length}.ts` — R1..R3.
2. Typecheck hẹp: `bun x tsc --noEmit` trên đúng các tệp `src/` của gói (bộ cờ như gate).
3. Test của gói: `bun test --timeout 60000 ./tests/<tầng>/<gói>.test.ts` (máy tải cao ⇒ PHẢI có `--timeout 60000`,
   nếu không sẽ đỏ giả vì hạn 5s mặc định).
4. Mức app: `bun run check:app` + ảnh chụp headless CDP (0 lỗi console) — chứng minh thay đổi không phá app.

Đỏ ở bước 2/3 ⇒ TRA LẠI dev; đỏ ở bước 4 ⇒ điều tra ngay (không revert vội).
## 2e. CHỐT: peerDependencies dùng id STOCK là HỢP LỆ trong phase này (Lead, 08/11/2026)

Bằng chứng: mount dựng **symlink peer TỪ KERNEL** (`apps/cli/src/mount.ts`): peer khai id GBH thì mount báo
"thiếu peer trong kernel" (dev-6 đã gặp đúng ca này với `gbh-host-tools`). Vì vậy `peerDependencies` KHÔNG phải
chỗ thể hiện danh tính — nó là **hợp đồng module-table** với kernel, cùng loại với `dsh.client.inject`/`external`.

⇒ **R6a chỉ áp cho IMPORT trong mã** (kể cả `import type`). Peer trỏ id row-seam được giữ và ghi
`R6b (hoãn, peer-kernel-id)`; review **KHÔNG** trả lại gói vì peer. (Trước đó §2d ghi "peer tính là R6a" — nay
sửa lại theo bằng chứng mount này.)

Hệ quả kèm theo: nếu đã đổi `gbh.peers` sang id GBH thì **trả về id stock** (nếu không, test liên gói pin ngoại lệ
stock sẽ đỏ: `cordis-client-runner`, `deepseek-account`, `message-feedback`).
## 2f. BỔ SUNG §2c (Lead, 08/11/2026) — R6b theo TIÊU CHÍ, không theo danh sách

Đo được (dev-3 + review-3 xác minh độc lập 2 lần): `host/optional-session-title-all-prompts` dùng `ctx.sessionTitle`
nhưng gói GBH `gbh-session-title` **không khai** `declare module` ⇒ đổi sang id GBH là mất `Context.sessionTitle`
(TS2339); thêm nữa test của gói khẳng định import bằng ĐƯỜNG DẪN TƯƠNG ĐỐI nên đổi id cũng làm đỏ.

⇒ **Luật (áp dụng cho mọi id, không cần liệt kê)**: nếu **gói GBH thay thế KHÔNG khai augmentation** mà consumer
dùng `ctx.<service>` của id đó, HOẶC test của gói pin specifier/đường dẫn, HOẶC việc đổi id làm thay đổi DANH TÍNH
LỚP (`instanceof`) ⇒ xếp **R6b (hoãn)** và ĐƯỢC KÝ, ghi lý do cụ thể vào cột chữ ký.

Ba trường hợp đã áp: `dsh-session-title` · `dsh-sandbox-policy` (self-ref augmentation trong khối `declare module`
của chính gói) · `dsh-commands` (union sự kiện + `CommandDefinitionId` brand khác).
## 6. LUẬT CÔNG CỤ (08/11/2026 — rút từ 2 sự cố thật)

### 6.1 `tools/debundle-client.ts`
CHỈ chạy cho gói cắt lát chung `src/parts/part-NN.ts`. Gói có `src/manifest.ts` với `PART_FILES` tên ngữ nghĩa
(ví dụ `packages/client/ui-schedule`) thì **CẤM** — công cụ xoá `src/parts/` và ghi đè 19 lát chung.
Sau khi sinh artefact, BẮT BUỘC chuẩn hoá id trong mọi `require()`:
`@deepseek-ai/dsh-client-store|ui-primitives|ui-slots` → id seed `@galaxy-blackhole/gbh-*`; **GIỮ** `@deepseek-ai/cordis`
(platform seed của shell). Quên bước này ⇒ app đỏ `missed the module table`.

### 6.2 Chỉ MỘT tiến trình host trên cổng 5439
Sự cố thật: 3 tiến trình cùng giữ cổng ⇒ `ready-url.txt` bị ghi đè và client phục vụ artefact CŨ, gây 'app đỏ ma'.
Trước khi bật: `for p in $(lsof -ti tcp:5439); do kill -9 $p; done`, chờ cổng nhả, rồi bật đúng một bản.

### 6.3 Ghi sổ chữ ký: APPEND-ONLY, một người ghi
Read-modify-write song song làm mất dòng (đã xảy ra 2 lần với `chu-ky-review-2.md`). Mỗi sổ có đúng một người ghi;
người khác gửi nội dung để người ghi nối thêm.
