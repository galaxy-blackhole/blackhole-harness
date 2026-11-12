<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-fs-observation-policy: bảng nguồn đối chiếu G4, lý do peer,
      bảng TRƯỚC/SAU, bằng chứng test và phần CHƯA làm
-->

# @galaxy-blackhole/gbh-fs-observation-policy

Bản viết lại của Galaxy Blackhole cho row `fs-observation-policy` của DSH
(`@deepseek-ai/dsh-fs-observation-policy`) — **chính sách quan sát tệp**: đọc-trước-khi-sửa, và
ghi/sửa có bảo vệ phiên bản, đặt lên **cổng sự kiện `fs/*`** (không service API).

## 0. Cặp row đã xác nhận (BƯỚC 0)

| điều phải xác nhận | bằng chứng |
|---|---|
| cặp `- id` + `name` CÓ THẬT trong dump | `.parity/dumps/2026-10-17T23-54-01/ours.yml` dòng **226–227**: `- id: fs-observation-policy` + `name: '@deepseek-ai/dsh-fs-observation-policy'` (không `disabled`); đo lại trên 2 dump trước đó (`23-25-26`, `22-32-31`) đều đúng **1** cặp |
| row **ĐANG BẬT** | cùng dump: row **KHÔNG** có khoá `disabled` (các row bị patch tắt nằm ngay trên: `tool-bash` · `tool-pwsh` · `tool-jobs`) |
| **MỘT MẶT** | `lib/client.js` **KHÔNG tồn tại** (`find` trên `apps/host/node_modules/@deepseek-ai/dsh-fs-observation-policy`: chỉ `lib/index.js` + `lib/types/*.d.ts` + `locale/*`) và `package.json` **không** có khoá `dsh.client` |
| hồ sơ chi phí | `bun run row:cost fs-observation-policy` ⇒ 98 dòng build · **0 inject** · 0 primitive · 0 khoá từ điển · **không trạng thái sống** |

## 1. Bảng nguồn đối chiếu (G4)

| bản gốc (`apps/host/node_modules/@deepseek-ai/dsh-fs-observation-policy`, CHỈ ĐỌC) | bản của ta |
|---|---|
| `lib/index.js` dòng 1–10 (module doc) + `lib/types/index.d.ts` | `src/index.ts` (header + `name` + `apply`) |
| `lib/index.js` dòng 15–76 — lớp `ObservedStateGate` | `src/gate.ts` — cùng **8 thành viên** (1 trường + 7 phương thức): `observed` · `owner` · `get` · `set` · `clear` · `writeIntent` · `editIntent` · `observe` |
| `lib/index.js` dòng 77–95 — `name` + `apply` (3 listener + 1 hiệu ứng) | `src/index.ts` — `apply` **1 tham số**, **3 listener theo ĐÚNG thứ tự gốc**, cùng nhãn hiệu ứng |
| `lib/types/types.d.ts` — `FsObservationActor` | `src/types.ts` — cùng hình dạng (`agent.session` là danh tính object) + `FsObservationContext` khai **theo cấu trúc** |
| `locale/en.json` · `locale/zh.json` | `locale/en.json` · `locale/zh.json` — **chép byte-for-byte** (shasum khớp) |

**Không chép code**: đọc `.d.ts` + `lib/*.js` để nắm hành vi rồi viết lại; `FsError` là **cùng một lớp
của kernel** (import từ `@deepseek-ai/dsh-fs`), nên `instanceof`/`name`/`code` khớp bản gốc — có ca test
so **danh tính lớp** giữa hai bên.

## 2. Peer — vì sao chỉ hai, và `gbh.peers ⊆ peerDependencies`

| peer | vì sao | dùng thế nào |
|---|---|---|
| `@deepseek-ai/dsh-fs` | `FsError` là **cùng một lớp** mà nhà cung cấp và tầng tool dùng; tự viết lại lớp là hai nguồn sự thật về mã lỗi | **import lúc chạy** |
| `@deepseek-ai/cordis` | context host cấp `ctx.on` / `ctx.effect` — kernel cấp **đúng một** thể hiện | chỉ mượn **hình dạng** (`src/types.ts` khai theo cấu trúc, không import) |

`gbh.peers` = `["@deepseek-ai/cordis", "@deepseek-ai/dsh-fs"]`, `peerDependencies` khai **đủ cả hai** ⇒
hiệu tập **rỗng** (so **PHẦN TỬ**, không so số lượng — `M6-MOUNT-PLAN.md` §1d). Có **HAI đối chứng âm**:
xoá từng tên ⇒ phép kiểm báo **đúng tên đó**; hai danh sách **cùng độ dài mà lệch phần tử** ⇒ vẫn ĐỎ.

**Không ambient nào** (luật 000d): peer `dsh-fs` là **symlink thật** trong
`packages/host/fs-observation-policy/node_modules/@deepseek-ai/dsh-fs` (trỏ về kernel), đúng cách
`session-checkpoint-policy` làm với `dsh-tools` — không `declare module`.

## 3. Hành vi (nguyên văn bản gốc)

| sự kiện | trạng thái đã quan sát | quyết định |
|---|---|---|
| `fs/write-intent` | chưa thấy **hoặc** đã xác nhận vắng mặt | `{ kind: "createIfAbsent" }` |
| `fs/write-intent` | có mặt tại `v` | `{ kind: "replaceIfVersion", version: v }` |
| `fs/edit-intent` | chưa thấy (hoặc actor **không** có phiên) | **ném** `FsError(…, "FS_NOT_OBSERVED")`, thông điệp `edit requires reading "<displayPath>" first` |
| `fs/edit-intent` | đã xác nhận vắng mặt | **ném** `FsError(…, "FS_NOT_FOUND")`, thông điệp `cannot edit "<displayPath>": not found` |
| `fs/edit-intent` | có mặt tại `v` | `{ version: v }` |
| `fs/observed` | — | ghi `present(v)` / `absent` vào bản đồ **yếu** `chủ sở hữu → targetKey`; **đồng bộ**, trả `undefined`, actor không có phiên ⇒ **không ghi gì** |

