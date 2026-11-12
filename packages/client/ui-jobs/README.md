<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ui-jobs cua DSH.
-->
# @galaxy-blackhole/gbh-client-ui-jobs
## 1. Nguồn đối chiếu (G4)
| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-jobs` (tier T3) | `@galaxy-blackhole/gbh-client-ui-jobs` |
| Package | `@deepseek-ai/dsh-client-ui-jobs` | `@galaxy-blackhole/gbh-client-ui-jobs` |
| Kích thước bản build | **659 dòng JS** | (điền sau khi viết) |
| Hai mặt? | **CÓ** (`dsh.client`) | phải làm đủ hai nửa |
| `dsh.client.inject` | `@deepseek-ai/dsh-api-job-controller` · `@deepseek-ai/dsh-client-locale` · `@deepseek-ai/dsh-client-ui-conversation` · `@galaxy-blackhole/gbh-client-ui-primitives` | phải đăng ký **đúng tên service cũ** |
## 2. Vì sao cần
(điền: row này làm gì trong app, ai gọi nó)
## 3. Peer
(ghi rõ peer nào và vì sao — chỉ được dùng các gói trong bảng §3b của `packages/README.md`)
## 4. Bảng TRƯỚC / SAU
| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| (điền phép đo TRƯỚC khi mount) | | |
Lệnh tái lập: (điền)
## 5. Phần CHƯA làm
(nói thẳng nếu có — đừng giả vờ đủ)

## Duong nen do luong (da co san TRUOC khi mount - ghi ngay 17/10/2026)

Ca session-open, KHONG co job (dung ca cua row nay vi JobListAction tra null khi visibleCount === 0):

| Man | Lech pixel | Phan tu la so voi ref | Ket qua |
|---|---|---|---|
| Mo session (khung chat + soan tin) | 0 / 1.075.392 (0,000%) | ours +0 · ref +0 | PASS |

Anh: .parity/features/2026-10-17T08-28-59/ (do boi tm-ui-features).

Sau khi mount row nay, PHAI do lai dung man do voi HAI LOP:
1. pixel A/B - ky vong van 0 px (khong job => component tra null => khong co gi de lech);
2. chi so PHAN TU LA (tag|role|aria-label|data-testid, co bbox) - ky vong ours +0 · ref +0.
   Lenh: bun run tools/features/run.ts --ids session-open --no-doc

Chi so phan tu la la thu da bat dung loi toast placeholder cua row ui-settings-session-log
(07:56 ours +1 button|switch|Could not save preference -> sau khi sua: +0) - no bat ho loi nay
MA KHONG CAN MOT PIXEL NAO. Nguoc lai, su co CSS thanh ben (5.437 px) KHONG bi no bat
(sai BO CUC chu khong thua phan tu) nen van phai chay lop pixel. Hai lop bo sung cho nhau.

## Viec con lai cua row nay (trang thai that)

· DA XONG: src/locales.ts - tu dien khoa job, 40 khoa x 2 ngon ngu TRICH NGUYEN VAN tu bundle goc
  (en + zh, ke ca 14 khoa terminal.* co tham so noi suy). Day la du lieu chi doc duoc, khong suy ra duoc.
· CHUA VIET: src/ids.ts · src/plugin.ts (dictionaries + slot conversation.session.header.actions id job-list
  order 20 + hop dong face) · JobListAction (MenuSurface + useAnchoredPosition + useDismissOnOutsidePointer
  + StateDot + TerminalBlock + 2 icon) · build.ts (CJS boc __ModuleLoader__.load) · test · lab.
· gbh.row: CHUA bat => row stock van BAT, tinh nang job-list van chay nhu cu trong app.

## TIEN DO 17/10/2026 (buoc 2) — DA XONG GI, CON GI

DA XONG (build chay, do duoc):
- src/ids.ts (PACKAGE_NAME, STOCK_PACKAGE_NAME, SLOT_OCCUPANT_ID job-list, SLOT_ORDER 20, LOCALE_KEY)
- src/locales.ts (tu dien 40 khoa x 2 ngon ngu, trich nguyen van tu bundle goc)
- src/plugin.ts (locale.register + slots.inject conversation.session.header.actions voi occupant id job-list, order 20, hop dong face: hooks.jobs / watchRows / observe / killJob; component tra null khi khong co job)
- src/client.ts (chi xuat factory) · src/index.ts (stub apply rong) · build.ts (host ESM + browser CJS boc __ModuleLoader__.load dang ky HAI id literal) · package.json (exports ./client + dsh.client + gbh.row)
- KIEM CHUNG: build ra bundle dang ky DUNG hai id literal; bun run check:rows => TAT CA dat (goi nay khong con bi chan); bun test tests/client/ui-jobs.test.ts => 3 pass / 0 fail

CON LAI (chua xong, khong tinh la xong):
- JobListAction DAY DU chua viet: ban goc la MOT MENU bung (MenuSurface + useAnchoredPosition + useDismissOnOutsidePointer) voi danh sach job, StateDot, output trong TerminalBlock (thu/mo tung dong), nut kill, 2 icon. Hien tai component moi tra ve mot nut don gian voi chuoi count.live da dich => THIEU TINH NANG THAT, khong phai sai hien thi.
- Chua mount: gbh.row co khai nhung app chua boot lai; row stock van BAT nen job-list van chay nhu cu.
- Chua lab, chua nho tm-ui-features do A/B (ca khong job: ky vong 0 px + 0/0 phan tu la).

## API primitive da TRICH DUOC tu bundle goc (17/10/2026) — de luot sau viet JobListAction khong phai do lai

Doc tu apps/host/node_modules/@deepseek-ai/dsh-client-ui-jobs/lib/client.js (chi doc):

- require: react/jsx-runtime · react · react-dom · @galaxy-blackhole/gbh-client-ui-primitives
- useAnchoredPosition({ open, anchorRef, panelRef, gap, margin })  -> tra ve menuPosition (doi tuong style)
- useDismissOnOutsidePointer(rootRef, open, setOpen, menuRef)      -> dong menu khi bam ra ngoai
- MenuSurface  <- ref (forwardRef), className, style (menuPosition ?? MEASURE_STYLE), children
- StateDot      <- state (dung cho tung dong job; ban goc con truyen cho TerminalBlock qua runStateDot: false)
- TerminalBlock <- nhan output cua job; ban goc dat runStateDot: false
- IconChevronDownOutlineRegular · IconStopFillRegular
- Menu duoc render qua react_dom.createPortal vao document.body; thu tu: nut (rootRef) -> portal
- Ban goc giu: liveRows (running/stopping) va settledRows; section header dung section.live / section.settledCount;
  nut kill goi killJob(sessionId, jobId); copy dung tu dien khoa job (40 khoa da co trong src/locales.ts).

TRANG THAI: component hien tai trong src/plugin.ts moi la NUT DON GIAN (chuoi count.live da dich) — THIEU TINH NANG THAT.
Day la ranh gioi dung: phan con lai la viet component theo API tren + build + lab + do A/B.

## GO gbh.row (17/10/2026 — quy uoc muc 7 cua cong thuc)

Component JobListAction DAY DU chua viet xong (van la nut don gian) va CHUA qua lab.
Vi vay `gbh.row` da duoc GO khoi package.json: lan boot sau se KHONG mount row nay,
row stock cua DSH van BAT va tinh nang job-list van chay nhu cu — khong co row chua nghiem thu nao vao app.
Bat lai `gbh.row` chi sau khi: (1) viet xong component theo API trong muc tren, (2) gate xanh,
(3) lab:row ui-jobs sach, (4) nho tm-ui-features do ca 'khong job' (ky vong 0 px + 0/0 phan tu la).

## BAN GIAO (17/10/2026) — doc muc nay la du de viet tiep, KHONG can doc lich su chat

### Trang thai
- gbh.row: **DA GO** khoi package.json (quy uoc muc 7). Lan boot sau se KHONG mount row nay; row stock cua DSH van BAT nen tinh nang job-list van chay nhu cu.
- Da xong: src/ids.ts · src/locales.ts (40 khoa x 2 ngon ngu, trich nguyen van tu bundle goc) · src/plugin.ts (dictionaries + slot conversation.session.header.actions, occupant job-list, order 20, hop dong face) · src/client.ts · src/index.ts · build.ts (host ESM + browser CJS boc __ModuleLoader__.load, dang ky HAI id literal) · tests/client/ui-jobs.test.ts (3 pass).
- CHUA xong: component JobListAction day du. Hien tai component chi la NUT DON GIAN (chuoi count.live da dich) => THIEU TINH NANG THAT, khong phai sai hien thi.

### API 7 primitive (trich tu bundle goc — dung de viet component)
- useAnchoredPosition({ open, anchorRef, panelRef, gap, margin }) -> menuPosition (style cho menu)
- useDismissOnOutsidePointer(rootRef, open, setOpen, menuRef)
- MenuSurface <- ref (forwardRef), className, style (menuPosition ?? MEASURE_STYLE), children; render qua react-dom createPortal vao document.body
- StateDot <- state · TerminalBlock <- output cua job (ban goc dat runStateDot: false)
- IconChevronDownOutlineRegular · IconStopFillRegular
- Ban goc con giu: liveRows (running/stopping) va settledRows; tieu de nhom dung section.live / section.settledCount; nut kill goi killJob(sessionId, jobId); copy lay tu khoa job trong src/locales.ts.

### Thu tu 4 buoc de xong
1. Viet component theo API tren (mo rong kieu PrimitivesModule/RuntimeModule trong src/plugin.ts) -> bun run build.ts phai ra lib/client.js co DUNG hai id literal.
2. bun run gate phai XANH 8/8 · bun run check:rows phai TAT CA dat (khi bat lai gbh.row).
3. bun run lab:row ui-jobs (home cach ly + cong rieng) -> roi nho tm-ui-features do A/B ca khong job.
4. Chi khi buoc 3 sach moi mount that + do lai check:app (doc CA chi so 8 do phia trang).

### 4 dieu kien de BAT LAI gbh.row
1. Component day du da viet xong (khong con nut don gian).
2. gate XANH 8/8 va check:rows TAT CA dat.
3. lab:row ui-jobs sach: 0 canh bao, bundle dang ky du hai id.
4. A/B do boi tm-ui-features: ca khong job ky vong pixel 0 px VA phan tu la ours +0 / ref +0.

### Ky vong do luong (da co san duong nen)
Ca session-open KHONG co job: pixel 0 / 1.075.392 (0,000%) va phan tu la ours +0 / ref +0 (do 17/10/2026, anh .parity/features/2026-10-17T08-28-59/).
Lenh: bun run tools/features/run.ts --ids session-open --no-doc

## CAP NHAT 17/10/2026 (chieu) — COMPONENT DA XONG; muc 'CON LAI' o tren KHONG con hieu luc

Cac muc phia tren ghi 'JobListAction chua viet / chi la nut don gian' — do la trang thai TRUOC. Trang thai THAT bay gio:

DA XONG:
- `src/plugin.ts` = **252 dong**, co **JobListAction DAY DU**: menu bung (useAnchoredPosition + useDismissOnOutsidePointer),
  render qua createPortal vao MenuSurface, danh sach liveRows/settledRows voi StateDot, xem output trong TerminalBlock,
  nut kill bang IconStopFillRegular, IconChevronDownOutlineRegular, tra null khi khong co job (dung ban goc).
- Build ra `lib/client.js` dang ky **DUNG hai id literal** (`@galaxy-blackhole/gbh-client-ui-jobs` + `@deepseek-ai/dsh-client-ui-jobs`).
- `bun test tests/client/ui-jobs.test.ts`: **3 pass / 0 fail**.
- `bun run check:rows`: **TAT CA dat** (24 package) khi `gbh.row` bat.
- `bun run gate`: **XANH 8/8** tai thoi diem do.
- **LAB SACH** (home cach ly /tmp/gbh-lab-ui-jobs, cong 5462): page 200 · 49.409 B · `rootLen` **89.015** · mode live · 72 entry ·
  **0 loi console** · id cua ta co trong payload, id stock khong (dung co che).

LOI LAB BAT DUOC VA DA SUA (ghi lai de nguoi sau khong mac): bundle tra `module.exports` thay vi **plugin object**
=> trang bao `invalid plugin, expect function or object with an "apply" method`. Sua: wrapper trong build.ts goi
`createPlugin(require)` va tra ket qua. **Tren app that loi nay chi no luc boot** — chi lab moi bat duoc.

TRANG THAI MOUNT: `gbh.row` **DANG GO** theo quyet dinh cua Lead (17/10/2026): `ui-session` (task-41, goi khac) dang lam
chi so (8) cua `check:app` DO voi 9 loi console `slots.bindStoreScope is not a function`; toi da **loai tru row nay bang
thuc nghiem** (go row cua minh + restart => loi VAN Y NGUYEN 9 loi) ⇒ giu go de luot boot co it bien so nhat.

4 DIEU KIEN BAT LAI `gbh.row` — trang thai:
1. Component day du: **DAT** (252 dong, xem tren).
2. gate XANH + check:rows TAT CA dat: **DAT** (tai thoi diem do; gate hien do o goi khac).
3. lab sach 0 canh bao, du hai id: **DAT** (so do o tren).
4. A/B do tm-ui-features (ca 'khong job': 0 px + ours +0 / ref +0): **CHUA DO** — se do sau khi (8) xanh va mount lai.

VIEC CON LAI DUY NHAT: cho Lead bao (8) xanh ⇒ bat lai `gbh.row` ⇒ `scripts/restart-host.sh` ⇒ `check:app` (doc ca (8))
=> nho tm-ui-features do ca `session-open` khong job ⇒ cap nhat §4 + ROADMAP ⇒ complete task-26.

## DIEU KIEN 4 — DA DAT (A/B do tm-ui-features, 17/10/2026)

| Man | Pixel A/B | Phan tu la so voi ref | Ket qua |
|---|---|---|---|
| session-open (KHONG co job) | **0 / 1.075.392 px (0,000%)** | **ours +0 · ref +0** | **PASS** |
| settings-general | 0 / 1.119.744 px (0,000%) | ours +0 · ref +0 | PASS |

Anh: .parity/features/2026-10-17T11-38-54 · anchor y: ref -1 / ours -1 (hang dau session khong xe dich).
Truoc khi do, tm-ui-features xac nhan CA HAI BEN lanh (parity:health 5439 + oracle 4001) — khong do trong cua so restart.

=> **Ca 4 dieu kien bat lai gbh.row deu DAT.** Row `ui-jobs` chay that trong app; hanh vi ca 'khong job' khop tuyet doi
(dung nhu bang chung doc tu bundle goc: JobListAction tra null khi visibleCount === 0).

GHI CHU VE CA 'CO JOB' (chua do): khi session CO job thi nut moi hien — luc do can mask trang thai cho vung hang dau session,
vi oracle 4001 khong co job nao. Do la khac biet TRANG THAI, khong phai loi render; da thong nhat truoc voi tm-ui-features.

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-jobs` (shasum `en 30fef79f896a...` · `zh e68884362824...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
