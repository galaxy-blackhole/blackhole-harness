# DANH MỤC SAI KHÁC CÓ CHỦ ĐÍCH SO VỚI DSH

<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 11/11/2026
 desc Khoá cứng danh sách các sai khác CỐ Ý so với bản gốc DSH — để không ai nhầm là lỗi.
-->

## Vì sao có tệp này (yêu cầu trực tiếp của chủ dự án, 08/11/2026)

Nhiều gói GBH **không phải bản sao 1:1**: chúng thay bằng cơ chế khác theo yêu cầu sản phẩm. Ví dụ GBH badge skill
không chèn file SVG như DSH mà chọn cách chèn khác nhau tuỳ tài liệu hay tệp mã. Người review sau (hoặc chính chúng tôi
vài tuần sau) mở artefact, thấy khác bản gốc, rất dễ kết luận 'port sai' rồi 'sửa' cho giống DSH — tức là phá đúng
thứ chủ dự án muốn. Vì vậy: **mọi sai khác cố ý phải được khai báo thành văn bản, có mã gói + lý do + dẫn chứng**.

## Luật (áp cho mọi gói có `gbh.row` và mọi gói client mount)

1. Nếu artefact KHÁC bản gốc DSH ngoài phần **đổi id** (tên gói, thương hiệu, `@deepseek-ai/*` → `@galaxy-blackhole/*`),
   gói đó **PHẢI** có mục trong tệp này.
2. Mỗi mục ghi đúng 5 thông tin: **gói** · **khác cái gì** · **vì sao** (yêu cầu sản phẩm nào) · **dẫn chứng `tệp:dòng`** ·
   **reviewer cần kiểm gì** (để không đòi parity ở chỗ này).
3. Sai khác **không khai báo** = lỗi. `tools/lint/deviation-registry.ts` (đang triển khai) sẽ so artefact với stock:
   lệch byte mà không có mục khai báo ⇒ **cổng ĐỎ**.
4. Khi port lại bản DSH mới: **giữ nguyên các sai khác đã khai báo**, chỉ cập nhật phần còn lại; mục nào hết đúng thì xoá mục đó
   kèm ghi chú ngày.

## SAI KHÁC HỆ THỐNG (áp cho mọi gói)

Đây là các lớp sai khác **áp cho MỌI gói**, không phải ý đồ của từng gói. Công cụ
`tools/lint/deviation-registry.ts` chỉ được phép BỎ QUA một lớp khi lớp đó được khai báo dưới đây bằng dòng
`<!-- normalize: <lớp> @ <phiên bản> -->`; lớp chưa khai báo thì cổng KHÔNG chuẩn hoá (so byte thô).

<!-- normalize: ids @ v1 -->
### Lớp `ids` (v1) — đổi id gói stock → GBH
- **Khác gì**: mọi chuỗi `@deepseek-ai/dsh-<x>` trong artefact gốc được đổi thành `@galaxy-blackhole/gbh-<x>` (292 cặp).
- **Vì sao**: yêu cầu "1:1 nhưng mang thương hiệu GBH"; không phải sai khác chức năng.
- **Dẫn chứng**: `tests/helpers/brand-ids-map.json` (sinh bởi `tools/brand-ids-client.ts`), ngày áp 08/11/2026.
- **Reviewer kiểm gì**: KHÔNG đòi parity ở phần id; nhưng nếu gói ta THÊM/BỚT export hay đổi ngữ nghĩa thì vẫn phải có mục riêng.

<!-- normalize: brand @ v1 -->
### Lớp `brand` (v1) — brand swap chuỗi thương hiệu
- **Khác gì**: `DEEPSEEK` / `DeepSeek` / `deepseek` → `GALAXY BLACKHOLE` / `Galaxy Blackhole` / `galaxy-blackhole`.
- **Vì sao**: quyết định brand swap của chủ dự án (17/10/2026) — xưng danh GBH, không xưng danh DSH.
- **Dẫn chứng**: `packages/client/locale/src/locales-vi-stock.ts`, wordmark `packages/client/ui-brand/*`; ngày áp 08/11/2026.
- **Giới hạn đã biết**: lớp này KHÔNG chuẩn hoá **ảnh/base64 wordmark SVG**; khác biệt còn lại do asset phải khai báo theo gói.
- **Reviewer kiểm gì**: chuỗi hiển thị phải là GBH; KHÔNG "sửa" về DeepSeek.

<!-- normalize: css-hash @ v1 -->
### Lớp `css-hash` (v1) — hash class CSS module
- **Khác gì**: hash sinh bởi bundler trong tên class (`Ab3dE_x9Yz12` → `<css-hash>`) khác nhau giữa hai lần build.
- **Vì sao**: hash là sản phẩm của bundler, không mang ngữ nghĩa; so byte thô sẽ báo oan toàn bộ client.
- **Dẫn chứng**: `packages/client/*/lib/client.js`, ngày áp 08/11/2026; mẫu nhận dạng `[A-Za-z0-9]{3,8}_[A-Za-z0-9_-]{5,}`.
- **Reviewer kiểm gì**: chỉ kiểm cấu trúc DOM/class có mặt; KHÔNG đòi trùng hash.

<!-- normalize: header @ v1 -->
### Lớp `header` (v1) — header 5 dòng bắt buộc của repo + chú thích đường dẫn nguồn
- **Khác gì**: mọi tệp nguồn của repo PHẢI có khối `/** author … desc … */` (luật repo §1), còn bản stock không có;
  thêm nữa bản build của ta chèn chú thích đường dẫn nguồn (`// src/x.ts`, `// packages/...`) và dòng `//#region`.
- **Vì sao**: luật repo bắt buộc header; chú thích đường dẫn là sản phẩm của bundler.
- **Dẫn chứng**: `AGENTS.md` §1 (header bắt buộc); mẫu `//#region` trong `packages/client/*/lib/*.js`; ngày áp 08/11/2026.
- **Reviewer kiểm gì**: header phải còn trong SRC; lớp này chỉ bỏ khi SO artefact.

<!-- normalize: build-shape @ v1 -->
### Lớp `build-shape` (v1) — prelude/footer do Bun sinh khi ghép lại từ TypeScript
- **Khác gì**: artefact của ta được `Bun.build` ghép từ `src/*.ts` nên có prelude/helper do Bun sinh
  (`var __create = Object.create;`, `__defProp`, `__toESM`, `__require`, `__dispose`, `__exportAll`, `0 && (module.exports = …)`),
  còn stock ship bản publish của họ.
- **Vì sao**: khác **cơ chế build**, không phải khác sản phẩm.
- **Dẫn chứng**: mọi `packages/host/*/lib/index.js` (build bằng `build.ts`/`Bun.build`), ngày áp 08/11/2026.
- **ĐIỀU KIỆN BẮT BUỘC (Lead duyệt 09/11/2026)**: lớp này là **phép biến đổi CƠ HỌC rồi SO LẠI byte**, KHÔNG phải
  "miễn trừ ngữ nghĩa". Sau khi bỏ prelude/footer mà còn lệch ⇒ **vẫn là lệch cấu trúc, phải khai báo**.
  Ngoài ra cổng PHẢI so thêm **bề mặt exports** (tập tên export + số tham số) với stock — vì "khác cơ chế build"
  không được che một export bị thiếu/thừa (đúng lớp lỗi đã gây P0: thiếu export Remote mà không cổng nào bắt).
- **Reviewer kiểm gì**: bề mặt exports phải khớp stock; phần còn lệch sau biến đổi cơ học phải có mục khai báo.

## Danh mục (mỗi mục theo khuôn 5 thông tin)

### 1. `gbh-skill-badge` (+ `gbh-badge-skill-bundle`) — cơ chế chèn huy hiệu KHÁC DSH
- **Khác gì**: DSH chèn **một file SVG cố định** (`dsh-badge`) vào tài liệu. GBH chọn **cơ chế chèn theo loại tệp**
  (tệp tài liệu và tệp mã có cách chèn khác nhau).
