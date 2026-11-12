<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc RÀ TRƯỚC KHI KÝ (review) — BẢN ĐÃ ÁP §2c: R6a (row seam phải sửa) + tệp thiếu header 5 dòng, theo batch.
      Sinh bằng ĐỌC mã (grep/đếm cơ học), KHÔNG so sánh/đối chiếu tự động với mã DSH.
-->

# Rà trước khi ký — R6a + header (08/11/2026, review) — **đã áp §2c**

> **Cập nhật quan trọng**: sau khi Lead chốt **§2b + §2c**, các id sau thuộc **R6b (hoãn, augmentation)** và
> **KHÔNG** phải sửa (đừng TRA LAI): `dsh-tools`, `dsh-agent`, `dsh-session`, `dsh-scope`, `dsh-llm`,
> `dsh-typert-protocol`, `dsh-client-ui-primitives`, `cordis`, `schemastery`, `cosmokit`, `dsh-sandbox`, `dsh-web`.
> Bản trước của tệp này (91 gói) **đã sai** vì chưa áp §2c — số đúng là **29 gói**.

## 0. Tổng (sau §2c)

| chỉ số | số |
|---|---|
| gói đã quét | 332 |
| gói **còn R6a** (phải sửa trước khi ký) | **29** (41 dòng import) |
| gói chỉ còn R6b (kernel/augmentation seam — ĐƯỢC KÝ, ghi "R6b (hoãn, augmentation)") | 252 |
| gói thiếu header 5 dòng | 2 |
| gói có tệp > 1100 dòng | 0 |
| gói sạch cơ học (không R6a, đủ header, ≤1100 dòng) | 301 |

### 2 tệp THIẾU header 5 dòng (R1) — phải bổ sung
| gói | tệp |
|---|---|
| `client/ui-settings-plugin-inventory` | `src/plugin.ts` |
| `client/ui-settings-shell` | `src/plugin.ts` |

## 1. Theo batch (dev-N): gói còn R6a (phải sửa)

### batch-dev-1 — 56 gói, **9 gói còn R6a**

| gói | id DSH phải đổi sang GBH | tệp |
|---|---|---|
| `host/account-platform` | @deepseek-ai/dsh-authorization -> @galaxy-blackhole/gbh-authorization | src/platform.ts |
| `host/account-platform` | @deepseek-ai/dsh-host-webserver -> @galaxy-blackhole/gbh-host-webserver | src/platform.ts |
| `host/agent-instructions` | @deepseek-ai/dsh-session-projection -> @galaxy-blackhole/gbh-session-projection | src/service.ts |
| `host/agent-instructions` | @deepseek-ai/dsh-working-directory -> @galaxy-blackhole/gbh-working-directory | src/service.ts |
| `host/agent-loop` | @deepseek-ai/dsh-session-projection -> @galaxy-blackhole/gbh-session-projection | src/inbox.ts |
| `host/agent-loop` | @deepseek-ai/dsh-system-prompt -> @galaxy-blackhole/gbh-system-prompt | src/agent.ts |
| `host/agent-preset` | @deepseek-ai/dsh-agent-preset-registry -> @galaxy-blackhole/gbh-agent-preset-registry | src/index.ts |
| `host/api-session-controller` | @deepseek-ai/dsh-session-title -> @galaxy-blackhole/gbh-session-title | src/parts-host/part-00-head.ts |
| `host/api-session-controller` | @deepseek-ai/dsh-skill -> @galaxy-blackhole/gbh-skill | src/parts-host/part-00-head.ts |
| `host/api-workspace-controller` | @deepseek-ai/dsh-workspace -> @galaxy-blackhole/gbh-workspace | src/commands.ts, src/feed.ts, src/service.ts, src/types.ts |
| `host/api-workspace-controller` | @deepseek-ai/dsh-storage-domain -> @galaxy-blackhole/gbh-storage-domain | src/feed.ts |
| `host/authorization` | @deepseek-ai/dsh-authorization -> @galaxy-blackhole/gbh-authorization | src/service.ts |
| `host/bash-sandbox` | @deepseek-ai/dsh-sandbox-policy -> @galaxy-blackhole/gbh-sandbox-policy | src/index.ts |
| `host/command-compact` | @deepseek-ai/dsh-commands -> @galaxy-blackhole/gbh-commands | src/parts/part-00-index.ts |

