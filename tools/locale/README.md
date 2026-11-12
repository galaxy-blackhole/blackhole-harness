<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Nguồn + cách sinh từ điển tiếng Việt cho TỪNG gói client (không dịch tập trung trong bundle)
-->

# tools/locale — nguồn và cách sinh bản dịch tiếng Việt

## 1. Nguồn (đã copy vào repo, đổi tên theo luật `gbh-*`)

| tệp | nguồn gốc | nội dung |
|---|---|---|
| `gbh-locale-keys.json` | `galaxy-code/web/brand/dsh-locale-keys.json` (445 KB) | bộ KHOÁ từ điển DSH theo namespace + hash tiếng Anh |
| `gbh-locale-vi.json` | `galaxy-code/web/brand/vi.locales.json` (170 KB) | bản dịch tiếng Việt đã có của blackhole web — **2527 khoá / 53 namespace** |
| `gbh-locale-vi-manual.json` | viết trong phiên 18/10/2026 | bản dịch TAY cho namespace chưa có trong bản nền (pluginMarket 78 · sidebarBrowser 26 · sidebarTerminal 28 · secretMask 2 · settings.sessionLog 4 · ui-attachment 8 · settings 7 · …) và cho các khoá lệch phiên bản |
| `gbh-locale-vi-same-by-design.json` | `vi-same-by-design.json` | danh sách khoá CỐ Ý giữ nguyên tiếng Anh (ví dụ `common.ok`, `model`) |

## 2. Sinh từ điển cho từng gói

```bash
~/.bun/bin/bun run tools/locale/gen-vi.ts            # báo cáo độ phủ, KHÔNG ghi
~/.bun/bin/bun run tools/locale/gen-vi.ts --write    # ghi packages/client/<gói>/src/locales-vi.ts
~/.bun/bin/bun run tools/locale/wire-vi.ts           # báo cáo điểm nối register()
~/.bun/bin/bun run tools/locale/wire-vi.ts --write   # thêm import + cặp "vi:" vào lời gọi register
~/.bun/bin/bun run tools/locale/embed-vi-parts.ts --write  # 4 gói DE-BUNDLE: nhúng literal vào lát
```

**Đo độ phủ hiện tại (18/10/2026): 1993/1994 khoá `en` của 40 gói có bản dịch `vi` = 100%**
(khoá còn lại là `meta` LỒNG NHAU của ui-attachment — không phải chuỗi phẳng nên không tra được).

## 3. Bốn gói DE-BUNDLE phải xử lý khác

`ui-chat` · `ui-conversation` · `ui-schedule` · `ui-trajectory` được ghép **văn bản** từ các lát của
bundle gốc thành MỘT phạm vi hàm phẳng — trong lát **không thể** `import` module. Vì vậy
`embed-vi-parts.ts` ghi một khối `JSON.parse("…")` giữa hai dấu `// >>> gbh-vi-locale` … `// <<< gbh-vi-locale`
ngay trong lát, và lời gọi `ctx.locale.register(NS, { vi: … })` nằm trong khối cổng chống cài hai lần
(phần viết tay của chính lát đó). Test đối chứng byte-for-byte đã được dạy **bỏ đúng các dòng đó**
trước khi so phần còn lại với bản gốc — xem `tests/lib/vi-locale.ts`.

## 4. Namespace của các gói CÒN LÀ BẢN GỐC DSH

Bản gốc chỉ đăng ký `{ zh, en }` nên UI của nó vẫn hiện tiếng Anh (đo được trên DOM thật:
*Appearance · Light · Font size* của `ui-theme`, *Keyboard shortcuts · Edit shortcuts* của `ui-shortcuts`).
Gói `@galaxy-blackhole/gbh-client-locale` đăng ký TẬP TRUNG bảng `vi` cho 9 namespace đó
(`settings.theme` · `shortcuts` · `model` · `slash.menu` · `cordis` · `question` · `agent-team` ·
`voice-input` · `session-log-download`). Danh sách này **không giao** với namespace do các gói của ta
tự đăng ký — `locale.register` ném lỗi nếu trùng locale trong cùng namespace.

## 5. Bất biến (đừng phá)

1. `en` và `zh` của mọi gói **giữ nguyên từng chuỗi** như bản gốc; `vi` là NGÔN NGỮ THÊM.
2. Không sửa tay `src/locales-vi.ts` — sửa nguồn trong `tools/locale/*.json` rồi chạy lại `gen-vi.ts`.
3. Không đăng ký cùng một namespace `vi` ở hai nơi (locale ném lỗi "already has locale").
