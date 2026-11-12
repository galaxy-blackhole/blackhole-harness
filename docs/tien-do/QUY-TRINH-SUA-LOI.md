# QUY TRÌNH SỬA LỖI: ĐỐI CHIẾU VỚI DSH TRƯỚC, KHÔNG TỰ SUY LUẬN

<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc Luật bắt buộc khi sửa BẤT KỲ lỗi nào: so với DSH trước, chỉ sau khi logic khớp mới xét bước khác.
-->

## Vì sao có tệp này

Ngày 08/11/2026, lỗi "gửi tin nhắn không có lượt trả lời" bị chẩn đoán sai ba lần liên tiếp: có lúc đổ cho model/khoá API,
có lúc đổ cho `kick()` nuốt lỗi, có lúc đổ cho composition thiếu row. Nguyên nhân gốc chỉ lộ ra khi so TỪNG DÒNG với DSH:
bản `agent-loop` của ta đòi service `sessionPersistence` NGAY trong constructor, còn DSH chỉ đọc nó TRÌ HOÃN.
Một dòng khác DSH = cả vòng chạy chết im lặng.

## 6 bước BẮT BUỘC (đúng thứ tự, không nhảy bước)

1. **Tái hiện bằng giao diện thật** — chụp ảnh trước/sau. Không nhận "test xanh" làm bằng chứng duy nhất.
2. **Định vị tệp:dòng của bản ta** — chỉ đúng dòng đang chạy trong ARTEFACT (lib), không chỉ trong src.
3. **Đối chiếu với DSH cùng chức năng** — mở tệp stock trong `apps/host/node_modules/@deepseek-ai/…`, so từng bước logic:
   điều kiện, thứ tự gọi, chỗ đọc service (ngay vs trì hoãn), chỗ nuốt lỗi, giá trị mặc định. Ghi bảng "ta ↔ DSH" kèm dòng.
4. **Nếu logic KHÁC DSH ⇒ sửa cho GIỐNG DSH** (không tự nghĩ cách khác). Buộc phải khác thì ghi lý do + ADR.
5. **Chỉ khi logic đã khớp DSH** mới xét: thứ tự mount, stamp/artefact cũ, cache, biến môi trường, dữ liệu người dùng.
6. **Xác nhận lại bằng giao diện thật** + ghi sổ (nguyên nhân, dòng đã sửa, bằng chứng trước/sau).

## Bẫy đã gặp thật

| bẫy | cách chặn |
|---|---|
| Mount im lặng dùng artefact cũ khi `build.ts` lỗi | Trước mọi lượt đo: grep log boot tìm `dung artefact co san` cho gói vừa sửa |
| Sửa `src` rồi tưởng đã xong | Chạy đúng lệnh build mount dùng (`bun run build.ts lib`), rồi grep chuỗi mới trong `lib/` |
| `Enter` trong composer contenteditable không submit | Bấm nút thật `aria-label="Send message"`; kiểm draft trong `localStorage` |
| Startup log có `StartupError` nhưng app vẫn trả 200 | Loop có thể chết mà app vẫn phục vụ ⇒ đọc startup log, đừng tin HTTP 200 |
| Nhiều nguồn sự thật cho cùng một giá trị mặc định | Lấy tệp DSH làm chuẩn, sửa mọi nơi còn lệch |

## Ai làm gì

- **Người sửa lỗi (dev)**: làm đủ 6 bước; báo cáo PHẢI có bảng "ta ↔ DSH". Thiếu bảng đó = chưa đủ điều kiện review.
- **REVIEW** (ra-soat / dev-denta / dev-5): từ chối mọi bản sửa không kèm bảng đối chiếu DSH khi lỗi thuộc loại "hành vi";
  kiểm lại ít nhất 3 dòng trong bảng.
- **TESTER** (kiem-tra): chỉ self-test + dựng lại bằng UI; KHÔNG kết luận nguyên nhân, chỉ báo hiện tượng.
- **Lead**: xác nhận cuối bằng giao diện thật + đọc startup log; không nhận kết luận từ chữ ký.

## Định nghĩa "đã sửa xong"

1. Logic khớp DSH ở mắt xích liên quan (có bảng dòng).
2. Có bằng chứng giao diện thật trước/sau (ảnh + mô tả thao tác).
3. Log boot không có `StartupError` / `dung artefact co san` cho gói vừa sửa.
4. Ghi sổ tiến độ (nguyên nhân, dòng, bằng chứng).
