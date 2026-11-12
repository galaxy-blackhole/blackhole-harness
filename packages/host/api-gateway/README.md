<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại Galaxy Blackhole cho NỬA HOST của @deepseek-ai/dsh-api-gateway (service typertGateway)
-->

# @galaxy-blackhole/gbh-api-gateway

Bản viết lại Galaxy Blackhole cho **NỬA HOST** của @deepseek-ai/dsh-api-gateway (0.2.1-alpha.4) — live Typert
Remote dispatch trên Cordis Services; lớp dịch vụ **typertGateway** (có registerRemoteEvents).

## 1. Kiểm hai mặt TRƯỚC khi viết (đo được)

| thành phần | số đo | xử lý |
|---|---|---|
| lib/index.js (nửa HOST) | **1.830 dòng** · 0 chỗ có apply/name (là Service class) | **port trọn** — byte-identical |
| lib/client.browser.js + client.node.js (nửa BROWSER) | **2.186 + 1.991 dòng** · dsh.client.platform = web, immediately = true | **GHI NỢ** — chưa port |
| exports["./client"] + dsh.client trong manifest gốc | có | gói ta KHÔNG khai (chưa có nửa client) |
| row trong dump | id typert-gateway → @deepseek-ai/dsh-api-gateway | **KHÔNG khai gbh.row** (lý do ở §4) |
| service do nó cấp | typertGateway (super(ctx, "typertGateway")) | không trùng gói nào khác đang chạy |

## 2. Cách port: de-bundle NGUYÊN VĂN + cổng byte (như llm-deepseek-adapter)

- tools/split-stock-bundle.ts cắt bundle 1.830 dòng thành **7 lát**; vùng cuối (1.136 dòng) bị cắt tiếp ở
  DÒNG BẮT ĐẦU CÂU LỆNH CẤP CAO và bọc vỏ hàm để mỗi file .ts hợp lệ cú pháp; công cụ TRANSPILE THỬ từng lát,
  lát nào gãy thì GỘP vào lát sau (không bao giờ giao lát gãy).
- src/assemble.ts ghép lại: bỏ header 5 dòng · dòng @ts-nocheck · 2 dòng trống · dòng export rỗng · và VỎ HÀM
  (theo hai dấu __GBH_FRAGMENT_BEGIN__ / __GBH_FRAGMENT_END__).
- build.ts **DỪNG BUILD nếu lệch 1 byte** (báo cả byte lệch đầu tiên + sha hai bên) và chép cây .d.ts gốc.

Số đo: lib/index.js = **1.830 dòng** · 7 lát (7 · 122 · 161 · 402 · 717 · 428 · 2 dòng, mọi lát ≤ 1000) ·
**byte-identical với bundle gốc** (cùng độ dài, cùng chuỗi, cùng sha).

## 3. Bằng chứng — tests/host/api-gateway.test.ts: **23 ca / 93 expect / 0 fail**

| nhóm | ca | nội dung |
|---|---|---|
| artefact | 4 | byte-identical · ghép 7 lát = văn bản gốc · mọi lát ≤ 1000 dòng + manifest khớp · tên gói mới + không khai row |
| bề mặt export | 3 | cùng 3 tên · default === TypertGatewayService · cả hai là LỚP |
| service trên Context cordis THẬT | 9 | cài lên Context ⇒ có ctx.typertGateway · **registerRemoteEvents là HÀM (seam mở khoá)** · registerRemoteEvents A/B cùng kết quả · hasLiveClient() = false · claimsEndpoint + collectSrcClaims · broadcastRemoteEvent frame sai ⇒ cùng thông điệp · closeRemoteEvents không ném · Config mặc định (262144) · TypertGatewayError cùng name/code/endpoint/message |
| A/B thêm | 7 | invoke endpoint lạ · dispatchRpc endpoint lạ · resourceReaders · consumeRemoteEvents nguồn rỗng · hasLiveClient sau register · Config TỪ CHỐI ngoài khoảng (2 trường) · 3 mã lỗi TypertGatewayError |

## 4. api-remotes có mount được SAU khi port? — ĐO ĐƯỢC: **CHƯA**

- bun run lab:row api-remotes ⇒ **"row api-remotes chua khai gbh.row (hoac khong ton tai)"** ⇒ gói api-remotes
  (task-39) **chưa khai gbh.row** nên chưa có gì để mount.
- Row typert-gateway trong profile vẫn trỏ **@deepseek-ai/dsh-api-gateway (stock)**: gói này KHÔNG khai gbh.row
  vì thiếu nửa client — mount mà thiếu nửa browser thì mất gateway phía UI.
- Hai việc còn lại để mở khoá (task riêng, có 2 lựa chọn):
  1. Port nốt **nửa client (~2.900 dòng)** rồi khai gbh.row cho row typert-gateway (moduleIds = gói này) — khi đó
     api-remotes khai gbh.row và mount được.
  2. Hoặc **overlay patch giữ nửa client của bản gốc** trong khi nửa host là của ta (rủi ro: hai nguồn cho một
     row, cần Lead quyết).
- Phần ĐÃ xong và có thể dùng ngay: lớp service typertGateway **đầy đủ** (gồm registerRemoteEvents) chạy được
  trên Context thật — có thể import từ gói này thay cho bản một phần 392 dòng ở packages/host/typert-gateway.

## 5. Ghi nợ

1. Nửa client ~2.900 dòng (client.browser.js + client.node.js) + dsh.client + exports["./client"].
2. Consumer hiện chưa import gói này (không ai import @deepseek-ai/dsh-api-gateway trong repo của ta).
3. Gõ kiểu: lát là JS nguyên văn + // @ts-nocheck (đúng tiền lệ session-inspector / llm-deepseek-adapter).