- **Vì sao**: yêu cầu sản phẩm — huy hiệu phải hiển thị đúng trong cả `.md` lẫn tệp mã, SVG thuần không làm được.
- **Dẫn chứng**: `packages/host/skill-badge/src/*` (đối chiếu `apps/host/node_modules/@deepseek-ai/dsh-skill-badge/lib/index.js`).
- **Reviewer kiểm gì**: KHÔNG đòi parity byte ở phần chèn; chỉ kiểm (a) không lộ chuỗi DSH ra UI, (b) tên skill/huy hiệu là GBH.

### 2. Hiển thị `Nhà cung cấp / model` khi model là `auto`
- **Khác gì**: DSH hiện thẳng `provider/model` thô (ví dụ `auto/deepseek-v4.1-flash`). GBH cần hiện **`Galaxy Blackhole / auto`**.
- **Vì sao**: provider `auto` là khái niệm của GBH (route nội bộ), không phải tên hãng; hiện `auto/deepseek-v4.1-flash`
  là rò rỉ tên model nội bộ và sai ngữ nghĩa với người dùng.
- **Dẫn chứng**: nhãn `message.turnUsage.model` ở `packages/client/locale/src/locales-vi-stock.ts:180`; giá trị lấy từ
  sự kiện `assistant/message.usage` — **map ở tầng HIỂN THỊ, không sửa sự kiện**: `packages/client/ui-chat/src/parts/part-010.ts:734-737`
  (`routeLabel`: `provider === "auto"` ⇒ `"Galaxy Blackhole / auto"`, ngược lại giữ `${provider}/${model}`).
- **Trạng thái**: ĐÃ SỬA 08/11/2026 (dev-5); artefact `packages/client/ui-chat/lib/client.js` chứa chuỗi `Galaxy Blackhole / auto`;
  test gói: 9 pass / 5 skip / 0 fail.
- **Reviewer kiểm gì**: với `provider === 'auto'` phải hiện `Galaxy Blackhole / auto`; với provider thật thì hiện đúng tên provider.

### 3. `gbh-client-ui-session-delete` — mục menu 'Xoá phiên' (tính năng RIÊNG của GBH)
- **Khác gì**: DSH **không có** tính năng xoá phiên trong menu ngữ cảnh; đây là gói GBH tự làm (ADR 0016).
- **Vì sao**: yêu cầu sản phẩm.
- **Dẫn chứng**: `packages/client/ui-session-delete/src/menu-item.ts`, `src/locales.ts`; tiếng Việt đăng ký ở
  `packages/client/locale/src/plugin.ts:66` (`["session-delete", viSessionDelete]`).
- **Nguyên nhân lỗi "chưa thấy tiếng Việt"** (đo 08/11/2026, dev-5): bảng `viSessionDelete` trong
  `packages/client/locale/src/locales-vi.ts:493-495` **RỖNG** (`{ }`) ⇒ mọi khoá của namespace `session-delete` rơi về
  bản `en` của row (`packages/client/ui-session-delete/src/locales.ts:33-43`), dù map đăng ký ở `plugin.ts:66` vẫn đúng.
- **Trạng thái**: ĐÃ SỬA 08/11/2026 — điền đủ **9 khoá** vi (`menu.deleteSession` = "Xoá phiên", `dialog.*`, `error.*`);
  build `packages/client/locale` ⇒ `lib/client.js` chứa "Xoá phiên".
- **Reviewer kiểm gì**: KHÔNG so với DSH (không có bản gốc). Kiểm: chuỗi tiếng Việt có hiện trong menu thật không
  (mở menu ngữ cảnh một phiên ở sidebar ⇒ phải là "Xoá phiên", không còn "Delete session").

### 4. Voice input (`gbh-experimental-voice-input-bundle`, `gbh-speech-to-text-phowhisper`, `gbh-experimental-speech-to-text*`)
- **Khác gì**: DSH dùng SenseVoice tải tại chỗ; GBH có thêm đường `phoWhisper` và cách chọn model voice riêng.
- **Vì sao**: yêu cầu sản phẩm (tiếng Việt + lựa chọn model).
- **Dẫn chứng**: `packages/host/speech-to-text-phowhisper/src/*`, `packages/host/experimental-speech-to-text/src/*`.
- **Reviewer kiểm gì**: không đòi parity UI/cơ chế với DSH; kiểm chuỗi hiển thị là tiếng Việt và không lộ DSH.

### 5. Model settings của provider `auto`
- **Khác gì**: provider `auto` (Galaxy Blackhole) KHÔNG có form cài đặt tuỳ chỉnh như provider thật trong DSH.
- **Vì sao**: `auto` là route nội bộ, không có tham số người dùng.
- **Dẫn chứng**: `packages/host/agent-default-model/src/*`, `packages/client/ui-settings-model*`.
- **Reviewer kiểm gì**: không coi 'thiếu form' là lỗi.

<!-- deviation: @galaxy-blackhole/gbh-skill-badge -->
### 6. `gbh-skill-badge` — cơ chế chèn huy hiệu KHÁC DSH (mục §1, nay có marker máy đọc)
- **Khác gì**: DSH chèn một file SVG cố định; GBH chọn cơ chế chèn theo loại tệp, nhãn mô tả mang chữ "Galaxy Blackhole".
- **Vì sao**: yêu cầu sản phẩm (huy hiệu phải hiển thị đúng trong cả tệp tài liệu và tệp mã).
- **Dẫn chứng**: `packages/host/skill-badge/src/*` ↔ `apps/host/node_modules/@deepseek-ai/dsh-skill-badge/lib/index.js`.
- **Reviewer kiểm gì**: không đòi parity byte; kiểm không lộ chuỗi DSH ra UI.

<!-- deviation: @galaxy-blackhole/gbh-api-session-controller -->
### 7. `gbh-api-session-controller` — chú thích tiếng Việt chèn trong mã
- **Khác gì**: bản port giữ chú thích tiếng Việt ngay trong hàm (ví dụ nhánh "Phiên còn sống…"), nên artefact lệch 1263 dòng so với gốc.
- **Vì sao**: dấu vết bản port; KHÔNG phải thay đổi hành vi.
- **Dẫn chứng**: `packages/host/api-session-controller/src/parts-host/*` (khu vực byte 78.5k).
- **Reviewer kiểm gì**: bề mặt exports + test của gói; chú thích không được che một nhánh logic bị đổi.

<!-- deviation: @galaxy-blackhole/gbh-experimental-inspector -->
### 8. `gbh-experimental-inspector` — chú thích tiếng Việt chèn trong mã
- **Khác gì**: artefact lệch 1467 dòng, nguyên nhân chính là JSDoc tiếng Việt trong thân hàm.
- **Vì sao**: dấu vết bản port.
- **Dẫn chứng**: `packages/host/experimental-inspector/src/parts-host/part-04.ts`.
- **Reviewer kiểm gì**: như mục 7.

<!-- deviation: @galaxy-blackhole/gbh-plugin-package-inventory-deepseek -->
### 9. `gbh-plugin-package-inventory-deepseek` — ĐỔI TÊN gói/thư mục
- **Khác gì**: gói gốc `@deepseek-ai/dsh-plugin-package-inventory-deepseek` được port thành `@galaxy-blackhole/gbh-plugin-package-inventory-deepseek` với thư mục nguồn đổi tên (`...-galaxy-blackhole`), nên artefact lệch 157 dòng.
- **Vì sao**: quy ước đặt tên GBH (mục 1 của danh mục áp cho tên gói, nhưng đường dẫn nguồn/thông điệp vẫn khác).
- **Dẫn chứng**: `packages/host/plugin-package-inventory-galaxy-blackhole/src/*`; `package.json` khai `name` GBH.
- **Reviewer kiểm gì**: id gói trong composition + bề mặt exports; KHÔNG "sửa" về tên DeepSeek.

