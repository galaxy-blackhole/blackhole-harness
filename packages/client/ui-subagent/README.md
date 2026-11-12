<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README cua goi @galaxy-blackhole/gbh-client-ui-subagent — ban viet lai cua row ui-subagent
-->

# @galaxy-blackhole/gbh-client-ui-subagent

Bản viết lại của Galaxy Blackhole cho row `ui-subagent` của DSH
(`@deepseek-ai/dsh-client-ui-subagent`, bản gốc 1.016 dòng bundle).

## Gói này làm gì

Danh mục hội thoại subagent, UI định tuyến tiếp nối và nguồn tham chiếu `@`:

- **Đường dẫn pha hệ** trong hàng đầu phiên (`conversation.session.header.lineage`) — nút đổi sang phien
  con anh em, kèm dropdown cây con.
- **Nút danh mục** trong hàng đầu phiên (`conversation.session.header.actions`, occupant
  `subagent-catalog`, order 10) — số lượng con + menu cây bung ra sau nhãn preset.
- **Chỗ soạn tin chỉ đọc** (`conversation.composer`, priority −10) — chiếm chỗ khi phiên con là lịch sử
  one-shot hoặc chủ tiếp nối không còn.
- **Tab chat trong thanh bên phải** (`sidebar.right.pane.tab` + `sidebar.chat.conversation`) — chủ tài
  nguyên `dsh-resource://subagentchat/session/…`, mở lại một Conversation của phiên con.

## Row này thay gì

| | |
|---|---|
| Row gốc | `ui-subagent` (`@deepseek-ai/dsh-client-ui-subagent`) |
| Id module bundle tự khai | `@galaxy-blackhole/gbh-client-ui-subagent` (ĐÚNG MỘT id) |
| Id gốc | chỉ khai ở `gbh.row.aliases` — tầng nạp tự sinh entry alias |
| Seam (`inject`) | `sessions` · `uiWorkspace` · `slots` · `locale` · `sidebarRight` (nguyên văn) |
| Slot đăng ký | 5: `conversation.session.header.lineage` · `conversation.session.header.actions` · `conversation.composer` · `sidebar.right.pane.tab` · `sidebar.chat.conversation` |
| Từ điển | namespace `subagent`, 41 khoá × 2 ngữ (zh là nguồn sự thật) |
| CSS | 3 module nhúng nguyên văn (tiền tố hash giữ nguyên như bản gốc) |

## Vì sao cần

Row gốc nằm trong cây plugin web đang chạy; muốn thay bằng bản của ta thì phải **đăng ký đủ 5 slot** đúng
tên, đúng occupant id, đúng thứ tự — thiếu một slot là UI mất một mảnh mà không có lỗi nào hiện ra.
