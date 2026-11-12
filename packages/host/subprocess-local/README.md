<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README cua @galaxy-blackhole/gbh-subprocess-local — port NGUYEN VAN TUNG BYTE ba artefact
      (index.js 1.692 + output.js 239 + runner-launch 1.529 dong); ROW DANG PARKED
-->

# @galaxy-blackhole/gbh-subprocess-local

Bản viết lại Galaxy Blackhole cho @deepseek-ai/dsh-subprocess-local (0.2.1-alpha.4) — runtime tiến trình CỤC BỘ:
spawn/giám sát/huỷ tiến trình con (Linux scope, Windows job, terminal/pty, shell activity).

## 1. Đo 4 bước TRƯỚC khi viết (19/10/2026)

| phép đo | kết quả | hệ quả |
|---|---|---|
| gói hai mặt? | **KHÔNG** — chỉ nửa host: lib/index.js 1.692 dòng + output.js 239 + runner-launch 1.529 + runner.js 436 | một mặt ⇒ không nợ nửa client |
| row trong dump | **'- id: subprocess'** TOP-LEVEL → @deepseek-ai/dsh-subprocess-local (row id KHÁC tên thư mục) | thay được, nhưng xem §5 (PARKED) |
| trùng tên service | package ta chưa từng có 'subprocess' | an toàn |
| bề mặt export | { LocalSubprocessRuntime, LocalSubprocessRuntime as default } | artefact giữ đúng 2 tên |
| vendor trong bundle | node-pty/koffi/win32-process đều qua **lazy-require**, không có khối vendor nhúng; chunk có 34 lần nhắc pty/koffi nhưng là GLUE gọi qua lazy-require | không tách vendor; khai dependency + symlink |
| entry phụ | './output' (output.js) và chunk nội bộ './runner-launch-B2zsQ1Dz.js' | **index.js import chunk lúc chạy** ⇒ BẮT BUỘC port kèm, nếu không import sẽ gãy |

## 2. TRƯỚC → SAU

