<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho row workspace của DSH (@deepseek-ai/dsh-workspace).
-->

# @galaxy-blackhole/gbh-workspace

Sổ đăng ký workspace của DSH viết lại: **bản ghi workspace bền vững** trên dạng dữ liệu MIỀN, **thứ tự
hiển thị ổn định**, **tư cách thành viên phiên có kiểm header** (`cwd` chuẩn tắc), và **sổ lưu trữ/ghim
TOÀN SỔ** trên hai waterfall `workspace/session-activity` · `workspace/session-stop`.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `workspace` (T4) | `@galaxy-blackhole/gbh-workspace` |
| Package | `@deepseek-ai/dsh-workspace` `0.2.1-alpha.4` | `@galaxy-blackhole/gbh-workspace` `0.1.0` |
| Kích thước bản build | **953 dòng** `lib/index.js` + **640 dòng** `lib/types/*.d.ts` | **757 dòng** `lib/index.js` · **7 tệp nguồn** (dưới đây) |
| Hai mặt? | **KHÔNG** — câu hỏi 5 = `False` | không có nửa client (đúng bản gốc) |
| `locale/` | **CÓ** (`en.json` 45 B · `zh.json` 137 B) | chép **byte-for-byte** (000e) |
| Bề mặt | `ctx.workspaceRegistry` (`WorkspaceRegistry extends Service`) | y nguyên tên dịch vụ + 25 thành viên prototype |

**Bước 0 — bốn phép, đo trên dump mới nhất `.parity/dumps/2026-10-18T01-31-57`:**

| phép | kết quả |
|---|---|
| (i) cặp `- id: workspace` + `name: '@deepseek-ai/dsh-workspace'` | **CÓ**: `ours.yml` **530–531** · `stock.yml` **435–436** · `oracleA.yml` **488** · `oracleA_nopatch.yml` **438** · `oracleA_rc2.yml` **488** |
| (ii) `dsh.client` + `lib/client.js` | **KHÔNG** cả hai: `package.json` gốc không có khoá `dsh`; `lib/` chỉ có `index.js` + `types/` ⇒ **MỘT MẶT** |
| (iii) `disabled` | **KHÔNG** (cả `ours.yml` lẫn `stock.yml`: khối row chỉ **2 dòng**) |
| (iv) `config` + `inject` trong `ours.yml` | **KHÔNG** cả hai (Lead đã kiểm; gói đối chiếu lại: khối row đúng 2 dòng) |

**5 câu hỏi:**

1. **Đang BẬT?** Có — row không `disabled` trong cả ba dump.
2. **Thuần host hay có mount surface client?** **Thuần host** (không `dsh.client`, không `lib/client.js`, `__ModuleLoader__` = 0 lần trong artifact gốc và artifact của ta).
3. **Cần seam nào?** `@deepseek-ai/cordis` (`Service`) — **Bậc 1 §3b**; `zod` cho schema ở ranh giới bền — **Bậc 3 §3b**. Bốn seam còn lại (`storageDomain` · `sessionPersistence` · `sessions` · `logger`) khai **theo CẤU TRÚC** trong `src/seams.ts`, **không import** gói nào ngoài bảng.
4. **Hành vi đo được?** Bản ghi bền trong miền `workspace` (bảng `workspaces` + ô global) · **đúng một** lượt `putRecord` khi tạo · ba lượt `setGlobal` cho một lượt tạo (dấu treo → bản ghi → thứ tự) · danh sách `list()` theo thứ tự bền · hai waterfall.
5. **Package gốc có `dsh.client`?** **KHÔNG** ⇒ mount bằng disable+insert **không** mất nửa client.

**Nguồn đối chiếu để viết**: `lib/types/index.d.ts` · `types.d.ts` · `entity.d.ts` · `paths.d.ts` · `spec.d.ts` (640 dòng) + `lib/index.js` (953 dòng) — **chỉ đọc**; mã viết lại theo cấu trúc của ta, không chép.

## 2. Vì sao cần

Row này là **chỗ duy nhất** biết "workspace nào tồn tại, phiên nào thuộc workspace nào": `ctx.workspaceRegistry`
được `workspace-controller` · `workspace-files` · `ui-workspace` · `session-inspector` gọi vào. Thiếu
nó thì màn chọn workspace mất dữ liệu, và các row kia **hỏng lúc chạy** — mà **không cổng nào thấy**
(cùng lớp lỗi "gói khác gọi vào thì hỏng").

**Ba tầng của gói:**

| tầng | tệp | nội dung |
|---|---|---|
| từ vựng + chuẩn đường dẫn | `src/types.ts` (136) · `src/paths.ts` (51) | thương hiệu `WorkspaceId`/`SessionId`, giao diện `Workspace`, họ `SessionActivity`; **MỘT chuẩn duy nhất** = `fs.realpath` của đường dẫn tuyệt đối |
| dạng dữ liệu MIỀN | `src/spec.ts` (138) | `workspaceRecord` · `workspaceDomainState` (zod) · `workspaceDomainSpec` (name `workspace`, version **2**, initial bốn trường) + phép kiểm khai báo **lúc nạp module** |
| thực thể + sổ đăng ký | `src/entity.ts` (249) · `src/registry.ts` (833) · `src/errors.ts` (87) · `src/seams.ts` (187) · `src/index.ts` (46) | một đường ghi `mutate` (đóng dấu `updatedAt` + tỉa ứng viên + dấu **huỷ-ô-khi-không-đổi**), sổ đăng ký với hàng đợi tuần tự, dấu thay-đổi-hai-lần + **ba lớp hoàn tác**, lượt gieo lịch sử CHỈ-TỪ-HEADER, và **bốn lớp lỗi** giữ nguyên trường + câu |

