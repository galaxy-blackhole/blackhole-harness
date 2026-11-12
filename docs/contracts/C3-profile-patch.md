<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Hop dong C3: profile/patch — dinh dang cordis.yml/patch, thu tu lop, cay 205 row khop Oracle A
-->

# C3 — Profile / patch

> **Trạng thái: ĐÓNG BĂNG (có test + bằng chứng số).** Đây là hợp đồng đã được chứng minh ở M1a:
> cây plugin của app **khớp Oracle A (4001) 0 thêm, 0 thiếu, 0 đổi** trên 205 row.

## 1. Phát biểu hợp đồng

Cây plugin KHÔNG được viết tay trong `cordis.yml`. Nó được compose theo đúng thứ tự lớp:

1. `cordis.yml` của profile — **luôn là danh sách rỗng** `[]`.
2. Các bundle khai trong `package.json` → `dsh.profile.bundles` (12 bundle của profile blackhole), mỗi bundle là **một lớp patch**.
3. Lớp patch của app (`app.patch.yml`), gồm cả các lớp đối chiếu oracle.
4. Lớp patch của người dùng (nếu có) — luôn thắng.

Quy tắc định danh row:

- Mỗi row có `id` duy nhất; patch **nhắm theo `id`**, không theo vị trí.
- Trường `disabled` tắt row nhưng KHÔNG xoá row khỏi cây (đo được: 41 row bị patch tắt).
- `config` được merge theo khoá; subpath trong `name` (`/tools`, `/host`, `/startup`) là **một row riêng**.

## 2. Nguồn chứng minh

| Nguồn | Chi tiết |
|---|---|
| Upstream | `apps/host/node_modules/@deepseek-ai/cordis-plugin-loader` + `cordis-plugin-include` (ngữ nghĩa patch/include của Loader); `dsh-web-app` và `dsh-base` (hai lớp patch đầu) |
| Hành vi đo được (17/10/2026) | 205 row · 195 gói · 41 row bị patch tắt · 323 dòng `- id:` trong dump (118 entry lồng trong config — KHÔNG phải row) |
| Bằng chứng đối chiếu | `.parity/dumps/<ts>/diff-oracleA-vs-ours.md` (rỗng) + `ours.normalised.json` vs `oracleA.normalised.json` |
| Fixture đóng băng | `tests/contract/fixtures/c3-profile-tree.json` (đọc thẳng YAML thô, độc lập với bộ chuẩn hoá của giàn parity) |
| Test | `tests/contract/c3-profile-patch.test.ts` — 8 test |
| Template profile | `profiles/blackhole/package.json` (12 bundle) · `cordis.yml` · `app.patch.yml` |

### Quy tắc đếm (để không hiểu lệch nhau)

| Cách đếm | Số | Ý nghĩa |
|---|---|---|
| row (dòng `- id:` thụt lề 0) | **205** | đơn vị thi công |
| tên package duy nhất | 195 | nhiều row dùng chung một gói (subpath) |
| dòng `- id:` mọi cấp | 323 | gồm 118 entry **lồng trong config** — không phải row plugin |

### Phát hiện kèm theo (đã báo Lead): bộ chuẩn hoá của giàn parity che nhầm id row

Bộ chuẩn hoá trong `tools/parity/lib/dump-core.ts` coi mọi chuỗi ≥ 32 ký tự chỉ gồm `[A-Za-z0-9-_.]` là secret.
Ba id row dài từ 32 ký tự trở lên bị thay bằng `<secret>`:
`plugin-package-inventory-deepseek`, `subagent-model-selection-settings`, `optional-session-title-all-prompts`
⇒ Fixture C3 đọc **YAML thô** (không qua bộ chuẩn hoá) để không phụ thuộc lỗi này;
cột `normaliser.redactedIds` trong fixture ghi lại đúng số id bị che để theo dõi khi bên kia sửa.

## 3. Test snapshot tương ứng

| Test | Canh điều gì |
|---|---|
| cây của ta ≥189 row, id duy nhất, index liên tục | không mất/không nhân đôi row |
| mọi row có tên package | row rác/thiếu name bị chặn |
| cấu trúc khớp Oracle A | id/name/disabled/khoá config của 205 row phải trùng |
| nội dung khớp Oracle A (+0 -0 ~0) | bằng chứng M1a, tính lại tại chỗ từ fixture của bản chuẩn hoá |
| id dài bị che nhầm | số id bị che khớp với số id ≥32 ký tự của ta |
| mọi gói có thật trong runtime | mỗi `@deepseek-ai/*` phải tồn tại trong `apps/host/node_modules` |
| `cordis.yml` luôn là `[]` | cây không được viết tay |
| `app.patch.yml` ghim credentials | lớp cuối có ghim tài liệu dùng chung (xem C6) |

## 4. Điều gì làm hợp đồng VỠ

| Thay đổi | Hậu quả |
|---|---|
| Viết cây trực tiếp vào `cordis.yml` | Mất ngữ nghĩa patch; bundle cập nhật sẽ ghi đè hoặc nhân đôi row |
| Patch theo **vị trí** thay vì theo `id` | Thêm/bớt một row là mọi patch sau đó nhắm sai plugin |
| Đổi thứ tự lớp (app patch trước bundle) | Row của bundle ghi đè cấu hình app — mất tinh chỉnh của ta |
| Xoá row khi tắt thay vì đặt `disabled` | Mọi so sánh dump lệch; plugin không thể bật lại bằng patch |
| Đổi tên `name` mà gói không có trong runtime | Cây vẫn in ra nhưng boot chết ở Loader |
| Sửa tay `app.patch.yml` sinh tự động | Lần boot sau sẽ ghi đè, thay đổi biến mất im lặng |

## 5. Việc còn lại

- [ ] **M2 (còn lại)**: đưa diff cây (app vs oracle) vào `bun run gate` như cổng riêng (hiện là bằng chứng chụp theo lần).
- [ ] Đóng băng cả **giá trị** config (không chỉ khoá) sau khi có bộ chuẩn hoá không che nhầm id.
- [ ] Bổ sung test cho patch của người dùng (lớp 4) khi có UI cấu hình.