### batch-dev-1b — 13 gói, **0 gói còn R6a**

_Không gói nào còn R6a._

### batch-dev-2 — 56 gói, **3 gói còn R6a**

| gói | id DSH phải đổi sang GBH | tệp |
|---|---|---|
| `host/experimental-agent-team` | @deepseek-ai/dsh-subagent -> @galaxy-blackhole/gbh-subagent | src/service.ts |
| `host/experimental-api-speech-to-text` | @deepseek-ai/dsh-experimental-speech-to-text -> @galaxy-blackhole/gbh-experimental-speech-to-text | src/index.ts, src/types.ts |
| `host/experimental-speech-to-text-sensevoice` | @deepseek-ai/dsh-experimental-speech-to-text -> @galaxy-blackhole/gbh-experimental-speech-to-text | src/worker.ts |

### batch-dev-2b — 13 gói, **0 gói còn R6a**

_Không gói nào còn R6a._

### batch-dev-3 — 56 gói, **0 gói còn R6a**

_Không gói nào còn R6a._

### batch-dev-3b — 13 gói, **0 gói còn R6a**

_Không gói nào còn R6a._

### batch-dev-4 — 56 gói, **14 gói còn R6a**

| gói | id DSH phải đổi sang GBH | tệp |
|---|---|---|
| `host/session-telemetry-otel` | @deepseek-ai/dsh-otel -> @galaxy-blackhole/gbh-otel | src/index.ts |
| `host/session-telemetry-otel` | @deepseek-ai/dsh-command-feedback -> @galaxy-blackhole/gbh-command-feedback | src/index.ts |
| `host/session-telemetry-otel` | @deepseek-ai/dsh-message-feedback -> @galaxy-blackhole/gbh-message-feedback | src/index.ts |
| `host/session-title-first-prompt-llm` | @deepseek-ai/dsh-session-title -> @galaxy-blackhole/gbh-session-title | src/index.ts |
| `host/session-title-llm` | @deepseek-ai/dsh-session-title -> @galaxy-blackhole/gbh-session-title | src/execute.d.ts, src/execute.ts, src/types.d.ts, src/types.ts |
| `host/skill-filesystem` | @deepseek-ai/dsh-skill -> @galaxy-blackhole/gbh-skill | src/config.ts, src/frontmatter.ts, src/provider.ts |
| `host/spill-policy` | @deepseek-ai/dsh-token-meter -> @galaxy-blackhole/gbh-token-meter | src/index.ts |
| `host/storage-domain` | @deepseek-ai/dsh-storage-domain -> @galaxy-blackhole/gbh-storage-domain | src/index.ts |
| `host/storage` | @deepseek-ai/dsh-storage -> @galaxy-blackhole/gbh-storage | src/index.ts |
| `host/subagent-fork-in-process` | @deepseek-ai/dsh-subagent -> @galaxy-blackhole/gbh-subagent | src/provider.ts |
| `host/subagent-spawn-in-process` | @deepseek-ai/dsh-subagent -> @galaxy-blackhole/gbh-subagent | src/provider.ts |
| `host/subagent` | @deepseek-ai/dsh-workspace -> @galaxy-blackhole/gbh-workspace | src/archive-admission.ts |
| `host/subagent` | @deepseek-ai/dsh-agent-preset-registry -> @galaxy-blackhole/gbh-agent-preset-registry | src/manager-spawn.ts |
| `host/subagent` | @deepseek-ai/dsh-working-directory -> @galaxy-blackhole/gbh-working-directory | src/manager-spawn.ts |
| `host/time-context` | @deepseek-ai/dsh-session-projection -> @galaxy-blackhole/gbh-session-projection | src/index.ts |
| `host/token-meter` | @deepseek-ai/dsh-llm-retry -> @galaxy-blackhole/gbh-llm-retry | src/turn-usage.ts, src/usage-projection.ts |
| `host/tool-goal` | @deepseek-ai/dsh-goal -> @galaxy-blackhole/gbh-goal | src/authority.ts, src/index.ts |
| `host/tool-goal` | @deepseek-ai/dsh-session-projection -> @galaxy-blackhole/gbh-session-projection | src/authority.ts |
| `host/tool-goal` | @deepseek-ai/dsh-system-prompt -> @galaxy-blackhole/gbh-system-prompt | src/index.ts |
| `host/tool-schedule` | @deepseek-ai/dsh-subagent -> @galaxy-blackhole/gbh-subagent | src/parts/part-00-head.ts |
| `host/tool-schedule` | @deepseek-ai/dsh-schedule -> @galaxy-blackhole/gbh-schedule | src/parts/part-00-head.ts |

