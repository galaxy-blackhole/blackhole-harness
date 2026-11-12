<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README gói @galaxy-blackhole/gbh-sandbox — nguồn đối chiếu, lý do 5 peer (2 ngoài §3b), bảng TRƯỚC/SAU, phần CHƯA làm
-->

# @galaxy-blackhole/gbh-sandbox

Bản viết lại của Galaxy Blackhole cho row **`sandbox`** của DSH (tier T4, nhóm `sandbox`): backend sandbox
**cục bộ** — service **`ctx.sandbox`** bọc argv của MỌI capability thực thi (bash, pwsh, PTC runtime) vào runner
cưỡng chế của nền tảng, báo **mức cưỡng chế** + **phương ngữ từ chối** + **luật lỗi runner**, và **ĐÓNG CỬA**
(`SANDBOX_UNAVAILABLE`) khi không có runner dùng được — không bao giờ trả argv nguyên bản.

## 0. Tên gói: đo trên dump ĐANG CHẠY

| Sự kiện | Bằng chứng |
|---|---|
| Row **`sandbox`** có THẬT và ĐANG BẬT | `.parity/dumps/2026-10-18T01-31-57/ours.yml` dòng **188–189**: `- id: sandbox` + `name: '@deepseek-ai/dsh-sandbox-local'`; **KHÔNG** có `disabled:`, **KHÔNG** có `config:`, **KHÔNG** có `inject:` (row trần, không `!!js`) |
| Tên plugin gốc của row là `dsh-sandbox-local` (**556 dòng**) | `apps/host/node_modules/@deepseek-ai/dsh-sandbox-local/lib/index.js` = **556 dòng**; `dsh-sandbox` chỉ **289 dòng** và là **seam trừu tượng** (không phải row: không có `id: sandbox` nào trỏ tới nó trong bốn dump `ours.yml`/`stock.yml`/`oracleA.yml`/`oracleA_nopatch.yml`) |
| Tên gói của ta theo **row id** | tiền lệ trong repo: row `subprocess` (plugin gốc `dsh-subprocess-local`) → `@galaxy-blackhole/gbh-subprocess`; row `sandbox` (plugin gốc `dsh-sandbox-local`) → **`@galaxy-blackhole/gbh-sandbox`** |

## 1. Nguồn đối chiếu (G4)

| # | Nguồn (CHỈ ĐỌC) | Đọc gì | Mức dẫn xuất |
|---|---|---|---|
| 1 | `apps/host/node_modules/@deepseek-ai/dsh-sandbox-local/lib/index.js` (556 dòng) | toàn bộ thân bundle: bảng `PLATFORM_CHAINS` · `STATIC_ENFORCEMENT` · `DENIAL_SIGNATURES` · `RUNNER_FAILURE_RULES` · ba phép dò · `bwrapProfileArgs`/`landlockProfileArgs`/`seatbeltProfileArgs` · lớp `LocalSandboxProvider` (13 phương thức) | **viết lại theo hành vi** (không chép code); các **CHUỖI** là hành vi nhìn thấy được nên giữ **nguyên văn**: thông điệp lỗi cấu hình, `fatalSignatures`, `informationalLines`, `denialSignatures`, thông điệp `AggregateError` |
| 2 | `…/lib/types/index.d.ts` (187 dòng) + `…/lib/types/profiles.d.ts` (27 dòng) | hợp đồng công khai: `Config` · `SandboxInternals` · `LocalSandboxProvider` (kể cả 11 móc `internals`) | tham chiếu |
| 3 | `…/package.json` | `dsh.client` (**KHÔNG** có ⇒ thuần host) · `exports` (có `./locale/*.json`) · peer gốc | tham chiếu |
| 4 | `…/locale/{en,zh}.json` | `meta.title` cho màn Plugins (`sandbox-local` · `本地进程沙箱`) | **chép byte-for-byte** (sha256 `e58e9c04…` · `9169dcaf…`) |
| 5 | `…/README.md` (149 dòng) | Source map của chính gốc: `src/index.ts` (chọn chuỗi + bọc + vòng đời grant) và `src/profiles.ts` (ba hồ sơ) — quyết định cách TÁCH MODULE của ta | tham chiếu |
| 6 | `docs/PARITY-MATRIX.md` dòng 40 | row ↔ gói gốc (`@deepseek-ai/dsh-sandbox-local`), tier T4, phụ thuộc `cordis, dsh-llm, dsh-sandbox +3` | tham chiếu |