| hạng mục | TRƯỚC | SAU |
|---|---|---|
| gói trong repo | **chưa tồn tại** | packages/host/subprocess-local/ (src 3 bộ lát + build + tools) |
| artefact 1 | chỉ trong bundle stock | **lib/index.js 1.692 dòng · sha256 2964d94d6aa735f79e5c… = gốc** · 8 lát |
| artefact 2 | — | **lib/output.js 239 dòng · sha256 4f77ef6da608d36df168… = gốc** · 3 lát |
| artefact 3 | — | **lib/runner-launch-B2zsQ1Dz.js 1.529 dòng · 57.475 B · sha256 6df08adc4a27f278878a… = gốc** · 10 lát (GIỮ ĐÚNG tên có hash vì index.js import tên này) |
| artefact 4 | — | **lib/runner.js 436 dòng · 13.483 B · sha256 4e21528dfdb3e92bdce2… = gốc** · 4 lát + khai lại export `./runner` (types ./lib/types/bin.d.ts) — BẮT BUỘC vì chunk gọi `import.meta.resolve("@deepseek-ai/dsh-subprocess-local/runner")` lúc chạy; thiếu nó thì Linux transient scope + Windows Job mất containment (probe try/catch ⇒ false) |
| bề mặt kiểu | lib/types/* của stock | chép nguyên cây + lib/index.d.ts (export * + default LocalSubprocessRuntime) |
| test | 0 | xem §4 |
| row 'subprocess' | stock | **PARKED** (chưa khai) — xem §5 |

## 3. Cổng byte

build.ts ghép 3 artefact rồi so **TỪNG BYTE** với bản gốc; lệch 1 byte là NÉM (báo byte lệch đầu tiên + sha256 12
ký tự hai bên). Lần chạy của tôi: cả 3 artefact **byte-identical** (3.460 dòng tổng, 0 byte lệch). Lát lớn nhất 596
dòng (< 1000).

## 4. Test A/B (tests/host/subprocess-local.test.ts)

Hai tệp: `tests/host/subprocess-local.test.ts` **28 ca / 111 expect / 0 fail** (970 dòng) + `tests/host/subprocess-local.node.test.ts`
**6 ca / 11 expect / 0 fail** (154 dòng — bổ sung bằng chứng RUNTIME: bun nạp cả hai bên cùng ném cùng thông điệp;
Node v26 nạp được và bề mặt export trùng; A/B hành vi thật qua node: echo · exit 7 · lệnh không tồn tại ·
resolveExecutable). Tổng: **34 ca / 122 expect / 0 fail** (chạy chung 2 tệp: 9,6 s).

Nhóm ca: A artefact byte-identical (3) · B bề mặt export + Context cordis thật (3) · **C tiến trình THẬT (14)**:
echo hello · sh exit 7 · printf A/B>&2 · env · stdin→cat · lệnh không tồn tại · cwd không tồn tại · gom maxBytes 4 ·
spill toàn luồng · stdout 'pipe' thô · /usr/bin/true + waitForExit · sleep bị AbortSignal (SIGKILL tất định) ·
terminalEnvironment · spawnTerminal argv rỗng · D nhánh lỗi tham số (6) · E vòng đời/dispose (2).

**Không gọi mạng**: chỉ spawn /bin/echo, /bin/sh -c, /bin/cat, /usr/bin/true, /bin/ps; grep artefact + test: không
node:http/https/net/tls/dgram, không fetch, không socket. Mọi tệp tạm trong mkdtemp(os.tmpdir()), dọn ở afterAll
(đo trước/sau: số thư mục tạm không đổi).

**Ràng buộc runtime (quan trọng)**: bun 1.3.14 THIẾU `node:util.getSystemErrorMessage` mà chunk runner-launch
import ở cấp module ⇒ **bun không nạp được artefact này**; **bản stock lỗi Y HỆT** ⇒ không phải lỗi port. Node
v26.9.0 nạp OK. Vì vậy test A/B chạy mỗi bên trong MỘT tiến trình bun con sạch (tệp tự chạy lại ở chế độ harness
qua env GBH_SUBPROCESS_SIDE, cài shim chỉ THÊM hàm thiếu — cùng một shim cho hai bên) rồi cha so từng ca.

## 5. ROW PARKED — lý do và điều kiện khai lại

- Row stock là **'- id: subprocess'** (TOP-LEVEL) ⇒ về kỹ thuật thay được; package ta khai `gbh.row_unmounted_ly_do`
  với `row.id = 'subprocess'`.
- **Quy ước gọi cổng**: `lab:row`/`boot-smoke` nhận THAM SỐ là **TÊN THƯ MỤC** (`subprocess-local`) rồi đọc
  `gbh.row.id` (= `subprocess`) để biết row nào bị thay. Đừng truyền `subprocess`.
- Chỉ khai lại khi: (1) test A/B xanh, (2) **Lead TỰ chạy boot-smoke subprocess-local ĐẠT**, (3) Lead thêm dòng
  packages/README.md §4. Trước đó row phải ở dạng park `{ ly_do, row: { id, aliases, moduleIds, tests } }`.

## 6. Nợ kỹ thuật

1. ~~`lib/runner.js` chưa port~~ → **ĐÃ port** (artefact 4, byte-identical) + export `./runner` khớp bản gốc.
2. Row khác: ngoài row 'subprocess' còn row 'sandbox' (@deepseek-ai/dsh-sandbox-local) — không thuộc gói này.
3. Symlink: `@deepseek-ai/*` (5 cấp) + `node-pty`/`koffi` nằm TRỰC TIẾP trong node_modules/ (4 cấp).
4. PTY thật (node-pty) đo được ở cả hai bên nhưng tốn ~9 s/bên nên KHÔNG đưa vào cổng — lý do ghi trong JSDoc tệp test.
