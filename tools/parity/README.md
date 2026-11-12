<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Huong dan su dung gian parity: oracle, lenh, artifact va nguong dat
-->

# tools/parity — thước đo của dự án

Mọi mốc sau M0 chỉ được coi là "xong" khi giàn này nói **PASS**.

| Lệnh | Việc |
|---|---|
| `bun run parity:dump` | chạy `--dump-config` cho các bên, chuẩn hoá, diff theo row id |
| `bun run parity:shot` | chụp ảnh A/B cùng viewport/route, pixelmatch, ghi hash bundle |
| `bun run parity:report` | chạy dump + shot rồi sinh `.parity/report.md` |
| `bun run tools/parity/clean.ts` | **parity:clean** — kill Chrome còn sót + xoá profile tạm `.parity/tmp/gbh-parity-chrome-*` |
| `bun run tools/parity/health.ts [cổng…]` | **parity:health** — cổng trạng thái: app có sidebar + ô soạn tin, không băng lỗi plugin, không modal API key, và thời điểm đo có nằm trong INVALID_WINDOWS không |
| `bun run tools/parity/dom.ts --against` | **parity:dom** — cây DOM + a11y của 5439 vs 4001, tách **lệch CẤU TRÚC** và **lệch do STATE** |
| `bun run tools/parity/session.ts` | **session round-trip** — phiên tạo ở bên này mở được ở bên kia (app ↔ oracle B, cùng slug workspace) |
| `bun run tools/parity/plugin-external.ts` | **plugin-compat (G1)** — cài plugin NGOÀI từ npm bằng đúng đường DSH, chứng minh nạp + chạy, so phía oracle B, rồi gỡ và khôi phục NGUYÊN BYTE |
| `bun test tests/e2e` | test logic chuẩn hoá, ngưỡng pixel, mask, phân loại delta (không cần server) |

### Chuẩn hoá STATE trong `parity:dom`

Danh sách phiên/workspace trong thanh bên là **trạng thái sống** của từng instance: số phiên, tiêu đề
và thời gian tương đối khác nhau một cách vô nghĩa với UI. Vì vậy cây con khớp
`[role='treeitem'], [role='tree']` bị **chuẩn hoá thành một node nhãn `<state>`** (không đi sâu vào
trong), văn bản của tổ tiên cũng bỏ phần nằm trong vùng đó, và dòng a11y có thời gian tương đối bị loại.
`diff.md` in **hai con số tách biệt**: *lệch CẤU TRÚC* (con số để kết luận) và *lệch do STATE* (đã loại).
Số node bị chuẩn hoá được ghi trong artifact của cả hai bên.

### `parity:plugin-external` — cài plugin ngoài như DSH

Cơ chế cài của DSH (khảo sát từ `apps/host/node_modules/@deepseek-ai/dsh/lib/plugin-*.js`):
`dsh plugin --profile <name> <pnpm-args…>` **chuyển tiếp thẳng tham số cho pnpm** chạy trong thư mục
profile; gói vừa cài được thêm vào `dependencies` **và** vào `dsh.profile.bundles` của
`profiles/<name>/package.json`, nhờ đó lớp patch của nó thành hoạt động. Vì thư mục profile là một
workspace root của pnpm, lệnh cần thêm `-w`.

Máy này **không có pnpm trên PATH**. Công cụ vì thế tự cài pnpm vào một tiền tố RIÊNG
(`/tmp/gbh-pnpm-tools` bằng npm của node 26, không đụng cài đặt toàn cục) rồi chạy đúng lệnh của DSH —
**không** chép tay gói vào `node_modules`. Nếu không có cả npm, công cụ báo SKIP kèm lý do.

Quy trình một lệnh: chụp trạng thái (profile **và** state ở home) → tải tarball và đối chiếu sha512 →
cài → kiểm row trong cây dump → thăm route riêng của plugin (đối chứng: oracle A phải 404) → bằng chứng
trình duyệt (entry trong `__DSH_BOOT__`, byte bundle tải về, chuỗi riêng của plugin, mục Settings mới) →
so cùng plugin trên oracle B → gỡ → khôi phục **nguyên byte** và kiểm lại.

