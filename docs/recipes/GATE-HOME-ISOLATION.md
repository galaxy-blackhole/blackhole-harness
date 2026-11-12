<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Cách chạy cổng gate:home-isolation cho đúng — nó flaky khi nhiều harness boot song song
-->

# Recipe — chạy `gate:home-isolation` cho đúng

## Cổng này kiểm gì

Boot harness ở một cổng OS cấp, xác nhận nó phục vụ 200, và xác nhận **cây chia sẻ `~/.galaxy/gbh`
không bị app chạm**. Phép so cuối cùng là: mọi đường dẫn đổi trong cây chia sẻ phải thuộc một
**người ghi đã biết** (`knownWriters`) hoặc phải đang **tiếp tục đổi** khi ta ngồi yên.

## Vì sao nó có thể đỏ oan

Cây chia sẻ bị **nhiều harness ghi song song**. Khi cả nhóm cùng boot, `knownWriters` không phủ hết
người ghi hợp lệ ⇒ vài đường dẫn bị xếp vào `unexplained`.

**Số đo 17/10/2026 (cùng một máy, cùng một mã):**

| Cách chạy | Kết quả |
|---|---|
| Chạy cả cổng (`bun run gate`) lúc **6+ agent boot song song** | `3 unexplained` ⇒ ĐỎ |
| Chạy **riêng** (`bun test tests/host/boot.test.ts`) lúc vắng | `1283 entries · 4 already written by other harnesses · 0 moved · 0 unexplained` ⇒ XANH |

## Luật chạy

1. Cổng này đỏ mà nghi do tranh chấp ⇒ **chạy riêng** `bun test tests/host/boot.test.ts`.
2. **Nếu chạy riêng vẫn có `unexplained` > 0 thì đó LÀ RÒ RỈ THẬT** — không được giải thích nó đi.
   Đây là lý do **không** nới `knownWriters`: nới ra sẽ che mất đúng tín hiệu cần thấy.
3. Khi báo một cổng đỏ không thuộc gói của mình: **báo số + cách phân biệt**, đừng kết luận thủ phạm.

## Lệnh

```bash
bun test tests/host/boot.test.ts          # chạy riêng, đọc dòng "[gate:home-isolation] shared tree: …"
bun run gate                              # chạy cả cổng — có thể đỏ oan khi đông agent
```