<!-- deviation: @galaxy-blackhole/gbh-client-ui-chat -->
### 10. `gbh-client-ui-chat` — BỎ icon "con cá" (whale) ở chỉ báo đang chạy/suy luận (10/11/2026)
- **Khác gì**: bản gốc vẽ `RunningWhaleTail` — một đuôi cá heo (APNG mask + SVG dự phòng) — ở ĐẦU dòng chỉ báo
  "đang chạy" (`chat.deepDiving` / `chat.deepDivingFor`) ngay dưới khối suy luận. GBH **xoá hẳn**: vùng
  `lib/types/client/chat/RunningWhaleTail.js` (hàm + `REST_PATH`) và lời gọi trong `RunningStatus`; CSS
  `.EvIC1a_runningIcon` · `.EvIC1a_runningWhaleAnimated` (mask APNG base64 **29 477 ký tự**) ·
  `.EvIC1a_runningWhaleStill` + khối `@supports (mask-mode:alpha)` của chúng, cùng 3 khoá tương ứng trong
  `ChatView_module_css_default`. Chỉ báo còn lại: `.runningDivider` + `TextShimmer` + nhãn chữ.
- **Vì sao**: chủ dự án yêu cầu trực tiếp 10/11/2026 ("bỏ icon con cá ở phần thinking") — đã yêu cầu một lần
  trước đó nhưng lần đó chỉ sửa **bản cài trong profile** (`~/.galaxy/blackhole/profiles/.../lib/client.js`),
  nên lần deploy kế tiếp (`scripts/sync-lib-to-profile.sh`) ghi đè lại từ mã nguồn ⇒ icon "quay lại". Lần này
  sửa **đúng chỗ sinh ra** là mã nguồn `packages/client/ui-chat/src/parts/*`.
- **Dẫn chứng**: `packages/client/ui-chat/src/parts/part-009.ts` (vùng `RunningWhaleTail` đã xoá; `RunningStatus`
  còn `visuallyHidden` + `runningDivider` + `TextShimmer`) · `packages/client/ui-chat/src/parts/part-005.ts`
  (CSS + bảng class) · artefact `packages/client/ui-chat/lib/client.js` (0 lần xuất hiện `whale`/`REST_PATH`).
- **Reviewer kiểm gì**: KHÔNG đòi parity byte với stock ở vùng chỉ báo đang chạy; **KHÔNG thêm lại** icon/asset
  whale. Vẫn phải giữ: `role="status"` + `aria-live="polite"` (trợ năng), `data-chat-running`, nhãn
  `chat.deepDiving*` (VI: "Đang suy nghĩ…"), dải phân cách `.runningDivider` và hiệu ứng `TextShimmer`.
  Lưu ý phân biệt: **"cá heo" ở màn Phiên mới** (`.pXSMma_fish` trong `gbh-client-ui-conversation`) là hoạ tiết
  khác, vẫn giữ nguyên theo bản gốc — không phải chỗ chủ dự án báo lần này.

## Việc tiếp (đã giao)
1. `tools/lint/deviation-registry.ts`: so artefact với stock, lệch ngoài phần đổi id mà thiếu mục khai báo ⇒ ĐỎ.
2. Bổ sung mục cho các gói còn lại có sai khác (rà soát bằng script so byte).
3. Sửa 2 lỗi hiển thị người-dùng-thấy: nhãn `auto` (mục 2) và tiếng Việt mục 'Xoá phiên' (mục 3).

### Xoá phiên đang mở ⇒ về màn 'Phiên mới' (tính năng RIÊNG của GBH — DSH không có)
- **Khác gì**: DSH **không có** tính năng xoá phiên trong menu ngữ cảnh, nên cũng không có hành vi sau-xoá. GBH: xoá phiên **đang mở** ⇒ UI về màn **'Phiên mới'** (không còn tiêu đề `session-…`); xoá phiên **không mở** ⇒ view hiện tại **giữ nguyên**.
- **Vì sao**: yêu cầu sản phẩm (ADR 0016 — tính năng riêng); trước 08/11/2026 xoá xong UI đứng ở khung hội thoại với tiêu đề là id thô ⇒ người dùng tưởng app hỏng.
- **Cơ chế (đúng tầng, không phải "thêm một lời gọi điều hướng")**: view đi theo **main binding / retention**; khi main reference đổi, khung nhìn tự tính lại phiên chính.
  · Stock chứng minh cơ chế: `apps/host/node_modules/@deepseek-ai/dsh-client-ui-session/lib/client.js:766` (`UiSession extends Service`) và `:916-917` — `nextId` lấy từ `retainInfo(currentId).retainedBy.mainView`, hết retention ⇒ `nextId = undefined` ⇒ màn Phiên mới.
  · Đường sửa của ta: `packages/client/ui-session-delete/src/mount.ts` (sau `sessions.refresh()`): nếu `uiWorkspace.mainReference.sessionId === sessionId` thì gọi `uiWorkspace.createInWorkspace(workspace, {})` — API đã có của `packages/client/ui-workspace/src/service.ts:124-136` (tự tái dùng phiên `blank` còn dùng được, hoặc tạo phiên mới).
  · KHÔNG đụng seam `sessions` (`packages/client/ui-session/src/ui-session.ts:88-96` chỉ có `list`/`binding`/`retainInfo`, không có hàm nhả main) và KHÔNG sửa artefact gói de-bundle `ui-session`.
- **Dẫn chứng**: `packages/client/ui-session-delete/src/mount.ts` (inject thêm `uiWorkspace`, khối "H1" sau `refresh`), `tests/client/ui-session-delete.test.ts` (hợp đồng inject + stub seam); test gói: 5 pass / 0 fail.
- **Reviewer kiểm gì**: KHÔNG đòi parity với DSH (không có bản gốc). Kiểm 2 ca trên UI thật: (a) xoá phiên đang mở ⇒ về 'Phiên mới', không còn tiêu đề `session-…`; (b) xoá phiên không mở ⇒ view giữ nguyên; cả hai ca sidebar phải cập nhật ngay.

#### Đối chiếu Lưu trữ phiên (đính chính 08/11/2026 — Lead chỉ ra có flow archive trong UI)
- **Đính chính**: kết luận trước của dev-5 ("repo ta không có flow archive") là **SAI** — tôi chỉ grep `dsh-client-ui-conversation` nên bỏ sót gói render menu Thao tác phiên.
- **Flow archive CÓ thật, ở `packages/client/ui-workspace`**: action `ArchiveSession` (kiểu khai tại `packages/client/ui-workspace/lib/types/client/session-actions/ArchiveSession.d.ts`), menu hiện đủ: Ghim phiên · Đổi tên ⌥⌘G · Fork phiên ⇧⌘F · Lưu trữ phiên ⌥⌘A · Sao chép ID phiên · Xoá phiên.
- **Cơ chế sau khi lưu trữ phiên đang mở**: `packages/client/ui-workspace/src/service.ts:286` — `if (this.mainReference?.sessionId === sessionId) this.clearMain();` ⇒ main reference bị xoá ⇒ khung nhìn rơi về màn Phiên mới.
- **So với H1**: cùng họ hành vi (đổi/xoá main reference ⇒ về Phiên mới); khác API — archive dùng `clearMain()` nội bộ ui-workspace, xoá dùng API công khai `createInWorkspace` (`service.ts:124-136`).
- **Kết luận**: hành vi xoá phiên-đang-mở ⇒ về Phiên mới là GIỐNG hành vi Lưu trữ phiên, đúng yêu cầu của chủ dự án.

<!-- deviation: @galaxy-blackhole/gbh-client-ui-agent-team -->
### 6. `gbh-client-ui-agent-team` (+ `gbh-host-agent-team`) — QUẢN LÝ NHÓM AGENT là tính năng RIÊNG của GBH
<!-- deviation: @galaxy-blackhole/gbh-client-ui-agent-team -->
- **Khác gì**: DSH chỉ hiển thị nhóm agent do preset quyết định. GBH thêm **hàng cài đặt giới hạn nhóm** (số teammate)
  và **thẻ hành động nhóm** (roster + task card) trong giao diện.