**Bài học bắt buộc (13:43–13:55):** khôi phục phải bao cả **state ở HOME**, không chỉ profile.
`dsh-settings` đổi tên `settings.yaml` → `settings.yaml.imported` rồi nạp vào profile; tệp trơ còn lại
làm màn *Settings → Agent presets* lệch 3.180 px. Công cụ chụp và khôi phục `settings.yaml`,
`settings.yaml.imported` và cả cây `.agent-presets/`, đồng thời ghi số entry `__DSH_BOOT__`
trước/trong/sau để chứng minh chu trình thêm đúng 1 entry rồi bỏ đúng 1 entry.

> Lead thêm giúp một dòng vào `package.json` root (ngoài write scope của parity):
> `"parity:clean": "bun run tools/parity/clean.ts"`.

## Hai cặp ảnh trong mỗi lần report

`parity:report` chụp **cả hai** bên tham chiếu trong cùng một phiên (dump rồi shot liền nhau):

| Cặp | Ý nghĩa |
|---|---|
| **ours vs oracleA** (5439 vs 4001) | cặp người dùng nhìn — cả hai đều branded, phải gần 0 px ngoài mask |
| **ours vs stock** (5439 vs 4543) | mốc DSH sạch; khác biệt ở đây được giải trình là "delta Galaxy" chứ không tính là lỗi |

### Vùng mask (có lý do, ghi trong report)

| Vùng | Nhóm | Vì sao |
|---|---|---|
| `brand-sidebar` | brand | wordmark sidebar (D9 cho phép khác brand) |
| `brand-hero` | brand | logo + wordmark màn hình chào |
| `state-sidebar-list` | state | danh sách workspace/session là **trạng thái sống** của từng instance |

Ảnh diff vẽ **viền xanh** quanh vùng mask. Mỗi cặp báo cả **tỉ lệ ngoài mask** (số chính) và
**tỉ lệ thô** (đối chiếu). Đổi mask bằng `--masks <file.json>` hoặc tắt bằng `--no-mask`.

## Ba oracle

| Tên | Là gì | Ở đâu |
|---|---|---|
| `ours` | app của ta (vỏ Tauri/CLI, profile `blackhole`) | http://127.0.0.1:5439 |
| `stock` | **Oracle B tái lập được**: profile `web` nguyên bản của harness, home tạm | http://127.0.0.1:4543 |
| `oracleA` | **Oracle A**: blackhole web của người dùng, đang chạy | http://127.0.0.1:4001 |

`oracleA` được **dò tự động**: đọc tiến trình đang listen cổng 4001 (`lsof` + `ps`), lấy đúng
`bin.js`, `--profile`, các `--patch` và `DSH_HOME` từ chính cmdline/file đang mở của nó —
nên dump của oracleA là **đúng cây đang chạy**, không phải cây ta đoán.

### Xác thực (không cần token từ log)

DSH lưu secret ký cookie phiên trong tài liệu credentials dùng chung
(`records."client-connection/browser-session"`). Parity tự mint cookie
`dsh-auth-<sha256(authority)>` = `v1.<payload>.<hmac-sha256>` đúng như `dsh-client-connection`.
**Giá trị secret/token không bao giờ được in ra log hay ghi vào report.**

## Cài phụ thuộc

`bun.lock` ở root do Lead giữ. Vì vậy `tools/parity/node_modules` được vendored (copy từ một
thư mục cài đặt **ngoài** workspace) để không ai phải chạy `bun install` ở root:

```bash
tools/parity/setup.sh          # cài ngoài workspace rồi copy vào tools/parity/node_modules
```

Khi Lead chạy `bun install` ở root, `tools/parity/package.json` đã khai báo đủ 4 gói
(playwright-core, pixelmatch, pngjs, yaml) nên node_modules của workspace cũng đủ.

## Artifact (`.parity/`, gitignored)

```
.parity/
  report.md                     # báo cáo tổng hợp (Markdown)
  latest.json                   # máy đọc: trạng thái + số liệu của lần chạy gần nhất
  dumps/<stamp>/<target>.yml    # dump-config thô
  dumps/<stamp>/<target>.json   # dump đã chuẩn hoá
  dumps/<stamp>/diff-<a>-vs-<b>.md
  shots/<stamp>/ref-<size>.png  ours-<size>.png  diff-<size>.png
  shots/<stamp>/ref.png  ours.png  diff.png      # ảnh của viewport đầu tiên (tiện mở)
```

