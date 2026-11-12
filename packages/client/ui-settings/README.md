<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README cua @galaxy-blackhole/gbh-client-ui-settings — row ui-settings (diem 8, no 23)
-->

# @galaxy-blackhole/gbh-client-ui-settings

Bản viết lại của Galaxy Blackhole cho row **ui-settings** (@deepseek-ai/dsh-client-ui-settings).
Row này **cấp HAI service** cho phần còn lại của giao diện; **23 gói** khác inject nó qua
dsh.client.inject (đếm được: số package.json trong apps/host/node_modules/@deepseek-ai có inject chứa id này).

## 1. Hai nửa

| Nửa | File vào | Việc |
|---|---|---|
| host | src/index.ts | Khai Config (trường enabled, volatile) và bảo kernel settings.configure({ auto: false }) |
| browser | src/client.ts -> src/plugin.ts | Cấp settingsSchema + configForms, giữ mirror tài liệu settings |

Browser gồm các module logic: ids.ts · types.ts · schema.ts · mirror.ts · config-form.ts · config-forms.ts · plugin.ts.

## 2. Bề mặt phải khớp (đây là lý do 23 row phụ thuộc)

| Service | Method | Nghĩa |
|---|---|---|
| settingsSchema | rehydrate · validate · nodeAtPath · getPath · hasPath · setPath · deletePath | Thao tác schema/giá trị settings; setPath/deletePath **bất biến**, tự tạo container, xoá mảng bằng splice |
| configForms | describe · get(entryId) · whileServed(namespaces, register) | get trả form của một namespace; whileServed giữ đăng ký sống theo namespace Host đang phục vụ |
| (qua get ui-settings) | getSnapshot · subscribe · set · unset · mutate · recover · dispose | Form một namespace: hàng đợi ghi tuần tự, mang revision mới nhất, gộp câu trả lời vào mirror |

Hai service được định nghĩa **bên trong** createPlugin vì chúng phải **kế thừa Service thật** của cordis
(lấy từ bảng module lúc chạy). Nếu chỉ uỷ quyền bằng lớp thường thì service **không được đăng ký vào
container** ⇒ 23 row inject sẽ không tìm thấy nó.

## 3. Hai id module

Bundle đăng ký **HAI id trong MỘT lần nạp**:

```js
register({ id: "@galaxy-blackhole/gbh-client-ui-settings", factory })   // id của ta
register({ id: "@deepseek-ai/dsh-client-ui-settings", factory })        // id stock
```

**Vì sao phải có id stock**: đồ thị __DSH_BOOT__ cho thấy entries[].inject trỏ theo **id row của bên cung
cấp** (ví dụ dsh-client-ui-conversation inject @deepseek-ai/dsh-client-ui-settings). Khi ta thay row, entry
stock **biến mất khỏi đồ thị**, nên các row stock inject nó sẽ **treo loading** ⇒ cascade. Khuôn này đã có
tiền lệ đang chạy thật: ui-layout (12 phụ thuộc), ui-sidebar, ui-session đều đăng ký hai id.

moduleIds trong package.json khai **cả hai** id (cổng check:rows đối chiếu tập id đăng ký ⊆ moduleIds).

## 4. Test (7 ca, chạy: bun test tests/client/ui-settings.test.ts)

1. settingsSchema: đọc/ghi đường dẫn, bất biến, tự tạo container, xoá mảng đúng kiểu, nodeAtPath, chặn path rỗng.
2. validate **trả thông báo lỗi** thay vì ném.
3. mirror.load() gộp lần đọc đang chạy và **chạy lại đúng một lần** khi bị invalidate giữa chừng; ensure() không đọc lại khi đã có view.
4. mirror.acceptView gộp câu trả lời của lần ghi **không đọc qua mạng**.
5. configForm.set() gửi đúng {op:set, path, value} với **revision hiện tại**, recover khi Host từ chối, dispose chặn ghi tiếp.
6. configForms.whileServed đăng ký khi namespace được phục vụ, huỷ khi không còn.
7. **Bundle build ra đăng ký ĐÚNG hai id** (tự build vào thư mục tạm rồi đọc chính file build).