- **Vì sao**: yêu cầu sản phẩm (chủ dự án chốt 08/11/2026) — người dùng phải tự điều chỉnh nhóm mà không sửa preset.
- **Dẫn chứng (đối chiếu mã 08/11/2026)**: `packages/client/ui-agent-team/src/set-team-limits-row.ts` + `set-team-limits.module.css`
  (hàng cài đặt 'Set team limits'), `src/team-action.ts` + `TeamAction.module.css` (vẽ roster: nút mở phiên + nhãn thành viên hiện tại +
  trạng thái, và task card — **KHÔNG có nút xoá thành viên**), `src/team-types.ts`.
- **ĐÍNH CHÍNH 08/11/2026 (review bắt lỗi văn bản)**: bản đầu ghi 'xoá teammate' — **mã KHÔNG có tính năng đó**
  (quét `removeMember`/`deleteMember`/`removeTeammate`/`deleteTeammate` trong `packages/*/*/src` = 0 tệp;
  `host/experimental-agent-team/src` chỉ có `Map.delete`/`removeEventListener` nội bộ). Văn bản nay khớp mã;
  muốn có tính năng xoá thành viên thì phải **làm mới**, không được coi là 'đã có'.
- **Reviewer kiểm gì**: KHÔNG đòi parity với DSH ở các thành phần trên (DSH không có); chỉ kiểm (a) chuỗi hiển thị tiếng Việt/không lộ DSH,
  (b) hành động hiện có không làm hỏng phiên đang mở, (c) export bề mặt khớp stock ở phần LÕI (không thừa API ở tầng kernel).
<!-- deviation: @galaxy-blackhole/gbh-host-tool-agent-team -->
### 6b. `reset_teammate` — NẠP LẠI MỘT TEAMMATE TỪ ĐẦU (tính năng RIÊNG của GBH, 11/11/2026)
<!-- deviation: @galaxy-blackhole/gbh-host-tool-agent-team -->
- **Khác gì**: DSH (và bản port 1:1 của ta trước hôm nay) **KHÔNG có** thao tác xoá/clear/reset một teammate.
  Bản gốc chỉ có: `spawn_teammate` · `send_message` · `list_agents` · `wait_agent` · `interrupt_agent` +
  4 tool bảng việc. Teammate cạn ngữ cảnh thì chỉ còn cách `interrupt_agent` (giữ nguyên bộ nhớ) hoặc tạo teammate
  MỚI — mà **tên teammate là vĩnh viễn**: bản ghi `team/member` trong log Lead chỉ-thêm, fold từ chối mọi chuyển
  pha ngoài `provisioning → active|failed` và khoá tên bằng `TEAM_MEMBER_NAME_TAKEN`
  (`packages/host/experimental-agent-team/src/projection.ts:311-331`, `roster.ts:380-385`).
  GBH thêm **tool thứ 11** `reset_teammate` + `TeamService.resetTeammate`: dừng lượt đang chạy, **xoá vĩnh viễn
  nhật ký phiên** của teammate rồi **dựng lại continuation TRÊN CÙNG id phiên** với prompt mới. Tên · mô tả ·
  provider giữ nguyên ⇒ `list_agents`/`send_message`/`wait_agent` vẫn nhắm đúng mục tiêu cũ; chỉ bộ nhớ hội thoại
  (và hộp thư chờ của nó) về 0. Không đổi bản ghi roster ⇒ **không đổi hợp đồng sự kiện `team/member`** (vẫn version 2).
- **Vì sao**: yêu cầu sản phẩm (chủ dự án 11/11/2026) — teammate cạn ngân sách ngữ cảnh phải được "clear để nạp lại
  từ đầu", thay vì phải bỏ cả Team hoặc sống chung với một teammate đã nhiễu.
- **Dẫn chứng**: `packages/host/experimental-tool-agent-team/src/install.ts:440-467` (đăng ký tool, SAU 9 tool gốc và
  `set_team_limits` nên 9 mục đầu vẫn 1:1) · `src/schemas.ts:115` (`RESET_VALUE_SCHEMA` = đúng hình dạng
  `spawn_teammate` `{ member }`) · `packages/host/experimental-agent-team/src/roster.ts:371-416` (`reset`) ·
  `src/service.ts:201-208` (`resetTeammate` qua `lifecycle.track`) · `src/types.ts` (`ResetTeammateRequest/Result`).
- **Phụ thuộc MỚI (mềm)**: bước xoá nhật ký dùng dịch vụ `sessionDelete` (row `gbh-session-delete`) qua
  `ctx.get("sessionDelete")`; composition nào không cài row đó thì tool trả `TEAM_RESET_UNAVAILABLE` và **không**
  tự tay gỡ thư mục (không nhân bản logic xoá phiên). Chờ sổ phiên SỐNG nhả id có trần 1s ⇒ `TEAM_RESET_BLOCKED`.
- **Giới hạn đã biết**: (a) teammate tạo bằng `context: "fork"` vẫn gieo lại tiền tố lượt Lead đã xong (đó là định
  nghĩa của fork) — muốn nạp lại "trắng" thì phải tạo teammate `fresh`; (b) nhật ký CŨ bị xoá nên không còn để đối
  chiếu về sau; (c) chưa có nút clear trên giao diện TeamAction (chỉ model/Lead gọi được qua tool);
  (d) CHỈ teammate pha `active` nạp lại được — teammate `failed`/`provisioning` bị `TEAM_MEMBER_NOT_FOUND`
  (fold không cho `failed → active`, nên "cứu" một mục `failed` phải là tính năng khác: thêm pha `retired` + cho
  phép tái dùng tên, tức ĐỔI hợp đồng `team/member`).
- **Reviewer kiểm gì**: (a) 9 tool gốc vẫn khớp byte với stock, tool bổ sung đứng CUỐI; (b) reset một teammate rồi
  `send_message` tới đúng tên đó vẫn tới nơi, còn `list_agents` không đổi id/tên; (c) composition thiếu
  `session-delete` ⇒ lỗi rõ, không ghi gì lên đĩa.

## SAI KHÁC HỆ THỐNG (áp cho mọi gói) — lớp chuẩn hoá cổng `deviation-registry`
<!-- normalize: ids @ v1 -->
<!-- normalize: brand @ v1 -->
<!-- normalize: css-hash @ v1 -->
<!-- normalize: header @ v1 -->
<!-- normalize: build-shape @ v1 -->


### 2b. Nhãn `Nhà cung cấp / model` lấy tên từ CONFIG — mở rộng ở CLIENT (DSH chỉ hiện `provider/model` thô)
- **Khác gì**: DSH render thẳng `${provider}/${model}` (`apps/host/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js:6851`) nên route nội bộ `auto` hiện `auto/deepseek-v4.1-flash`. GBH hiện **`Galaxy Blackhole / Auto`** — lấy từ CONFIG (`providers.auto.displayName`, `models[0].name`), không hard-code.
- **Vì sao**: yêu cầu sản phẩm — nhãn phải đổi theo config, không sửa mã; và phiên CŨ (log đã persist) cũng phải hiện đúng tên.
- **Cách làm (chỉ phía CLIENT; KHÔNG sửa host)**: catalog `session/modelCatalog` **đã** mang tên (`packages/host/api-session-controller/src/parts-host/part-02-catalog.ts:33-46`: `name: provider.name`, `name: model.name`). Thêm MỘT khối join nhỏ trong bundle `ui-chat`:
  · `packages/client/ui-chat/src/parts/part-018.ts` — bảng `__gbhRouteNames` (phạm vi module) + hàm `napTenRoute(ctx)` gọi `remote.session.modelCatalog()` **đúng một lần**, dùng CHUNG `ctx.effect` sẵn có để không thêm phần tử vào chuỗi effect/inject (test `tests/client/ui-chat.test.ts:315` so chuỗi với bản gốc);
  · `packages/client/ui-chat/src/parts/part-010.ts` — `routeLabel` đọc bảng, thiếu ⇒ **fallback `${provider}/${model}`** y như bản gốc.