**Những luật của bản gốc được giữ NGUYÊN (đo được, không suy đoán):**

- **Một chuẩn đường dẫn**: hai đường dẫn là "cùng một chỗ" khi và chỉ khi **chuỗi đã chuẩn tắc** bằng
  nhau (symlink trỏ vào thư mục đã có ⇒ ĐỤNG); mọi phép kiểm `cwd` đi qua đúng chuẩn ấy.
- **`sessionIds` là phép chiếu ĐỒNG BỘ đã lọc**: header vắng / `cwd` hỏng / `cwd` chuẩn tắc lệch ⇒
  **không bao giờ** được trả, và mỗi ứng viên bị lọc có **một dòng cảnh báo** nêu lý do.
- **`cwd` đầy đủ mà `ENOENT`** ⇒ **GIỮ** tư cách thành viên (thư mục có thể chỉ đang bị chuyển tạm).
- **Không-đổi thì KHÔNG ghi**: `mutate` huỷ ô chuỗi ghi bằng dấu gửi khi hàm trả lại `current` nguyên văn
  **và** lượt tỉa không tìm thấy gì ⇒ không viết lại môi trường lưu, không phát sự kiện đổi.
- **Lưu trữ bỏ ghim trong CÙNG lượt ghi bền**; ghim và lưu trữ **loại trừ nhau**.
- **`sessionPersistence` là phụ thuộc BẮT BUỘC**: peer vắng **không bao giờ** được đọc nhầm thành "lịch
  sử rỗng" rồi đóng dấu `initialized` (dấu đó là vĩnh viễn).

## 3. Peer

| peer | bậc §3b | vì sao ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | **Bậc 1** | `WorkspaceRegistry extends Service` — phải **CÙNG một lớp** `Service` của kernel (`Object.getPrototypeOf` của ta **BẰNG** của bản gốc — có ca test); bản sao ⇒ `super(ctx, name)` đăng ký vào **sổ khác** ⇒ row không activate |
| `zod` (`4.4.3`) | **Bậc 3** | `workspaceRecord` · `workspaceDomainState` là **schema zod THẬT** mà `ctx.storageDomain` gọi `.parse()` ở ranh giới bền; bản gốc cũng khai `zod` ở `dependencies` |

`gbh.peers = ["zod"]` (cordis + schemastery do **tầng mount** tự thêm); **`gbh.peers ⊆ peerDependencies`
so PHẦN TỬ = 0 tên lệch**, `dependencies` **RỖNG**. Ba **đối chứng âm** nằm trong test (xoá-một-tên ·
cùng-độ-dài-mà-lệch-phần-tử · thừa-tên-vẫn-ĐẠT) + **hai đối chứng âm của chính bộ test** (sửa nguồn ⇒ ca
đỏ; bỏ `zod` khỏi `peerDependencies` ⇒ ca 0c đỏ).

**Ba thứ CỐ Ý KHÔNG khai peer** (mỗi thứ có lý do đo được):

- `@deepseek-ai/dsh-brand`: `brandString` là hàm **ĐỒNG NHẤT** `(value) => value` (đọc `dsh-brand/lib/index.js`,
  32 dòng, tự ghi *"keeps no runtime identity"*) ⇒ khai tại chỗ trong `src/spec.ts` + `src/types.ts`.
- `@deepseek-ai/dsh-session` / `dsh-typert-protocol` / `dsh-storage-domain` / `dsh-storage`: gói gốc chỉ
  **mượn KIỂU**; ta khai bốn seam **theo CẤU TRÚC** (`src/seams.ts`) ⇒ vẫn không lệ thuộc tên gói.
- `schemastery`: **không dùng** — không có `Config` (row trần, xem bước 0 (iv)).

## 4. Bảng TRƯỚC / SAU + lệnh tái lập

Row **CHƯA mount** (người viết gói không tự khai `gbh.row`) ⇒ các số "SAU" dưới đây là **đo trong giàn
cách ly** (Context cordis THẬT + kho + miền của ta + persistence giả), **không** phải app 5439.