## Ngưỡng đạt

| Hạng mục | Ngưỡng | Nguồn |
|---|---|---|
| dump-config diff | **0** row THÊM/THIẾU/ĐỔI | §5.2 C3, D9 |
| pixel diff | **≤ 0.1%** số pixel **ngoài vùng mask** | §5.2, R11, D9 |
| allowlist cặp app-vs-oracle | **rỗng** — không miễn trừ row nào | task-5 |
| hash bundle | asset name + thứ tự trùng nhau | R8 |
| boot contract | tập khoá của `__DSH_BOOT__` trùng nhau | C1 |


## ⚠️ Bẫy đo đã trả giá (17/10/2026, giàn A/B)

Một lượt đo `plugins-installed` **SKIP oan 3 lần** vì cổng trạng thái `parity:health` đọc 5439 bằng **cookie mint từ `~/.galaxy/credentials.yaml`** và nhận **401**, trong khi app hoàn toàn lành.

**Cách phân biệt (chạy cả hai, đừng đoán):**

    # 1) đường TOKEN: đổi token trong ready-url thành phiên qua một lượt điều hướng
    U=$(cat ~/.galaxy/blackhole/ready-url.txt)
    curl -sL -c /tmp/ck.txt -b /tmp/ck.txt -o /dev/null -w '%{http_code}\n' "$U"      # 200 = app LÀNH

    # 2) đường SECRET: mint cookie từ credentials rồi gọi trần
    bun run .parity/features/probe/mint-check.ts                                        # in vân tay secret + status

**Hai kết quả này KHÁC NHAU nghĩa là gì?**
- **(1) 200 nhưng (2) 401** ⇒ **secret của lượt boot đang chạy KHÁC secret dùng chung** trong `credentials.yaml`. App vẫn lành; **dụng cụ đo mới là thứ hỏng**. Không phải lỗi giao diện, đừng đi tìm lỗi ở row.
- **(1) 401 và (2) 401** ⇒ app thật sự chưa phục vụ (hoặc token trong `ready-url.txt` đã bị lượt boot khác ghi đè — xem `ls -la ~/.galaxy/blackhole/ready-url*.txt`).

**Cách sửa đúng** (thuộc người giữ cổng, KHÔNG tự làm): boot lại 5439 bằng `scripts/restart-host.sh` — lệnh này chạy `env -u DSH_HOME -u GBH_HOME` nên lượt boot mới dùng lại **secret dùng chung**, và giàn đo mint cookie được trở lại.

**Kết luận cho người đo**: khi gặp SKIP vì 401, **đừng tự restart** và **đừng kết luận app hỏng** — chạy hai lệnh trên để biết mình đang ở ca nào, rồi báo người giữ cổng.


## Phép kiểm ĐỒ THỊ CLIENT — `tools/parity/graph.ts` (17/10/2026)

`parity:dump` so **danh sách row trong config**; nó **KHÔNG** thấy đồ thị client. Khi ta thay một row, **entry id STOCK biến mất khỏi đồ thị**, nhưng các entry STOCK khác **inject đúng id đó** ⇒ chúng không bao giờ activate ⇒ treo `loading` ⇒ cascade `waiting for service: uiConversation` ⇒ trang trắng/ngắn. Đây là gốc của 14 entry không activate và của nhiều lượt lab trắng.

    bun run tools/parity/graph.ts [cổng] [--json]      # mặc định cổng của ta

In ra: số entry · id các gói của ta · **id stock bị inject nhưng THIẾU entry** · **entry KHÔNG activate** · kết luận ĐẠT/KHÔNG ĐẠT.

**Luật của phép kiểm này**: `entries = 0` ⇒ **KHÔNG ĐẠT** (không đọc được đồ thị thì không được phép kết luận ĐẠT). Chính tôi đã viết sai chỗ này ở bản đầu — nó báo `ĐẠT` khi app không có `__DSH_BOOT__`; bản hiện tại in kèm `LÝ DO` và các **khoá của payload boot** để tự chẩn đoán khi hình dạng payload khác kỳ vọng.