- **Bằng chứng giữ điều kiện "không hard-code"**: `grep -c "Galaxy Blackhole" packages/client/ui-chat/lib/client.js` = **0**; tên chỉ đến từ payload lúc chạy.
- **Reviewer kiểm gì**: (a) đổi `displayName`/`name` trong config ⇒ nhãn đổi, không sửa mã; (b) xoá tên khỏi config ⇒ nhãn fallback `auto/deepseek-v4.1-flash`; (c) mở phiên CŨ vẫn đúng tên. KHÔNG đòi parity byte với stock ở 2 lát đã sửa.

### 3b. Xoá phiên: dùng ĐÚNG cơ chế của "Lưu trữ phiên" (`clearMain`) — cập nhật 08/11/2026
- **Đổi gì so với H1 ban đầu**: H1 gọi `uiWorkspace.createInWorkspace(workspace, {})`; nay gọi **`uiWorkspace.clearMain()`** — chính là API mà flow "Lưu trữ phiên" dùng (`packages/client/ui-workspace/src/service.ts:286` `if (this.mainReference?.sessionId === sessionId) this.clearMain();`, method public ở `:462`).
- **Vì sao**: yêu cầu "xoá phiên phải giống lưu trữ" ⇒ cùng một API, cùng một hành vi; `createInWorkspace` chỉ là đường vòng tương đương.
- **Hành vi giữ nguyên**: chỉ nhả khi phiên bị xoá ĐANG là phiên mở; xoá phiên khác ⇒ không đụng view; `sessions.refresh()` vẫn gọi trước đó nên sidebar cập nhật ngay.
- **Dẫn chứng**: `packages/client/ui-session-delete/src/mount.ts` (khối H1 sau `refresh`), `tests/client/ui-session-delete.test.ts` (stub `clearMain`); test gói 5 pass / 0 fail.

### 2c. Mục "Plugin thử nghiệm" — predicate của client nhận thêm `meta.category` (DSH chỉ khoá theo tiền tố tên)
- **Khác gì**: bản gốc chia mục bằng **tiền tố tên gói**: `apps/host/node_modules/@deepseek-ai/dsh-client-ui-plugin-manager/lib/client.js` hàm `packageText(pkg, resolveText)` → `beta: pkg.name.startsWith("@galaxy-blackhole/gbh-experimental-")` (trong artefact của ta: `packages/client/ui-plugin-manager/lib/client.js:895-902`). Bundle GBH của ta tên `gbh-terminal-bundle`, `gbh-badge-skill-bundle`… ⇒ rơi vào danh sách chính, mục "Plugin thử nghiệm" trống (chỉ còn 2 id stock không có bản GBH).
- **Vì sao**: hệ quả bộ lọc stock của Lead (ẩn 12 bundle `dsh-experimental-*` mang chuỗi DSH) ⇒ phải có đường khác để 12 bundle GBH vào ĐÚNG mục, nếu không người dùng thấy "mất" 12 tính năng.
- **Cách làm (2 phía)**: (i) host `packages/host/plugin-manager/src/manager.ts` — khi lọc, ghi lại tập bundle GBH thử nghiệm (`tenThuNghiemGbh`) rồi gắn `meta.category = "experimental"` cho đúng các bundle đó ở điểm áp bảng chữ Việt; (ii) client predicate đổi thành `beta: pkg.meta?.category === "experimental" || pkg.name.startsWith("@galaxy-blackhole/gbh-experimental-")`.
- **Lưu ý kỹ thuật**: `packages/client/ui-plugin-manager/build.ts:100-112` — gói de-bundle nên nhánh build chỉ **CHÉP** `lib/*.js` sẵn có (không build lại từ `src/parts`) ⇒ sửa predicate phải sửa thẳng artefact, và artefact đó là **sai khác có chủ đích** (đã đo: `bun test tests/client/ui-plugin-manager.test.ts` → 25 pass / 0 fail, không có test so byte thuần với stock; test chỉ kiểm 1 id + CSS + bảng 153 lớp).
- **Reviewer kiểm gì**: 12 bundle GBH thử nghiệm phải nằm ở mục "Plugin thử nghiệm"; 0 chuỗi `powered by dsh`/`DSH badge`; KHÔNG đòi artefact `ui-plugin-manager` trùng byte stock ở dòng predicate.

### 2d. Mục "Plugin thử nghiệm": KHÔNG đưa bundle GBH vào — chúng ship trong profile, không cài từ npm (chốt 08/11/2026)
- **Khác gì**: mục "Plugin thử nghiệm" (`extensionsTitle`) của trang Plugin **chỉ** liệt kê bundle tuỳ chọn cài từ npm của kernel stock — hiện là `Claude Code (agent con)` và `Codex (agent con)`. 12 bundle thử nghiệm của GBH (`gbh-terminal-bundle`, `gbh-badge-skill-bundle`, `gbh-auto-review-bundle`, `gbh-plugin-market-bundle`, `gbh-ralph-bundle`, `gbh-session-titles-bundle`, `gbh-tool-worktree-bundle`, `gbh-agent-team-profile`, `gbh-cot-translation-bundle`, `gbh-voice-input-bundle`, `gbh-session-search`, `gbh-inspector-profile`) **KHÔNG** nằm trong mục này; chúng nằm ở danh sách chính và đang chạy.
- **Vì sao**: 12 bundle đó **được ship sẵn trong profile** (`~/.galaxy/blackhole/profiles/blackhole/package.json` → `dsh.profile.bundles`, đúng 14 tên GBH) ⇒ đưa chúng vào mục "thử nghiệm" sẽ ngụ ý "cài từ registry", **sai sự thật vận hành** và có thể sinh nút "Cài" gọi npm.
- **Cơ chế (dẫn chứng hai phía)**:
  · Ta: `packages/client/ui-plugin-manager/lib/client.js:4105-4109` — `listed = state.packages.filter(pkg => !BUILTIN_PROFILE_BUNDLES.has(pkg.name) && (pkg.installed || pkg.official || pkg.error !== undefined))`, rồi `official = listed.filter(pkg => pkg.official)`; cờ `official` lấy từ **`state.packages`** (inventory của kernel `@deepseek-ai/dsh-app-boot` + `official-bundles.generated`), **không** lấy từ `listBundles` của `packages/host/plugin-manager`.
  · DSH: `apps/host/node_modules/@deepseek-ai/dsh-client-ui-plugin-manager/lib/client.js` — cùng kiến trúc `pinned`/`extensions`/`renderGroup("extensions", …)` và cùng nguồn `state.packages.official`.
- **Đã thử và KHÔNG hiệu quả (ghi lại để người sau không thử lại)**: thêm entry vào catalog `official` phía host `packages/host/plugin-manager` (`src/catalog-thu-nghiem.ts`, `meta.category = "experimental"`) **không** làm bundle xuất hiện ở mục này, vì client không đọc catalog đó cho mục "thử nghiệm". Phần mã này **giữ nguyên** (vô hại, có ích cho nhãn "Thử nghiệm" trên thẻ) nhưng **không phải** cơ chế chia mục.
- **Reviewer kiểm gì**: mục "Plugin thử nghiệm" có đúng 2 thẻ stock (Claude Code, Codex) là **ĐÚNG THIẾT KẾ**; KHÔNG đòi bundle GBH xuất hiện ở đó; kiểm thay vào đó là 12 bundle GBH **có mặt ở danh sách chính** và bật/tắt được.

