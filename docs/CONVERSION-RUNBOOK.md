<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Quy trình chuyển đổi DSH → GBH: vai trò, Definition of Done, bằng chứng, chữ ký, ma trận, wave plan
-->

# Quy trình chuyển đổi DSH → Galaxy Blackhole

> Mục tiêu cuối: **không còn gì liên quan DSH** — mọi package (kernel · core · host · api · client-ui · tool ·
> bundle · icon · asset) có bản GBH 1:1, mount thật, có test và **đủ 3 chữ ký**.
> Bảng tiến độ duy nhất: [`DSH-CONVERSION-MATRIX.md`](DSH-CONVERSION-MATRIX.md) (sinh tự động).

## 1. Vai trò

| Vai | Ai | Được làm | Không được làm |
|---|---|---|---|
| **Lead** | phiên chính | điều phối, đo, boot, cập nhật ma trận + chữ ký, báo cáo | viết code thay teammate (trừ khi teammate cạn ngân sách) |
| **Teammate phụ trách** | `tm-*` | viết code + unit test + e2e trong **vùng ghi của mình**, báo cáo bằng chứng | sửa package của teammate khác, sửa ma trận/signoff, commit git |
| **Subagent phát triển** | do teammate gọi (nếu runtime cho phép); **1 subagent cho 1 package** — xong package nào thì tạo subagent mới cho package đó, để teammate không đốt ngân sách | làm 1 package được giao | ký thay reviewer |
| **Reviewer** | `tm-reviewer` | chạy lại test, đối chiếu source DSH, viết e2e nếu không tin, **ký hoặc từ chối** | sửa code hộ tác giả |

> ⚠️ **Runtime hiện đặt `maxDepth = 1`** (đo được: `tm-reviewer`, `tm-client-ui-a` đều nhận
> `subagent depth 2 exceeds maxDepth 1`) ⇒ teammate **không gọi được subagent**, dù là 1 hay n.
> Nguồn của khoá này: service `@deepseek-ai/dsh-subagent` có `maxDepth` **mặc định 1** (schema
> `z.number().step(1).min(0).default(1)`), tool `dsh-tool-subagent` có `Config.maxDepth` (số hoặc
> `"provider-managed"`). Muốn mô hình 3 tầng chạy đúng thiết kế phải nâng giá trị này **ở tầng
> runtime của harness** (không phải `app.patch.yml` của app 5439) — cần một lượt đổi cấu hình riêng.
>
> **Quy ước khi bị chặn:** teammate làm việc một mình và báo Lead; **Lead chỉ gọi subagent khi (a) teammate
> cạn ngân sách, hoặc (b) Lead muốn tự kiểm chứng lại**. Không dùng subagent để làm hộ việc teammate
> đang làm được.

## 2. Definition of Done của MỘT package

Một package DSH chỉ được coi là **✓ đã chuyển** khi có **đủ 6 mục**:

1. **Package GBH 1:1**: đọc `apps/host/node_modules/@deepseek-ai/<pkg>/lib` (chỉ đọc) + `.d.ts`; giữ nguyên
   tên service / event / export / slot / id bundle.
2. **Luật code**: header 5 dòng · ≤1000 dòng/file · JSDoc mọi export · không Tailwind/thư viện UI ·
   không màu/số literal · icon theo C7.
3. **Unit test** trong `tests/<tier>/<row>.test.ts` (pass 100%) + **e2e/lab evidence**:
   `bun run lab:row <row>` ⇒ **0 lỗi console · 0 `did not activate`**; với UI phải có **ảnh A/B**.
4. **Cổng**: `bun run check:rows` ⇒ row đó **0 dòng `chan`**; `bun run gate --no-tests` ⇒ **7/7 XANH**.
5. **Mount thật**: `bun run apps/cli/src/main.ts host --dump-config` ⇒ có entry
   `@galaxy-blackhole/gbh-…`; `check:app` (5)=0, (8) 0 lỗi console, (10) khớp repo.
