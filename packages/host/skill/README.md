<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Ban viet lai cua @deepseek-ai/dsh-skill (row `skill`) — bang nguon doi chieu G4, ly do peer, TRUOC/SAU va phan CHUA lam
-->

# @galaxy-blackhole/gbh-skill — row `skill` (M6, HOST)

Bản viết lại **trung thành** của `@deepseek-ai/dsh-skill` — **sổ đăng ký nhà cung cấp kỹ năng** (`ctx.skills`).
Row này **KHÔNG tự sinh kỹ năng nào**: nó chỉ gộp catalog của các nhà cung cấp khác
(`skill-filesystem`, `tool-skill`…), phân giải **kỹ năng thắng theo tên**, nạp thân theo yêu cầu, và phơi
`<skill_content>` cho model.

## 1. Bảng nguồn đối chiếu (G4)

| Hạng mục | Bản gốc (chỉ đọc) | Bản của ta | Bằng chứng |
|---|---|---|---|
| Mặt plugin | `apps/host/node_modules/@deepseek-ai/dsh-skill/lib/index.js` — **566 dòng** | `src/index.ts` + `src/registry.ts` (576) + `src/render.ts` (135) + `src/validation.ts` (224) + `src/types.ts` (196) | 5 module, mỗi file ≤ 1000 dòng |
| Kiểu công khai | `lib/types/index.d.ts` — **297 dòng** | `src/types.ts` (giữ nguyên tên + ý nghĩa từng kiểu, thêm mô tả tiếng Việt) | `typecheck` 0 vi phạm |
| Tập export (ARTIFACT) | `BUNDLED_SKILL_RANK` · `SkillRegistry` · `default` · `escapeText` · `isModelInvocable` · `isSkillName` · `isUserInvocable` · `renderSkillContent` | **8 = 8**, 0 thiếu · 0 thừa | ca test `ARTIFACT` đo trên `lib/index.js` đã build |
| Tên dịch vụ | `skills` (`super(ctx, "skills")`) | `skills` | `ctx.get("skills")` trong test |
| Schema `Config` | `z.object({ collectCacheMaxEntries: z.number().default(128) })` | y hệt | `String(Config)` **trùng từng ký tự** |
| Phần THUẦN | `renderSkillContent` · `escapeText` · `escapeAttr` · `isSkillName` · hai công tắc gọi · bốn hằng hạng | `src/render.ts` | 6 hình dạng nội dung + bảng chân trị, **trùng từng ký tự** |
| Tầng lớp phạm vi | `NamedEntries` · `ScopedLayers` · `scopeOf` · `scopeChainOf` của `@deepseek-ai/dsh-scope` | **mượn nguyên** (không tự chế) | ca `PHẠM VI` trên `createScope` THẬT của cả hai bản |
| Từ điển | `locale/en.json` (41 B) · `locale/zh.json` (132 B) | chép **byte-for-byte** | `shasum` **5a55d221…** · **580b19e1…** khớp |

## 2. Bước 0 — ba phép bắt buộc (đo 18/10/2026)

1. **Cặp row CÓ THẬT**: dump mới nhất `.parity/dumps/2026-10-18T01-31-57/ours.yml` dòng **258–259**:
   `- id: skill` + `name: '@deepseek-ai/dsh-skill'`.
2. **MỘT MẶT**: `package.json` GỐC **KHÔNG có khoá `dsh`** (nên `dsh.client` KHÔNG) và `lib/client.js`
   **KHÔNG tồn tại** ⇒ chỉ có nửa host. (`grep -c "loader.create\|loader.resolve"` trên bundle gốc = **0**.)
3. **Row ĐANG CHẠY, KHÔNG bị tắt**: khối row chỉ có **2 dòng** ⇒ **không `disabled:`**, **không `config:`**,
   **không `inject:`** (row trần, không `!!js`) ⇒ `gbh.row` của ta **không cần** `inject`/`config` nào.

> **Trạng thái mount**: **tác giả gói KHÔNG khai `gbh.row`** — gói được bàn giao ở trạng thái đó (an toàn:
> không tắt row stock của ai). Ngày 18/10/2026 lúc **10:41**, một agent khác đã thêm khối
> `gbh.row { id: "skill", tests: ["tests/host/skill.test.ts"] }` vào `package.json`; gói **không tự ý gỡ** để
> không tranh file với người đang chạy lượt mount. Ca test `MANIFEST` **canh HAI CHIỀU**: vắng `gbh.row` là
> hợp lệ; nếu có thì phải **tự nhất quán** (đúng id row stock `skill`, có `tests`, không `moved`, có dòng §4).
> ⚠️ Khai `gbh.row` mà **chưa mount/nghiệm thu** ⇒ tắt row stock ⇒ mất dịch vụ `skills` cho
> `skill-filesystem`/`tool-skill` đang gọi vào.

## 3. Bề mặt dịch vụ (hợp đồng phải giữ)

`SkillRegistry` (service `skills`) — 10 phương thức công khai, đúng tên và đúng thứ tự prototype:

| Phương thức | Việc |
|---|---|
| `registerProvider(create)` | đăng ký nhà cung cấp **ĐỒNG BỘ** vào lớp của `this.ctx`; trả hàm dọn của Cordis; tên `runtime` bị chặn |
| `register(skill)` | đóng góp runtime; **ai tới trước thắng** trong một lớp; mục trùng nhận hàm dọn **RỖNG** |
| `list(options)` | bản tóm tắt **trung tính với cách gọi**, sắp theo tên |
| `snapshot(options)` | như `list` + cờ `complete` (phép dò có ổn định trong MỘT bản sửa đổi) |
| `get(name, options)` | nạp + kiểm định nghĩa thắng; tên lệch ⇒ `undefined` **và** làm mới cache |
| `collect` · `collectFresh` · `collectLayer` · `listLayerCandidates` | đường dò: cache theo `{cwd, scopes, revision}`, thử lại **2 lượt** khi catalog đổi giữa lượt |
| `invalidateCache` · `invalidateEntry` · `scopeId` · `collectCacheKey` · `notifyChange` | làm mới + khoá cache + phát `skills/change` (lỗi người nghe được **cô định**) |

Thứ tự thắng trong MỘT lớp: `rank` → thứ tự đăng ký nhà cung cấp → thứ tự trong một lượt `list()`.
Hạng: runtime **250** · gói đóng gói **600** (`BUNDLED_SKILL_RANK`).

## 4. Vì sao peer nào (bảng §3b)

| Peer | Bậc | Lý do ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | 1 | `extends Service` — kernel cấp đúng một thể hiện; hai bản cài ⇒ hai lớp `Service` khác nhau |
| `@deepseek-ai/schemastery` | 1 | `static Config` — Settings/config-editor của kernel đọc schema này |
| `@deepseek-ai/dsh-scope` | 2 | **vật mang không thể tự chế**: `NamedEntries`/`ScopedLayers`/`scopeOf`/`scopeChainOf` quyết định lớp phạm vi + quyền dọn hiệu ứng; tự chế ⇒ lệch hành vi mà cổng không thấy |
| `@deepseek-ai/dsh-llm` | — | **CHỈ mượn KIỂU** (`MessageSourceMap['skill-invocation']`) ⇒ `devDependencies`, không vào `gbh.peers` |

`gbh.peers` **3 phần tử** ⊆ `peerDependencies` **3 phần tử** (so **PHẦN TỬ**, không so số lượng), có
**ĐỐI CHỨNG ÂM** trong test: xoá-một-tên ⇒ báo đúng tên thiếu · xoá-sạch ⇒ báo cả ba · thừa-tên ⇒ vẫn rỗng.
`dependencies` **RỖNG** (peer phải do kernel cấp MỘT thể hiện).

Hai gói ngoài bảng §3b **đã cài lại cục bộ thay vì thành peer**:
- `assertNever` của `@deepseek-ai/dsh-util-values` ⇒ **hàm cục bộ 4 dòng**, cùng thông điệp
  (`unreachable variant in <nhãn>: <JSON>`), chỉ chạy ở nhánh `kind` không bao giờ tới của union ĐÓNG.

## 5. Kiểm chứng đã chạy

| Phép | Kết quả |
|---|---|
| `bun test tests/host/skill.test.ts` | **13 test / 87 expect · 0 fail** |
| Đối chứng hành vi | mọi ca chạy **CẢ HAI** bản (ta + bundle gốc) trên **Context cordis THẬT của từng bản cài**; so bằng `canonical()` giữ cả `undefined` ⇒ **trùng từng chuỗi** |
| Tập export trên ARTIFACT | **8 = 8** (0 thiếu · 0 thừa), `default === SkillRegistry`, prototype **trùng tên từng phương thức**, `String(Config)` trùng |
| Một bundle ⇒ một id | `grep -c "id: @deepseek-ai" lib/index.js` = **0** (row host, không có lời gọi `load()`) |
| C6 — danh tính | `list()` mỗi lượt trả **vật thể MỚI**; hai kỹ năng **KHÔNG** chung `invocation` (`not.toBe`) ⇒ sửa một không lan sang cái kia; hai thực thể ⇒ hai sổ **độc lập** |
| Ca huỷ | tín hiệu đã huỷ ⇒ ném NGAY; huỷ GIỮA lượt ⇒ từ chối trong **≤ 1,5 s** (mọi lượt chờ đều có **TRẦN**) |
| `bun run check:rows` | **0 dòng `chan`** (gói chưa khai `gbh.row` nên không vào sổ mount) |
| `bun run gate --no-tests` | **7/7 XANH** |

## 6. Khác biệt CÓ Ý (không đổi hành vi)

1. **`assertNever` cục bộ** thay vì `@deepseek-ai/dsh-util-values` (gói ngoài bảng §3b) — chỉ dùng ở
   nhánh `default` của `SkillResourceBase.kind` (union đóng, không tới được lúc chạy).
2. **Tách 5 module** thay vì một bundle: chỉ là hình dạng nguồn; ARTIFACT vẫn MỘT file ESM và **tập export bằng gốc**.
3. `normalizeProviderObservation` **trả CHÍNH vật thể** nhà cung cấp đưa vào (không dựng bản sao) — như gốc,
   để giữ danh tính quan sát.
4. Giữ `if (oldest.done === false)` quanh phép xoá khoá cache cũ: nhánh `done` không tới được
   (`size > trần ≥ 1`), thêm vào chỉ để `noUncheckedIndexedAccess` không phải ép kiểu — **hành vi y nguyên**.

## 7. CHƯA làm (bàn giao)

- **Khai `gbh.row`** — thuộc lượt boot của Lead (kèm `tests` + dòng §4 này).
- **`lab:row`** + mount 5439 + **TRƯỚC/SAU** trên app thật (chưa có số vì chưa mount).
- **Đo phía trang**: row host không vẽ gì lên màn hình ⇒ kỳ vọng `#root`/`(5) did not activate` **KHÔNG đổi**;
  phải đo lại sau khi mount theo `M6-MOUNT-PLAN.md` §4.
