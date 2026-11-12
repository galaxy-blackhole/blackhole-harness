<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Danh sách 56 gói UI: MOUNT / GO-MOUNT / CHUA-KHAI + số khoá tiếng Việt — SINH TỪ DUMP, không grep
-->

# Trạng thái 56 gói UI (đo 18/10/2026 sau khi dịch)

## 1. Cách đo (đừng thay bằng phép đo gián tiếp)

```bash
bun run apps/cli/src/main.ts host --dump-config   # CÂY ENTRY đã hợp — trực tiếp, in cả '- id:' và name
```

- **MOUNT** = entry đang chạy có `name: '@galaxy-blackhole/gbh-client-…'` (gói CỦA TA thay row gốc).
- **CHUA-KHAI** = gói chưa khai `gbh.row` ⇒ row GỐC của DSH vẫn đang chạy.
- Cột `vi` = số dòng từ điển trong `src/locales-vi.ts` (gói de-bundle ghi `part` — xem `tools/locale/README.md`).

## 2. Bảng (sau lượt đo cuối)

```
  goi (thu muc)                      row id                         trang thai  lib   vi
  --------------------------------------------------------------------------------------------
  client-hmr                         client-hmr                     MOUNT      C/C   —
  connection                         connection                     MOUNT      C/C   —
  file-upload                        —                              CHUA-KHAI  -/C   —
  locale                             locale                         MOUNT      C/C   362
  modules                            modules                        MOUNT      C/C   —
  product-analytics                  product-analytics              MOUNT      C/C   —
  resources                          resources                      MOUNT      C/C   —
  settings-about                     —                              MOUNT*     C/C   —
  shortcuts                          shortcuts                      MOUNT      C/C   —
  ui-agent-preset                    ui-agent-preset                MOUNT      C/C   76
  ui-approval                        ui-approval                    MOUNT      C/C   5
  ui-attachment                      ui-attachment                  MOUNT      C/C   8
  ui-brand-official                  ui-brand-official              MOUNT      C/C   —
  ui-chat                            ui-chat                        MOUNT      C/C   202
  ui-commands                        ui-commands                    MOUNT      C/C   28
  ui-conversation                    ui-conversation                MOUNT      C/C   385
  ui-deliverables                    ui-deliverables                MOUNT      C/C   71
  ui-goal                            ui-goal                        MOUNT      C/C   12
  ui-jobs                            ui-jobs                        MOUNT      C/C   40
  ui-layout                          ui-layout                      MOUNT      C/C   1
  ui-message-feedback                ui-message-feedback            MOUNT      C/C   20
  ui-open-in-app                     ui-open-in-app                 MOUNT      C/C   48
  ui-permission                      ui-permission                  MOUNT      C/C   24
  ui-plan                            ui-plan                        MOUNT      C/C   19
  ui-plugin-manager                  —                              CHUA-KHAI  -/-   —
  ui-plugin-market                   ui-plugin-market               MOUNT      C/C   78
  ui-reference                       ui-reference                   MOUNT      C/C   15
  ui-renderer                        —                              CHUA-KHAI  -/-   —
  ui-schedule                        ui-schedule                    MOUNT      C/C   260
  ui-secret-mask                     ui-secret-mask                 MOUNT      C/C   2
  ui-session                         ui-session                     MOUNT      C/C   —
  ui-settings                        ui-settings                    MOUNT      C/C   —
  ui-settings-account                ui-settings-account            MOUNT      C/C   94
  ui-settings-agent-loop             ui-settings-agent-loop         MOUNT      C/C   12
  ui-settings-general                ui-settings-general            MOUNT      C/C   42
  ui-settings-models                 ui-settings-models             MOUNT      C/C   141
  ui-settings-plugin-inventory       ui-settings-plugin-inventory   MOUNT      C/C   40
  ui-settings-plugins                ui-settings-plugins            MOUNT      C/C   52
  ui-settings-session-log            ui-settings-session-log        MOUNT      C/C   4
  ui-settings-shell                  ui-settings-shell              MOUNT      C/C   14
  ui-settings-subagent               ui-settings-subagent           MOUNT      C/C   35
  ui-settings-web-search             ui-settings-web-search         MOUNT      C/C   18
  ui-shortcuts                       —                              CHUA-KHAI  -/-   —
  ui-sidebar                         ui-sidebar                     MOUNT      C/C   5
  ui-sidebar-browser                 ui-sidebar-browser             MOUNT      C/C   26
  ui-sidebar-documentpreview         ui-sidebar-documentpreview     MOUNT      C/C   89
  ui-sidebar-files                   ui-sidebar-files               MOUNT      C/C   17
  ui-sidebar-right                   ui-sidebar-right               MOUNT      C/C   34
  ui-sidebar-terminal                ui-sidebar-terminal            MOUNT      C/C   28
  ui-skill                           ui-skill                       MOUNT      C/C   8
  ui-subagent                        ui-subagent                    MOUNT      C/C   45
  ui-theme                           —                              CHUA-KHAI  -/-   —
  ui-tool                            ui-tool                        MOUNT      C/C   —
  ui-trajectory                      ui-trajectory                  MOUNT      C/C   194
  ui-workflow-run                    ui-workflow-run                MOUNT      C/C   18
  ui-workspace                       ui-workspace                   MOUNT      C/C   121

  TONG: 56 goi · MOUNT 51 · CHUA-KHAI 5
```

`*` **settings-about** mount như BUNDLE ĐỘC LẬP (`dsh.bundle.patch` + `- insert:`), không phải row thay thế —
vì thế nó KHÔNG khai `gbh.row` và cột row id để `—` (đúng thiết kế, xem ADR 0003/0004).

## 3. Năm gói CHUA-KHAI — số đo và lý do (KHÔNG mount vội)

Đo bằng chính bộ lọc của `check:rows` trên bản build của gói (`exportNames`/`slotNames`) so với bundle gốc:

| gói | khoảng cách đo được | kết luận |
|---|---|---|
| `file-upload` | nửa host chỉ export `apply`; bản gốc export `FileUploads` · `Session` · `TYPERT` · `TYPERT_REMOTE` · `default` | mount bây giờ sẽ MẤT dịch vụ upload ⇒ giữ row gốc |
| `ui-plugin-manager` | 0 slot / 0 export; bản gốc có 3 slot (`main` · `shell.overlay` · `sidebar.panellist`) và 3 export | chưa viết nửa client ⇒ giữ row gốc |
| `ui-renderer` | chưa có `lib/client.js`; bản gốc export `apply` | chưa viết nửa client ⇒ giữ row gốc |
| `ui-shortcuts` | chưa có `lib/client.js`; bản gốc có 2 slot (`settings.general.item` · `shell.overlay`) + `apply` | chưa viết nửa client ⇒ giữ row gốc |
| `ui-theme` | chưa có `lib/client.js`; bản gốc export 10 tên + 1 slot `settings.general.item` | chưa viết nửa client ⇒ giữ row gốc |

**Vì sao vẫn dịch được các gói này dù chưa mount:** chúng đang là bản GỐC (chỉ zh+en), nên
`@galaxy-blackhole/gbh-client-locale` đăng ký TẬP TRUNG bảng `vi` cho namespace của chúng
(`settings.theme` · `shortcuts` · `model` · `slash.menu` · `cordis` · `question` · `agent-team` ·
`voice-input` · `session-log-download`). Đo trên DOM thật: *Appearance · Light · Font size* và
*Keyboard shortcuts · Edit shortcuts* đã thành tiếng Việt **mà không cần mount gói chưa hoàn thiện**.
