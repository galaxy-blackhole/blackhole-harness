<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README cua @galaxy-blackhole/gbh-api-terminal-controller — NUA HOST port NGUYEN VAN TUNG BYTE
      (bundle @deepseek-ai/dsh-api-terminal-controller 1.037 dong) + ghi no nua client va hai entry typert
-->

# @galaxy-blackhole/gbh-api-terminal-controller

Bản viết lại Galaxy Blackhole cho **NỬA HOST** của @deepseek-ai/dsh-api-terminal-controller (0.2.1-alpha.4) —
dịch vụ **terminalController** (namespace 'terminal'): quản lý terminal của phiên (tạo/giữ/đổi tên/đóng, giới hạn
kích thước và bộ đệm, dòng stream theo cơ chế retention).

## 1. Đo 4 bước TRƯỚC khi viết (19/10/2026)

| phép đo | kết quả | hệ quả |
|---|---|---|
| gói hai mặt? | **CÓ** — nửa host lib/index.js **1.037 dòng**; nửa client lib/client.js **1.051 dòng** + dsh.client (inject api-gateway, platform web) | **KHÔNG khai gbh.row** (luật §4f) |
| entry phụ | lib/typert.host.js **1.368 dòng** + lib/typert.remote-client.js **604 dòng** | **GHI NỢ** |
| trùng tên service? | 'terminalController' KHÔNG xuất hiện trong packages của ta | an toàn |
| row trong dump | '- id: terminal-controller' thụt lề 0 → @deepseek-ai/dsh-api-terminal-controller | row TOP-LEVEL, hiện vẫn stock |
| vendor trong bundle | xterm/zod chỉ xuất hiện **3 lần** (đều qua dsh-lazy-require) ⇒ **KHÔNG có khối vendor bị nhúng** | không cần tách vendor |
| bề mặt export | { TerminalController, TerminalController as default } | artefact giữ đúng 2 tên đó |

## 2. TRƯỚC → SAU

| hạng mục | TRƯỚC | SAU |
|---|---|---|
| gói trong repo | **chưa tồn tại** | packages/host/api-terminal-controller/ (src 7 lát + build + tools) |
| nguồn nửa host | chỉ có trong bundle stock | **artefact 1.037 dòng · 36.403 B · sha256 0cefb34efc0cae1da14dfbcdcad6c899422e052add9238d0442a97d71ed98cdf = sha256 bundle gốc** (diff 0 byte; build DỪNG nếu lệch) |
| bề mặt kiểu | lib/types/* của stock | chép nguyên cây **24 tệp** (diff -r IDENTICAL) + lib/index.d.ts 2 dòng |
| test | 0 | **24 ca / 125 expect / 0 fail** (tests/host/api-terminal-controller.test.ts, 496 dòng) |
| row terminal-controller | stock | **vẫn stock** (không khai row — §1) |
| service terminalController | chỉ trong stock | bản của ta chạy trên Context cordis thật (test dựng new TerminalController(ctx, config) ⇒ ctx.terminalController) |

## 3. De-bundle: 7 lát NGUYÊN VĂN (0 lát gãy, mọi lát ≤ 1000 dòng)

| lát | dòng tệp | dòng thân |
|---|---:|---:|
| part-00-head.ts | 16 | 5 |
| part-01-shells.ts | 73 | 62 |
| part-02-stream.ts | 102 | 91 |
| part-03-retention.ts | 162 | 151 |
| part-04-terminal.ts | 276 | 265 |
| part-05-index.ts | 473 | 462 |
| part-06-tail.ts | 13 | 2 |

Vùng dài nhất 462 dòng < ngân sách 700 ⇒ không cần mảnh/vỏ hàm. tools/split-stock-bundle.ts cắt theo //#region và
TRANSPILE THỬ từng lát; src/assemble.ts ghép lại; build.ts so TỪNG BYTE với bundle gốc rồi mới ghi.

## 4. Test A/B — 24 ca (cùng đầu vào chạy CẢ artefact ta và bundle gốc)

| nhóm | ca | nội dung |
|---|---|---|
| artefact byte-identical | 2 | cùng độ dài 36.403 · trùng toàn văn + sha256 |
| bề mặt export | 2 | TerminalController + default · default === TerminalController |
| service trên Context cordis THẬT | 2 | ctx.terminalController xuất hiện · cùng tên service + namespace terminal |
| Config schema | 2 | validate rỗng ⇒ cùng mặc định (maxTerminals 8, maxCols 500, maxRows 200, scrollback 1000, maxBufferedBytes 2 MiB, maxInputBytes 64 KiB…) · 9 giá trị sai ⇒ cùng issues |
| inject tĩnh | 1 | ['subprocess','sandboxPolicy','workingDirectory','typert'] |
| prototype | 1 | cùng tập 16 phương thức công khai |
| nhánh LỖI (cùng ném cùng thông điệp) | 8 | id sai · kích thước ngoài giới hạn · tiêu đề 0/121 ký tự · attach khi KHÔNG có Remote invocation · thiếu provider subprocess/sandboxPolicy · terminal không tồn tại · shellPath lạ · signal đã huỷ |
| nhánh HỢP LỆ (subprocess GIẢ) | 6 | environment · shells (6 shell) · create+list · create+close · vượt maxTerminals ⇒ terminal/limit-reached · shellPath hợp lệ |

Trung thực: ca attach KHÔNG test được đường stream đầy đủ (cần Gateway/uplink Remote thật) — ghi lý do ngay trong
tên ca, chọn nhánh A/B 'cùng ném cùng thông điệp'; không ca nào bịa hành vi.

## 5. Nợ kỹ thuật (mount row cần cả ba)

1. **Nửa client** lib/client.js **1.051 dòng** + dsh.client — thiếu ⇒ row không thể thay.
2. **lib/typert.host.js 1.368 dòng** — tầng @Remote phía host (gateway đăng ký remote methods).
3. **lib/typert.remote-client.js 604 dòng** — phía client của tầng typert.

Khi đủ ba phần: khai gbh.row (id terminal-controller, aliases stock, moduleIds = tên gói) → check:rows →
lab:row terminal-controller → boot-smoke → Lead boot.

## 6. Ghi chú vận hành (sự cố thật trong lượt này)

- Symlink peer (9 cái) nằm trong node_modules/ của gói (gitignore): 7 link @deepseek-ai/* dùng **5 cấp**
  ../../../../../ (nằm trong node_modules/@deepseek-ai/), còn @xterm và zod nằm TRỰC TIẾP trong node_modules/
  nên dùng **4 cấp** ../../../../.
- packages/host/typert-gateway/node_modules/ws từng dùng 5 cấp ⇒ **link GÃY** (bundle typert-gateway có import ws);
  đã sửa sang 4 cấp, chạy lại 21 ca của typert-gateway ⇒ xanh.