6. **Ba chữ ký** trong `docs/contracts/data/conversion-signoff.json`: `dev` · `owner` · `reviewer` + ≥1 bằng chứng.

## 3. Lệnh chuẩn

```bash
# 1) bảng tiến độ (nguồn sự thật)
~/.bun/bin/bun run tools/check/conversion-matrix.ts          # hoặc --check
# 2) ký một package (chỉ Lead; kiểm đủ 3 chữ ký + test khai báo + bằng chứng)
~/.bun/bin/bun run tools/check/signoff.ts --sign @deepseek-ai/dsh-client-ui-shortcuts \
  --gbh @galaxy-blackhole/gbh-client-ui-shortcuts \
  --dev "subagent:ui-shortcuts-dev" --owner tm-client-ui-a --reviewer tm-reviewer \
  --evidence "tests/client/ui-shortcuts.test.ts: 12 pass" \
  --evidence "lab:row ui-shortcuts: 0 console error · 0 did-not-activate"
~/.bun/bin/bun run tools/check/signoff.ts --list          # xem chữ ký
~/.bun/bin/bun run tools/check/signoff.ts --unsign <pkg>  # thu hồi
```

Công cụ **từ chối ký** khi: thiếu 1 trong 3 chữ ký · `dev` trùng `reviewer` · không có `--evidence` ·
package GBH không khai `gbh.row.tests` hoặc tệp test không tồn tại · package DSH không có trong cây cài.

## 4. Wave plan

| Wave | Nội dung | Nguồn |
|---|---|---|
| **W1** | 5 gói client-ui còn CHUA-KHAI (ui-shortcuts · ui-theme · ui-renderer · ui-plugin-manager · file-upload) + nợ “lát nguyên văn” | `docs/UI-PACKAGES-STATUS.md` §3 |
| **W2** | host/API (T2): config-editor · settings · api-* · session-* — xếp theo dòng bundle tăng dần | ma trận §4 |
| **W3** | tool/LLM/sandbox/subagent/schedule/workflow (T4) | ma trận §4 |
| **W4** | kernel/core (T0/T1) — làm cuối theo ARCHITECTURE §2.4 | ma trận §4 |
| **X** | icon/asset DSH → GBH (không còn tham chiếu DSH) | `tm-assets` |

## 4b. Năm lớp lỗi và phép đo tương ứng (bổ sung 18/10/2026)

| # | Lớp lỗi | Phép đo BẮT BUỘC |
|---|---|---|
| 1 | Thiếu slot / thừa slot | so TẬP slot trên artifact ta vs bundle gốc (`check:rows`) |
| 2 | Cổng idempotent sai (cờ bật sớm / khoá theo ctx) | ca test "lần đầu NÉM ⇒ cờ vẫn false ⇒ lần hai đăng ký đủ" |
| 3 | Keyed slot: `key` ≠ `id` định nghĩa | in ra `id:` của register và `key:` của từng slot cùng nhóm |
| 4 | Store cấp cho gói khác trả thiếu | ca HỢP ĐỒNG giữa hai gói (`getSnapshot/subscribe/actions`) |
| **5** | **Lab pass nhưng app CHẾT vì thiếu facade/bootstrap của vỏ web** | **boot-smoke app THẬT**: trang > 40.000 B · có `__DSH_BOOT__` · `#root ≥ 40.000` · 0 lỗi console. Áp dụng cho row chạm bootstrap/module-loader: `ui-renderer`, `modules`, `hmr`, `connection` |

**Luật đo bổ sung**

