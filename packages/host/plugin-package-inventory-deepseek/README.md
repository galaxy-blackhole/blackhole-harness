<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-plugin-package-inventory-deepseek — bảng nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU
-->

# @galaxy-blackhole/gbh-plugin-package-inventory-deepseek

Bản viết lại của Galaxy Blackhole cho row **`plugin-package-inventory-deepseek`** của DSH
(`@deepseek-ai/dsh-plugin-package-inventory-deepseek`, **154 dòng** `lib/index.js`, **MỘT MẶT** —
`lib/client.js` **KHÔNG tồn tại**, `dsh.client` **không có**; đọc từ `apps/host/node_modules/…` — CHỈ ĐỌC).

**Vai trò**: kiểm kê các **gói plugin ĐANG hoạt động** để gửi kèm request tới API DeepSeek chính thức.
Nó đăng ký **một trường mở rộng** trên sổ `deepseekLlmApiExtensions`:

```json
// tên trường: dsh_plugin_packages   (nguyên văn)
{ "version": 1, "packages": [ { "name": "@scope/a", "version": "1.2.3" }, { "name": "@scope/b" } ] }
```

Danh tính gói được phân giải **LÚC REQUEST**, không phải lúc nạp: entry của cây Loader (chỉ entry
**ACTIVE**, không phải entry nhóm, không bị tắt) + module trong **bố cục preset** của agent đang gọi.
Khử trùng theo `(name, version)` rồi sắp xếp **TẤT ĐỊNH theo mã ký tự** (không `localeCompare`) —
nên thứ tự trên dây không phụ thuộc dữ liệu ICU/locale của máy chạy.

> ✅ **ĐÃ mount** (lượt boot 5 row của Lead, 18/10/2026): `gbh.row = { id: "plugin-package-inventory-deepseek",
> tests: [...] }` — **không có `config`** vì row gốc cũng không có config (luật *chép config từ oracle*:
> chỉ chép khi gốc CÓ). Profile đang phục vụ thật
> `profiles/node_modules/@galaxy-blackhole/gbh-plugin-package-inventory-deepseek/lib/index.js` (5.763 B),
> và `check:rows` nay kiểm luôn gói này (**85 package · 0 chặn**).
>
> Trước lượt khai đó gói có **TEST CANH** "KHÔNG có `gbh.row`"; test ấy đã được **gỡ** đúng như
> `HOST-ROW-REWRITE.md` §7 dặn (khai xong thì xoá hoặc đảo khẳng định).

## 1. Bảng nguồn đối chiếu (G4)

