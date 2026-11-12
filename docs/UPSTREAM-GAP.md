<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 30/10/2026
 desc Đối chiếu bản DSH đang pin (0.2.1-alpha.4) với 0.2.1-rc.5 và 0.2.2-alpha.2 trên npm
-->

# Khoảng cách upstream: alpha.4 → rc.5 → 0.2.2-alpha.2

Đo ngày **30/10/2026**, bằng cách tải tarball từ npm và so danh sách file/kích thước từng gói (không dựa vào changelog — upstream không phát hành changelog trong tarball).

## 1. Bản đang pin so với bản mới nhất

| Mục | Giá trị | Nguồn |
|---|---|---|
| GBH đang pin | `@deepseek-ai/dsh*` **0.2.1-alpha.4** (phát hành 2026-10-15) | `apps/host/package.json`, `docs/UPSTREAM.md` |
| Upstream commit đối chiếu | `1517a4dbca0a2789ff1d41ba439600f8547d23fa` (2026-10-16) | `docs/UPSTREAM.md` |
| npm `latest` / `next` | **0.2.1-rc.5** (2026-10-29) | `npm dist-tags` |
| npm `alpha` | **0.2.2-alpha.2** (2026-10-27) | `npm dist-tags` |
| Các bản 0.2.x đã có | alpha.4, alpha.5, rc.1 … rc.5, 0.2.2-alpha.2 | `npm view versions` |

Nói cách khác: **rc.5 là bản mới nhất theo ngày** (29/10), còn **0.2.2-alpha.2 là bản mới nhất của dòng kế tiếp** (27/10, kênh alpha).

## 2. alpha.4 → rc.5: gần như y hệt

So 5 gói trụ cột (`dsh-agent`, `dsh-app-boot`, `dsh-client-modules`, `dsh-host-webserver`, `dsh-client-ui-chat`):

| Gói | alpha.4 | rc.5 | Khác biệt |
|---|---|---|---|
| dsh-agent | 24 file | 24 file | **giống hệt** |
| dsh-app-boot | 30 file | 30 file | **giống hệt** |
| dsh-client-modules | 17 file | 17 file | **giống hệt** |
| dsh-host-webserver | 10 file | 10 file | **giống hệt** |
| dsh-client-ui-chat | 106 file | 107 file | thêm `lib/types/client/reasoning-text.d.ts` |

Thêm duy nhất một API: `reasoningText(text)` — chuẩn hoá text của phần suy luận để hiển thị (cắt khi streaming, trả rỗng nếu không có gì để hiện).

⇒ Dòng `0.2.1-rc.*` là **ổn định hoá**, không phải bước nhảy tính năng. Ví dụ: `dsh-client-connection` cũng không đổi.

## 3. alpha.4 → 0.2.2-alpha.2: bước nhảy thật

| Hạng mục | Thay đổi |
|---|---|
| Gói mới (+5) | `dsh-official-bundles` (danh sách bundle chính thức + protected/presented của plugin manager), `dsh-cua-bundle` (Computer Use trên macOS), `dsh-experimental-forge-bundle` (panel change-request + worktree cho repo Git), `dsh-experimental-liveshare` (chia sẻ Session qua Relay riêng), `dsh-personalized-recommendations` (card gợi ý dưới câu trả lời) |
| i18n | Hầu hết gói thêm `locale/{de,es,fr,ja,pt,ru}.json` (trước chỉ en/zh/vi ở phần GBH dùng) |
| `dsh-app-boot` | thêm `bundle-platform.d.ts` (`assertBundlePlatform`, `UnsupportedBundlePlatformError` — từ chối bundle khai báo không hỗ trợ OS) và `startup-diagnostics.d.ts` |
| `dsh-client-modules` | thêm `assets.d.ts` |
| `dsh-client-ui-chat` | thêm `chat/text-interaction.d.ts` (surface chọn text, gesture), `chat/text-selection.d.ts`, asset `running-whale@2x` |

## 4. Ảnh hưởng tới GBH

1. **Lên rc.5: rẻ và nên làm.** Chỉ là đổi pin (`0.2.1-alpha.4` → `0.2.1-rc.5`) rồi chạy lại `bun run parity:report`. Rủi ro thấp vì API gần như trùng; việc cần kiểm là `reasoningText` có được package client nào của GBH dùng hay không (GBH đang tự cắt reasoning trong panel).
2. **Lên 0.2.2-alpha.2: việc thật.** Chạm vào chuỗi khởi động (`app-boot` + bundle platform), danh sách bundle chính thức, i18n (6 ngôn ngữ mới ⇒ GBH phải bổ sung locale hoặc chấp nhận fallback), và API chat mới ở client. Vì là alpha, dự kiến còn đổi tiếp.
3. **Wire protocol không đổi** giữa alpha.4 và rc.5 (`dsh-host-webserver`, `dsh-client-modules` y hệt) ⇒ phần tích hợp VS Code đang làm (origin fence + cookie, `/api/<method>`, mux WebSocket) không phải sửa khi lên rc.5.

## 5. Cách đo lại

```bash
npm view @deepseek-ai/dsh versions --json | tail
npm dist-tags @deepseek-ai/dsh
npm view @deepseek-ai/dsh time --json | grep 0.2
# tải và so từng gói
npm pack @deepseek-ai/dsh-client-ui-chat@0.2.1-rc.5 && tar -xzf *.tgz
```

## 6. Trạng thái nâng pin lên rc.5 (30/10/2026)

Đã làm:

| Việc | Kết quả |
|---|---|
| Pin `@deepseek-ai/dsh*` trong manifest | **305 manifest** → `0.2.1-rc.5` (giữ tiền tố `~` ở devDeps) |
| `apps/host` (runtime cô lập) | cài lại sạch: **559 gói**, `@deepseek-ai/dsh` = `0.2.1-rc.5` |
| `bun install` workspace | 964 gói, lockfile đã lưu |
| Sáu lỗi typecheck do rc.5 đổi API | sửa xong: (1) bỏ khai báo trùng `Context.deepseekAccount` (rc.5 đã ship `.d.ts`), (2) `execa` `^9.6.0` → `^10.0.1` (có `nodeChildProcess`), (3) `sessionProjections.register<"timeContext", …>()` ghi rõ kiểu (rc.5 nổ TS2589 khi suy luận), (4) ép kiểu `stateSchema` tại biên vì workspace và runtime cài hai bản zod khác danh tính module |
| `gbh.provenance` | cập nhật `version` + `sha256` cho 29 gói có `shaFile` |

Trạng thái cổng: **7/8 XANH** (header · file-length · jsdoc · dep-guard · parity-matrix · typecheck · hygiene), **test ĐỎ**.

Còn lại (đo được, không phải phỏng đoán):

1. **Peer/deps phải chép lại theo stock rc.5**: rc.5 đã **thu gọn** peerDependencies (ví dụ `dsh-time-context`: stock còn 5 peer + cordis `~4.0.5`, ta còn thêm `dsh-util-values`, `schemastery ~3.18.5-alpha.2`, `zod`) ⇒ ảnh hưởng ~289 gói khai `gbh.provenance`, phải đồng bộ máy móc rồi chạy lại test.
2. **Khác biệt hành vi** (mỗi cái cần đọc diff stock rc.5 rồi port): bề mặt export của row `session-telemetry-otel`; 6 thông điệp `ManualCompactionError`; byte `dist` của `web-frontend`; danh tính `LlmError`/`schemastery` (cùng gốc "hai bản cài"); metadata `pty` và `plan-mode`; `inspectCompositions`; sự kiện `AgentPresetRegistry.select`; hành vi `/models`.

Chưa làm, có chủ ý: **chưa restart host 5439** (tiến trình đang chạy vẫn là bản alpha.4 đã nạp trước khi đổi pin) để không phá các phép đo đang dở; và **chưa chạy `parity:report`** vì test còn đỏ.

> **Cập nhật cuối ngày 30/10/2026: đã REVERT.** Việc nâng pin lên rc.5 được thử trọn một lượt rồi
> hoàn lại vì nó chạm vào `stockVersion` trong `packages/host/bundle-*`: khi stock trong profile còn
> alpha.4 mà `stockVersion` đã là rc.5 thì **patch của bundle không áp được**, cây plugin rơi về row
> stock (thanh bên hiện menu `Thêm/Feedback/Sign in` thay vì `Cài đặt`, trang Plugin báo `Trực trặc`).
> Hiện pin đã về `0.2.1-alpha.4`; muốn lên rc.5 phải làm **một lượt trọn**: cài rc.5 vào profile,
> sinh lại bundle patch, sửa parity, rồi mới boot lại.

> Trong lúc thử, phát hiện 2 lỗi có sẵn trong manifest (không do việc nâng pin):
> 9 gói khai `"@deepseek-ai/cordis": "0.2.1-alpha.4"` (cordis đi theo dòng 4.x, đúng phải là `~4.0.5`)
> và 2 gói khai `@deepseek-ai/dsh-skills` — gói này **không tồn tại** trên npm (tên đúng là `dsh-skill`,
> đã có trong peers). Chính chúng làm `bun install` ở workspace fail; nay đã sửa.

## 7. Chân sidebar: một nút “Cài đặt” thay cho menu “Thêm” (31/10/2026)

Đo được nguyên nhân:

- Nút “Thêm” là `AccountMenu` của row `ui-settings-account`, đăng ký vào ghế **`settings.launcher`** (`ui-settings-account/src/plugin.ts`).
- `settings.launcher` là ghế **single** con của `sidebar.settings`; `SettingsRoot` dựng **fallback** cho ghế này = nút bánh răng gọi `actions.open()`.
- Vì ghế bị `AccountMenu` chiếm nên fallback (nút “Cài đặt”) không bao giờ hiện.
- `disabled: true` trong `cordis.patch.yml` **có** tác dụng, nhưng phải đúng **id entry** (`ui-settings-account`), không phải id module (`gbh-client-ui-settings-account`). Ba lần thử trước thất bại vì sai id / dùng `config.enabled` (row không có trường đó).

Cách sửa (chỉ đổi cấu hình profile, không sửa mã nguồn):

```yaml
- id: ui-settings-account
  disabled: true
```

Kết quả đo lại bằng Playwright: chân sidebar còn **đúng một** nút `aria-label="Cài đặt"`, bấm vào **mở bảng Settings** (`bam mo Settings: true`). Ảnh: `/tmp/gbh-footer-caidat.png`, `/tmp/gbh-footer-caidat-open.png`.

Đã thử và **loại**: một gói độc lập chiếm ghế `settings.launcher` — hai chủ thể trên ghế single làm row `ui-settings-account` kẹt `loading` và client báo “1 entry did not activate”, nên đã gỡ bỏ hoàn toàn.

Đánh đổi: khi cần đăng nhập/đăng xuất tài khoản DeepSeek, dùng trang Settings (mục tài khoản) thay vì menu ở chân sidebar.