| Phép đo | TRƯỚC (bản gốc, đo trên artifact) | SAU (gói của ta) |
|---|---|---|
| Tập export trên **ARTIFACT** | **12** tên | **12** tên — **0 thiếu · 0 thừa** |
| `default` | LÀ lớp `WorkspaceRegistry` | LÀ lớp `WorkspaceRegistry` (`Object.getPrototypeOf` hai lớp **BẰNG** nhau ⇒ cùng `Service`) |
| `id: @deepseek-ai` trong `lib/index.js` | 0 | **0** (và `__ModuleLoader__` = **0**) |
| Một lượt `create` (miền sạch) | 1 `putRecord` · 3 `setGlobal` | **1 · 3** (A/B khớp từng bước) |
| `list()` sau khi tạo a rồi b | `[b, a]` (chèn-đầu) | **giống** |
| Gieo lịch sử 3 header / 2 thư mục | 2 workspace · thứ tự `[beta, alpha]` · `puts` 2 | **giống** |
| Bốn lớp lỗi | `name` + `message` + `sessionId`/`activity`/`workspaceId` | **trùng từng ký tự** |
| `locale/{en,zh}.json` | `49d74290…` · `2fa925eb…` (sha256) | **khớp byte-for-byte** |
| Test | — | **18 test / 128 expect / 0 fail** |

**Lệnh tái lập:**

```bash
cd galaxy-blackhole/blackhole-tauri
~/.bun/bin/bun test tests/host/workspace.test.ts          # 18 pass / 0 fail
cd packages/host/workspace && ~/.bun/bin/bun run build.ts # lib/index.js 757 dòng
grep -c "id: @deepseek-ai" lib/index.js                   # 0
bun run check:rows                                        # 0 dòng "chan"
bun run gate --no-tests                                   # 7/7 XANH
```

**Phép kiểm tập export (đo trên ARTIFACT, không đọc báo cáo)** — cũng nằm trong test (ca 14), build lại
bản của ta vào thư mục tạm rồi trích `export { … }` + `export function|const|class` + `export default`:

```text
gốc : 12  WorkspaceActiveSessionError WorkspaceArchivedSessionPinError WorkspaceId WorkspaceMoveInvalidError
          WorkspaceOrderInvalidError WorkspaceRegistry WorkspaceUnknownSessionError default realpathNormalize
          workspaceDomainSpec workspaceDomainState workspaceRecord
ta   : 12  (CÙNG tập — THIẾU 0 · THỪA 0)
```

## 5. Phần CHƯA làm

- **Chưa khai `gbh.row`** (cố ý: người viết gói không tự khai — khai là tắt row stock của mọi người ở
  lượt boot kế tiếp). Test **canh** điều này (ca 0a) để không ai bật sớm mà không đổi test.
- **Chưa `lab:row`**, chưa mount 5439, chưa có `check:app` `(5)`/`(8)`/`(9)`/`(10)`/`(11)` và **chưa
  có bảng TRƯỚC/SAU trên app thật** — thuộc lượt boot của Lead.
- **Không ship `lib/types/*.d.ts`** (bản gốc có 640 dòng) — cùng quy ước với các gói host khác trong repo;
  hệ quả: gói **không** augment `Context`/`Events` của cordis (tránh TS2717 — lớp lỗi 000d), nên
  `ctx.workspaceRegistry` là **bề mặt lúc chạy**, không có kiểu toàn cục. Nếu sau này cần kiểu, phải
  ship `.d.ts` **kèm** `declare module` đúng gói sở hữu (không ambient toàn cục).
- **Không có ca test nào chạm mạng hay Git** — chủ ý: mọi ca dùng thư mục tạm `mkdtemp` và tự dọn.

## 6. Ghi chú kỹ thuật đã cắn thật (để người sau không vấp)

1. **`ctx.logger.exporter` LỌC theo ngưỡng** (`levels.default` mặc định **1** = chỉ `error`): hàng
   cảnh báo (`warn` = level 2) **BIẾN MẤT** nếu exporter không khai ngưỡng. Giàn test khai
   `levels: { default: 4 }` — trước đó ca "một dòng cảnh báo chẩn đoán" **xanh giả** (hai bên đều rỗng).
2. **`export { default } from "./registry.ts"` bị Bun NUỐT** khi module đích không có `default` ⇒ artifact
   thiếu `default` mà build vẫn "thành công". Cách đúng: `import` lớp rồi `export default <lớp>` — và
   **đo lại tập export trên artifact** (ca 14) mới thấy.
3. **macOS: `/var` là symlink của `/private/var`** ⇒ bản ghi gieo sẵn phải dùng `fs.realpath`, nếu không
   `sessionIds` rỗng một cách "hợp lệ" và test dễ kết luận sai.
4. **PHẢI nạp `zod/v4`, KHÔNG nạp `zod` trần.** Repo có một **ambient shim** `declare module "zod"` ở
   `packages/client/ui-sidebar-right/src/externals.d.ts` (khai đúng bề mặt mà một gói client dùng). Khi
   `tsc` đọc **CẢ chương trình**, shim đó **đè** kiểu thật ⇒ `ZodString.transform` và
   `ZodArray.default` **"không tồn tại"** (đo được: 5 vi phạm trong `src/spec.ts` chỉ ở lượt gate đầy
   đủ, còn typecheck RIÊNG gói thì 0). Đây là biến thể của **lớp lỗi 000d** — và cách chữa y hệt: đổi
   đường nạp (`zod/v4`, đúng quy ước 12 gói host khác), **không** thêm ambient mới.