### 2e. `bundle-base` KHÔNG còn là bản sao 1:1 patch của stock (09/11/2026, Lead duyệt (a)+(b))
- **Khác gì**: `packages/host/bundle-base/cordis.patch.yml` khác bản gốc ở 2 điểm: (1) **4 row trỏ gói GBH đúng provenance** — `approval`→`@galaxy-blackhole/gbh-user-approval`, `sandbox`→`gbh-sandbox-local`, `timeout-policy`→`gbh-tool-call-timeout-policy`, `timer`→`gbh-cordis-plugin-timer`; (2) **6 row lõi được khai MỚI** — `ui-session-delete`, `session-delete`, `subagent-model-selection-settings`, `web-runtime`, `web-startup`, `web-search-auto` (→ `gbh-web-search-ollama`).
- **Vì sao**: overlay trong `~/.galaxy/blackhole/app.patch.yml` tắt row stock rồi chèn row GBH với **id khác** ⇒ trang bundle đếm row của bundle (đang tắt) ⇒ hiện sai "đang tắt"; và **3/4 cặp overlay đang chạy SAI GÓI** so với gói thay thế đúng (bug thật thứ ba của đợt). Cách đúng: khai thẳng id gốc trong `bundle-base` rồi bỏ overlay.
- **Dẫn chứng**: `packages/host/bundle-base/cordis.patch.yml` (4 name + 6 row, có comment ngày) · `gbh.provenance.stock` của 4 gói GBH tương ứng · 10 cặp overlay đã xoá khỏi `~/.galaxy/blackhole/app.patch.yml` (backup `/tmp/app.patch.yml.bak-step2-2026-11-09`) · ngoại lệ khai báo tương ứng trong `tests/host/bundle-profile-patches.test.ts` (so TẬP ID cho riêng gói này).
- **Reviewer kiểm gì**: KHÔNG đòi `bundle-base` khớp 1:1 patch stock; kiểm thay vào đó (a) 4 row trỏ đúng gói GBH theo `provenance.stock`, (b) 6 row mới trỏ gói GBH **tồn tại** trong repo, (c) `app.patch.yml` không còn cặp overlay tương ứng.

### 2f. `gbh-client-ui-commands` — nhận diện 6 lệnh dựng sẵn theo KHOÁ CHUẨN, thêm khoá thứ hai cho `permission` (10/11/2026)
- **Khác gì**: `src/resolution.ts` khai thêm `DEFINITION_KEY_ALIASES` (`permission` nhận CẢ khoá `permission-presets` lẫn `permission`) và `resolveCommand` so bằng `builtinCommandName` thay vì so chuỗi id thô (stock so chuỗi thô).
- **Vì sao**: SỰ CỐ 10/11/2026 — menu `/` hiện `permission` + mô tả tiếng Anh trong khi 5 mục kia đã tiếng Việt. Bảng đổi id ở bản cài (`tests/helpers/brand-ids-map.json:36`) đổi id stock `dsh-permission-presets` thành `gbh-permission` (TÊN GÓI của ta) ⇒ khoá đổi `permission-presets` → `permission`; tệp của CHÍNH gói thì được miễn đổi (chống self-import) nên Host vẫn đăng ký id stock ⇒ hai khoá lệch nhau ⇒ trượt nhãn + mô tả + icon. Khoá khai bằng chuỗi TRẦN vì phép đổi id chỉ thay chuỗi id có scope (khai id đầy đủ sẽ bị đổi thành cùng một khoá — đã đo: vẫn MISS).
- **Dẫn chứng**: `packages/client/ui-commands/src/resolution.ts` (`DEFINITION_KEY_ALIASES` · `KEY_TO_BUILTIN` · `resolveCommand`) · Host đăng ký id stock ở `packages/host/permission/src/service.ts:145` · đo trên bundle ĐÃ CÀI trong profile: 6/6 khớp id stock và 12/12 khi tính cả id GBH · test `tests/client/ui-commands.test.ts` (14 pass).
- **Reviewer kiểm gì**: KHÔNG đòi parity byte ở ba chỗ này; kiểm (a) menu `/` hiện “Quyền” + mô tả tiếng Việt, (b) gõ alias `/权限` mở đúng lệnh `permission`, (c) 5 lệnh dựng sẵn còn lại không đổi hành vi.

### 2g. `gbh-skill-badge` — id skill là `gbh-badge` chứ không phải `dsh-badge` (10/11/2026)
- **Khác gì**: `lib/index.js` đăng ký `PROVIDER_NAME` + `CANDIDATE.name` = `gbh-badge` (bản gốc `dsh-badge`), asset đổi tên `assets/gbh-badge.md` + `assets/gbh-badge.png` (PNG vẫn TRÙNG BYTE stock); `src/sync.ts` đổi tên tệp + đổi chuỗi trong chú thích `lib/types/index.d.ts` khi đồng bộ, và **KHÔNG ghi đè** hai tệp ta đã cố ý viết lại (`lib/index.js`, `assets/gbh-badge.md`).
- **Vì sao**: quy ước repo — mọi id/package là `gbh-*`; mục §1 (và §6) đã yêu cầu “tên skill/huy hiệu là GBH”, nên đây là SỬA CHO ĐÚNG khai báo sẵn có, không phải sai khác mới về cơ chế.
- **Dẫn chứng**: `packages/host/skill-badge/lib/index.js:6,10,11,17,48` · `packages/host/skill-badge/src/sync.ts` (`TEN_TEP_TA` · `THAY_CHUOI` · `KHONG_GHI_DE`) · test `tests/host/skill-badge.test.ts` (12 pass, gồm ca “không còn chuỗi dsh-badge trong tệp ship”).
- **Reviewer kiểm gì**: menu `/` liệt kê `gbh-badge` (không còn `dsh-badge`); PNG vẫn trùng byte stock; KHÔNG đòi parity byte cho `lib/index.js` và `assets/gbh-badge.md` (đã khai ở §1).

### 2h. `gbh-workspace` — boot TỰ NHẬN NUÔI phiên MỒ CÔI; DSH chỉ gieo lịch sử MỘT LẦN (10/11/2026)
- **Khác gì**: `packages/host/workspace/src/registry.ts` — ở lượt khởi động, khi sổ ĐÃ `initialized: true` và bảng có bản ghi, ta vẫn dựng chỉ mục `cwd` rồi gọi `adoptOrphanedSessions(headers)`: phiên TRÊN ĐĨA giải được `cwd` mà KHÔNG workspace nào ghi tên sẽ được nhận nuôi vào **workspace ĐÃ CÓ cho đúng đường dẫn đó** (chỉ THÊM id lên đầu, không xoá id cũ, không đổi chủ, KHÔNG tạo workspace mới, KHÔNG đụng thứ tự `workspaceIds`) kèm một dòng `warn` có số đo. Bản gốc chỉ chạy `bootstrap` đúng MỘT lần khi `initialized` còn `false`; các lượt sau chỉ `replaceHeaderIndex` nên phiên xuất hiện sau dấu đó vĩnh viễn không vào sổ.
- **Vì sao**: SỰ CỐ 10/11/2026 — app Tauri hiện đúng **1 phiên** dù `session/list` trả **629** và `~/.galaxy/blackhole/sessions/--Users-buitronghieu-Desktop-Project-galaxy--/` có **613** thư mục phiên. Nguyên nhân: sổ workspace đóng dấu `initialized` từ trước, còn **574 phiên do `bh migrate` chép sang SAU dấu đó** không bao giờ vào sổ ⇒ sidebar chỉ còn nhóm `galaxy` 1 dòng, 21 phiên còn lại rơi vào "Chưa nhóm" (mặc định THU GỌN) nên người dùng đọc là "mất phiên". Bản gốc DSH cũng hành xử y vậy khi home bị chép/khôi phục; cách sửa duy nhất của bản gốc là xoá tay `storages/workspace.json` (mất ghim/lưu trữ/thứ tự). Yêu cầu trực tiếp của chủ dự án: **boot phải tự phát hiện lệch, không bắt người dùng xoá tay**.
- **Dẫn chứng**: `packages/host/workspace/src/registry.ts:142-153` (nhánh init có thêm lượt kiểm lệch) · `:636` (`adoptOrphanedSessions`) · bản gốc chỉ-once ở `apps/host/node_modules/@deepseek-ai/dsh-workspace/lib/index.js:387-391` · test `tests/host/workspace.test.ts` ca 11b (nhà bình thường: 0 lượt ghi, A/B BẰNG NHAU) và ca 11c (A/B: bản gốc giữ [s-old], ta [s-new1, s-new2, s-old]; phiên không có cwd và đường dẫn chưa có workspace đều KHÔNG bị nhận nuôi) · đo trên home THẬT: `session/list` = 629→630 item, `storages/workspace.json` = 30 id ghi (20 còn header) TRƯỚC, và sau lượt boot 17:56 ngày 10/11/2026: nhóm `galaxy` = 612 id ⇒ sidebar từ **1 dòng** thành **19 dòng** (5 dòng + “Hiện thêm 14 phiên”).
- **Reviewer kiểm gì**: KHÔNG đòi parity byte cho `registry.ts`; kiểm (a) nhà bình thường (mọi phiên đã có chủ) ⇒ **0 lượt ghi**, hành vi y bản gốc (ca 11b), (b) chỉ THÊM id — không xoá id cũ (kể cả id trỏ phiên đã mất), không đổi chủ giữa hai workspace, (c) KHÔNG tự tạo workspace cho đường dẫn chưa có ai làm chủ (tôn trọng luật “xoá workspace là tắt VĨNH VIỄN” của bản gốc — ca 11c có đối chứng âm `s-elsewhere`), (d) sau lượt boot lệch, sidebar hiện phiên trong NHÓM WORKSPACE chứ không phải “Chưa nhóm”.

