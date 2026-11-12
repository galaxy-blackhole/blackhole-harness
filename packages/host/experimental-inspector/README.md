<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port row experimental-inspector: de-bundle host 2.599 + client 3.571 + page 313 + worker 7.293 + devtools
      (cổng byte), dsh.client khớp tuyệt đối, deps ngoài trong gbh.peers, captureFetch fail-soft + đường lùi
-->

# @galaxy-blackhole/gbh-experimental-inspector — row `experimental-inspector`

Port 1:1 @deepseek-ai/dsh-experimental-inspector (**13.776+ dòng**, phần lớn là bundle/asset):
`lib/index.js` 2.599 · `lib/client.js` 3.571 · `lib/client.page.js` 313 · `lib/worker.js` 7.293 · `lib/devtools/`.
Không có nguồn typed (`lib/types/*.js` = 0) ⇒ **de-bundle nguyên văn + CỔNG BYTE** (không port typed).

## ⚠️ TÁC ĐỘNG KHI MOUNT (đọc trước)
Row bật **server inspector** và `captureFetch: true` ⇒ khi mount, **MỌI `fetch` của app đi qua capture của ta**.
Nếu capture **treo** ⇒ request **treo** ⇒ ảnh hưởng cả app. Vì vậy các test BẮT BUỘC:
1. **capture trả về NGAY khi không có subscriber** (không được chờ/treo) — so A stock vs B ta.
2. **`captureFetch:false` KHÔNG cài gì** vào `globalThis.fetch` (so trước/sau khi mount).
3. **Fail-soft khi server không mở được** — định nghĩa Lead đã chốt, đúng hành vi stock:
   (a) **ctx/app SỐNG** (row khác vẫn boot), (b) **có log chẩn đoán** (stock dùng `logger.error` — ta giữ nguyên mức log để parity),
   (c) **B không tệ hơn A**: message của A **≡** B từng ký tự. `fiber.await()` reject khi không mở được port là **hành vi stock** ⇒ giữ 1:1,
   **KHÔNG nuốt lỗi** (nuốt lỗi = lệch parity + che sự cố).

1. Row giữ **PARKED** (`gbh.row_unmounted_ly_do`, config `captureFetch: true`) tới khi đủ: test A/B xanh (gồm 3 ca trên), Lead boot-smoke **home CÁCH LY** ĐẠT, dòng `packages/README.md` §4, và boot thật khi đội **RẢNH**.
2. **KHÔNG** `lab:row`/boot thật khi chưa có các điều trên.

## 🚨 ĐƯỜNG LÙI TỨC THỜI (≤2 phút)
```bash
# packages/host/experimental-inspector/package.json: chuyển gbh.row → gbh.row_unmounted_ly_do (giữ id/tests/config)
cd <repo> && bun run apps/cli/src/main.ts host --dump-config    # BẮT BUỘC: patch regen, row stock bật lại
scripts/restart-host.sh                                          # boot lại, app về row stock
```
Chỉ sửa package.json mà KHÔNG `--dump-config` ⇒ overlay insert-only ⇒ **trùng service `inspector`**.