**Tách module của ta** (3 file, đúng theo Source map của gốc + một file cho bảng/rung):
`src/index.ts` 480 dòng (lớp provider + `confine` + vòng đời grant) · `src/profiles.ts` 65 dòng (ba hồ sơ) ·
`src/chain.ts` 160 dòng (bảng chuỗi/dialect/luật lỗi + ba phép dò + `assertPositiveFinite`/`assertNever`).

## 2. Peer — vì sao, và thuộc seam nào (5 peer; **2 NGOÀI bảng §3b**)

| Peer | Thuộc seam | Vì sao cần |
|---|---|---|
| `@deepseek-ai/cordis` | bậc 1 §3b — vòng đời plugin + `Service`/`Context` | lớp provider PHẢI kế thừa **cùng một** `SandboxProvider`/`Service` mà kernel cấp; cần `ctx.inject`/`ctx.effect`/`ctx.logger` |
| `@deepseek-ai/schemastery` | bậc 1 §3b — schema `Config` | `static Config` để Settings/config-editor render `runnerCommand` · `runnerFailureSignatures` · `probeTimeoutMs` |
| `@deepseek-ai/dsh-sandbox` | bậc 2 §3b — nhóm executor (§2b) | **kế thừa** `SandboxProvider` (kiểm bằng `Object.getPrototypeOf`), dùng `SandboxUnavailableError` (**cùng lớp** để `instanceof`/mã lỗi đi qua `tool/result`), `canonicalPath`, `writableRoots` |
| `@deepseek-ai/dsh-sandbox-windows-acl` | ⚠️ **NGOÀI §3b** — thư viện hạ tầng của DSH | rung win32: `AclWriteGrant` · `workspaceWriteSid`/`tempWriteSid` · `assertTempRootOutsideWorkspace` · `registerAclDiagnosisSkill` · **và chính runner** (`import.meta.resolve("…/runner")`). **Lý do ĐO ĐƯỢC**: hợp đồng là **cùng lớp + cùng danh tính SID** — gói này 1.411 dòng FFI (kernel32/advapi32) + runner 188 dòng; bản sao thứ hai sẽ tính **SID khác** cho cùng workspace ⇒ ACE của ta không mở đúng chỗ runner cưỡng chế |
| `@deepseek-ai/node-addon-system` | ⚠️ **NGOÀI §3b** — bậc 3 "thư viện npm thật" | `/landlock-run`: `LAUNCHER_BIN` · `LAUNCHER_FAILURE_EXIT` (125) · `grantArgs` · `launcherPath` · `probe`. **Lý do ĐO ĐƯỢC**: đây là **binary gốc theo nền tảng** (`@deepseek-ai/node-addon-system-<os>-<arch>/bin/landlock-run`) + **hợp đồng CLI** của nó (`--probe` in "partially enforced", lỗi thoát 125, dòng chí tử tiền tố `landlock-run: `) — không thể viết lại bằng JS thuần |

Điều kiện §3b: cả 5 đều là **`peerDependencies`** (và `devDependencies` để tsc phân giải), **KHÔNG** có
`dependencies` (test khẳng định `dependencies` RỖNG). **Hai peer ngoài bảng cần Lead xác nhận mở rộng §3b**,
như tiền lệ `approval` (`dsh-session`) · `jobs-local` (`dsh-jobs`/`dsh-scope`/`dsh-timeout`) · `workflow` (`dsh-llm`).

## 3. Bề mặt phải khớp (đo trên ARTIFACT)