| Phần của bản gốc | Nguồn đã đọc (chỉ đọc) | Bản của ta | Cách đối chiếu |
|---|---|---|---|
| `barePackageName` | `lib/index.js` dòng 24–29 | `src/identity.ts` | cùng chuỗi specifier ⇒ cùng tên gói (gói trần · `@scope/ten/sub` · `./x` · `node:fs` · `cordis:x` · đường dẫn tuyệt đối) |
| `identityFromManifest` | `lib/index.js` dòng 30–38 | `src/identity.ts` | manifest thật trên đĩa: `name` rỗng ⇒ **không danh tính** · `version` toàn khoảng trắng ⇒ **bỏ version** · đọc CẢ HAI bên |
| `barePackageManifest` | `lib/index.js` dòng 39–50 | `src/identity.ts` | hai nhánh: **có** seam `pluginPackages` (chỉ `packageOf`, KHÔNG rơi về `createRequire`) vs **không** seam (dò `node_modules` bằng `createRequire(anchor).resolve.paths`) — ca B5 |
| `nearestManifest` | `lib/index.js` dòng 51–61 | `src/identity.ts` | module TƯƠNG ĐỐI `./plugins/one/lib/index.js` ⇒ danh tính `local-one@9.9.9` |
| `PackageIdentityResolver` (cache) | `lib/index.js` dòng 62–96 | `src/identity.ts` | cùng entry ⇒ cùng **vật thể** danh tính; hai lần cài ⇒ vật thể **khác** (ca C6/D1) |
| `activeEntries` (bộ lọc) | `lib/index.js` dòng 97–103 | `src/inventory.ts` | 13 entry: nhóm · `disabled` · fiber 1/3 bị loại, fiber 2 giữ — so TỪNG PHẦN TỬ với bản gốc (ca B1) |
| `compareWireText` | `lib/index.js` dòng 104–107 | `src/inventory.ts` | `Zed` < `alpha` theo mã ký tự — chứng minh **không** phải `localeCompare` (ca B2) |
| `collectActivePluginPackages` | `lib/index.js` dòng 108–135 | `src/inventory.ts` | bố cục preset (`useHostBase` ⇒ neo ở base URL HOST) · khử trùng · cảnh báo-một-lần · sắp xếp — ca B3/B4/C1/C3 |
| `apply` + `Config` | `lib/index.js` dòng 136–152 + `lib/types/index.d.ts` | `src/index.ts` | `enabled: false` ⇒ **0 lượt đăng ký**; `String(Config)` = `{ enabled?: boolean }`; `Config({})` = `{ enabled: true }` (ca C2/E5) |
| tập export lúc chạy | `export { Config, apply, inject, name }` | `lib/index.js` | **đo trên ARTIFACT**: tập tên export bằng **đúng** tập gốc, không `default` (ca A1) |
| hành vi cảnh báo | `lib/index.js` dòng 124–128 | `src/inventory.ts` | câu cảnh báo **nguyên văn** `…omitting unreadable package identity for %s: %o`; **một lần** cho mỗi tên trong một lần cài (ca C1/D2) |
| `locale/{en,zh}.json` | `locale/*.json` | `locale/*.json` | chép **byte-for-byte** (`Buffer.equals`), kèm `exports["./locale/*.json"]` (ca E4) |

## 2. Peer — vì sao, và thuộc seam nào

| Peer | Vì sao thuộc seam | Ghi chú |
|---|---|---|
| `@deepseek-ai/schemastery` | schema `Config` để Settings/config-editor render được field | **bảng §3b Bậc 1**. Dùng ĐÚNG như bản gốc: `z.object({ enabled: z.boolean().default(true) })` |
| `@deepseek-ai/cordis` | vòng đời plugin + `ctx.get` · `ctx.logger` | **bảng §3b Bậc 1**. Ta **không import** gói này: context khai theo **CẤU TRÚC** (`PluginPackageInventoryContext`), đúng khuôn `llm-retry`/`directory-picker-auto` — tránh khai báo ambient `Events` toàn cục (luật 000d) |

### Hai seam NGOÀI bảng §3b mà bản gốc import — ta KHÔNG khai peer

| Gói gốc | Bản gốc dùng để làm gì | Cách của ta (đo được) |
|---|---|---|
| `@deepseek-ai/dsh-brand` | `brandString(sessionId)` | Hàm của gói đó là **hàm đồng nhất** (`lib/index.js`: `function brandString(value) { return value }`) ⇒ `src/brand.ts` khai bản địa phương, **cùng một byte trên dây**, không cần thêm peer. Khai một peer ngoài bảng chỉ để gọi `return value` là tạo **thể hiện thứ hai vô ích** |
| `@deepseek-ai/dsh-deepseek-llm-api-extensions` (+ `dsh-agent` · `dsh-session` · `dsh-agent-preset-registry`) | kiểu của service/tham số | Chỉ **mượn KIỂU** (`deepseekLlmApiExtensions.register` · `agents.get` · `presets.inspectCompositions` · `pluginPackages.packageOf`) ⇒ khai lại theo **CẤU TRÚC** trong `src/types.ts`; lúc chạy kernel cấp service qua context, không import gói nào |

`gbh.peers ⊆ peerDependencies` **0 tên lệch** (so **PHẦN TỬ**, không so số lượng — `M6-MOUNT-PLAN.md` §1d),
có **ĐỐI CHỨNG ÂM** ba dạng (xoá một tên · xoá sạch · lệch phần tử cùng số lượng) — ca E1/E2.

## 3. Bảng TRƯỚC/SAU