### batch-dev-4b — 13 gói, **0 gói còn R6a**

_Không gói nào còn R6a._

### batch-dev-5 — 56 gói, **3 gói còn R6a**

| gói | id DSH phải đổi sang GBH | tệp |
|---|---|---|
| `host/tool-web` | @deepseek-ai/dsh-system-prompt -> @galaxy-blackhole/gbh-system-prompt | src/index.ts |
| `host/web-runtime` | @deepseek-ai/dsh-host-webserver -> @galaxy-blackhole/gbh-host-webserver | src/index.ts |
| `host/web-startup` | @deepseek-ai/dsh-host-webserver -> @galaxy-blackhole/gbh-host-webserver | src/index.ts |

### batch-dev-6-het-ngan-sach — 52 gói, **0 gói còn R6a**

_Không gói nào còn R6a._

## 2. Ghi chú R4 (đã thống nhất với dev-5, căn cứ `docs/DSH-RESIDUAL-REPORT.md` §4)

Không tính là vi phạm R4 (review sẽ KHÔNG trả lại vì các mục này):
- `gbh.provenance.stock`, `gbh.row.aliases`, id stock trong module-table/`inject`/`external`;
- marker de-bundle `//#region \0dsh-css:`;
- chuỗi attribution/bản quyền ("DSH 0.2.0-rc.2, MIT"), ghi chú lịch sử trong JSDoc;
- đường dẫn oracle trong `tests/`;
- **id dịch vụ/sự kiện của kernel** dùng làm giá trị tra cứu (vd `"deepseekAccount"`, `"deepseek-account/session-expired"`) —
  đổi giá trị là hỏng hợp đồng kernel (cùng lý do với R6b).

Tính là vi phạm: tên hằng/biến/hàm/export/component của TA chứa `dsh`/`deepseek`, hoặc chuỗi hiển thị cho người dùng.

## 3. Việc phải làm theo người (đã gửi tin trực tiếp 08/11/2026)

| người | batch | số gói R6a | ghi chú |
|---|---|---|---|
| dev-1 | batch-dev-1 + 1b | 9 | account-platform · agent-instructions · agent-loop · agent-preset · api-session-controller · api-workspace-controller · authorization · bash-sandbox · command-compact |
| dev-2 | batch-dev-2 + 2b | 3 | experimental-agent-team · experimental-api-speech-to-text · experimental-speech-to-text-sensevoice |
| dev-3 | batch-dev-3 + 3b | 0 | không có việc R6a |
| dev-4 | batch-dev-4 + 4b | 14 | session-telemetry-otel · session-title-first-prompt-llm · session-title-llm · skill-filesystem · spill-policy · storage-domain · storage · subagent-fork-in-process · subagent-spawn-in-process · subagent · time-context · token-meter · tool-goal · tool-schedule |
| dev-5 | batch-dev-5 | 3 | tool-web · web-runtime · web-startup |
| dev-denta | batch-dev-6 | 0 | **nhưng phải bổ sung header cho 2 tệp `client/ui-settings-plugin-inventory/src/plugin.ts` và `client/ui-settings-shell/src/plugin.ts` (R1)** |

**CHO DEV CỦA BATCH SỬA (R1)**: 2 tệp header ở trên thuộc **dev-denta** — đã nhắn trực tiếp.

Nhắc lại khi sửa: đổi id **row-seam**; **KHÔNG** đổi id **R6b §2b+§2c**; nếu là `import type` thì vẫn phải đổi (rẻ).


## 4. Peer-level R6a (ĐANG CHỜ LEAD CHỐT — chưa dùng để trả lại)

