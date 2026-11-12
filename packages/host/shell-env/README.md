<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Nguon doi chieu (G4) + ly do peer + nam cau hoi bat buoc + phan CHUA lam cua @galaxy-blackhole/gbh-shell-env
-->

# `@galaxy-blackhole/gbh-shell-env`

Bản viết lại của Galaxy Blackhole cho **row host `shell-env`** của DSH
(`@deepseek-ai/dsh-shell-env`) — **môi trường shell độc lập với tool**: sổ đăng ký `ctx.shellEnv`
giữ các biến `DSH_*` **tin cậy, theo từng lượt thi hành** mà hai tool shell của model
(`dsh-tool-bash`, `dsh-tool-pwsh`) đọc ở mỗi lời gọi.

## 1. Cặp row đã xác nhận (bước 0) + phân loại MỘT MẶT

| Việc | Bằng chứng đo được |
|---|---|
| Cặp row có thật | `.parity/dumps/2026-10-17T23-54-01/ours.yml` dòng **213–214**: `- id: shell-env` + `name: '@deepseek-ai/dsh-shell-env'` (dump MỚI NHẤT; `oracleA.yml` dòng **202–203** giống hệt); khai gốc ở `apps/host/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml` dòng **278–279** |
| Row **đang BẬT** | Dòng row trong patch nền **KHÔNG** có `disabled` và **KHÔNG** có `config` ⇒ row đang chạy (không bị patch của oracle tắt) |
| MỘT MẶT | `ls apps/host/node_modules/@deepseek-ai/dsh-shell-env/lib/` ⇒ **chỉ `index.js` (127 dòng) + `types/`** — **KHÔNG có `lib/client.js`** |
| Câu hỏi 5 (`dsh.client`) | `package.json` gốc **KHÔNG** có `dsh`/`dsh.client` ⇒ **một mặt**, disable+insert không làm mất nửa client |
| 000e (`locale/`) | Gói gốc **CÓ** `locale/{en,zh}.json` (45 B · 130 B) ⇒ đã chép **byte-for-byte** (`sha256 34fd2ede…` · `6fd02dc9…` khớp hai chiều) |
| Hồ sơ chi phí | **127 dòng** build · **0** inject trong row · **0** primitive client · **1** khoá từ điển (`meta.title`) · **không** trạng thái sống ⇒ row rẻ, hạng "sổ đăng ký thuần" |

### Năm câu hỏi bắt buộc (recipe mục 0)

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row đang BẬT? | **CÓ** — `dsh-base/cordis.patch.yml:278-279`, không `disabled`, không `config` |
| 2 | Thuần host hay có mặt client? | **Thuần host** — chỉ `lib/index.js`; không `loader.create/resolve`, không slot, không CSS |
| 3 | Cần seam nào? | `Service` của cordis (dịch vụ `shellEnv`) · `DSH_ENV_PREFIX` của `dsh-shell` · `DSH_HOME_ENV` + `resolveDshHome` của `dsh-home-paths` · **đọc tuỳ chọn** dịch vụ `profileContext` qua `ctx.get` |
| 4 | Hành vi đo được là gì? | (a) `collect(execution)` trả ảnh chụp `DSH_*` **bất biến, đã sắp khoá** — đây là thứ đi vào `dshEnv` của tiến trình shell; (b) `register()` từ chối 8 lớp khai báo sai với **thông điệp nguyên văn**; (c) `list()` là mặt liệt kê được cho model |
| 5 | Gói gốc có `dsh.client`? | **KHÔNG** (`python3 … get('dsh').get('client')` ⇒ `None`) |

## 2. Nguồn đối chiếu (G4) — đọc CHỈ ĐỌC, rồi viết lại