Row nằm trong cửa sổ mount của Lead ⇒ gói này **chưa mount**, nên TRƯỚC/SAU trên app 5439 **chưa đo được**
ở đây (và **không được tự boot**). Phép đo đã chạy là **A/B trên ARTIFACT của ta + bundle gốc trong CÙNG một
giàn giả**, tức đúng lớp bằng chứng mà mục 4 của `HOST-ROW-REWRITE.md` đòi, chỉ khác môi trường.

| Chỉ số | TRƯỚC (gói stock) | SAU (gói của ta) | Diễn giải |
|---|---|---|---|
| vật thể dây `dsh_plugin_packages` (13 entry, ca B1) | `{version:1, packages:[5 mục]}` | **y hệt** | lọc · khử trùng · sắp xếp khớp từng byte |
| cảnh báo khi gói không phân giải được (ca C1) | 1 cảnh báo / tên / lần cài | **y hệt** | câu cảnh báo + tham số `%s`/`%o` trùng |
| `enabled: false` (ca C2) | 0 lượt `register` | **0** | tắt hẳn, không đăng ký trường |
| tập export trên ARTIFACT (ca A1) | `Config · apply · inject · name` | **y hệt** | 0 thiếu · 0 thừa · không `default` |
| `grep -c 'id: @deepseek-ai' lib/index.js` | — | **0** | row HOST-ONLY: không đăng ký id module nào |

Khi Lead mount, phép đo TRƯỚC/SAU phải làm trên **dây thật** (thân request tới API DeepSeek) và trên
`check:app`: `(5)` `did not activate` **không tăng**, `(6)` tên gói của ta **có trong trang**, `(8)` `#root` **không đổi**
(row host không được làm `#root` đổi — `M6-MOUNT-PLAN.md` §4).

## 4. Khác hình dạng CÓ Ý (và vì sao)

| Khác | Lý do |
|---|---|
| Không ship subpath `./types` (bản gốc có) | Bản gốc dùng nó cho **augmentation kiểu** (`declare module '@deepseek-ai/dsh-deepseek-llm-api-extensions/types'`). Không consumer **lúc chạy** nào import nó (đã grep `apps/`, `packages/`), và kiểu đã khai lại theo cấu trúc trong `src/types.ts` ⇒ ship `lib/types` chỉ thêm một artifact phải đồng bộ |
| `createRequire(anchor).resolve.paths(name) ?? []` | Bản gốc lặp thẳng trên giá trị có thể `null` (⇒ `TypeError`). Cả hai đường rơi vào **cùng một nhánh** (không đọc được ⇒ cảnh báo một lần ⇒ bỏ entry) nên **dây không đổi**; khác duy nhất là **loại** lỗi trong tham số `%o` |
| `brandString` khai tại chỗ | Xem §2: gói gốc là **hàm đồng nhất**, ngoài bảng §3b |

## 5. Phần CHƯA làm

- **TRƯỚC/SAU trên app 5439 vẫn CHƯA đo** (row đã mount và `(5)` `did not activate` = **0**, nhưng
  `check:app` hiện đỏ ở `(9)` bố cục 75/80 — do **row client** thanh bên, KHÔNG phải row host này).
- **Chưa chạy `lab:row`** — lab đòi quyền boot cổng riêng; theo luật của repo, việc boot thuộc Lead.
- Chưa đo **dây thật** tới API DeepSeek (cần credential + lượt gọi thật; ngoài phạm vi một row).
- Lớp **A/B pixel / phần tử lạ** KHÔNG áp dụng: row host, không có artifact client.

## 6. Tái lập

```bash
cd packages/host/plugin-package-inventory-deepseek && bun run build.ts    # lib/index.js (ESM, peer external)
cd ../.. && bun test tests/host/plugin-package-inventory-deepseek.test.ts  # 16 test · 0 fail · 88 expect
grep -c 'id: @deepseek-ai' packages/host/plugin-package-inventory-deepseek/lib/index.js  # 0
```

`locale/{en,zh}.json` chép **byte-for-byte** từ bản gốc (luật 000e): `en.json` chỉ có `meta.title`
= `plugin-package-inventory-deepseek`; `zh.json` = `DeepSeek 插件清单上报` + `meta.description`.