Nếu §2d "peer cũng tính" được áp nguyên văn thì **88/332 gói** có peerDependencies trỏ id row-seam
(vd host/api-session-controller 8 peer: agent-preset-registry · commands · session-projection · session-title ·
settings · skill · workspace · working-directory). Trong đó **48 gói dev đã ký** (dev-2: 4 · dev-3: 14 · dev-4: 16 · dev-5: 14).
Rủi ro: peer id stock có thể là CHỦ Ý (tầng nạp mount GBH bundle dưới id stock) — trùng cách hiểu "module-table/inject"
mà chính sách R4 của dev-5 coi là hợp lệ. **Chờ Lead chốt (A) trả lại hay (B) ghi R6b "peer-kernel-id" rồi bỏ qua.**


## 5. §2e — 11 gói phải TRẢ PEER VỀ ID STOCK (Lead chốt 04:40; review tạm rút hiệu lực 4 gói đã ký)

Bảng thay thế chính xác (lấy `gbh.provenance.stock` của gói GBH tương ứng):

| gói (owner) | peer đang khai (GBH) | → phải đổi thành (stock) |
|---|---|---|
| host/account-controller (dev-1) | @galaxy-blackhole/gbh-typert-protocol | @deepseek-ai/dsh-typert-protocol |
| host/acp (dev-1) | gbh-agent · gbh-session · gbh-token-meter | @deepseek-ai/dsh-agent · dsh-session · dsh-token-meter |
| host/api-session-controller (dev-1) | gbh-agent-default-model · gbh-client-connection · gbh-client-file-upload · gbh-session-projection-cache · gbh-subagent · gbh-typert-registry | @deepseek-ai/dsh-* tương ứng 6 gói |
| host/api-workspace-controller (dev-1) | gbh-client-connection | @deepseek-ai/dsh-client-connection |
| host/cordis (dev-2) | gbh-cordis-plugin-include · gbh-cordis-plugin-loader | @deepseek-ai/cordis-plugin-include · cordis-plugin-loader |
| host/experimental-worktree (dev-2) | gbh-agent · gbh-fs · gbh-sandbox · gbh-sandbox-policy · gbh-subprocess · gbh-working-directory | @deepseek-ai/dsh-* tương ứng |
| host/host-directory-picker-browse (dev-2) | gbh-host-directory-picker | @deepseek-ai/dsh-host-directory-picker |
| host/plugin-inventory (dev-3) | gbh-typert-protocol | @deepseek-ai/dsh-typert-protocol |
| host/session-delete (dev-3) | gbh-typert-protocol | @deepseek-ai/dsh-typert-protocol |
| host/tool-skill (dev-5) | gbh-agent · gbh-fs · gbh-credentials · gbh-launch-environment · gbh-timeout · gbh-llm | @deepseek-ai/dsh-* tương ứng |
| host/typert-protocol (dev-5) | gbh.peers: gbh-brand | gbh.peers: @deepseek-ai/dsh-brand |

**Chữ ký review TẠM RÚT HIỆU LỰC** cho 4 gói tôi đã ký (chờ dev trả peer về stock): **host/cordis · host/account-controller · host/api-session-controller · host/session-delete**. Ký lại ngay khi dev báo xong (chỉ kiểm package.json peer + chạy lại checklist cũ, mã không đổi).


## 6. Ghi nhận vận hành (review)

- **Lỗi mount xoá locale của repo**: đã được vá tại `apps/cli/src/mount.ts:384-399` (mtime 08/11 03:37) bằng chốt
  `trungNguon(dest, src)` — đích là symlink trỏ ngược nguồn thì BỎ QUA, không `rmSync`. Kiểm 08/11 05:40: locale của
  **12/12 gói** trong cảnh báo lần 2 đã có đủ (agent-default-model · goal · sandbox · sandbox-policy · session-projection ·
  session-projection-cache · session-title · settings · skill · storage-domain · system-prompt · workspace).
- **Quy tắc tự áp khi ký**: mỗi gói phải kiểm `locale/` TỒN TẠI (và nội dung không lệch stock) trước khi ký, vì lỗi mount
  từng xoá 32 tệp locale của 16 gói (2 lần).

## 7. Bài học tự rút (08/11)

- **Không kết luận "đường dẫn chết" khi chưa resolve TỪ THƯ MỤC CỦA TỆP.** Tôi từng báo 32 `packages/*/*/build.ts`
  import `../../tools/brand-rename/src/index.ts` là chết — nhưng `../../` tính từ `packages/client/<gói>/` = `packages/`
  ⇒ trỏ ĐÚNG `packages/tools/brand-rename/src/index.ts` (có thật). Lỗi thật nằm ở cầu nối `tools/lib/brand-rename-client.ts`
  (phải tính 3 cấp). Trước khi báo "chặn build", phải `test -e` bằng đường dẫn resolve từ tệp, hoặc chạy thử 1 build.

