<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại Galaxy Blackhole cho gói THƯ VIỆN @deepseek-ai/dsh-llm-deepseek (DeepSeek Messages adapter)
-->

# @galaxy-blackhole/gbh-llm-deepseek-adapter

Bản viết lại Galaxy Blackhole cho gói **THƯ VIỆN** @deepseek-ai/dsh-llm-deepseek (0.2.1-alpha.4) — DeepSeek
Messages transport, cấu hình request và năng lực model. **Tên gói là ...-ADAPTER** vì gbh-llm-deepseek đã là
bản viết lại của gói KHÁC (dsh-llm-deepseek-api-key, 75 dòng / 6 export) — reviewer xác nhận 18/10/2026.

## 1. Kiểm trùng TRƯỚC khi viết (đo được)

| phép kiểm | kết quả |
|---|---|
| có apply/name (plugin) không? | **KHÔNG** — 0 lần xuất hiện; đây là gói thư viện, không có row nào để thay |
| có tự đăng ký provider/service không? | **KHÔNG** — nó XUẤT hàm registerDeepSeekProvider cho nơi khác gọi |
| ai đăng ký provider "deepseek"? | packages/host/llm-deepseek (src/index.ts:90) + packages/host/llm-deepseek-account (cùng gọi helper) — hai gói ĐANG CHẠY, không trùng gói này |
| hai mặt? | **KHÔNG** — chỉ lib/index.js (không có lib/client.js) |
| row trong dump? | không có (không phải row) |

⇒ Chuyển gói này KHÔNG tạo service/provider trùng, không cần khai gbh.row.

## 2. Cách port: DE-BUNDLE NGUYÊN VĂN + CỔNG BYTE

Tiền lệ trong repo: packages/host/session-inspector (bundle lớn de-bundle nguyên văn, build chặn nếu lệch).

- tools/split-stock-bundle.ts cắt bundle gốc (2.327 dòng) thành **23 lát** ≤ 250 dòng/lát, mỗi lát một
  //#region của upstream; lát giữ ĐÚNG NGUYÊN mọi dòng (kể cả dòng đánh dấu vùng và dòng trống).
- src/assemble.ts ghép lại: chỉ bỏ phần GIAO KÈO (header 5 dòng · dòng // @ts-nocheck · dòng trống sau nó ·
  dòng trống trước + dòng export rỗng ở cuối); mọi dòng còn lại là nguyên văn.
- build.ts **DỪNG BUILD** nếu bản ghép khác bundle gốc dù MỘT byte (so độ dài + chuỗi + SHA-256).
- Build còn chép nguyên cây .d.ts của bản gốc sang lib/types ⇒ consumer typecheck y như trước.

Số đo: bản ghép **102.238 B** (bản đầu bỏ dòng đánh dấu vùng ⇒ THIẾU 946 B, đã sửa) → hiện **bằng tuyệt đối**:
lib/index.js = 2.327 dòng / 104 KB / sha256 **eba35025…8dff37d6** — TRÙNG sha256 của bundle gốc.

## 3. Bằng chứng (tests/host/llm-deepseek-adapter.test.ts — 27 ca / 232 expect / 0 fail)

| nhóm | số ca | nội dung |
|---|---|---|
| artefact | 4 | byte-identical với bundle gốc · ghép lại 23 lát = văn bản gốc · mỗi lát đủ header/dấu/kết thúc · tên package mới không trùng |
| bề mặt export | 2 | **41 tên export trùng** bản gốc · mọi tên cùng LOẠI giá trị |
| hằng số | 3 | 11 hằng số DEFAULTS · 11 hằng số giới hạn · PUBLIC_BASE_URL |
| hàm thuần | 8 | deepSeekFileScope (kèm đối chứng âm) · DeepSeekFileId · deepSeekImageTokens (3 hình) · deepSeekRequestImageDimensions · resolveRequestImageMaxBytes/Target · catalogModelInfo · plainOptions · bộ khoá 2 schema (18 + 8) |
| schema | 1 | Config validate rỗng ⇒ cùng mặc định |
| DeepSeekFilesClient (fetch giả) | 6 | upload cùng URL/method + cùng file object · HTTP 401 ⇒ AUTH · 500 ⇒ SERVER · 429 ⇒ RATE_LIMIT · expiry ngoài khoảng ⇒ INVALID_REQUEST (không ra mạng) · huỷ trước khi gửi |
| DeepSeekFileStore | 2 | 2 lời gọi ĐỒNG THỜI ⇒ **1 upload** + kết quả giống nhau · ảnh > 32 MiB ⇒ INVALID_REQUEST |
| DeepSeekAdapter | 1 | providerInfo · providerRetryPolicy · listModels |
| registerDeepSeekProvider | 1 | trên **Context cordis THẬT**: mỗi bên đăng ký ĐÚNG MỘT adapter cho provider "deepseek" |

Mọi ca đều A/B: cùng đầu vào chạy trên **cả** bản của ta và bundle gốc, so kết quả/mã lỗi/thông điệp.

## 4. Vì sao hành vi TRÙNG (không chỉ test trùng)

Thân artefact là **cùng một văn bản** với bundle gốc (sha trùng) ⇒ không có đường nào để hành vi lệch, ngoài
phần phụ thuộc môi trường (kernel peers). Đó là lý do 27 ca A/B ở trên là đối chứng, không phải nguồn duy nhất.

## 5. Ghi nợ (KHÔNG thuộc gói này)

1. **Consumer vẫn import bundle DSH**: packages/host/llm-deepseek + llm-deepseek-account còn
   from "@deepseek-ai/dsh-llm-deepseek". Việc chuyển consumer sang gói này là task riêng (tiền lệ task-13).
2. **Đường phân giải**: repo dùng symlink trong node_modules của gói (node_modules bị gitignore) như các gói
   khác — clone mới cần bước tạo link (đã nêu ở task-32).
3. **Gõ kiểu**: các lát là JS nguyên văn + // @ts-nocheck (đúng tiền lệ session-inspector). Chuyển sang TS có
   kiểu đầy đủ là việc riêng, không đổi hành vi.