Hai chi tiết dễ làm sai, đã giữ đúng:

1. **Lỗi thành PROMISE bị từ chối, KHÔNG ném đồng bộ** — bản gốc bọc
   `Promise.resolve().then(() => …)`; test tách bạch `threwSync: false` + `isPromise: true`.
2. **Thứ tự đăng ký** `fs/write-intent` → `fs/edit-intent` → `fs/observed`: slot quyết định là
   **first-wins theo thứ tự đăng ký**, nên đây là một phần hợp đồng, không phải chi tiết trang trí.

## 4. Test — 17 ca / 61 expect / **0 fail**

`bun test tests/host/fs-observation-policy.test.ts`

| nhóm | ca |
|---|---|
| đối chứng **với chính bundle gốc** (7 ca) | mỗi ca dựng **HAI giàn giống hệt** rồi chạy **CẢ HAI** `apply` (ta + `@deepseek-ai/dsh-fs-observation-policy`) và so **từng bước** bằng `toEqual`: write-intent 3 trạng thái · edit-intent 3 trạng thái (**nguyên văn hai thông điệp**) · **cùng lớp `FsError`** · actor không phiên · khoá theo (phiên, đích) · `fs/observed` đồng bộ · thứ tự đăng ký + nhãn hiệu ứng + hàm dọn |
| **ARTIFACT** | `buildPackage()` ra `lib/test-artifact` (nằm trong `lib/` để `packages: "external"` phân giải được peer): **tập export = gốc = `["apply","name"]`**, không `default`, `apply.length` **1 = 1**, `name` = `fs-observation-policy`, `id: @deepseek-ai` = **0**, `id: @galaxy-blackhole` = **0** |
| **000e** | `locale/{en,zh}.json` **byte-for-byte** (shasum `b60e8137…` · `aee9eeae…`), `meta.title` khớp từng chữ, manifest khai `"./locale/*.json"` |
| **peer** | `gbh.peers ⊆ peerDependencies` so phần tử + **2 đối chứng âm** + peer có thật trong kernel, khớp khoảng phiên bản, **không** nằm trong `dependencies` |
| **cổng an toàn mount** | **TEST CANH**: package **KHÔNG** khai `gbh.row` (khai sớm = nhận rủi ro mount) và không kéo gói `@galaxy-stack/*` nào |
| **C6 (danh tính)** | hai lượt cài **không** chia sẻ trạng thái (**đối chứng dương** trong MỘT lượt cài để test không rỗng nghĩa) · hai thực thể giữ phiên bản **riêng**, hàm dọn thực thể này **không** xoá thực thể kia · **vật thể trả về**: mỗi lượt sinh object **mới** — `toEqual` ĐẠT nhưng `toBe` KHÁC, sửa bản này **không** lan sang bản kia |

Vì sao **không** có "ca an ninh": row này **không phục vụ route/RPC nào**, không đọc/ghi đĩa, không giữ
dữ liệu người dùng — nó chỉ chuyển trạng thái trong bộ nhớ thành bảo vệ cho nhà cung cấp.

## 5. TRƯỚC / SAU

⛔ **CHƯA mount lên app 5439** (gói **chưa khai `gbh.row`** — trạng thái an toàn của gói đang chờ Lead).
Vì vậy phép đo dưới đây là **A/B trên giàn giả + ARTIFACT**, **không phải** A/B trên trang thật.

| phép đo (cùng một kịch bản 7 bước, cùng giàn) | TRƯỚC = bundle gốc | SAU = artifact của ta |
|---|---|---|
| `fs/write-intent` chưa thấy / có mặt v1 / vắng mặt | `createIfAbsent` / `replaceIfVersion v1` / `createIfAbsent` | **y hệt** |
| `fs/edit-intent` chưa thấy / có mặt / vắng mặt | `FS_NOT_OBSERVED` / `{version:"v1"}` / `FS_NOT_FOUND` | **y hệt** (kể cả nguyên văn thông điệp) |
| lớp lỗi | `FsError` của kernel | **cùng lớp** (`constructor` bằng nhau) |
| thứ tự đăng ký · nhãn hiệu ứng · hàm dọn | 3 sự kiện đúng thứ tự · 1 nhãn · dọn rơi sạch trạng thái | **y hệt** |
| tập export | `apply` · `name` | **y hệt** (0 thiếu · 0 thừa) |

## 6. Lệnh tái lập

```bash
cd galaxy-blackhole/blackhole-tauri
bun run packages/host/fs-observation-policy/build.ts                # hoặc: bun run build.ts <outDir>
grep -c "id: @deepseek-ai" packages/host/fs-observation-policy/lib/index.js   # 0
bun test tests/host/fs-observation-policy.test.ts                    # 17 pass · 0 fail
```

## 7. CHƯA làm (điều kiện chặn mount, không phải ghi chú cuối báo cáo)

- **Khai `gbh.row`** — cố ý **không** khai trong lượt này (chỉ Lead bật, sau `lab:row`).
- **`lab:row` + mount + `check:app`** (chỉ số (5) · (8) · (9) · (10)) — chờ lượt boot của Lead.
- **`lib/types/*.d.ts`** — bản gốc ship kiểu; gói ta build ESM **không kèm** kiểu (giống các gói host
  khác trong repo). Thiếu kiểu **không** ảnh hưởng lúc chạy.
- **Persistence của trạng thái quan sát** — bản gốc cũng không có: phiên resume phải đọc lại tệp.