### 2i. `gbh-host-plugin-manager` — bật/tắt bundle so theo DANH TÍNH lớp, không so chuỗi thô (10/11/2026)
- **Khác gì**: `src/manager.ts` (`selectBundle` · phép tính `enabled` trong `listBundles` · nhánh chọn của `installBundle`) dùng helper mới `chonBundle` (`src/manager-support.ts`) + `khoaBundle`/`laCungBundle` (`src/bundle-rename.ts`): một lượt bật/tắt so theo **DANH TÍNH lớp bundle** — trùng sau khi quy tên, hoặc trùng **KHOÁ TÍNH NĂNG** (bỏ scope, `gbh-`/`dsh-`/`experimental-`, hậu tố `-bundle`/`-profile`) — rồi mới lọc/ghi; bản gốc so ĐÚNG chuỗi nhận được.
- **Vì sao**: SỰ CỐ 10/11/2026 — tắt công tắc “Tự động duyệt uỷ quyền” mà menu quyền vẫn còn mục “Tự động duyệt” (4 preset) và `dsh.profile.bundles` vẫn khai lớp đó. Đo trên host thật: `setBundleEnabled` nhận id STOCK trả `{"changed":false,"application":"applied"}` — lệnh TẮT thành no-op nhưng vẫn báo THÀNH CÔNG, nên UI lật công tắc còn row vẫn mount. Bản gốc DSH không có bảng đổi tên stock→GBH nên không gặp lớp lỗi này. **Càng không thể dựa vào bảng**: bản cài trong profile bị `tools/p1b/denta-profile.ts` đổi id stock→GBH NGAY TRONG artefact nên `DOI_TEN_BUNDLE` ở đó thành ánh xạ ĐỒNG NHẤT (`gbh-auto-review-bundle → gbh-auto-review-bundle`, đọc được trong `profiles/node_modules/@galaxy-blackhole/gbh-host-plugin-manager/lib/index.js`) ⇒ danh tính PHẢI suy từ hình dạng tên.
- **Dẫn chứng**: `packages/host/plugin-manager/src/bundle-rename.ts` (`khoaBundle`, `laCungBundle`) · `src/manager-support.ts` (`chonBundle`) · `src/manager.ts` (`selectBundle`) · test `tests/host/plugin-manager.test.ts` — 6 ca “danh tính lớp bundle”, gồm ca **không có bảng đổi tên** (`dsh-experimental-terminal-bundle` ↔ `gbh-terminal-bundle`, chỉ khớp nhờ khoá tính năng).
- **Reviewer kiểm gì**: KHÔNG đòi parity byte cho `selectBundle`; kiểm (a) tắt bằng id stock hay tên của ta đều bỏ ĐÚNG một lớp, (b) bật lại chuẩn hoá về tên gốc và KHÔNG nhân đôi lớp, (c) bundle không liên quan không bị xoá oan, (d) hồ sơ chỉ khai tên của ta thì hành vi y bản gốc.

### 2j. Hai bundle tính năng cắm ĐÚNG gói sở hữu row của ta (không dùng bản sao 1:1) — 10/11/2026
- **Khác gì**: `packages/host/bundle-session-titles-bundle/cordis.patch.yml` cắm row `optional-session-title-all-prompts`
  bằng `@galaxy-blackhole/gbh-optional-session-title-all-prompts` (bản gốc + trước đây: bản sao 1:1
  `gbh-session-title-all-prompts-llm`); `packages/host/bundle-tool-worktree/cordis.patch.yml` cắm row `worktree`
  bằng `@galaxy-blackhole/gbh-worktree` (trước đây: bản sao 1:1 `gbh-experimental-worktree`). Hai bản sao 1:1 vẫn
  nằm trong repo (bằng chứng byte-identical, còn test riêng) nhưng KHÔNG còn là module của row nào.
- **Vì sao**: SỰ CỐ 10/11/2026 (nửa còn lại của §2i) — người dùng tắt plugin mà tính năng vẫn chạy. Nguyên nhân: khối
  `- id: <row> / disabled: true` + `- insert: <row>-ours` do metadata `gbh.row` sinh trong
  `~/.galaxy/blackhole/app.patch.yml` (lớp CUỐI, luôn thắng bundle) cắm chính gói của ta; tắt bundle chỉ bỏ row của
  bundle, còn row `-ours` vẫn nạp gói ⇒ tính năng sống. Cách chữa theo đúng mẫu `auto-review` đã nghiệm thu: gói
  SỞ HỮU row khai `gbh.row.ownedByBundle: true` ⇒ `renderRewriteBlock` không phát khối nữa; và bundle patch phải cắm
  ĐÚNG gói sở hữu đó (nếu không, sau khi bỏ khối, row sẽ chạy bản sao 1:1 thay vì bản viết lại của ta — đổi hành vi
  ngoài phạm vi sự cố).
- **Dẫn chứng**: `packages/host/optional-session-title-all-prompts/package.json` · `packages/host/worktree/package.json` ·
  `packages/host/tool-worktree/package.json` (cùng cờ `ownedByBundle: true`) · hai `cordis.patch.yml` nêu trên ·
  `gbh.provenance.replacements` của hai bundle đã cập nhật (`headerLines` 7 và 8) · `tools/check/toggle-matrix.ts`
  (bảng bundle × row × "cắm ngoài bundle": 12 bundle / 29 row riêng / 0 FAIL) · `bh host --dump-config`:
  tắt `gbh-session-titles-bundle` ⇒ `optional-session-title-all-prompts` 1→0, row stock `session-title-llm` bật lại;
  tắt `gbh-tool-worktree-bundle` ⇒ `worktree` 1→0, `tool-worktree` 1→0 (TRƯỚC khi sửa: hai row `*-ours` vẫn BẬT).
- **Parity còn lại**: phép so hai chiều ở `tests/host/bundle-profile-patches.test.ts` vẫn xanh — thay NGƯỢC tên gói ta
  trong patch ra ĐÚNG nguyên văn patch stock, chiều thuận ra đúng tệp của ta ⇒ vẫn là bản 1:1 **modulo bảng provenance**,
  không phải patch viết lại tay.