| Bản gốc (CHỈ ĐỌC) | Của ta | Ghi chú |
|---|---|---|
| `apps/host/node_modules/@deepseek-ai/dsh-shell-env/lib/index.js` (**127 dòng**, `0.2.1-alpha.4`) | `src/index.ts` (**47**) + `src/registry.ts` (**177**) ⇒ `lib/index.js` (**114** dòng đã build) | Cùng bề mặt: `name` · `inject` · `Config` · `ShellEnvRegistry` · `apply` |
| `…/lib/types/index.d.ts` (99 dòng: 3 interface + lớp + `Config`) | `src/types.ts` (**62**) | `BashEnvVariable` · `BashEnvContributor` · `BashEnvVariableInfo` · `Config`; `ToolExecution` khai **theo CẤU TRÚC** (`ShellEnvExecution`) |
| `…/locale/{en,zh}.json` | `locale/{en,zh}.json` | **byte-for-byte** (luật 000e) |
| `…/README.md` mục *managed environment* | §4 dưới đây | Năm khoá dựng sẵn + bốn luật đăng ký |

**Bản gốc không đọc `dsh-app-boot`**: nó khai peer đó nhưng `lib/index.js` **không import** ⇒ gói ta
không khai (không kéo peer không dùng). `@deepseek-ai/dsh-tools` chỉ dùng ở **tầng KIỂU** ⇒ khai theo cấu trúc.

## 3. Vì sao peer là `dsh-shell` + `dsh-home-paths`

| Peer | Vì sao | Ở đâu |
|---|---|---|
| `@deepseek-ai/dsh-shell` | Cần **đúng hằng `DSH_ENV_PREFIX`** của kernel để dựng bốn khoá dựng sẵn; chép chuỗi `"DSH_"` sẽ trôi khi kernel đổi tiền tố | `src/registry.ts` |
| `@deepseek-ai/dsh-home-paths` | Cần **`DSH_HOME_ENV` + `resolveDshHome`**: thứ tự ưu tiên (cấu hình → `$DSH_HOME` → `~/.dsh`) và cách mở rộng `~` là **hợp đồng của kernel**; cài lại là tạo **nguồn sự thật thứ hai** cho đúng giá trị đi vào mọi lời gọi shell | `src/registry.ts` |
| `@deepseek-ai/cordis` · `@deepseek-ai/schemastery` | seam chuẩn của §3b: lớp `Service` và schema `Config` để Settings/config-editor render được | `src/index.ts`, `src/registry.ts` |

`gbh.peers` = `["@deepseek-ai/dsh-home-paths", "@deepseek-ai/dsh-shell"]` ⊆ `peerDependencies`
(**0 tên lệch**, so **PHẦN TỬ**, có **ĐỐI CHỨNG ÂM** trong test). Peer **không** nằm trong `dependencies`.

⚠️ **`dsh-home-paths` NGOÀI bảng §3b** — lý do đo được ở trên; **cần Lead xác nhận** mở rộng §3b
(tiền lệ giống `jobs-local` · `workflow` · `subagent-*` · `agent-default-model` · `subprocess`).
`dsh-shell` đã nằm trong nhóm peer được cấp phép của recipe **§2b** (nhóm executor).

## 4. Hành vi trung thành (kể cả các chi tiết dễ "cải tiến" sai)

**Năm khoá dựng sẵn** (sổ tự sở hữu, plugin không được chiếm):

| Khoá | Nguồn giá trị |
|---|---|
| `DSH_HOME` | `resolveDshHome(config.dshHome)` — **một lần** ở constructor |
| `DSH_SHELL` | hằng `"1"` |
| `DSH_SESSION_ID` | `execution.agent.session.header.id` — **chỉ khi** có `agent` |
| `DSH_PROFILE` · `DSH_PROFILE_DIR` | `ctx.get("profileContext")` — **chỉ khi** dịch vụ có mặt |

1. **Ảnh chụp BẤT BIẾN, khoá đã SẮP**: `collect()` trả `Object.freeze` của bản đồ đã sắp theo tên biến
   (`localeCompare`) ⇒ thứ tự tất định, không phụ thuộc thứ tự đăng ký.
2. **Đóng góp chạy theo TÊN đã sắp** — đóng góp `alpha` chạy trước `zeta`; kết quả cuối vẫn được sắp lại.
3. **Bốn luật đăng ký, đúng thứ tự kiểm** (mỗi luật một thông điệp nguyên văn): tên không rỗng → tên chưa
   dùng → khoá đúng tiền tố + đuôi `^[A-Z][A-Z0-9_]*$` → khoá không bị giữ → mô tả không rỗng →
   khoá chưa có chủ. **Hai luật lúc `collect`**: khoá trả về **phải đã khai**; giá trị **phải là chuỗi**.
