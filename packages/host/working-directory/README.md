<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho row working-directory của DSH — nguồn đối chiếu, peer, TRƯỚC/SAU, phần chưa làm.
-->

# @galaxy-blackhole/gbh-working-directory

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `working-directory` (T4, **MỘT MẶT**) | `@galaxy-blackhole/gbh-working-directory` |
| Package | `@deepseek-ai/dsh-working-directory` (0.2.1-alpha.4) | `@galaxy-blackhole/gbh-working-directory` (0.1.0) |
| Cặp row trong dump | `.parity/dumps/2026-10-17T23-54-01/ours.yml` **141–142** · `oracleA.yml` **137–138** | không `disabled`, **KHÔNG có `config:`** trong oracle ⇒ mount bằng `id` + `tests`, không cần khối cấu hình |
| Kích thước bản build | **167 dòng** `lib/index.js` | **163 dòng** `lib/index.js` |
| Nửa browser | **KHÔNG** (`ls lib/client.js` rỗng; `package.json` không có `dsh.client`, không `exports["./client"]`) | không có (đúng là row MỘT MẶT) |
| `locale/` | **KHÔNG có** (luật 000e không áp dụng) | không có — test khẳng định cả hai phía |
| Tập export trên artifact | `WorkingDirectoryService`, `default` | **BẰNG HỆT** (2 = 2, 0 thiếu · 0 thừa) |
| Hành vi đo được | `ctx.workingDirectory.get/ensure/set` · chiếu phiên `workingDirectory` · ngữ cảnh model `working-directory:current` · sự kiện `working-directory/change` | y hệt, xem §6 |

Nguồn **CHỈ ĐỌC**: `apps/host/node_modules/@deepseek-ai/dsh-working-directory` (`lib/index.js` + `lib/types/index.d.ts`). Không chép code: đọc hành vi rồi viết lại.

## 2. Vì sao cần

Mỗi phiên có **một thư mục làm việc hiệu lực**. Row này là **chủ sở hữu duy nhất** của nó:

- giữ thư mục trong **chiếu phiên** `workingDirectory` (đọc được cả khi agent không sống) và chiếu nó ra bề mặt client (`wire`);
- **header phiên vẫn giữ dự án GỐC** — thư mục hiện tại không ghi đè dự án gốc, nên khôi phục được;
- đưa thư mục vào **ngữ cảnh model** bằng mục `working-directory:current` (`required: true`, `interpolate: false`) và **cưỡng chế** nó ở waterfall `system-prompt/assemble` (prepend);
- mọi thay đổi được **chuỗi hoá theo phiên**, kiểm bằng seam `fs`, kiểm tín hiệu huỷ + vòng đời fiber, **ghi bền trước** khi trả, rồi xếp một thông báo ngữ cảnh vào hộp thư agent.

Ai gọi vào: row `tool-working-directory` (`cd`), các tool đọc/ghi tệp (đi qua cwd phiên), và vòng lắp prompt.

## 3. Peer

| Peer | Vì sao | Bảng |
|---|---|---|
| `@deepseek-ai/cordis` | `extends Service` — **phải CÙNG một lớp cơ sở** với kernel (đo: `Object.getPrototypeOf(ta) === Object.getPrototypeOf(gốc)`), nếu không thì `instanceof`/`ctx.reflect.provide` lệch | §3b bậc 1 |
| `@deepseek-ai/schemastery` | `static Config` để kernel + config-editor render được trường `defaultDirectory` | §3b bậc 1 |
| `@deepseek-ai/dsh-llm` | `createUserMessage` — **cùng một định nghĩa tin** với kernel (id + `deepFreeze`); tự dựng object là bịa định danh | §3b bậc 2 |
| `zod` (dependencies) | schema trạng thái chiếu `z.string().min(1).refine(isAbsolute).nullable()` — **đúng biểu thức bản gốc**; sổ chiếu chỉ gọi `.parse` | thư viện thường, không cần một thể hiện |

Bốn seam còn lại (`fs` · `sessionProjections` · `systemPrompt` · hộp thư agent + vòng đời fiber) được khai **theo CẤU TRÚC** trong `src/seams.ts`, **KHÔNG import gói seam nào** và **KHÔNG có ambient `declare module`** (luật 000d). Ngoại lệ duy nhất là **module augmentation** `MessageSourceMap` của `@deepseek-ai/dsh-llm` (khai `kind: "working-directory"`) — đúng cách bản gốc làm, đây là **hợp nhất interface**, không đè kiểu.

