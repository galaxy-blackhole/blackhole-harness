<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Công cụ và cách đối chứng của row ui-trajectory: cắt lát nguyên văn, tách CSS, và HAI chỗ sửa tay
-->

# tools/ — row `ui-trajectory`

Bản port này KHÔNG viết lại giao diện bằng tay: nó **cắt bundle gốc thành 12 lát nguyên văn** rồi ghép lại
nguyên văn. Nhờ vậy phần render nhiều nhất có thể trùng với bản stock, và mọi khác biệt đều **đo được**.

## Quy trình (chạy lại được từ đầu)

```bash
bun run tools/split-stock-bundle.ts <đường-dẫn-bundle-gốc>   # 1. cắt lát + chèn cổng chặn
bun run tools/extract-css.ts                                  # 2. tách 4 module CSS NGUYÊN VĂN
bun run build.ts                                              # 3. ghép + build hai nửa
```

Bundle gốc (CHỈ ĐỌC): `apps/host/node_modules/@deepseek-ai/dsh-client-ui-trajectory/lib/client.js` (8.246 dòng).

## Vì sao cắt theo `//#region`

tsdown giữ nguyên dấu vùng của từng file nguồn upstream, nên mỗi vùng là một đơn vị cú pháp trọn vẹn.

## Hai chỗ sửa tay DUY NHẤT (còn lại nguyên văn từng byte)

1. **Cổng chống cài hai lần** — `patchPluginGuard()` trong `tools/split-stock-bundle.ts` chèn
   `let uiTrajectoryInstalled = false;` + `const uiTrajectoryContexts = new WeakSet();` ở **phạm vi module,
   TRƯỚC JSDoc của hàm**, và đổi thân đăng ký thành `applyInner`. Cờ chỉ bật SAU khi `applyInner` chạy xong.
   ⚠️ Tuyệt đối không khoá theo `ctx`: tầng nạp sinh HAI entry (id của ta + alias của gói gốc) ⇒ HAI ctx.
2. **Điểm thay thế CSS** — `tools/extract-css.ts` thay `const css$N = "…"` bằng một điểm thay thế;
   `src/styles/*.module.css` là nguồn sự thật, `build.ts` nhúng lại **nguyên văn** (giữ hash lớp gốc).

## Vì sao mỗi lát là một module HỢP LỆ (bài học 18/10/2026, đo được)

Bundle gốc là MỘT phạm vi hàm phẳng, nên một lát bị cắt giữa câu lệnh sẽ mất cân bằng ngoặc. Đã sai hai lần:

| Cách | Hậu quả đo được |
|---|---|
| Cắt ở "đầu câu lệnh cấp cao nhất", lui về dòng trống khi bí | hai nhát cắt rơi giữa hàm ⇒ `tsc` TS1005/TS1128 (22 dòng), cổng typecheck ĐỎ |
| Dùng bộ quét token của TypeScript (không có bộ phân tích đi kèm) | template literal LỒNG NHAU làm bộ quét mất đồng bộ (một `TemplateHead` nuốt 5 KB) ⇒ mọi dòng bị coi là "bẩn" |
| Đếm ngoặc bằng tay | đếm SAI một ngoặc trong vùng `TrajectoryTable.js` ⇒ đóng thừa một ngoặc |

**Cách đang dùng (đúng):** bộ quét NGĂN XẾP KHUNG tự viết (template `${…}` mở một khung mã và `}` đóng khung
đó để quay lại template), rồi **cắt từ CUỐI VỀ** và để **phép thử cú pháp làm quan toà**: mỗi mảnh được ghi kèm
một dòng mở/đóng vỏ (`// __GBH_FRAGMENT_BEGIN__` / `// __GBH_FRAGMENT_END__`) mà `src/assemble.ts` GỠ khi ghép.

⚠️ Hai cái bẫy đã trả giá, đừng lặp lại:

- Dấu đánh dấu phải nằm **CUỐI** dòng (sau phần ngoặc). Đặt trước thì nó là bình luận dòng và **nuốt luôn** phần ngoặc.
- Cắt từ ĐẦU về thì mảnh cuối của vùng "thừa ra" và có thể bắt đầu giữa một object literal ⇒ không cách bọc nào cứu được.

## Đối chứng (những gì được KHẲNG ĐỊNH, không phải kể lại)

`tests/client/ui-trajectory.test.ts` khẳng định, trong đó có ba phép đối chứng trực tiếp với bundle gốc:

- **thân factory TRÙNG TỪNG DÒNG** với vùng region của bundle gốc (chỉ khác 5 dòng `require` + khối cổng chặn);
- **4 module CSS TRÙNG TỪNG BYTE** với chuỗi CSS trong bundle gốc (SHA-256 in ở `tools/extract-css.ts`);
- **từ điển zh/en TRÙNG TỪNG CHUỖI** và cùng 192 khoá; hai bundle chạy qua CÙNG một context giả để so hiệu ứng,
  tập spec slot, số định nghĩa view/sự kiện, và tên `persist` của store — nên không thể lệch âm thầm.
