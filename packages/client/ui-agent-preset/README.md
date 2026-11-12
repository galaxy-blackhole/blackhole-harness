<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README cua goi @galaxy-blackhole/gbh-client-ui-agent-preset — ban viet lai cua row ui-agent-preset
-->

# @galaxy-blackhole/gbh-client-ui-agent-preset

Bản viết lại của Galaxy Blackhole cho row `ui-agent-preset` của DSH
(`@deepseek-ai/dsh-client-ui-agent-preset`, bản gốc 2.472 dòng bundle).

## Gói này làm gì

Bốn bề mặt trên **một** sổ preset agent:

- **Chip chọn preset** ở màn hình phiên mới (`conversation.hero.agentPreset`) — chọn thành phần cho
  phiên *sắp* bắt đầu; lựa chọn được **stage** rồi áp khi có phiên trống hiện hành.
- **Nhãn chỉ đọc** trong hàng đầu phiên (`conversation.session.header.actions`, occupant
  `agent-preset`, order −10) — phiên chỉ *báo cáo* thành phần nó đang chạy.
- **Mục "để agent tạo plugin"** trong menu thêm plugin (`plugins.add.actions`, occupant
  `create-plugin`) — vào Creator mode mà không gửi tin nhắn nào.
- **Khúc "Agent presets"** trong cài đặt (`settings.section`, occupant `agent-presets`, order 20) —
  danh sách đầy đủ (kể cả dòng hỏng), đặt mặc định cho phiên sau, xem thân khai báo, và mở hộp thoại
  hướng dẫn chỉ đọc của bốn preset ship sẵn.

## Row này thay gì

| | |
|---|---|
| Row gốc | `ui-agent-preset` (`@deepseek-ai/dsh-client-ui-agent-preset`) |
| Id module bundle tự khai | `@galaxy-blackhole/gbh-client-ui-agent-preset` (ĐÚNG MỘT id) |
| Id gốc | chỉ khai ở `gbh.row.aliases` — tầng nạp tự sinh entry alias |
| Seam (`inject`) | `slots` · `sessions` · `locale` · `remote` · `remote.agentPresets` · `remote.settings` · `configForms` (nguyên văn, đúng thứ tự) |
| Seam trong `ctx.inject` | `slots` · `conversation` · `sessions` · `uiWorkspace` (nguyên văn) |
| Slot đăng ký | **4**: `conversation.hero.agentPreset` · `conversation.session.header.actions` (id `agent-preset`, order −10) · `plugins.add.actions` (id `create-plugin`) · `settings.section` (id `agent-presets`, order 20 + `label`) |
| Từ điển | namespace `settings.agentPreset`, **47 khoá × 2 ngữ** (19 khoá hướng dẫn dùng chung + 28 khoá riêng) |
| CSS | **5 module nhúng nguyên văn** (tiền tố hash giữ nguyên: `SVAs4q_` · `ejSU7q_` · `cubgiG_` · `LSQftG_` · `rtSEdW_`) |
| Store trao cho slot | `controller.store` · `unboundSeat.store` · `section.store` — **thể hiện ĐẦY ĐỦ** của `createSnapshotStore` (`getSnapshot`/`set`/`subscribe`), không bọc lại |

## Vì sao cần

Row gốc nằm trong cây plugin web đang chạy; muốn thay bằng bản của ta thì phải **đăng ký đủ 4 slot** đúng
tên, đúng occupant id, đúng thứ tự — thiếu một slot là UI mất một mảnh mà **không có lỗi console nào**.

## Những chỗ phải cẩn thận (đã trả giá ở row khác)

1. **Cổng `apply` phạm vi MODULE** (`let uiAgentPresetInstalled`), bật **sau** khi `applyInner` chạy
   xong. Khoá theo `ctx` không bao giờ kích hoạt vì hai entry ⇒ hai `ctx`.
2. **`hooks.*` trao cho slot là store của gói khác** — phải là thể hiện đầy đủ (`getSnapshot`/`set`/
   `subscribe`); trả thiếu ⇒ `TypeError: w.getSnapshot is not a function` ⇒ **cả thanh bên không render**.
   Test có **ca hợp đồng** khẳng định đúng danh tính thể hiện do `createSnapshotStore` sinh ra.
3. **Id người ngồi** của hai slot keyed (`agent-preset` · `create-plugin` · `agent-presets`) là **nguyên
   văn** của bản gốc: đổi là mất khả năng khôi phục trạng thái tab/mục đã lưu.
4. **Header 5 dòng** nằm ở file nguồn `.module.css`, còn `build.ts` **bỏ header** trước khi nhúng — nhờ
   vậy thẻ `<style>` lúc chạy **nguyên văn từng byte** như bản gốc (test so từng byte với chính bundle gốc).

## Đối chứng với bản gốc (trong `tests/client/ui-agent-preset.test.ts`)

- Tập slot của ta = tập slot của bản gốc (chạy lại **chính hai regex** của `check:rows`).
- Bốn spec slot + khóa nghiệp vụ `inject` + nhãn hiệu ứng vòng đời + seam: so **trực tiếp** với bundle gốc
  nạp trong `window` giả.
- Từ điển: **từng chuỗi** (47 khoá × 2 ngữ) so với bản gốc.
- **Cây render** của cả bốn component + hộp thoại hướng dẫn: so trực tiếp với bản gốc.
- **CSS**: 5 file `.module.css` + bảng tên lớp + thẻ `<style>` lúc chạy: **nguyên văn từng byte**.