4. **Vòng đời theo HIỆU ỨNG**: `register` chạy trong `ctx.effect(…, "bashEnv.register()")`; hàm dọn rút
   **cả tên lẫn mọi khoá** của đóng góp. Lỗi khai báo **ném ngay tại chỗ gọi** và **không để lại trạng thái**.

**C6 — vật thể cấu hình ĐỘC LẬP (kiểm bằng DANH TÍNH)**: hai sổ đăng ký (hai lần cài) có **sổ đóng góp
và sổ chủ khoá riêng**; đăng ký **cùng tên + cùng khoá** ở hai sổ **không xung đột chéo**; dọn bên này
**không lan** bên kia; mỗi lượt `collect()`/`list()` trả **vật thể mới**. Test so `not.toBe` (danh tính)
**kèm ĐỐI CHỨNG**: trong CÙNG một sổ, chiếm lại khoá vẫn **bị chặn** ⇒ tính độc lập không đến từ việc tắt phép kiểm.

## 5. Nghiệm thu (đo trên máy, 18/10/2026)

| Phép đo | Kết quả |
|---|---|
| `bun test tests/host/shell-env.test.ts` | **15 pass · 0 fail · 72 expect** |
| Tập export trên **ARTIFACT** | `["Config","ShellEnvRegistry","apply","inject","name"]` — **= bản gốc**, không `default` |
| `grep -c "id: @deepseek-ai" lib/index.js` | **0** · `__ModuleLoader__` = **0** (row host thuần) |
| `String(Config)` · `name` · `inject` · `apply.length` | trùng bản gốc từng chữ (`{ dshHome?: string }` · `shell-env` · `[]` · `1`) |
| Đối chứng hành vi | **cùng một kịch bản** chạy trên **Context cordis THẬT** cho cả hai bản ⇒ vết `{ảnh chụp, danh sách, kết cục}` **bằng nhau từng phần tử**, gồm **10 đường lỗi** với thông điệp **nguyên văn** |
| Quan hệ kế thừa (§2b) | `Object.getPrototypeOf(ShellEnvRegistry) === Object.getPrototypeOf(bản gốc)` ⇒ **cùng một `Service`** của kernel |
| `locale/{en,zh}.json` | **byte-for-byte** (`sha256` khớp; 45 B · 130 B) + `exports["./locale/*.json"]` |
| `bun run check:rows` | **0 dòng `chan`** cho gói này (gói **chưa khai `gbh.row`**) |
| `bun run gate` | **7/8 XANH** (header · file-length · jsdoc · dep-guard · parity-matrix · typecheck · hygiene). Cổng `test` **ĐỎ** vì **file của gói KHÁC** đang được người khác ghi trong lúc chạy (chính gate in *"KHONG DANG TIN: co 8 tep nguon vua bi ghi trong 120s"*); `bun test tests/host/shell-env.test.ts` chạy riêng: **15 pass · 0 fail** |

**TEST CANH**: test khẳng định gói **CHƯA có `gbh.row`** — bề mặt đã viết xong nhưng **chưa mount**;
ai bật sớm sẽ làm test đỏ ngay (luật *"gỡ khai báo + test canh"*).

## 6. CHƯA làm

- **Chưa khai `gbh.row`** ⇒ chưa mount, chưa có bảng TRƯỚC/SAU trên app 5439. Cần Lead: khai
  `gbh.row: { id: "shell-env", inject: [], tests: [...] }` rồi boot; khi mount, **phải kiểm `(5) did not activate = 0`**
  và **mọi biến shell vẫn tới được tiến trình** (đo bằng một lệnh `bash` in `env | grep DSH_`).
- **Chưa ship `lib/types/*.d.ts`** (như phần lớn gói host viết lại): kiểu công khai hiện chỉ nằm ở `src/`.
- **Khác biệt CÓ Ý**: `ToolExecution`/`DshEnvironment` khai **theo cấu trúc** thay vì `import type` từ
  `dsh-tools`/`dsh-shell` ⇒ không kéo hai peer chỉ-dùng-kiểu; bên gọi không phải đổi gì.
