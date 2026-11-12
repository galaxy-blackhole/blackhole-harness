<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-timer — bảng nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU
-->

# @galaxy-blackhole/gbh-timer

Bản viết lại của Galaxy Blackhole cho row **`timer`** của DSH
(`@deepseek-ai/cordis-plugin-timer` 1.1.7 — bundle MỘT FILE **152 dòng** `lib/index.js`, đọc từ
`apps/host/node_modules/@deepseek-ai/cordis-plugin-timer/` — CHỈ ĐỌC).

**Vai trò**: dịch vụ hẹn giờ **sống theo fiber** của cordis. Row rất nhỏ nhưng là **hạ tầng** — nó
trộn sáu phương thức vào chính `ctx` nên mọi plugin khác gọi `ctx.timeout()`/`ctx.interval()`/
`ctx.debounce()` qua nó.

> **MỘT MẶT**: gói gốc **KHÔNG có** `lib/client.js` và **KHÔNG** khai `dsh.client`
> (đo lại 18/10/2026: `lib/` chỉ có `index.js` + `types/`). Row này **không vẽ gì lên màn hình**.

> **18/10/2026 — Lead ĐÃ khai `gbh.row`** (commit `80214e4`, sau khi tự kiểm ba phép tiền-mount:
> `row:cost` 152 dòng · tập export 2 = 2 · `gbh.peers` 2/2). Người viết gói **không** tự khai.
> Ca test canh cũ (khẳng định **chưa** khai) đã đổi thành khẳng định **đúng hình dạng row đã khai**
> (xem §5) — đổi id hoặc bỏ `tests` là đỏ ngay.

## 1. Bảng nguồn đối chiếu (G4)

| Phần của bản gốc | Nguồn đã đọc (chỉ đọc) | Bản của ta | Cách đối chiếu |
|---|---|---|---|
| `class TimerService extends Service` | `lib/index.js` dòng 3–15 · `src/index.ts` dòng 12–16 | `src/index.ts` | 23 ca test; **16 ca chạy CẢ HAI bản cài** trên cùng một context giả rồi so từng số đo |
| `ctx.mixin("timer", [...])` | `lib/index.js` dòng 7–14 | `MIXED_IN_METHODS` + constructor | ca "tên dịch vụ + danh sách phương thức" so **TỪNG PHẦN TỬ và ĐÚNG THỨ TỰ** |
| nhãn effect `ctx.timeout()/interval()/throttle()/debounce()` | `lib/index.js` dòng 34 · 54 · 74 · 122 · 137 · 147 | bốn hằng `LABEL_*` | ca "sáu nhãn khớp gốc từng chữ" (chuỗi này hiện trong `getEffects()` và log kernel) |
| `timeout(callback, delay)` | `lib/index.js` dòng 24–47 | `timeout` nhánh 1 | chạy đúng MỘT lần · hàm huỷ trước hạn ⇒ **0 lần** |
| `timeout(delay)` → promise | như trên, nhánh 2 | `timeout` nhánh 2 | promise hoàn tất **không sớm hơn** delay; bị gỡ giữa lúc chờ ⇒ **TỪ CHỐI** |
| câu lỗi khi fiber bị gỡ | `lib/index.js` dòng 42 · 70 | `DISPOSED_MESSAGE` | `Context has been disposed` — khẳng định **từng chữ** ở 2 ca |
| `interval(callback, delay)` | `lib/index.js` dòng 48–54 | `interval` nhánh 1 | lặp lại ≥ 2 nhịp; hàm huỷ ⇒ **dừng hẳn** |
| `interval(delay)` → async iterator | `lib/index.js` dòng 55–116 | `interval` nhánh 2 | `next()` phát nhịp · `return(v)` trả `{done:true, value:v}` · `throw(e)` ⇒ nhịp sau **TỪ CHỐI** đúng lý do · gỡ fiber ⇒ nhịp đang chờ **TỪ CHỐI** |
| `_schedule(label, trigger, isDisposed)` | `lib/index.js` dòng 117–129 | `_schedule` (**cùng tên**, xem §4) | ca "bề mặt prototype khớp gốc từng tên" |
| `throttle(cb, delay, noTrailing?)` | `lib/index.js` dòng 130–142 | `throttle` | lượt đầu **NGAY** → lượt trong cửa sổ dồn **MỘT** lượt cuối; `noTrailing` bỏ lượt cuối |
| `debounce(cb, delay)` | `lib/index.js` dòng 143–149 | `debounce` | ba lượt liên tiếp ⇒ chỉ lượt **CUỐI** chạy |
| `setTimeout` / `setInterval` (bí danh cũ) | `lib/index.js` dòng 16–23 | hai phương thức cùng tên | chuyển tiếp nguyên văn: một lần · lặp lại · huỷ được |
| tập export lúc chạy | `export { TimerService, TimerService as default }` | `lib/index.js` | **đo trên ARTIFACT**: tập tên export bằng **đúng** tập gốc (`TimerService` · `default`), và khoá thật của module cũng bằng |
| `locale/{en,zh}.json` | `locale/*.json` | `locale/*.json` | chép **byte-for-byte** — `shasum` hai bên khớp (luật 000e) |

## 2. Peer — vì sao, và thuộc bậc nào của §3b

**`gbh.peers = ["@deepseek-ai/cordis"]`** · `peerDependencies` có đúng tên đó.

| peer | bậc | lý do ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | **bậc 1** (kernel/core) | lớp `TimerService` **kế thừa** `Service` của kernel và gọi `ctx.mixin()`/`ctx.effect()` — phải là **CÙNG một kernel** với các row khác, nên là peer chứ không phải dependency |

