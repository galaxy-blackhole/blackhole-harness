<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README goi gbh-client-ui-workspace — row ui-workspace cua DSH viet lai
-->

# @galaxy-blackhole/gbh-client-ui-workspace

Ban viet lai cua Galaxy Blackhole cho row `ui-workspace` cua DSH
(`@deepseek-ai/dsh-client-ui-workspace`, bundle goc 5.354 dong).

## Vi sao row nay quan trong

Bundle goc chua lop CSS `Qg_5Eq_exits` (module `AnimatedRows.module.css`):

```css
.Qg_5Eq_exits{contain:strict;pointer-events:none;position:absolute;inset:0;overflow:clip}
```

Lop nay la **lop phu tro** chua cac dong vua bi bo khoi danh sach thanh ben. `contain:strict` +
`position:absolute; inset:0` giu cho no **khong chiem cho trong luong** — thieu lop nay thi phan tu
dang thoat van nam trong dong chay bo cuc va **day bo cuc lech +21px** so voi oracle. Vi vay bon module
CSS cua ban goc duoc giu **nguyen van tung byte**, ke ca tien to hash (`YDXeBa_` · `Qg_5Eq_` ·
`_G5b-a_` · `bhn1Oq_`) — xem `src/css.ts`.

## Cau truc

| File | Vai tro |
|---|---|
| `src/ids.ts` | id module, muoi ten slot/occupant nguyen van, bon the CSS, hang so hanh vi |
| `src/css.ts` | **CSS nguyen van tung byte** cua bon module + bang ten lop hash cua ban goc |
| `src/locales.ts` | hai bang tu dien `zh`/`en` (119 khoa moi bang), nguyen van |
| `src/runtime.ts` | cau noi bang module (react · jsx-runtime · primitives · store · cordis) |
| `src/animated-rows.ts` | `AnimatedRows` — lop phu `Qg_5Eq_exits` + hieu ung di chuyen/mo dan |
| `src/rows.ts` | cac dong cua cay workspace (workspace · phien · ket qua tim kiem · the hover) |
| `src/session-tree.ts` | cay phien theo workspace (dung `AnimatedRows`) |
| `src/flat-list.ts` | danh sach phang + than tim kiem |
| `src/workspace-browser.ts` | vung duyet workspace (hang dau · tim kiem · hai hop thoai) |
| `src/workspace-picker.ts` | luong chon/them workspace cua man trong |
| `src/session-actions.ts` | bon muc menu · hai nut tren dong · hai hop thoai |
| `src/toast.ts` | muoi mot muc toast cua row |
| `src/service.ts` | service `uiWorkspace` (mo phien · ghim · luu tru · fork · chon thu muc) |
| `src/derive.ts` · `src/paths.ts` | suy dien nhom/danh sach/tim kiem + ham duong dan |

## Nghiem thu

```bash
bun run build.ts                                   # 2 artifact
grep -c 'id: "@deepseek-ai' lib/client.js          # = 0
grep -c 'id: "@galaxy-blackhole' lib/client.js     # = 1
bun test tests/client/ui-workspace.test.ts
```

## No ky thuat (ghi ro, khong giau)

- `util/values/src/partial-json.ts` cua ban goc (620 dong: bo doc JSON dang stream cho truy van noi dung)
  **chua duoc port**; `deriveSearchResults` cua ta dung `content.items` cua host truc tiep.
- Nua host **rong** nhu ban goc (`apply()` khong lam gi).