- **Reviewer kiểm gì**: KHÔNG đòi hai bundle đó cắm bản sao 1:1; kiểm (a) bật bundle ⇒ row
  `optional-session-title-all-prompts` / `worktree` / `tool-worktree` trỏ gói GBH viết lại và KHÔNG còn row `*-ours`
  trong `app.patch.yml`, (b) tắt bundle ⇒ row biến mất khỏi `--dump-config`, (c) `bun run tools/check/toggle-matrix.ts`
  phải 0 FAIL.

### 2k. Thương hiệu route trong persona + thư mục Workspace mặc định (11/11/2026, yêu cầu trực tiếp của chủ dự án)
- **Khác gì (a) — persona**: ba preset "coding agent" (`standard` · `ptc` · `cordis`) và persona của deployment dùng
  biến prompt **`{{model_label}}`** thay cho `{{model}}` của bản gốc. `model_label` do
  `packages/host/agent-loop/src/model-label.ts` cung cấp: route quản lý `auto` ⇒ **"Galaxy Blackhole"**, mọi route
  khác ⇒ **id model thật** người dùng chọn. Preset `minimal` giữ nguyên persona riêng của bản gốc.
- **Khác gì (b) — thư mục mặc định**: `packages/host/api-workspace-controller/src/defaults.ts` dựng Workspace lần
  dùng đầu dưới `<Documents>/galaxy/default-workspace` thay vì `<Documents>/deepseek-harness/default-workspace`.
- **Vì sao**: (a) LỖI NGƯỜI DÙNG 11/11/2026 — chọn model "Auto" mà system prompt ghi *"powered by the deepseek-v4.1-flash
  model"* vì preset chạy SAU persona của deployment và `{{model}}` là **id trên dây**. Yêu cầu: route `auto` phải đọc
  *"You are a coding agent powered by the Galaxy Blackhole model."*, còn chọn model khác thì **vẫn hiện đúng tên model
  đó** (nên KHÔNG chọn cách bỏ persona của preset). (b) Sản phẩm là Galaxy Blackhole: thư mục do nó tạo cho người dùng
  phải mang tên sản phẩm, không mang tên harness gốc.
- **Dẫn chứng**: `packages/host/agent-loop/src/model-label.ts` · `packages/host/agent-loop/src/plugin.ts`
  (`systemPrompt.variable("model_label", …)`) · `tools/gen-bundle-patches.ts` (`doiPersonaPreset` + cổng "không còn
  `{{model}}`") · `packages/host/agent-preset/src/preset-redirect.ts` (`rewritePersonaPrefix`) ·
  `profiles/blackhole/parity.patch.yml` · `packages/host/api-workspace-controller/src/defaults.ts`
  (`WORKSPACE_PARENT_DIRECTORY`) · test `tests/host/agent-loop.test.ts` (ca "biến prompt model_label", gồm ca DỰNG
  prompt thật) và `tests/host/api-workspace-controller.test.ts` (A/B khoá sai khác + ca TƯƠNG THÍCH).
- **Tương thích (b)**: chỉ Workspace **TẠO MỚI** dùng thư mục mới. Workspace đã đăng ký giữ nguyên đường dẫn tuyệt đối
  trong `storages/workspace.json` (không di trú, không viết lại), và sổ đăng ký KHÔNG dựng bản mặc định khi đã có
  Workspace/Session nào (`dsh-workspace` `initializeDefault`) ⇒ bản cũ dưới `deepseek-harness` vẫn mở được, không
  mất, không tạo trùng.
- **Reviewer kiểm gì**: KHÔNG đòi parity chuỗi persona với bản gốc và KHÔNG đòi đường dẫn mặc định giống bản gốc; kiểm
  (a) route `auto` ⇒ prompt mở đầu đúng câu "You are a coding agent powered by the Galaxy Blackhole model.", route
  khác ⇒ tên model thật, (b) preset `minimal` vẫn là "You are a helpful software engineer assistant.", (c) tạo
  Workspace mặc định mới ⇒ `~/Documents/galaxy/default-workspace`, (d) nhà đã có Workspace cũ ⇒ vẫn mở đúng đường
  dẫn cũ, không sinh bản thứ hai.

<!-- deviation: @galaxy-blackhole/gbh-hmr -->
### 2l. `gbh-hmr` — THÊM ĐÚNG MỘT method `applyPatches` vào prototype của service (11/11/2026)
- **Khác gì**: bản gốc `@deepseek-ai/dsh-hmr/lib/index.js` ship service `Hmr` với một tập method CỐ ĐỊNH trên
  prototype (tập đó không có `applyPatches`). Bản của ta giữ **đủ, không thiếu một tên nào** của bản gốc và
  **thêm đúng MỘT tên**: `applyPatches(patches, requiredIds?)`. Không đổi chữ ký method nào của bản gốc; phần
  static (`Config`, `inject`), tập export của artefact và locale `{en,zh}.json` vẫn đo 1:1 với bản gốc ở các ca
  khác của `tests/host/hmr.test.ts`.
- **Vì sao**: SỰ CỐ 11/11/2026 — MỌI lượt ghi cấu hình từ Cài đặt (`settings/mutate`, namespace `ui-settings`,
  công tắc bundle…) bị Host từ chối `settings/rejected: dsh: profile reload requires the root Include entry`.
  Nguyên nhân đã đo: `reconcileProfilePatches` của kernel tra **WeakMap `bootstrapIncludes`** khoá theo ctx
  LÚC BOOT; hồ sơ của ta compose bằng **bundle patch** nên ctx mà plugin nhìn thấy không khớp khoá đó ⇒ kernel
  ném ngay dòng đầu, trước khi chạm tệp (nên không có tác dụng phụ, chỉ là mọi lượt ghi đều hỏng). Đường đúng
  đã đóng ở VÒNG 60 cho công tắc bundle: **lấy entry Include từ loader rồi làm đúng 3 bước cuối của kernel**
  (`packages/host/hmr/src/profile-apply.ts`). Cần một **seam SỐNG** cho `configEditor`, và seam đó thuộc gói
  `hmr` (gói đã sở hữu `runExclusive` + `reconcileProfile` + `ctx.effect` của watcher) ⇒ chọn **thêm một
  method** thay vì nhân bản logic kernel vào `config-editor` hay chọc thẳng vào WeakMap nội bộ của kernel.
- **Dẫn chứng**: `packages/host/hmr/src/service.ts:830` (`applyPatches`) · `packages/host/hmr/src/profile-apply.ts`
  (`applyProfilePatches` — phần thân dùng chung với `reconcileProfile`) ·
  `packages/host/config-editor/src/service.ts:93-96` (`reconcilePatches`: chọn đường SỐNG `hmr.applyPatches`
  TRƯỚC, rơi về `reconcileProfilePatches` khi không có hmr) · `packages/host/config-editor/src/types.ts:46`
  (`HmrSeam.applyPatches?` TUỲ CHỌN — hồ sơ tối giản/không mount hmr vẫn đi đường kernel y bản gốc) ·
  test `tests/host/hmr.test.ts` ca "bề mặt service" (whitelist tường minh, đọc CHÍNH tài liệu này để đối chiếu).
- **Reviewer kiểm gì**: KHÔNG đòi prototype khớp bản gốc 1:1 ở đúng MỘT tên `applyPatches`; KIỂM (a) **0 method
  THIẾU** so bản gốc, (b) method THỪA **chỉ** được là `applyPatches` — phát sinh tên thứ hai (kể cả tên có trong
  whitelist nhưng KHÔNG khai ở mục này) ⇒ `tests/host/hmr.test.ts` ĐỎ, (c) một lượt `settings/mutate` lưu được
  và công tắc bundle vẫn bật/tắt thật, (d) hồ sơ KHÔNG có dịch vụ `hmr` vẫn chạy đúng đường kernel của bản gốc.

