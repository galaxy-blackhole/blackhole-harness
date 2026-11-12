<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Review độc lập row ui-shortcuts (task-1) — đo trên artifact, KHÔNG đọc src để kết luận
-->

# Review độc lập — row `ui-shortcuts` (task-1)

- reviewer: **tm-reviewer** (KHÁC tác giả: dev/owner = tm-client-ui-a)
- ngày đo: 18/10/2026 · gói: `@galaxy-blackhole/gbh-client-ui-shortcuts` ← `@deepseek-ai/dsh-client-ui-shortcuts`
- artifact build tạm: `/tmp/rev/us/{index.js,client.js}` (build.ts nhận outDir qua argv[2])
- stock đối chiếu: `apps/host/node_modules/@deepseek-ai/dsh-client-ui-shortcuts/lib/client.js`

## A. Khuôn bundle (đo trên artifact)

| phép kiểm | đo được | kết luận |
|---|---|---|
| `grep -c 'id: "@deepseek-ai'` | **0** | ĐẠT |
| `grep -c 'id: "@galaxy-blackhole'` | **1** — `/tmp/rev/us/client.js:1223` `window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-client-ui-shortcuts", factory })` | ĐẠT (MỘT id, là id của ta) |
| `build.ts` đọc `process.argv[2]` | **1** chỗ | ĐẠT |
| cú pháp ESM trong bundle client | **0** dòng | ĐẠT |

## B. Tập SLOT (artifact ta vs bundle gốc)

| nguồn | slot |
|---|---|
| stock `lib/client.js` | `settings.general.item` · `shell.overlay` (2) |
| ta `client.js` | `settings.general.item` · `shell.overlay` (2) |

- thiếu: **0** · thừa: **0** ⇒ ĐẠT 2=2.
- Body `settings.general.item` khớp bản gốc: `id: "shortcuts"`, `order: 16`, `locale: "shortcuts"` (NS="shortcuts"), `store`, `inject` cùng hình dạng.
- Plugin inject runtime của ta: `["shortcuts","locale","slots"]` = `exports.inject` của stock.
- `dsh.client.inject` (manifest): 4 phần tử = **đúng** manifest stock.

## C. Cổng chống cài hai lần

| điều kiện | bằng chứng |
|---|---|
| cờ `let/var` phạm vi module | `var installed = false` — artifact dòng 1125 (trước `createPlugin`) |
| thoát sớm khi đã cài | `if (installed) return` — dòng 1128 |
| chỉ bật cờ SAU khi đăng ký xong | `try { applyInner(ctx); installed = true } ` — dòng 1130-1132 |
| catch KHÔNG bật cờ | catch chỉ `console.error(...)` rồi `throw` (dòng 1133-1135) |
| KHÔNG khoá theo `ctx` | đúng — cờ là biến module |
| ca test "lần đầu ném ⇒ cờ false ⇒ lần hai đăng ký lại đủ slot" | `tests/client/ui-shortcuts.test.ts:471` |

## C2. Hai luật hợp đồng

- **KEYED**: row **không có** slot kiểu keyed ⇒ không áp dụng. (0 slot keyed trong artifact.)
- **STORE**: `store = { ...handle, create: () => instance }` — cùng hình dạng bản gốc `createShortcutsStore()`; `inject()` trả đúng các trường `platform/runtime/edit/recording/describeBinding/hooks{catalog,config,fixedCatalog}` như stock ⇒ ĐẠT.

## C3/C4/C5. Đo trên trang thật / lab

| phép đo | TRƯỚC | SAU | kết luận |
|---|---|---|---|
| app `#root` (app-health (8)) | 67.167 ký tự (mức đã chấp nhận trước mount) | **67.167** · 0 lỗi console | ĐẠT — không nhỏ đi |
| lab accept-row (Lead) | — | #root **39.573** · 0 console · 0 did-not-activate · 0 overlay | ĐẠT (bằng chứng của Lead) |
| lab độc lập (reviewer) | — | lần 1 **BỎ QUA**: lab không boot được (319,7s) do tranh CPU/lock `/tmp/gbh-lab.lock` với batch của tm-evidence | CHƯA KẾT LUẬN — sẽ chạy lại sau batch |
| overlay-probe (C5) | — | lab: 0 overlay; app: 2 phần tử phủ nhưng **không** phải `VOzbGW_overlay`/`mask` | ĐẠT (không có modal bỏ mở) |

## D. Bằng chứng bắt buộc

| hạng mục | đo được |
|---|---|
| test | tôi tự chạy `bun test tests/client/ui-shortcuts.test.ts` ⇒ **13 pass · 0 fail · 165 expect** |
| check:rows | **0 dòng** cho `ui-shortcuts` (không chặn) |
| --dump-config (sau boot 21:00) | `- id: ui-shortcuts / name stock / disabled: true` + `- id: ui-shortcuts-ours / name @galaxy-blackhole/gbh-client-ui-shortcuts / aliases: @deepseek-ai/dsh-client-ui-shortcuts` ⇒ **MOUNT** |
| gate --no-tests | **ĐỎ 1/7** do 5 vi phạm KHÔNG thuộc row: `tests/host/pwsh-sandbox.test.ts:915` (test cũ, đỏ từ HEAD) + `tools/check/no-dsh-assets.ts:67-78` (file tm-assets đang viết). Vi phạm cũ `tests/client/ui-shortcuts.test.ts:359` đã hết ⇒ row sạch typecheck |
| gbh.row | khai đủ: id · moduleIds · aliases · tests |

## F. Ký

```
row: ui-shortcuts
reviewer: tm-reviewer (KHAC tac gia)
A khuon bundle : DAT  id goc=0 · id ta=1 · argv[2]=1 · ESM=0
B tap slot     : DAT  stock=2 ta=2 thieu=0 thua=0
C cong idem    : DAT  var installed=false · if(installed)return · try{applyInner;installed=true} · catch khong bat co · test dong 471
C2 keyed/store : DAT  khong co keyed slot · store {…handle,create} + inject giong stock
C3 #root       : DAT  67.167 = muc truoc mount (khong giam)
C4 lab         : DAT  (Lead accept-row 39.573/0/0/0) · do doc lap dang cho lock lab
C5 overlay     : DAT  0 overlay lab · app khong co VOzbGW_overlay/mask
D bang chung   : DAT  test 13 pass · check:rows 0 chan · dump MOUNT
ket luan       : KY (dieu kien: 1 lan do lab doc lap khi lock nha — neu fail lai se bao Lead)
```