- **Row HOST phải kết luận bằng LOG HOST**, không chỉ DOM probe: `grep -c "did not activate" ~/.galaxy/blackhole/host-5439.log` (log nay ghi đúng đường dẫn chuẩn và **truncate mỗi lượt boot** — trước 18/10 script ghi `/tmp/host5439.log` nên chỉ số (5) đọc log 17/10 và luôn ra 0 giả).
- **Đừng dùng (5)=0 làm bằng chứng ký** khi còn 3 entry hỏng đã biết (`config-editor` · `pwsh-sandbox` · `ui-sidebar-documentpreview`): sửa xong mới có (5)=0 thật.
- **Chỉ số (8) dùng ngưỡng CẤU TRÚC** (#root ≥ 40.000 · slot ≥ 46 · 0 console · 0 pageerror), không dùng số ký tự tuyệt đối — brand GBH bỏ wordmark SVG làm #root giảm ~17,6k byte nhưng KHÔNG mất nội dung.
- **Ký theo lô**: `bun run tools/check/signoff.ts --batch <tệp.json>` (khuôn `{dev, owner, evidence[], packages:[{dsh,gbh}]}`) — kiểm từng gói rồi sinh ma trận một lần.
- **ROW CHÈN LUÔN BẬT** (phát hiện 18/10/2026, đo được): tầng sinh patch chỉ ghi `disabled` cho **row stock**; khối `insert` luôn **không** có `disabled`. Hệ quả: mọi row stock đang **TẮT CÓ ĐIỀU KIỆN** (`disabled: !!js …`) sẽ bị bản thay thế **BẬT** khi mount. Cách đúng: khai `gbh.row.insertDisabled` (nhận `true` hoặc `{ js: "…" }`) để **mirror đúng biểu thức của oracle**.
  - Ca thật: `desktop-product-telemetry` (`disabled: !!js ctx.get('profileContext')?.name !== 'desktop'`) — mount không mirror = **bật gửi telemetry sản phẩm** ở profile `blackhole` và có thể POST ra collector mặc định; `session-title-llm` (`insertDisabled: true`).
  - Bằng chứng bắt buộc: `--dump-config` cho thấy `<id>-ours` có `disabled` đúng như oracle **trên profile đang chạy**.

## 4c. Wave D — dọn nợ DSH cuối (luật TƯƠNG THÍCH)

Mục tiêu cuối là "không còn gì liên quan DSH", NHƯNG mục tiêu G1 là "cài được plugin ngoài giống DSH".
Vì vậy mọi lần đổi tên hằng/protocol/env của DSH phải theo luật **đọc cũ — ghi mới**:

| Nợ | Số chỗ (đo 18/10) | Cách làm đúng |
|---|---|---|
| URI scheme `dsh-resource://` | **48** (đo 19/10) → **0 chỗ PHÁT cũ** ngoài lát nguyên văn (còn 29 dòng: 4 nợ lát nguyên văn ui-chat · 7 định nghĩa legacy · 18 chỗ CHẤP NHẬN cũ — cố ý) | host **chấp nhận cả hai** scheme, client **phát** `gbh-resource://`; test round-trip 2 chiều + scheme lạ bị từ chối (task-29 XONG) |
| Persist key `dsh.*` | **10 khoá / 7 gói** → **4 khoá × 4 gói ĐÃ XONG** (task-38 D2: ui-open-in-app · ui-sidebar-browser · ui-sidebar-right · shortcuts) + **6 khoá NỢ** trong lát nguyên văn (xem dưới) | đọc key cũ → ghi key mới → xoá key cũ (migration một lần, không mất preference); migration chạy TRƯỚC khi store khởi tạo, test 3 ca + test nguồn mỗi gói |
| Boot marker `__DSH_BOOT__` | **~8** (client/modules) | phát `__GBH_BOOT__` + **giữ alias** `__DSH_BOOT__`; **cập nhật đồng bộ `tools/check/*`** trong cùng thay đổi |
| Env `DSH_HOME` | rải rác | ưu tiên `GBH_HOME`, chấp nhận `DSH_HOME` làm fallback |

Task board: task-29/30/31 (owner: tm-evidence).

**Nợ KHÔNG trả được (quyết định 18/10/2026 — chốt lại khi nghiệm thu task-38):** 6 khoá persist `dsh.*` nằm TRONG **lát nguyên văn** của gói de-bundle:

| Gói | Khoá CŨ (giữ nguyên) | File:line |
|---|---|---|
| ui-conversation | `dsh.conversation.contentWidth` | `src/parts/78-client-skeleton-ConversationWidthControls.ts:11` |
| ui-conversation | `dsh.conversation` | `src/parts/27-types-client-stores.ts:11` |
| ui-schedule | `dsh.schedule.recent-time-zones.v1` | `src/parts/31-recent-time-zones.ts:11` |
| ui-schedule | `dsh.schedule.task-tab.v1.` (tiền tố) | `src/parts/43-task-tab-bindings.ts:11` |
| ui-trajectory | `dsh.trajectory.duration` | `src/parts/part-01.ts:17` |
| ui-trajectory | `dsh.trajectory.jsonStringWrapping` | `src/parts/part-01.ts:28` |

Sửa literal trong lát = phá bất biến de-bundle (task-6) + lệch bản gốc ⇒ **giữ nguyên, ghi nợ**; host/consumer nhận cả hai khoá nên hành vi không gãy. Trả nợ khi lát được chuyển sang **viết tay** (task riêng). Bằng chứng bắt buộc: grep TRƯỚC→SAU + test hai chiều + README ghi lý do giữ alias.

## 4d. Ba kiểu "row" phải phân loại TRƯỚC khi viết (đo 18/10/2026)

| kiểu | dấu hiệu đo được | cách chuyển |
|---|---|---|
| **row TOP-LEVEL** | có `- id: <x>` ở thụt lề 0 trong dump | khai `gbh.row`, mount bình thường |
| **row LỒNG trong config** (vd `persistent-pwsh` trong agent-preset) | chỉ thấy trong `config:` của row khác, không có ở thụt lề 0 | **KHÔNG khai `gbh.row`** (tầng mount không thay row lồng) — port 1:1 + test + ghi nợ |
| **row NHÓM** (`cordis:group`) (vd `optional-ralph` trong `dsh-experimental-ralph-bundle/cordis.patch.yml`) | bundle khác chèn group có `group: true` + con (`isolate: { workflowEngine: true }`) | khai `gbh.row` sẽ thay CẢ NHÓM ⇒ mất con ⇒ phải **overlay patch tầng nhóm** (task riêng), chưa mount |

Trước khi viết bất kỳ row nào: `grep -n "<tên gói>" .parity/dumps/<mới nhất>/ours.yml` và kiểm cả 3 kiểu.

## 4e. Flake ĐÃ BIẾT (18/10/2026): test tệp đơn lẻ xanh, chạy CẢ BỘ đỏ

| ca | hiện tượng | nguyên nhân đo được | cách xử lý |
|---|---|---|---|
| `tests/client/locale.test.ts` → "cổng chống cài hai lần > lần đầu NÉM ⇒ cờ vẫn false ⇒ …" | chạy riêng: **6 pass / 0 fail**; chạy cả bộ: **1 fail** | cờ `bundleInstalled` ở **phạm vi module bundle**; khi tệp test khác đã nạp/áp cùng bundle trước thì cờ đã bật ⇒ `apply(firstCtx)` KHÔNG ném ⇒ ca đỏ oan | nạp bundle với **cache-buster riêng** cho ca này (tiền lệ `resources.test.ts` dùng `?guard=2`) hoặc cô lập state toàn cục (`window`/`navigator`) như `tests/client/client-modules.test.ts` |

Quy tắc: **mọi ca kiểm "cờ chống cài hai lần" phải có instance bundle RIÊNG** (specifier khác nhau), không dựa vào thứ tự nạp của tệp khác.

## 4f. Row khai ĐƯỢC ≠ row mount ĐƯỢC (bài học 19/10/2026)

`check:rows` chỉ so **export + slot của nửa HOST** trong phạm vi nó biết; nó **KHÔNG** kết luận được
"mount an toàn" cho gói **HAI MẶT**. Ca thật: `gbh-api-remotes` khai `gbh.row` và `check:rows` báo
****143 gói đạt · 0 chặn** (đo 19/10/2026 04:20)**, nhưng gói gốc có `dsh.client` + `exports["./client"]` còn gói ta **không** ⇒
mount sẽ **thay row stock và xoá nửa browser khỏi đồ thị boot** (sự cố typert-gateway: 63 entry pending,
trang còn 68 B).

**Luật bắt buộc trước khi khai `gbh.row` cho gói hai mặt:**
1. `grep '"dsh"' apps/host/node_modules/<gói-gốc>/package.json` — nếu gốc CÓ `dsh.client` thì gói ta
   **phải** có `dsh.client` + `exports["./client"]` + nửa client đã port (byte-parity hoặc port 1:1).
2. So `exports` hai bên: thiếu khoá nào ở gói ta = mất khả năng phục vụ khoá đó lúc chạy.
3. Chỉ khai row khi (1)+(2) đạt **và** có lab:row/boot-smoke; nếu chưa, giữ `gbh.row_unmounted_ly_do`
   kèm lý do đo được.

**Bằng chứng định lượng (19/10/2026, `gbh-api-remotes` khai row tạm rồi lab cách ly):**

| phép đo | CÓ row (thiếu nửa browser) | LÀNH (row park) |
|---|---|---|
| `#root` | **13.509** | ≥ 24.602 |
| lỗi console | **1** | 0 |
| `did not activate` (trang / host log) | **2 / 1** | 0 / 0 |
| `check:rows` | **129 gói · 0 chặn** (xanh oan) | **143 gói · 0 chặn** |

⇒ `check:rows` xanh **không** cứu được ca này; **lab:row là cổng bắt buộc** trước khi mount gói hai mặt.


> **CẬP NHẬT 19/10/2026 (sau review chéo tài liệu)**: ví dụ `gbh-api-remotes` dưới đây là **LỊCH SỬ** — gói đó
> NAY ĐÃ CÓ nửa client (`dsh.client` + `exports["./client"]` + `src/client-parts/`, 24 part ≤1.000 dòng, cổng byte
> khớp 1.083.964 B) và **đã mount**. Ví dụ còn đúng thời sự cho "hai mặt thiếu nửa client":
> `gbh-api-terminal-controller` (host 1.037 dòng byte-identical, thiếu client 1.051 + typert.host 1.368 +
> remote-client 604) và `gbh-api-workspace-controller` (host 1.049, thiếu client 530 + typert 898 + 668).
> **LUẬT BOOT DUY NHẤT (chốt 19/10/2026)**: mỗi lượt boot mount **MỘT** row mới (bisect) — nếu cần gom nhiều row
> trong một lượt thì **điều kiện tiên quyết** là TỪNG row đã có `lab:row` + `boot-smoke` riêng ĐẠT (đo cách ly),
> và sau lượt boot đó vẫn phải chạy `check:app` 11/11. Hai câu "bisect 1 row" (HANDOVER) và "gom nhiều row"
> (RUNBOOK) trước đây mâu thuẫn — nay hiểu theo luật này.
## 5. Luật chống hồi quy

- **Stop-the-line**: `gate` / `check:rows` / `check:app` đỏ ⇒ **không nhận thêm package**, sửa trước.
- **Một package một writer** tại một thời điểm; reviewer không sửa hộ.
- **Chỉ Lead boot** (`scripts/restart-host.sh`), gom nhiều row vào **một** lượt boot.
- **Không kill job boot**; **không commit git** khi còn agent khác đang chạy.
- Mọi bản sửa phải kèm **TRƯỚC → SAU bằng số**; “HTTP 200” **không** là bằng chứng.
- Khi một gói chuyển xong: **bảng `vi` của gói đó rời khỏi đăng ký tập trung ở `locale`**, về đúng gói.
