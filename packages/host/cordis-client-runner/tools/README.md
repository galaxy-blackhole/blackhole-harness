<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Công cụ de-bundle nửa client của row cordis-client-runner: cắt nguyên văn, ghép lại, và 0 chỗ sửa tay
-->

# tools/ — row `cordis-client-runner`

Bản port này **không viết lại** nửa browser bằng tay: nó **cắt bundle gốc thành 11 lát nguyên văn** rồi ghép lại.
Nhờ vậy phần chạy nhiều nhất (7.408 dòng) trùng với bản stock **từng byte**, và mọi khác biệt đều **đo được**.

## Quy trình (chạy lại được từ đầu)

```bash
bun run tools/split-stock-bundle.ts \
  ../../../../apps/host/node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js
bun run build.ts
```

Bundle gốc (CHỈ ĐỌC): `apps/host/node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js` (7.408 dòng · 399.710 B).

## Vì sao cắt theo `//#region`

tsdown giữ nguyên dấu vùng của từng file nguồn upstream, nên mỗi vùng là một đơn vị cú pháp trọn vẹn —
cắt ở đó không làm đứt câu lệnh. Vùng nào vượt ngân sách (880 dòng) thì công cụ cắt thêm ở chỗ **đứng riêng
được**, và tự kiểm bằng `Bun.Transpiler` trước khi ghi.

## BA ĐOẠN KHÔNG NẰM TRONG VÙNG REGION — và vì sao vẫn phải đi qua lát

Bản `ui-trajectory` bỏ phần prelude/đuôi rồi **chèn lại bằng tay** (5 dòng `require` + 3 dòng `exports`).
Với row này, cách đó là **chỗ sửa tay thứ hai** và làm phép so byte mất nghĩa. Vì vậy `factorySegments()`
coi **mọi dòng của thân factory** là đoạn:

1. **prelude** — `var module = { exports: {} }` · `var exports = module.exports` · `Object.defineProperty(exports, Symbol.toStringTag, …)`;
2. **các vùng `//#region`** — 11 vùng của tsdown;
3. **các dòng NGOÀI vùng** (giữa hai vùng: `let react = require("react")` · `let _deepseek_ai_cordis = require("@deepseek-ai/cordis")`);
4. **đuôi** — `exports.X = …` (11 dòng) + `return module.exports;`.

⚠️ Bài học đo được: bản đầu chỉ lấy vùng ⇒ **mất 3 dòng** `let react = require("react")` ⇒ phép so byte báo
lệch **121 B** trên 399.710 B. Đó là lý do có `factorySegments` thay vì `splitRegions`.

## Số chỗ sửa tay: **0**

Không có cổng chống cài hai lần, không đổi tên `apply` ⇒ `applyInner`, không chèn hằng số. Lý do: tầng nạp
đã bảo đảm **một bundle ⇒ một plugin** (`aliasView` trả `apply` no-op cho id alias), nên `apply` chỉ chạy
**một lần** dù đồ thị có hai entry. Mọi sửa tay ở đây sẽ làm **sai** phép đối chứng byte.

## Đối chứng

`tests/host/cordis-client-runner.test.ts` khẳng định:

- **thân factory TRÙNG TỪNG BYTE** với bundle gốc: 7.402 dòng · 399.565 B · SHA-256 `2c2ceebd…5abe`;
- artifact chứa thân ấy như **chuỗi con liền mạch** (không thụt lề lại);
- **CSS 0 khối = 0 khối** (bundle gốc không nhúng module CSS nào);
- **ĐỐI CHỨNG ÂM**: sửa 1 ký tự trong một lát ⇒ đỏ; hoàn nguyên ⇒ xanh;
- artifact **chạy thật** trong window giả: đăng ký **1 id**, export **11 tên** y bản gốc.
