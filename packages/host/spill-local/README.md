<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README goi @galaxy-blackhole/gbh-spill-local — viet lai row spill-local cua DSH: nguon doi chieu,
      bon phep buoc 0, nam cau hoi, ly do peer, tap export, ma tran test, TRUOC/SAU va phan CHUA lam
-->

# `@galaxy-blackhole/gbh-spill-local` — tràn ngữ cảnh cục bộ

Row DSH được thay: `spill-local` → `@deepseek-ai/dsh-spill-local` (**~571 dòng** `lib/index.js` +
102 dòng `lib/types/index.d.ts` + `store.d.ts` + `cleanup.d.ts`).
Vai trò: **bản cài đặt bằng hệ tệp host của seam lưu tràn** `ctx.spillStore` — lưu văn bản quá khổ vào
một tệp **riêng theo phiên**, bảo đảm **không đọc được bởi người dùng cục bộ khác**, **không chuyển
hướng được bằng symlink cài sẵn**, rồi trả **locator đường dẫn + câu hướng dẫn đọc lại** cho model.

## 1. Nguồn đối chiếu (G4) — đọc bản gốc CHỈ ĐỌC rồi VIẾT LẠI, không chép code

| Bản gốc (chỉ đọc) | Bản của ta | Vai trò |
|---|---|---|
| `apps/host/node_modules/@deepseek-ai/dsh-spill-local/lib/index.js` (571 dòng) | `src/index.ts` | plugin: `LocalSpillStore extends SpillStore`, schema `Config`, lượt dọn lúc kích hoạt |
| `…/lib/types/store.d.ts` | `src/store.ts` | khử đường dẫn leo thang (`encodeSegment`), thư mục phiên (`sessionDir`), ghi độc quyền 0600 |
| `…/lib/types/cleanup.d.ts` | `src/cleanup.ts` | quét gốc, xoá tệp quá hạn, tỉa thư mục rỗng, dò gốc `dsh-spill-*` cũ |
| `…/locale/en.json` · `locale/zh.json` | `locale/en.json` · `locale/zh.json` | **byte-for-byte** (luật 000e; sha khớp bản gốc) |
| `@deepseek-ai/dsh-spill` (seam, KHÔNG viết lại) | — | `SpillStore` · `SpillLocator` · `SaveTextSpill` · `SpillRef` |

Bản gốc chia **ba vùng `//#region`** (`store` · `cleanup` · `index`); ta giữ **đúng ba module** đó để
mỗi tệp ngắn và mỗi hành vi có chỗ đối chiếu riêng.

## 2. Bốn phép BƯỚC 0 (đo lại trong test, không tin báo cáo)