| Hạng mục | Giá trị |
|---|---|
| Export | `LocalSandboxProvider` · `default` (= chính lớp ấy) — **2 = 2**, 0 thiếu · 0 thừa |
| Prototype | **13** phương thức: `chainVerdict` · `confine` · `constructor` · `landlockLauncher` · `materializeAclGrant` · `probeRunner` · `removeTempDir` · `revokeAclGrants` · `runnerArgv` · `seatbeltExec` · `selectRunner` · `windowsAclRunnerArgv` · `windowsAclRunnerInvocation` — **trùng tên từng cái** |
| Service | tên `sandbox` (do `SandboxProvider` cấp); `static Config` (schemastery: `runnerCommand` · `runnerFailureSignatures` · `probeTimeoutMs` = 5.000) |
| Chọn runner | theo **nền tảng trước** (`linux`: bwrap → landlock · `darwin`: seatbelt · `win32`: windows-acl), dò **sau**; ứng viên duy nhất KHÔNG dò; kết luận **nhớ** cho quãng đời provider (kể cả `unavailable`) |
| Hồ sơ | bwrap (ro-bind + /dev + PID namespace + `--die-with-parent`, thêm `--tmpfs /tmp` + bind workspace) · Landlock (`--ro /` + `--rw /dev/null[,/tmp,workspace]`) · Seatbelt (`(deny file-write*)` + literal `/dev/null` + subpath các gốc từ `writableRoots`) |
| Dialect từ chối | bwrap `read-only file system` · landlock `permission denied` · seatbelt `operation not permitted` · windows-acl 4 chuỗi · `runnerCommand` 2 chuỗi |
| Luật lỗi runner | bwrap `bwrap: ` · landlock exit **125** + `landlock-run: ` + dòng thông tin "partial enforcement (older Landlock ABI)" · seatbelt `sandbox-exec: ` · windows-acl exit **127** + `windows-acl-run: ` |
| Grant windows-acl | SID theo **workspace** (đứng yên, ACE tái dùng giữa phiên) + thư mục tạm **ngẫu nhiên** mỗi cặp phiên/workspace (SID riêng, thu hồi khi dispose); lượt không phiên ⇒ `--temp <tmpdir>` và **không** cờ SID |

## 4. TRƯỚC/SAU và lệnh tái lập

| Phép đo (chạy CẢ HAI bản) | TRƯỚC (bản gốc) | SAU (bản của ta) |
|---|---|---|
| Bọc argv — **8 kịch bản** (cả 4 rung × 2 chế độ bị cưỡng chế) | oracle | **trùng từng ký tự JSON** (`argv` · `enforcement` · `denialSignatures` · `runnerFailureRules`); mỗi kịch bản còn khẳng định **đúng runner ở `argv[0]`** |
| Đóng cửa: nền tảng không chuỗi, và Linux cả hai rung hỏng | `SandboxUnavailableError` · `SANDBOX_UNAVAILABLE` | **y hệt**, cùng thông điệp "refusing to run the command unconfined" |
| Huỷ TRƯỚC khi giải policy | `AbortError` | **y hệt** |
| `runnerCommand` (khẳng định của người vận hành) | hồ sơ bwrap + `enforcement: full` + dấu hiệu đã cấu hình | **y hệt** |
| Cấu hình sai: 5 ca ở constructor + 4 giá trị ở schema | 9 thông điệp | **trùng từng thông điệp** |
| Vòng đời grant (sổ **GIẢ** — host darwin không cấp được ACE thật) | oracle | cùng `dispose` từng grant · cùng xoá thư mục tạm · cùng xoá sổ · **không ném** khi dọn dẹp hỏng |
| Tập export trên artifact | 2 tên | **2 tên, 0 thiếu · 0 thừa** |
| `String(Config)` + `Config({})` | oracle | trùng từng ký tự / từng giá trị |
| `locale/{en,zh}.json` | 49 B · 143 B | **byte-for-byte** (sha256 khớp) |
| `grep -c "id: @deepseek-ai" lib/index.js` | — | **0** |