Không có peer nào khác. Bản gốc khai `dependencies: @deepseek-ai/cosmokit` nhưng **không import**
trong `src/index.ts` (chỉ dùng `Promise.withResolvers` có sẵn) ⇒ ta **không** kéo nó vào.

⚠️ **HAI bản cordis KHÁC ĐỜI trong repo** (đo 18/10/2026): `apps/host/node_modules/@deepseek-ai/cordis`
là bản cài riêng của app, còn `packages/host/timer/node_modules/@deepseek-ai/cordis` là symlink vào
`node_modules/.bun/@deepseek-ai+cordis@4.0.5`. Vì vậy phép kiểm `Object.getPrototypeOf(ours) ===
Object.getPrototypeOf(stock)` (mục 2b) **không dùng được** cho row này — hai lớp `Service` là hai
thể hiện module khác nhau. Bù lại, mọi ca hành vi chạy trên **cùng một context giả** nên so sánh
không phụ thuộc thể hiện kernel nào.

## 3. TRƯỚC/SAU trên app thật (5439)

**Chưa đo** — gói chưa được mount (chờ lượt boot của Lead). Bảng dưới là **mẫu phép đo sẽ điền**:

| Phép đo | TRƯỚC | SAU (kỳ vọng) |
|---|---|---|
| `bh host --dump-config \| grep timer` | 1 dòng `- id: timer` + `name: '@deepseek-ai/cordis-plugin-timer'` | + 1 dòng `- id: timer-ours` (insert) và dòng cũ `disabled: true` |
| `check:rows` cột `chan` | **0** | **0** (không đổi) |
| `check:app` (5) `did not activate` | 0 | **0** |
| `check:app` (8) `#root` | ≥ 68.000 | **không đổi** (row host, không vẽ gì) |
| `parity:dump` | — | THÊM 0 · THIẾU 0 · ĐỔI 0, "đã thay N row" **+1** |

Lệnh tái lập phép đo khi Lead mount: `bun run check:rows && bun run check:app &&
bun test tests/host/timer.test.ts`.

## 4. Khác biệt có ý thức so với bản gốc

| điểm | bản gốc | bản của ta | vì sao |
|---|---|---|---|
| kiểu trả của phần **cài đặt** overload | `any` | `any` (giữ nguyên) | TS **bắt buộc**: kiểu cài đặt phải gán được cho **từng** overload, mà `() => void` và `Promise<void>` không gán được cho nhau |
| kiểu `PromiseWithResolvers` | kiểu toàn cục (lib ES2024) | `interface Deferred<T>` nội bộ | cổng `typecheck` chạy `--target ES2023`; kiểu toàn cục đó **không tồn tại** trong lib của cổng (đã đo: `TS2304`) — hình dạng **y hệt**, không đổi hành vi |
| `_schedule` | `private` | `private` **cùng tên** | giữ nguyên bề mặt prototype để phép so prototype khớp **từng tên** |
| `declare module '@deepseek-ai/cordis'` | có (mở rộng `Context`) | **giữ nguyên** | đây là **module augmentation** trên module CÓ THẬT (có `.d.ts` trên đĩa), **không** phải ambient shim ⇒ không vi phạm 000d/000d-2 |
| `dependencies: cosmokit` | khai (không dùng) | **bỏ** | nguồn sự thật thứ hai không cần thiết |

Không có khác biệt hành vi nào đã biết: 16 ca A/B (ta vs chính bundle gốc) **bằng nhau từng số đo**.

## 5. Test — 23 ca, 0 fail

```bash
bun test tests/host/timer.test.ts     # 23 pass · 0 fail · 57 expect
```

| nhóm | ca | nội dung |
|---|---|---|
| ARTIFACT | 3 | tập export ta = gốc (`TimerService` · `default`) đo trên `lib/index.js` **và** ở tầng chạy · `grep -c "id: @deepseek-ai"` = **0** · prototype khớp từng tên · tên dịch vụ + danh sách mixin khớp từng phần tử |
| HÀNH VI (A/B) | 12 | 6 đường API × (chạy đúng · huỷ đúng · đường lỗi) — mỗi ca chạy **cả hai** bản cài rồi `toEqual` |
| NHÃN EFFECT | 1 | sáu chuỗi `ctx.*()` khớp gốc từng chữ |
| **C6 — DANH TÍNH** | 2 | hai thực thể ⇒ hàm bọc/iterator/danh sách mixin là **vật thể riêng** (sửa bên này **không** lan sang bên kia; gỡ fiber của A **không** dừng hẹn giờ của B) · hai lượt gọi của **cùng** một thực thể cũng trả vật thể mới |
| METADATA | 5 | `gbh.peers ⊆ peerDependencies` so **PHẦN TỬ** + **ĐỐI CHỨNG ÂM** (thiếu một tên · cùng số lượng lệch phần tử · thừa tên vẫn đạt) · **000e** locale byte-for-byte · ca canh **hình dạng `gbh.row`** Lead đã khai (`id: "timer"` + `tests`, không `inject`/`config`) |

## 6. CHƯA làm

- **Chưa có TRƯỚC/SAU trên app 5439**: `gbh.row` đã khai (Lead, commit `80214e4`) nhưng **chưa tới lượt
  boot của Lead** ⇒ bảng §3 còn là mẫu phép đo.
- **Chưa chạy `lab:row`** (chờ lượt boot của Lead).
- `docs/PARITY-MATRIX.md` dòng 57 đặt tên đích là `gbh-cordis-plugin-timer`, còn gói này tên
  **`gbh-timer`** theo chỉ đạo của Lead ⇒ **lệch tên** cần Lead chốt lại (một dòng ở ma trận).