| # | Phép | Kết quả |
|---|---|---|
| (i) | cặp `- id: spill-local` + `name: '@deepseek-ai/dsh-spill-local'` trong `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **CÓ THẬT** (dòng 394–395) |
| (ii) | `dsh.client` trong `package.json` GỐC · `lib/client.js` | **KHÔNG** · **KHÔNG tồn tại** ⇒ **MỘT MẶT** |
| (iii) | `disabled:` | **KHÔNG** (cũng không có `!!js` điều kiện) ⇒ row đang BẬT |
| (iv) | `config:` · `inject:` | **KHÔNG có cả hai** ⇒ không có `ctx.<X>` nào cần inject tương ứng |

Ba phép (ii)(iii) đã thành ca test (đo lại mỗi lượt `bun test`), để người sau không phải tin báo cáo.

## 3. Năm câu hỏi

| # | Câu hỏi | Trả lời đo được |
|---|---|---|
| 1 | Row có đang BẬT không? | **BẬT** — không `disabled` trong `ours.yml` (mọi profile: `stock` · `oracleA` · `oracleA_nopatch` · `ours`) |
| 2 | Thuần host hay có mount surface client? | **Thuần host** — `dsh.client` = `false`, `lib/client.js` không tồn tại, 0 lời gọi `__ModuleLoader__` |
| 3 | Cần seam nào? | `@deepseek-ai/cordis` (kernel: `Service`/`Context.effect`) · `@deepseek-ai/schemastery` (schema `Config`) · **`@deepseek-ai/dsh-spill`** (lớp cha `SpillStore`) · `node:` builtins |
| 4 | Hành vi đo được là gì? | (a) **một tệp được ghi** dưới `<root>/session-<12hex>/<12hex>-<tên mã hoá>`, quyền **0600**, thư mục **0700**; (b) **locator + bytes + hint** trả về; (c) **lượt dọn** xoá tệp `mtime` cũ hơn `cleanupPeriodDays` và tỉa gốc `dsh-spill-*` rỗng; (d) **dòng cảnh báo** `spill-local: …` qua logger khi gặp gốc không an toàn |
| 5 | Package gốc có `dsh.client` không? | **KHÔNG** ⇒ không có nửa client ⇒ thay bằng disable+insert **không** làm mất entry nào |

## 4. Vì sao peer nào — và peer nào NGOÀI bảng §3b

| peer | Bậc trong §3b | Lý do ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | **Bậc 1** (kernel) | `Service`/`Context.effect` — phải là **cùng lớp** của kernel; một bản sao `Service` làm cơ chế `ctx.reflect.provide`/`fiber` không nhận ra |
| `@deepseek-ai/schemastery` | **Bậc 1** | `static Config = z.object(…)` — schema là **hợp đồng dữ liệu** của row |
| `@deepseek-ai/dsh-spill` | **NGOÀI bảng** (§3b Bậc 2 chưa liệt kê; `docs/PARITY-MATRIX.md` dòng 77 ghi `cordis, dsh-spill`) | Row này **kế thừa** `SpillStore` — lớp cha **tự đăng ký** service tên `spillStore`. Cài lại lớp đó là tạo **thể hiện thứ hai** ⇒ `service "spillStore" has been registered` ngay khi row khác cũng nạp một backend; và `ctx.spillStore` của người tiêu thụ (`spill-policy`) phải là **cùng một kiểu**. Đo: `Object.getPrototypeOf(Object.getPrototypeOf(LocalSpillStore)).name === "Service"` cho **cả hai bên**. ⇒ **CẦN LEAD XÁC NHẬN** (tiền lệ `bash-sandbox` → `dsh-bash-local` ở §2b) |

Quy ước **`gbh.peers` ⊆ `peerDependencies`** (so **PHẦN TỬ**, không so số lượng): **3/3 đạt**, có **ba đối
chứng âm** trong test (bỏ một peer ⇒ báo đúng tên đó · thêm tên ma vào `peers` ⇒ báo đúng tên ma · thêm
tên vào chỉ `peerDependencies` ⇒ không báo gì), cộng một ca chứng minh **phép so số lượng cho verdict
rỗng**. Peer **không** nằm trong `dependencies` (một thể hiện do kernel cấp).

## 5. Tập export — đo trên **ARTIFACT của CẢ HAI bên**, so **PHẦN TỬ**

```
gốc  : apps/host/node_modules/@deepseek-ai/dsh-spill-local/lib/index.js   (10 tên)
ta   : packages/host/spill-local/lib/index.js                              (10 tên)
THIẾU = 0 · THỪA = 0
```

`DEFAULT_ROOT_PREFIX` · `LocalSpillStore` · `default` · `discoverDefaultRoots` · `encodeSegment` ·
`isErrno` · `privateRoot` · `saveTextFile` · `sessionDir` · `sweepSpillRoots`
(và `default === LocalSpillStore` ở **cả hai** bên — Loader nạp class plugin qua `default`).

Kiểu chỉ-tồn-tại-lúc-biên-dịch (không vào artifact): `Config` · `SavedText` · `SaveTextOptions` ·
`SweepOptions` · `SweepRoot` · `WarnFn` — **đủ như `lib/types/*.d.ts` của gốc**.

## 6. Ma trận test — 15 ca / 100 expect (`tests/host/spill-local.test.ts`)

| Nhóm | Ca |
|---|---|
| BƯỚC 0 (2) | cặp id+name trong dump mới nhất · không `disabled`/`config`/`inject` · gói gốc không `dsh.client`/`lib/client.js` |
| ARTIFACT (1) | **tập export 10 = 10 so phần tử**, `default` là chính lớp, tên gói lấy **từ dump** |
| Hành vi A/B (6) | `encodeSegment`/`sessionDir`/`isErrno`/`prefix` (bảng 15 + 6 đầu vào) · `saveTextFile` (**tên mã hoá** `../../etc/passwd` ⇒ một đoạn, **0600/0700**, byte UTF-8) · **đường lỗi `ENOTDIR`** không treo · `sweepSpillRoots` (**cây còn lại từng phần tử** + cảnh báo + tỉa gốc) · `discoverDefaultRoots` (chỉ đúng hình dạng `mkdtemp` 6 ký tự) · `Config` (mặc định 30 + **3 ca sai cùng thông điệp**) |
| Service thật (3) | `ctx.spillStore.saveText` trên **Context cordis THẬT** (bytes/hint/locator) · đăng ký lần hai **cùng thông điệp** · lượt dọn lúc kích hoạt + `cleanupPeriodDays: 0` · **lượt gỡ fiber CHỜ lượt dọn lắng** |
| C6 (1) | **danh tính** `not.toBe`: `a.config` ≠ `b.config`, sửa một không lan sang cái kia, hai gốc độc lập; vật thể mặc định của schema cũng độc lập |
| Peer (1) | `gbh.peers ⊆ peerDependencies` **so phần tử** + **3 đối chứng âm** |
| 000e (1) | `locale/{en,zh}.json` **byte-for-byte** + `exports["./locale/*.json"]` |

⚠️ **Ca bất đồng bộ dùng `waitFor` CÓ TRẦN** (10 ms/lượt, trần 5.000 ms; ca "gỡ chờ lắng" có trần riêng
150 ms cho vế *chưa được lắng*). Không ca nào `sleep` mù — bài học 18/10/2026: `sleep` cố định là
nguồn flaky.

### Lệnh tái lập

```bash
cd <repo>
bun run packages/host/spill-local/build.ts
grep -c 'id: @deepseek-ai' packages/host/spill-local/lib/index.js   # phải = 0
bun test tests/host/spill-local.test.ts                            # 15 pass · 0 fail
bun run check:rows | grep spill-local                               # KHÔNG dòng nào = 0 chan (export 10 = 10)
bun run gate --no-tests                                             # 7/7 XANH
```

## 7. TRƯỚC / SAU

**Trạng thái khai/mount (đo lại 18/10 11:07, không suy đoán)**: `gbh.row` **do LEAD khai** — commit
`34702d4` (18/10 10:51:49), `id: "spill-local"`, **KHÔNG `config`**, **KHÔNG `inject`** (đúng `ours.yml`
dòng 394–395). `profiles/blackhole/app.patch.yml` có **cặp disable+insert** (`- id: spill-local` +
`disabled: true` / `- id: spill-local-ours` → `@galaxy-blackhole/gbh-spill-local`) và **profile đã có gói**:
`~/.galaxy/blackhole/profiles/node_modules/@galaxy-blackhole/gbh-spill-local/lib/index.js` (**11.081 B**,
10:49) khác bản build trong repo **chỉ ở dòng chú thích đường dẫn nguồn** (`// src/index.ts` vs
`// packages/host/spill-local/src/index.ts`) — **thân mã y hệt**. Vì vậy **mã đang phục vụ là mã này**.

⚠️ **Nhưng TRƯỚC/SAU trên app 5439 vẫn CHƯA đo trong lượt của tôi** (lượt boot thuộc Lead). Ghi đúng sự
thật thay vì điền số ước lượng:

| Phép đo | TRƯỚC (row stock) | SAU | Trạng thái |
|---|---|---|---|
| `ctx.spillStore.saveText` | tệp `<root>/session-<12hex>/<12hex>-<tên>`, 0600/0700 | **y hệt** (đo trong test A/B) | ✅ đo trong lab-test |
| dọn tệp quá hạn lúc kích hoạt | xoá tệp cũ hơn 30 ngày, tỉa gốc rỗng | **y hệt** (A/B) | ✅ đo trong lab-test |
| `did not activate` trên app 5439 | — | — | ⬜ **chờ lượt boot của Lead** |
| `(6)` gói CỦA TA đang chạy | — | — | ⬜ **chờ lượt boot của Lead** |

Lệnh đo khi tới lượt boot (dùng `lab:row`, KHÔNG tự boot 5439):

```bash
bun run lab:row spill-local     # cần gbh.row — Lead khai trước
bun run check:app               # (5) did not activate = 0 · (6) +1 tên của ta · (8) #root không đổi
```

## 8. Phần CHƯA làm (nói thẳng)

1. **Tôi KHÔNG tự khai `gbh.row`** — và **không cần khai nữa**: Lead đã khai (commit `34702d4`,
   18/10 10:51:49) với đúng metadata đo được (`id: "spill-local"`, không `config`, không `inject`,
   `tests: ["tests/host/spill-local.test.ts"]`), và `app.patch.yml` có cặp disable+insert.
2. **Chưa có TRƯỚC/SAU trên app 5439** (mục 7): profile đã có artifact của gói, nhưng **phép đo
   `check:app` (`(5)` `did not activate` · `(6)` tên của ta · `(8)` `#root`) thuộc lượt boot của Lead**
   — tôi **không boot 5439**.
3. **Chưa có `lib/types/*.d.ts`** như bản gốc: `build.ts` chỉ build JS (giống 7 gói host đang chạy);
   kiểu vẫn đầy đủ trong `src/` và được kiểm bằng `typecheck`.
4. **Hai nhánh chỉ chạy trên POSIX** (kiểm quyền chủ sở hữu + tổ tiên dính) được viết **trung thành**
   nhưng trên Windows nhánh đó trả `true` sớm — **chưa đo trên Windows**.