`gbh.peers` = 3 tên, **⊆ `peerDependencies`** (0 tên lệch); không tên nào nằm trong `dependencies`.

## 4. TRƯỚC / SAU và lệnh tái lập

⚠️ **Gói CHƯA khai `gbh.row`** ⇒ chưa mount ⇒ **chưa có phép đo TRƯỚC/SAU trên app 5439**. Bảng dưới là phép đo **sẽ chạy ở lượt boot của Lead**, cùng lệnh tái lập.

| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) | Lệnh |
|---|---|---|---|
| `ctx.workingDirectory.get(session)` | thư mục đã ghi bền, hoặc `defaultDirectory` | **phải bằng** | `bun test tests/host/working-directory.test.ts` (so trực tiếp với bundle gốc) |
| `set(agent, "sub")` | trả `/repo/sub`, ghi `working-directory/change`, xếp 1 thông báo | **phải bằng** từng chữ | như trên |
| `ensure` khi thư mục mất | khôi phục `header.cwd` + câu "is unavailable" | **phải bằng** | như trên |
| `system-prompt/assemble` | chèn/ghi đè mục `working-directory:current` | **phải bằng** | như trên |
| Dòng "đã thay N row" | N | N **+1** | `bh host --dump-config \| grep working-directory-ours` |
| `(5)` dòng `did not activate` | 0 | **0** | `bun run check:app` |

## 5. Phần CHƯA làm

- **Chưa khai `gbh.row`** — bề mặt host-only đã xong và đã đối chứng, nhưng **chưa có lượt boot lab/mount của Lead**. Trạng thái này là trạng thái AN TOÀN: gói chưa khai thì không thể làm hỏng app của người khác. Có **test canh** khẳng định `gbh.row` vắng mặt.
- **Chưa chạy `lab:row` / `check:app`** trên home cách ly (cần lượt boot của Lead).
- Không có phép đo A/B pixel — row host, không vẽ gì lên màn hình.

## 6. Hành vi đã đối chứng (mỗi ca dựng HAI giàn giống hệt rồi chạy CẢ HAI bản cài)

| Ca | Điều được khẳng định |
|---|---|
| `set` tương đối | `resolve(sub, {cwd: cwd-phiên})` → `stat` → `processPath`; ghi `{cwd}`; thông báo "changed from … to …"; nguồn `working-directory` |
| `set` trùng thư mục | **0** sự kiện, **0** thông báo (chốt `previous === directory`) |
| đường lỗi | `cd must not be empty` · `directory does not exist: "<path>"` (thư mục mất **và** đường dẫn là tệp) — đúng từng chữ, không treo |
| `ensure` + chiếu `null` | ghi bền thư mục hiện tại, **không** thông báo |
| `ensure` + chiếu đã có | **không** ghi thêm sự kiện |
| `ensure` + thư mục mất | khôi phục `header.cwd` (hoặc `defaultDirectory`) + câu "is unavailable" |
| `ensure` + cả hai mất | ném đúng lỗi của bản gốc, **không** ghi gì |
| hộp thư hỏng | commit **vẫn** xảy ra, lượt gọi **vẫn** trả thư mục, chỉ cảnh báo |
| fiber đã ngừng | ném **trước** khi ghi bền |
| chuỗi hoá | hai lượt đồng thời trên CÙNG phiên chạy tuần tự (đo bằng cổng chặn `resolve`); lượt hỏng không chặn lượt sau; hai PHIÊN khác nhau **không** chờ nhau |
| waterfall | không agent ⇒ `next()` ngay, **0** lượt chạm hệ tệp; có agent ⇒ kiểm trước rồi **chèn** mục; mục đã có ⇒ **ghi đè tại chỗ**, không nhân đôi, ép `interpolate: false`; `prepend: true` |
| mục system prompt | `working-directory:current` · `order = getContextOrder("WORKING_DIRECTORY")` · `required: true` · `interpolate: false` · chữ `""` khi lượt lắp không có agent |

## 7. Ba luật đã canh bằng máy

- **C6 (danh tính)**: hai thực thể service **không** chia sẻ `lifecycle`/`pending`/`operations`; gỡ plugin bên này **không** làm chết bên kia; hai thông báo commit có `id` **khác nhau** và **đông cứng**.
- **000e**: bản gốc **không** ship `locale/` ⇒ gói ta cũng không, manifest không export `./locale/*.json`.
- **Artifact**: `grep -c "id: @deepseek-ai" lib/index.js` = **0** · `grep -c "id: @galaxy-blackhole"` = **0** · `build.ts` nhận `process.argv[2]`.