```bash
cd packages/host/sandbox && bun run build.ts              # ⇒ lib/index.js (ESM, 372 dòng)
grep -c "id: @deepseek-ai" lib/index.js                    # ⇒ 0
cd ../../.. && bun test tests/host/sandbox.test.ts         # ⇒ 9 pass / 0 fail / 137 expect
bun run check:rows                                         # gói này: 0 dòng (chưa khai gbh.row)
bun run gate --no-tests                                    # các cổng của gói này XANH
```

**Vì sao chưa có TRƯỚC/SAU trên app 5439**: gói CHƯA khai `gbh.row` (xem §7) nên chưa mount. Mọi phép đo trên
đây đều trên **artifact** hoặc **đối chứng trực tiếp với chính bundle gốc**.

## 5. Test

`tests/host/sandbox.test.ts` — **9 ca / 137 expect / 0 fail**, mọi phép so đều chạy **CẢ HAI bản**:

1. **ARTIFACT**: build bằng chính `build.ts`, nạp artifact, so **tập export** + `default === LocalSandboxProvider`
   + **tên 13 phương thức prototype** + tên thuộc tính tĩnh + `String(Config)` + `Config({})`; `grep` hai chiều
   `id: @deepseek-ai` / `id: @galaxy-blackhole` ⇒ **0**.