## 8. Quy tắc BẮT BUỘC trước khi ký (bổ sung 08/11, sau khi tester bắt lỗi)

**Luôn chạy phép kiểm locale** trước mỗi chữ ký — rẻ và bắt được lớp lỗi mà test 000e của gói KHÔNG phủ:
```bash
# với mỗi gói: đọc gbh.provenance.stock, rồi
ls apps/host/node_modules/<stock>/locale   # stock có?
ls packages/<tầng>/<gói>/locale            # ta có?
# thiếu ⇒ TRA LAI (000e), dù package.json vẫn khai "./locale/*.json"
```
Script sẵn: `/tmp/gbh-review/locale-sweep.py` (quét toàn bộ gói đã ký). Kết quả lần đầu: **5 gói thiếu locale**
(host/cordis-plugin-timer · host/tools · host/token-meter · host/experimental-speech-to-text · host/product-telemetry-otel)
⇒ 2 gói đã ký phải **TẠM RÚT** (cordis-plugin-timer, tools).

## 9. PHASE C — BẢNG CHẤM SẴN cho `host/open-in-app` (lập 08/11, trước khi dev-3 port lại)

Đo bằng script đọc `.d.ts`/`src` (không grep tay): **stock 46 export · ta 11 · THIẾU 41**.
(Danh sách chính xác — dùng làm checklist từng tên khi dev báo xong:)
`DesktopEntry · OPEN_IN_APP_APPS_PATH · OPEN_IN_APP_APPS_ROUTE · OPEN_IN_APP_CATALOG · OPEN_IN_APP_ICON_PREFIX_PATH ·
OPEN_IN_APP_ICON_PREFIX_ROUTE · OPEN_IN_APP_OPEN_PATH · OPEN_IN_APP_OPEN_ROUTE · OpenInAppApp · OpenInAppAppsPayload ·
OpenInAppIcon · OpenInAppIconSource · OpenInAppInternals · OpenInAppLaunch · OpenInAppLaunchOutcome · OpenInAppLocator ·
OpenInAppOpenPayload · OpenInAppPlatform · OpenInAppPlatformSpec · OpenInAppResolvedLaunch · PATH_TOKEN · ResolvedInternals ·
WindowsRegistryView · execCommand · expandCandidate · extractAppIcon · findDesktopEntry · internals · isDirectory · isFile ·
launchDetachedApp · launchResolved · output · parseDesktopEntry · parseRegistryDump · readWindowsRegistryView ·
resolveInternals · resolveLaunch · resolveOpenInAppApps · specFor · xdgDataDirectories`

**5 LỖI HÀNH VI — vị trí hiện tại để đối chiếu sau khi sửa:**
1. `src/index.ts:108` `launch()` — thiếu `unref()` + fallback + re-resolve khi ENOENT (stock: `lib/index.js:363` `child.unref()`, `:896` kiểm `code === "ENOENT"`, `:1155` invalidate + re-resolve 1 lần).
2. `src/index.ts:147` `catalogOnce = () => (catalog ??= resolveCatalog())` — cache VĨNH VIỄN, không bao giờ invalidate.
3. `src/catalog.ts:34-38` `darwinCandidates()` — chỉ `/Applications`/`/System/Library/CoreServices`; stock còn `expandCandidate` + `xdgDataDirectories` + registry Windows.
4. `src/index.ts:21` `inject = ["webServer","connection","subprocess"]` — **"subprocess" khai mà KHÔNG dùng** (0 lần ngoài JSDoc `:130`).
5. `src/index.ts:36-38` default `1500/5000/1200` **lệch** `gbh.row.config` = `{probeTimeoutMs:10000, iconTimeoutMs:10000, launchWatchMs:1000}` ⇒ hai nguồn sự thật.

**Trạng thái baseline lúc mở Phase C**: runtime `lib/index.js` = 268 dòng, export `{name, inject, apply, Config}` (khớp 4/4 stock); `src` 11 export; test gói xanh.