## 5. TRƯỚC / SAU

| | TRƯỚC (stock) | SAU (gói này) |
|---|---|---|
| Dòng code CỦA ROW | ~615 dòng (vùng 896-1510) | ~1.060 dòng TS có JSDoc |
| Dòng bundle | 1.532 dòng (**900 dòng đầu là vendor** cosmokit + schemastery) | 49.495 B, schemastery nhúng lúc build |
| Đăng ký id | 1 id | 2 id (ta + stock) |
| Test | không | 7 ca |
| Phụ thuộc | remote, remote.settings | y nguyên |

### Phát hiện cho row:cost
bun run row:cost ui-settings báo **1.532 dòng** — nhưng **900 dòng đầu là vendor code nhúng**
(region ../../../vendor/cosmokit + vendor/schemastery), không phải code của row. Code thật của row là
**~615 dòng**. Công cụ đang đếm cả vendor ⇒ ước lượng công viết lại bị **phóng đại ~2,5 lần** cho mọi
bundle có vendor. (Đề nghị: trừ các vùng #region ../../../vendor/* khi đếm.)

## 6. TRẠNG THÁI: A+B+C ĐÃ VÀO — còn chờ tầng nạp gán BATCH cho entry alias

### Giai đoạn 1 — TRƯỚC khi tầng nạp sửa (đo 19:2x, lab cách ly cổng 5464)

- Trang phục vụ thật: **200 · 49.634 B** · 0 dòng did not activate trong HTML.
- **Nhưng phía trang**: #root chỉ **1.623 ký tự** · 1 lỗi console
  web boot: 14 entries did not activate, gốc dsh-client-ui-conversation: loading, 13 row khác
  pending (waiting for service: uiConversation).
- **Đối chứng cùng cây** (lab ui-jobs, mọi gói khác y hệt): #root **89.015 ký tự · 23 nút · sidebar 1 · 0 lỗi**.
- Đọc __DSH_BOOT__ của **app 5439** lúc đó: hasStockSettings = false, và inject của dsh-client-ui-conversation
  thiếu đúng 4 id stock mà ta đã thay (dsh-client-locale, dsh-client-ui-layout, dsh-client-ui-session, ui-settings).

⇒ Nguyên nhân: khi ta thay row, **entry id stock biến mất khỏi đồ thị** nhưng các row stock khác vẫn inject id đó
⇒ treo loading ⇒ cascade. Sửa ở tầng nạp (gbh-client-modules), không sửa ở tầng gói.

### Giai đoạn 2 — SAU khi A+B (task-52) và C (aliases) cùng vào (đo 19:43, lab cổng 5463)

- **`__DSH_BOOT__` có entry id stock: CÓ** ✓ (`hasStockSettings = true` · 80 entry) — đúng phép kiểm nghiệm thu.
- **`inject` của dsh-client-ui-conversation thiếu = []** ✓ ⇒ hết cascade 14 entry.
- **Nhưng vẫn chưa render**: #root **383 ký tự** · 1 lỗi console, lần này từ chính loader của ta:
  `client-modules: boot manifest entry "@deepseek-ai/dsh-client-ui-settings" belongs to no initial-load batch`
  (parseBootManifest) ⇒ entry alias **chưa được gán vào batch nạp nào** (batch chỉ có URL của ta).

⇒ Việc còn lại nằm ở `gbh-client-modules`: entry alias phải trỏ **cùng URL/rev** với entry chính (nạp một lần,
hai id), hoặc được đánh dấu `aliasOf` và bỏ qua khi kiểm batch. Đã báo tm-client kèm repro sống.

### Giai đoạn 3 — SỬA GỐC Ở TẦNG GÓI: `apply` phải IDEMPOTENT (đo 20:14, lab cổng 5467)

Sau khi tầng nạp phát entry alias, row này **vẫn kẹt `loading`**. Log chẩn đoán (thêm vào chính gói này) in ra:

```
gbh-client-ui-settings: apply nem loi Error: service "settingsSchema" has been registered
```

⇒ Cơ chế: bundle đăng ký **hai id** nhưng loader tạo **MỘT PLUGIN INSTANCE CHO MỖI id** ⇒ factory chạy hai lần ⇒
`apply` lần hai đăng ký lại service ⇒ ném lỗi ⇒ row kẹt `loading` ⇒ mọi row stock inject nó cũng kẹt.

**Cách sửa trong gói này**: cờ Ở PHẠM VI MODULE (không phải trong `apply`) + `try/catch` in lỗi rồi **vẫn ném**.
Cùng khuôn đã áp cho hai gói khác của cùng tác giả (`ui-jobs`, `ui-settings-session-log`).

**Phép đối chứng trong cùng một lab**: trước khi vá, cả ba row `loading`; sau khi vá, **cả ba activate** (không còn
trong danh sách entry không activate) trong khi **17 row hai-id khác vẫn `loading` y nguyên**. Tương quan đo được:
**row kẹt `loading` ⇔ row hai-id** (18/18). Lead đã phát khuôn này cho cả nhóm.

### Giai đoạn 4 — NGUYÊN NHÂN CUỐI CÙNG: thiếu `developerTools` trên LỚP SERVICE (đóng sự cố 17/10/2026)

Sau khi hạ tầng sạch (97 entry · inject treo 4 = ref · trần batch đạt), app vẫn kẹt **19 entry** với log:

```
client-modules: apply for "@deepseek-ai/dsh-client-ui-conversation" threw: Cannot read properties of undefined (reading 'enabled')
```

tm-ui-features truy ra nguyên văn chỗ đọc (grep trên **bundle ĐANG PHỤC VỤ**, không phải bản trên đĩa):
`ctx.configForms.developerTools.enabled.getSnapshot()` · `.subscribe(refreshViews)` ⇒ tức **`ctx.configForms.developerTools` là undefined**.
Bản gốc cấp thuộc tính này trong `ConfigForms` (dòng 1255 + 1274 của bundle gốc); bản của gói này **thiếu hẳn**.

**Đã vá HAI chỗ** (vì consumer đọc qua LỚP SERVICE, không qua lớp logic — vá một chỗ vẫn hỏng y nguyên):
· `src/config-forms.ts`: lớp `DeveloperToolsPreference` (`enabled.getSnapshot()` mặc định false · `enabled.subscribe` chỉ gọi khi giá trị ĐỔI · `setEnabled` · `scope` công khai) + `ConfigForms.developerTools`.
· `src/plugin.ts`: `ConfigFormsService` phơi `developerTools` (lớp cordis mà consumer inject).

**Canh hồi quy**: ca 9 (đối chứng với bundle gốc) nay khẳng định thêm bản gốc có `developerTools` + `enabled.getSnapshot() === false`, bản ta có hàm trả false, và `developerTools.scope === forms.get("ui-settings")`.

**Kết quả**: app 5439 hoàn toàn lành — **26 gói của ta chạy thật · `#root` 99.183 ký tự · 0 lỗi console · 0 dòng did not activate · 54 file mount khớp repo**. Sự cố 6 tầng đóng.

### Còn lại (nghiệm thu cuối)

### Nghiệm thu sau khi tầng nạp sửa xong (phép kiểm bắt buộc)
1. __DSH_BOOT__ phải có **entry id stock** cho mọi row ta đã thay.
2. Số entry **không activate = 0** (hiện 14).
3. #root bằng đường nền (~99.000 ký tự trên app, ~89.000 trong lab).
4. **Bằng chứng nổ 23**: mở Settings, các mục của row khác (session-log, shell, plugins, models) phải
   render **chữ thật, 0 khoá thô** — vì chúng đi qua configForms của gói này.

## 7. Còn lại

- Chờ tầng nạp (tm-client) ⇒ rồi mount, đo A/B hai lớp (pixel + phần tử lạ) và mở lại Settings để lấy
  bằng chứng nổ 23.
- DEVELOPER_TOOLS_NAMESPACE giữ nguyên chuỗi ui-settings (kernel tra theo chuỗi này).