2. **locale byte-for-byte** (`Buffer.equals`) + **test canh**: gói **KHÔNG** khai `gbh.row` (an toàn cho mọi lượt boot).
3. **Manifest**: `gbh.peers ⊆ peerDependencies` so **PHẦN TỬ** (5/5) + **BA ĐỐI CHỨNG ÂM** — thêm một peer lạ, xoá
   **từng** peer khỏi `peerDependencies`, và một tập **cùng số lượng nhưng khác phần tử** (đúng cái bẫy "so số lượng
   cho verdict rỗng"); `dependencies` RỖNG.
4. **Hành vi — bọc argv**: **8 kịch bản** phủ **cả 4 rung × cả 2 chế độ** bị cưỡng chế; so **từng ký tự JSON** với bản gốc,
   và mỗi kịch bản khẳng định **đúng runner ở `argv[0]`** + đúng mức cưỡng chế + `--` + dialect/luật lỗi khác rỗng.
5. **Hành vi — đường lỗi**: đóng cửa (2 dạng) · `AbortError` · `runnerCommand` · **kết luận `unavailable` được NHỚ**
   (đổi nền tảng sau đó vẫn đóng cửa, không dò lại) · **phép dò chạy ĐÚNG MỘT LẦN** mỗi rung; so cả **tên lớp + mã lỗi + thông điệp**.
6. **Cấu hình sai**: 5 ca constructor + 4 giá trị schema, **trùng từng thông điệp** hai bên.
7. **C6 — DANH TÍNH** (`not.toBe`, không so sâu): hai provider không chia sẻ `internals`/sổ grant; sửa
   `internals` của bên A **không lan** sang bên B; `Config({})` trả vật MỚI (mảng mặc định mới) ở **cả hai bên**.
8. **Vòng đời grant** (trạng thái **TỰ DỰNG**, dán nhãn đúng loại): sổ grant giả ⇒ dispose đủ, xoá đủ thư mục,
   dọn sổ, và **không ném** khi cả grant lẫn bước xoá đều hỏng.
9. **Mount như Service**: `ctx.plugin` rồi `waitFor` **CÓ TRẦN 2.000 ms** (không ngủ cố định) tới `ctx.sandbox`
   ở trạng thái ACTIVE (2), rồi `confine()` cho **cùng kết quả** hai bên.

## 6. Khác biệt CÓ Ý (đã đo, không phải nợ kỹ thuật)

1. **Constructor tự điền mặc định** ba trường (`?? []` / `?? 5.000`) thay vì ném `TypeError` khi bị gọi **TRỰC TIẾP**
   với `{}` (bản gốc đọc `config.runnerCommand` không phòng `undefined`). Qua **loader** thì **y hệt**: `static Config`
   điền mặc định TRƯỚC khi constructor chạy (đo: `Config({})` hai bên ra cùng giá trị; 9 ca cấu hình sai cho **cùng
   thông điệp**).
2. **`assertNever` viết lại cục bộ** (gói `@deepseek-ai/dsh-util-values` nằm NGOÀI §3b): hàm chỉ ném
   `unreachable variant: <JSON>` và **không nhánh nào tới được** trong sản phẩm.
3. **Tách 3 module** thay vì một bundle: `index` · `profiles` · `chain` — cùng ranh giới mà README gốc mô tả
   (`src/index.ts` + `src/profiles.ts`), tách thêm phần bảng/rung cho dễ đối chiếu; `build.ts` gộp lại **một**
   artifact ESM như profile cần.

## 7. CHƯA làm (điều kiện chặn mount, không phải ghi chú cuối báo cáo)

1. **CHƯA khai `gbh.row`** — theo luật của Lead cho lô M6: chỉ khai khi đã chạy sạch trong lab. Hệ quả: gói này
   **không thể làm hỏng app** ở bất kỳ lượt boot nào (không có khối disable+insert nào được sinh).
2. **CHƯA mount + CHƯA có TRƯỚC/SAU trên app 5439** (`check:app` 11 chỉ số · parity 0/0/0) — chờ lượt boot của Lead.
3. **CHƯA chạy `lab:row`** (công cụ cần gói đã khai `gbh.row`).
4. **Nhánh windows-acl THẬT chưa đo được trên host darwin**: `AclWriteGrant.create` ném
   `Failed to load shared library: dlopen(kernel32.dll…)` — **hai bên ném cùng thông điệp** (đo trong ca đường lỗi),
   nhưng SID/DACL/runner thật chỉ kiểm được trên Windows. Phần đã đo: argv read-only + workspace-write **không phiên**,
   và **vòng đời grant bằng sổ giả**.
5. Row này là **row NỀN của mọi executor**: `bash-sandbox` · `pwsh-sandbox` · `ptc-runtime` gọi `ctx.sandbox.confine`.
   Trước khi mount BẮT BUỘC đo lại nhóm ấy trên lab (cùng thứ tự argv + cùng `enforcement`) — đã có test đối chứng
   từng ký tự với bản gốc cho cả 4 rung.

## 8. Năm câu hỏi bắt buộc (mục 0 của công thức)

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row có đang **BẬT** không? | **CÓ** — `ours.yml` (dump `2026-10-18T01-31-57`) dòng **188–189**: `- id: sandbox` + `name: '@deepseek-ai/dsh-sandbox-local'`; **KHÔNG** `disabled:` (kể cả `!!js`), **KHÔNG** `config:`, **KHÔNG** `inject:`. Đo trên dump, KHÔNG chạy `bh host --dump-config` vì lệnh ấy ghi lại `app.patch.yml` của app đang chạy |
| 2 | Thuần host hay có mount surface client? | **THUẦN HOST** — chỉ `Service` + `spawnSync`; không `slots.register`, không `loader.create/resolve`, không `__ModuleLoader__` |
| 3 | Cần **seam** nào? | `extends SandboxProvider` (`dsh-sandbox`, bậc 2 §3b) · `Service`/`Context`/`ctx.inject`/`ctx.effect` (cordis) · `schemastery` · hai gói hạ tầng **ngoài §3b** đã khai lý do ở §2 (**cần Lead xác nhận**) · `node:child_process/fs/os/path/url` |
| 4 | **Hành vi đo được** là gì? | `ctx.sandbox.confine(argv, policy[, signal])` trả `{argv, enforcement, denialSignatures, runnerFailureRules}`; nền tảng không runner ⇒ ném `SANDBOX_UNAVAILABLE`; phép dò chạy **một lần** rồi nhớ; rung windows-acl cấp/thu hồi grant ghi theo workspace & phiên |
| 5 | Gói gốc có **`dsh.client`** không? | **KHÔNG** — `package.json` gốc không có khoá `dsh`, và `lib/client.js` **không tồn tại** ⇒ **MỘT MẶT**, thay được ngay, không cần nửa browser |