## Ba yêu cầu bắt buộc của Lead
1. **`dsh.client` khớp TUYỆT ĐỐI bản gốc**: `{ client: { inject: [], platform: 'web', immediately: true } }` — thiếu/sai ⇒ nửa client không vào bảng web (bài học `api-session-controller`: 58 entry pending, #root 6.402). Artifact `lib/client.js` phải đăng ký **module id của ta** (`__ModuleLoader__.load`).
2. **Deps ngoài trong `gbh.peers`**: `open`, `serve-static`, `ws` (+ kernel `dsh-app-boot`, `dsh-util-crypto`, `schemastery`, `cordis`) — mount chỉ symlink PEER về kernel; test phải chứng minh `require.resolve` 3 gói này từ **profile THẬT**.
3. **Capture fail-soft**: test có ca `captureFetch:false` (không cài capture) và ca server không mở được (bind lỗi) ⇒ `apply` KHÔNG làm chết app.

## Cấu trúc port
| Hạng mục | Cách làm |
|---|---|
| Host `lib/index.js` | de-bundle **5 lát** nguyên văn (src/parts-host) → ghép → **cổng byte delta 0** |
| Client `lib/client.js` | de-bundle **4 lát** (src/parts-client) → ghép → thay id module → **cổng byte** vs `stock.replaceAll(id)` |
| `lib/client.page.js` | 1 lát nguyên văn + **đổi 3 id module** (chunk cùng module — luật MỘT-ID) → **11.056 B** (+15) · delta 0 vs `stock.replaceAll(id)` |
| `lib/worker.js` + `lib/devtools/` | copy nguyên văn, byte-identical · **Bun.build THẬT** cho nửa client (`client-entry.js` + `client-entry.iife.js`, target browser, packages external) để qua cổng `>= 2 Bun.build` |
| Service | `inspector` — **provider duy nhất** trong repo (0 gói GBH khác cấp) |
| Trùng với runner/gateway | `cordis-host-runner` cấp `dynamicCordisRunner`/`cordisInspect` (KHÁC tên, không ghi đè); inspector **không có typert ownership** |
| Event | inspector **không `ctx.emit`** (emit duy nhất là messaging worker nội bộ) |

## Số đo TRƯỚC → SAU

| Phép đo | TRƯỚC | SAU |
|---|---|---|
| de-bundle host | 0 | 5 lát → `lib/index.js` **95.230 B · delta 0** |
| de-bundle client | 0 | 4 lát + page → `lib/client.js` **134.156 B** (delta 0 sau **2** id thay) · `client.page.js` **11.041 B** delta 0 |
| asset | 0 | `worker.js` **266.680 B** + `devtools/` **769 tệp / 22.913.083 B** — delta 0 |
| `dsh.client` | — | khớp tuyệt đối stock |
| bề mặt export | — | 6 tên khớp stock (Config/apply/inject/name/resolveInspectorOptions/startInspector) |
| test A/B | 0 ca | **51 ca · 0 fail**: host 14 · codec 25 · faces 7 · collision 5 |
| gate lint | — | header/file-length/jsdoc/dep-guard XANH |
| check:rows | — | xem báo cáo Lead |

## Test A/B (theo yêu cầu)
- `tests/host/experimental-inspector.test.ts` — host A/B **14 ca** trên Context cordis THẬT, KHÔNG gọi mạng ngoài; gồm `captureFetch:false` + fail-soft khi server không mở được.
- `tests/host/experimental-inspector-codec.test.ts` — codec/bridge A/B **25 ca** (hàm thuần).
- `tests/host/experimental-inspector-faces.test.ts` (**7 ca**) — cổng byte host/client/page, `grep` id stock trong `lib/client.js` = 0, `dsh.client` khớp tuyệt đối, worker/devtools byte-identical.
- `tests/host/experimental-inspector-collision.test.ts` (**4 ca**) — 1 provider `inspector`; `dynamicCordisRunner`/`cordisInspect` của runner còn nguyên; 0 event trùng; `require.resolve` `open`/`serve-static`/`ws` từ profile THẬT.

## ⚠️ BẮT BUỘC KHI FLIP: `hostAliases`
`lib/index.js:2414` self-resolve `import.meta.resolve("@deepseek-ai/dsh-experimental-inspector/package.json")` để phục vụ asset
`devtools/`. Khi mount, package của ta nằm ở `profile/node_modules/@galaxy-blackhole/gbh-experimental-inspector`, nên nếu KHÔNG có alias
stock → gói ta thì resolve này **NÉM** (đo được khi stage không alias). Vì vậy row khai
`hostAliases: ['@deepseek-ai/dsh-experimental-inspector']` để lượt alias TOÀN CỤC của `mount.ts` tạo symlink trước khi boot.

## Nợ kỹ thuật
- Lát giữ `// @ts-nocheck` (precedent api-terminal-controller / session-persistence) vì là asset nguyên văn, không viết lại.
- `worker.js` + `devtools/` là asset upstream, copy nguyên văn — không sửa tay.
- Row chưa flip: chờ boot-smoke + README §4 + đội rảnh.

## SAI LỆCH CÓ CHỦ ĐÍCH (task-152 · HANDOVER §8)

Stock ném `Error: inspector: Host source is closed` trong `HostBridgePublisher.setState` khi Worker đã chết
(`read ECONNRESET`) ⇒ **fatal uncaught exception ⇒ host exit** (đã làm chết host 1 lần, app phải restart).
Bản ta thay bằng **fail-soft**: cảnh báo `console.warn` **ĐÚNG MỘT LẦN** (field `closedLogged`) rồi `return`,
KHÔNG ném — để host sống và các row khác tiếp tục.

- Cổng byte vẫn canh **từng byte** với stock: `build.ts` có `normalizeHostDeviation` đảo ngược sai lệch
  (bỏ 2 dòng field `closedLogged`, thay khối fail-soft bằng dòng throw gốc) và **NÉM nếu mỗi sai lệch
  xuất hiện ≠ 1 lần**; `applyHostDeviation` áp lại sai lệch lên bản đã khớp để artefact THẬT SỰ chứa fail-soft.
- Artefact: **95.762 B** (stock 95.230 B, +532 B đúng khối sai lệch); `normalizeHostDeviation(lib/index.js) === stock`.
- Test: `tests/host/experimental-inspector-failsafe.test.ts` (4 ca) + 2 tệp A/B cũ.
- Rollback: khôi phục dòng throw gốc trong `src/parts-host/part-02.ts` + xoá `DEVIATION_*/FIELD_*/normalize/apply`
  trong `build.ts`, rồi `bun run build.ts` ⇒ artefact về đúng stock.
