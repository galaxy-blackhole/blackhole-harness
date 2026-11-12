<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 12/11/2026
 desc Rà soát (điều tra, KHÔNG sửa mã): chỗ nào thay được `@deepseek-ai/*` bằng bản GBH mà không đổi hành vi · kiểm chứng nhóm gói "vỏ lib-only" (33 gói chỉ có lib/, không có .ts) · lộ trình 3 nhóm kèm số đo trên bản CÀI (profile)
-->

# Rà soát: thay `@deepseek-ai/*` bằng bản GBH — và nhóm gói "vỏ lib-only"

**Ngày đo:** 2026-11-12 · **Phạm vi:** `packages/**` (334 gói) + bản cài thật `~/.galaxy/blackhole/profiles` (335 mục)
**Tính chất:** RÀ SOÁT — không sửa một dòng mã nào (đúng yêu cầu).
**Phương pháp:** `graphify` **không có** trên máy (`which graphify` → rỗng) ⇒ dùng grep + đọc mã + đo trực tiếp trên đĩa.

---

## 0. TL;DR — 5 kết luận

1. **Ánh xạ gần như đầy đủ.** 362 tên `@deepseek-ai/*` được nhắc trong `packages/**`; **301/334 gói GBH khai `gbh.provenance.stock`**, đủ để ánh xạ 1:1 cho **255/256** tên có mặt trong `package.json`.
2. **Nhưng "sửa import trong `src`" KHÔNG phải đòn bẩy chính** — bản CÀI đã tự đổi id rồi (`tools/p1b/denta-profile.ts`, chạy trong `sync-lib-to-profile.sh`) cho **217 gói được chép** vào profile; **118 gói là symlink thì denta BỎ QUA HẲN** (`lstatSync(...).isDirectory()` sai với symlink).
3. **Số quyết định:** 1.261 tham chiếu runtime trong `src` → **372 kernel (buộc giữ) · 13 self-import (cấm đổi) · 7 không có bản GBH · 869 đổi được** (80 tên, 136 gói).
4. **Câu (2) ĐÚNG:** có **33 gói "vỏ lib-only"** = 0 tệp `.ts`, chỉ có `lib/` (tổng 339,8 KB). Trong đó **14 gói là bản chép NGUYÊN VĂN stock** (`.debundled`), **12 là vỏ bundle chỉ có `cordis.patch.yml`**, 7 gói khác.
5. **Ba rủi ro thật, đo được:** (a) `tools/debundle-host.ts` chạy `rmSync(lib)` + `cpSync(stockLib, lib)` ⇒ **mọi sửa tay trong `lib/` của 14 gói đó bị xoá**; (b) sửa `src` **không tới app** nếu gói là symlink trong profile; (c) đổi id không loại trừ chính gói ⇒ **self-import, ESM chết** (đã có sự cố 17 entry).

---

## 1. Câu (1) — chỗ nào thay được bằng bản GBH?

### 1.1 Số liệu quét `packages/**` (không tính `node_modules`)

| Chỉ số | Số |
|---|---|
| Lần xuất hiện chuỗi `@deepseek-ai/` | **10.248** trong **2.020** tệp |
| Tên gói phân biệt | **362** |
| Khai báo trong `package.json` (dependencies / devDependencies / peerDependencies) | **2.225** khai báo · **256** tên · 321 / 735 / 1.169 |
| Import runtime thật (`.ts/.tsx/.js/.mjs`, trừ dòng comment) | **1.261** chỗ trong **506** tệp · **88** tên |
| Chỉ nằm trong comment của mã | 1.156 |
| Chỉ nằm trong tài liệu (`.md/.txt/.lock`) | 2.146 |
| Trong `.yml` (patch bundle / profile) | 246 |
| Chỉ nhắc trong comment-docs, không dùng | **102** tên |

### 1.2 Phân loại 1.261 tham chiếu runtime — con số trả lời trực tiếp câu hỏi

| Nhóm | Số chỗ | Tên | Kết luận |
|---|---|---|---|
| **Kernel** (`cordis`, `schemastery`, `cosmokit`) | **372** (29,5 %) | 3 | ❌ **KHÔNG BAO GIỜ đổi** — ADR-0030 |
| **Self-import** (gói tự gọi tên stock của chính nó) | **13** (1,0 %) | 7 | ❌ **CẤM đổi** — tạo vòng ESM |
| **Không có bản GBH** | **7** (0,6 %) | 20 (đa số là rác/văn xuôi) | ❌ giữ stock |
| **ĐỔI ĐƯỢC** (khác gói, có bản GBH) | **869** (68,9 %) | **80** | ✅ 136 gói |
| ├ trong đó **đã có tiền lệ** (đã có `.ts` import đúng tên GBH đó) | 514 | 24 | ✅ rủi ro thấp |
| └ **chưa có tiền lệ** | 355 | 56 | ⚠️ cần đo typecheck từng đợt |

> "Đổi được" ở đây nghĩa là **về mặt phân giải gói**. Việc đổi có *thực sự vô hại* hay không còn phụ thuộc mặt kiểu — xem §1.5.

### 1.3 Bảng 1a — nhóm PHẢI giữ stock (kernel)

| `@deepseek-ai/X` | bản GBH | tham chiếu runtime | package.json d/dev/peer | đổi được? | lý do |
|---|---|---|---|---|---|
| `@deepseek-ai/cordis` | `@galaxy-blackhole/gbh-cordis`<br>`packages/host/cordis` | 238 chỗ / 238 tệp | 1/163/271 | **KHÔNG BAO GIỜ** | ADR-0030 + `KERNEL` trong denta-profile: chỉ một thể hiện kernel. Gói GBH là bản chép NGUYÊN VĂN, không phải bản thay thế |
| `@deepseek-ai/schemastery` | `@galaxy-blackhole/gbh-schemastery`<br>`packages/host/schemastery` | 132 chỗ / 132 tệp | 51/78/78 | **KHÔNG BAO GIỜ** | ADR-0030 + `KERNEL` trong denta-profile: chỉ một thể hiện kernel. Gói GBH là bản chép NGUYÊN VĂN, không phải bản thay thế |
| `@deepseek-ai/cosmokit` | `@galaxy-blackhole/gbh-cosmokit`<br>`packages/host/cosmokit` | 2 chỗ / 2 tệp | 5/3/1 | **KHÔNG BAO GIỜ** | ADR-0030 + `KERNEL` trong denta-profile: chỉ một thể hiện kernel. Gói GBH là bản chép NGUYÊN VĂN, không phải bản thay thế |

Vì sao `packages/host/cordis` gọi `@deepseek-ai/cosmokit` dù có `@galaxy-blackhole/gbh-cosmokit`: **cố ý**. `gbh-cordis`/`gbh-cosmokit`/`gbh-schemastery` là **bản chép nguyên văn** (đã băm: `lib/index.js` **byte-identical** với stock) và **không ai import chúng lúc chạy** — chỉ `tests/setup/kernel-alias.ts` và `tools/lint/gate.ts` trỏ chúng về stock. Ba id này nằm trong danh sách `KERNEL` của denta-profile (dòng 34) nên **kể cả bản cài cũng giữ id stock**.

### 1.4 Bảng 1b — 20 tên ĐỔI ĐƯỢC nhiều nhất

| `@deepseek-ai/X` | bản GBH (đường dẫn) | tham chiếu runtime | d/dev/peer | có tiền lệ? | ghi chú |
|---|---|---|---|---|---|
| `@deepseek-ai/dsh-llm` | `@galaxy-blackhole/gbh-llm`<br>`packages/host/llm` | 157 chỗ / 157 tệp | 0/48/81 | có | port 1:1 · `types` = `src/index.ts` (không có `lib/types`) ⇒ **chưa đo mặt kiểu** · đã có tiền lệ trong src |
| `@deepseek-ai/dsh-typert-protocol` | `@galaxy-blackhole/gbh-typert-protocol`<br>`packages/host/typert-protocol` | 73 chỗ / 73 tệp | 2/28/30 | có | bản port 1:1, `.d.ts` **byte-identical** với stock (đã đo) · đã có tiền lệ trong src |
| `@deepseek-ai/dsh-session` | `@galaxy-blackhole/gbh-session`<br>`packages/host/session` | 61 chỗ / 61 tệp | 0/38/64 | có | port 1:1 · `types` = `src/index.ts` ⇒ **chưa đo mặt kiểu** · đã có tiền lệ trong src |
| `@deepseek-ai/dsh-util-values` | `@galaxy-blackhole/gbh-util-values`<br>`packages/host/util-values` | 51 chỗ / 51 tệp | 14/17/20 | có | bản port 1:1, `.d.ts` **byte-identical** với stock (đã đo) · đã có tiền lệ trong src |
| `@deepseek-ai/dsh-timeout` | `@galaxy-blackhole/gbh-timeout`<br>`packages/host/timeout` | 38 chỗ / 38 tệp | 2/19/29 | **chưa** | bản port 1:1, `.d.ts` **byte-identical** với stock (đã đo) |
| `@deepseek-ai/dsh-scope` | `@galaxy-blackhole/gbh-scope`<br>`packages/host/scope` | 37 chỗ / 37 tệp | 0/13/21 | **chưa** | bản port 1:1, `.d.ts` **byte-identical** với stock (đã đo) |
| `@deepseek-ai/dsh-agent` | `@galaxy-blackhole/gbh-agent`<br>`packages/host/agent` | 33 chỗ / 33 tệp | 0/29/48 | có | ⚠️ **bộ export KHÁC stock** — so lại trước khi đổi · đã có tiền lệ trong src |
| `@deepseek-ai/dsh-brand` | `@galaxy-blackhole/gbh-brand`<br>`packages/host/brand` | 34 chỗ / 34 tệp | 11/24/24 | có | bản port 1:1, `.d.ts` **byte-identical** với stock (đã đo) · đã có tiền lệ trong src |
| `@deepseek-ai/dsh-attachment` | `@galaxy-blackhole/gbh-attachment`<br>`packages/host/attachment` | 33 chỗ / 33 tệp | 0/6/12 | **chưa** | bản port 1:1, `.d.ts` **byte-identical** với stock (đã đo) |
| `@deepseek-ai/dsh-sandbox` | `@galaxy-blackhole/gbh-sandbox`<br>`packages/host/sandbox` | 32 chỗ / 32 tệp | 0/7/20 | có | ⚠️ **bộ export KHÁC stock** — so lại trước khi đổi · đã có tiền lệ trong src |
| `@deepseek-ai/dsh-app-boot` | `@galaxy-blackhole/gbh-app-boot`<br>`packages/host/app-boot` | 22 chỗ / 22 tệp | 3/6/7 | **chưa** | bản port 1:1, `.d.ts` **byte-identical** với stock (đã đo) |
| `@deepseek-ai/dsh-tools` | `@galaxy-blackhole/gbh-host-tools`<br>`packages/host/tools` | 21 chỗ / 21 tệp | 0/19/46 | **chưa** | bản port 1:1, `.d.ts` **byte-identical** với stock (đã đo) |
| `@deepseek-ai/dsh-fs` | `@galaxy-blackhole/gbh-fs`<br>`packages/host/fs` | 16 chỗ / 16 tệp | 0/10/17 | có | bản port 1:1, `.d.ts` **byte-identical** với stock (đã đo) · đã có tiền lệ trong src |
| `@deepseek-ai/dsh-credentials` | `@galaxy-blackhole/gbh-credentials`<br>`packages/host/credentials` | 15 chỗ / 15 tệp | 0/7/14 | **chưa** | bản port 1:1, `.d.ts` **byte-identical** với stock (đã đo) |
| `@deepseek-ai/dsh-subprocess` | `@galaxy-blackhole/gbh-subprocess`<br>`packages/host/subprocess` | 14 chỗ / 14 tệp | 1/9/16 | **chưa** | bản port 1:1, `.d.ts` **byte-identical** với stock (đã đo) |
| `@deepseek-ai/cordis-plugin-loader` | `@galaxy-blackhole/gbh-cordis-plugin-loader`<br>`packages/host/cordis-plugin-loader` | 12 chỗ / 12 tệp | 1/14/21 | **chưa** | bản port 1:1, `.d.ts` **byte-identical** với stock (đã đo) |
| `@deepseek-ai/dsh-jobs` | `@galaxy-blackhole/gbh-jobs`<br>`packages/host/jobs` | 12 chỗ / 12 tệp | 0/2/7 | có | bản port 1:1, `.d.ts` **byte-identical** với stock (đã đo) · đã có tiền lệ trong src |
| `@deepseek-ai/dsh-session-query` | `@galaxy-blackhole/gbh-session-query`<br>`packages/host/session-query` | 11 chỗ / 11 tệp | 0/5/7 | **chưa** | port 1:1 nhưng **chưa đo mặt kiểu** |
| `@deepseek-ai/dsh-launch-environment` | `@galaxy-blackhole/gbh-launch-environment`<br>`packages/host/launch-environment` | 9 chỗ / 9 tệp | 2/8/14 | **chưa** | bản port 1:1, `.d.ts` **byte-identical** với stock (đã đo) |
| `@deepseek-ai/dsh-llm-deepseek` | `@galaxy-blackhole/gbh-llm-deepseek-adapter`<br>`packages/host/llm-deepseek-adapter` | 9 chỗ / 9 tệp | 0/2/3 | **chưa** | port 1:1 nhưng **chưa đo mặt kiểu**; tên gói đã đổi (`-adapter`) nên API cần soát |

### 1.5 Mặt kiểu: đo trực tiếp 21 gói — 83/97 tệp `.d.ts` **byte-identical**

So từng tệp `.d.ts` của bản GBH với bản stock trong profile:

- **18/21 gói trùng khít 100 %** (ví dụ `gbh-typert-protocol` 8/8, `gbh-app-boot` 23/23, `gbh-host-tools` 13/13, `gbh-util-values` 2/2, `gbh-brand` 1/1).
- **3 gói KHÁC bộ export** — *chưa* kết luận là khác API, nhưng **phải soát trước khi đổi**:

| gói | export của ta | export của stock | lệch |
|---|---|---|---|
| `gbh-agent` | 53 | 37 | stock có `AgentRegistry`, `AgentSubjectEvent`, `InboxWireState`, `TurnBoundaryProjection` mà ta **không thấy** |
| `gbh-sandbox` | 33 | 26 | stock có `SandboxMode`, `EscalationRequest`, `EscalationOutcome`… |
| `gbh-system-prompt` | 35 | 18 | ta tách `layer/order/render/types`, stock gộp 1 tệp |

(Đếm thô bằng regex `export`; `export *` không nhìn xuyên được ⇒ đây là **tín hiệu**, không phải kết luận.)

### 1.6 Điểm mấu chốt: repo đang có **HAI VŨ TRỤ PHÂN GIẢI**, không phải một

| | Trong repo (`src`, typecheck) | Trong bản CÀI (runtime) |
|---|---|---|
| `@deepseek-ai/*` | trỏ `apps/host/node_modules/@deepseek-ai/*` (`tools/lint/gate.ts:172`) | 304 gói stock có thật trong profile |
| `@galaxy-blackhole/*` | link workspace → `types` của chính gói | 335 mục: **217 thư mục chép** + **118 symlink** |

Hệ quả đo được trên profile:

| Nhóm | Số tham chiếu stock còn lại | Bản chất |
|---|---|---|
| A. kernel | **1.221** | cố ý (ADR-0030) |
| B. self-reference trong chính gói | **734** | cố ý (`bangCuaGoi` bỏ cặp có đích là chính gói) |
| C. **gói SYMLINK** | **1.456** | ⚠️ denta bỏ qua hẳn ⇒ **chạy bằng id stock** |
| D1. có bản GBH trong repo nhưng **không có trong profile** | **175** | phải giữ |
| D2. không có bản GBH | **37** | phải giữ |
| E. **đích CÓ trong profile mà chưa đổi** | **181** | ⚠️ lỗ hổng thật |
| **Tổng** | **3.804** | (riêng 217 thư mục chép: 1.626) |

⇒ **Kết luận cho câu (1):** thay import trong `src` **không** làm bản chạy khác đi (vì denta đã đổi sẵn 217 gói), và **không** sửa được nhóm C (symlink) — muốn sửa nhóm C phải đổi **trong `src` của chính gói**, vì artefact đó chính là `lib/` trong repo.

---

## 2. Câu (2) — nhóm "vỏ lib-only": ĐÚNG, và đây là bảng đầy đủ

### 2.1 Trả lời ngắn

**ĐÚNG.** Có **33/334 gói** (9,9 %) **không có một tệp `.ts` nào** và chỉ có `lib/`:

- **14 gói "DEBUNDLED"** — có tệp đánh dấu `.debundled`, nội dung ghi *"Bản sao NGUYÊN VĂN từ `apps/host/node_modules/@deepseek-ai/<x>` (`lib/`)"*. Trong đó có đúng nhóm bạn nghi: `cordis`, `cosmokit`, `cordis-plugin-loader`, `cordis-plugin-include`, `cordis-plugin-timer`.
- **12 gói "BUNDLE-SHELL"** — `lib/index.js` chỉ **11 byte** (rỗng), toàn bộ giá trị nằm trong `cordis.patch.yml`.
- **7 gói khác** — vỏ bundle có code thật (`bundle-auto-review` 23 KB, `bundle-tool-worktree`, `bundle-sdk-app`, `bundle-acp-app`, `gbh-tool-call-timeout-policy`, `gbh-experimental-session-inspector`, `gbh-bundle`).

Ngoại lệ: `schemastery` **không** có `lib/index.js` mà có `lib/index.cjs` + `lib/index.mjs`; `cordis-plugin-group` **có** `src/sync.ts` (không thuộc nhóm này).

### 2.2 Bảng 2 — 33 gói vỏ lib-only

| đường dẫn | `lib/index.js` | nhóm | `.debundled` | `gbh.provenance.stock` |
|---|---|---|---|---|
| `packages/host/bundle-agent-team-profile` | 0 KB (11 B) | BUNDLE-SHELL | — | `@deepseek-ai/dsh-experimental-agent-team-profile` |
| `packages/host/bundle-badge-skill-bundle` | 0 KB (11 B) | BUNDLE-SHELL | — | `@deepseek-ai/dsh-experimental-badge-skill-bundle` |
| `packages/host/bundle-base` | 0 KB (11 B) | BUNDLE-SHELL | — | `@deepseek-ai/dsh-base` |
| `packages/host/bundle-cot-translation-bundle` | 0 KB (11 B) | BUNDLE-SHELL | — | `@deepseek-ai/dsh-experimental-cot-translation-bundle` |
| `packages/host/bundle-inspector-profile` | 0 KB (11 B) | BUNDLE-SHELL | — | `@deepseek-ai/dsh-experimental-inspector-profile` |
| `packages/host/bundle-plugin-market-bundle` | 0 KB (11 B) | BUNDLE-SHELL | — | `@deepseek-ai/dsh-experimental-plugin-market-bundle` |
| `packages/host/bundle-ralph-bundle` | 0 KB (11 B) | BUNDLE-SHELL | — | `@deepseek-ai/dsh-experimental-ralph-bundle` |
| `packages/host/bundle-sdk-minimal` | 0 KB (11 B) | BUNDLE-SHELL | — | `@deepseek-ai/dsh-sdk-minimal` |
| `packages/host/bundle-session-search` | 0 KB (11 B) | BUNDLE-SHELL | — | `@deepseek-ai/dsh-experimental-session-search` |
| `packages/host/bundle-session-titles-bundle` | 0 KB (11 B) | BUNDLE-SHELL | — | `@deepseek-ai/dsh-experimental-session-titles-bundle` |
| `packages/host/bundle-terminal-bundle` | 0 KB (11 B) | BUNDLE-SHELL | — | `@deepseek-ai/dsh-experimental-terminal-bundle` |
| `packages/host/bundle-voice-input-bundle` | 0 KB (11 B) | BUNDLE-SHELL | — | `@deepseek-ai/dsh-experimental-voice-input-bundle` |
| `packages/host/libreoffice-kit` | 83 KB | DEBUNDLED | có | `@deepseek-ai/libreoffice-kit` |
| `packages/host/cordis` | 59 KB | DEBUNDLED | có | `@deepseek-ai/cordis` |
| `packages/host/translator` | 36 KB | DEBUNDLED | có | `@deepseek-ai/dsh-experimental-translator` |
| `packages/host/cordis-plugin-loader` | 24 KB | DEBUNDLED | có | `@deepseek-ai/cordis-plugin-loader` |
| `packages/host/sandbox-local` | 22 KB | DEBUNDLED | có | `@deepseek-ai/dsh-sandbox-local` |
| `packages/host/cosmokit` | 17 KB | DEBUNDLED | có | `@deepseek-ai/cosmokit` |
| `packages/host/permission-presets` | 16 KB | DEBUNDLED | có | `@deepseek-ai/dsh-permission-presets` |
| `packages/host/experimental-worktree` | 13 KB | DEBUNDLED | có | `@deepseek-ai/dsh-experimental-worktree` |
| `packages/host/cordis-plugin-include` | 8 KB | DEBUNDLED | có | `@deepseek-ai/cordis-plugin-include` |
| `packages/host/user-approval` | 8 KB | DEBUNDLED | có | `@deepseek-ai/dsh-user-approval` |
| `packages/host/web-app` | 8 KB | DEBUNDLED | có | `@deepseek-ai/dsh-web-app` |
| `packages/host/node-addon-system` | 5 KB | DEBUNDLED | có | `@deepseek-ai/node-addon-system` |
| `packages/host/cordis-plugin-timer` | 4 KB | DEBUNDLED | có | `@deepseek-ai/cordis-plugin-timer` |
| `packages/host/product-telemetry-otel` | 4 KB | DEBUNDLED | có | `@deepseek-ai/dsh-host-product-telemetry-otel` |
| `packages/host/bundle-auto-review` | 23 KB | KHÁC | — | `@deepseek-ai/dsh-experimental-auto-review` |
| `packages/host/gbh-tool-call-timeout-policy` | 5 KB | KHÁC | — | `@deepseek-ai/dsh-tool-call-timeout-policy` |
| `packages/host/bundle-tool-worktree` | 2 KB | KHÁC | — | `@deepseek-ai/dsh-experimental-tool-worktree` |
| `packages/host/bundle-sdk-app` | 2 KB | KHÁC | — | `@deepseek-ai/dsh-sdk-app` |
| `packages/host/bundle-acp-app` | 1 KB | KHÁC | — | `@deepseek-ai/dsh-acp-app` |
| `packages/host/bundle` | 0 KB (233 B) | KHÁC | — | — |
| `packages/host/gbh-experimental-session-inspector` | 0 KB (226 B) | KHÁC | — | `@deepseek-ai/dsh-experimental-session-inspector` |

Tổng dung lượng `lib/index.js`: **339,8 KB** · **32/33** có `gbh.provenance.stock` (chỉ `packages/host/bundle` không có — nó là "BUNDLE-NATIVE", 17 tệp patch của 13 bundle stock).

### 2.3 Cơ chế nạp hiện tại — 4 tầng, không phải "alias" đơn thuần

1. **`cordis.patch.yml`** (12 vỏ bundle): bundle không phải mã, nó là **patch chèn row** vào profile. Loader đọc patch, không `import` gói. Ví dụ `packages/host/bundle-base/cordis.patch.yml` dài **529 dòng**, chứa 77 cặp `stock → ours`.
2. **`.debundled` + `tools/debundle-guard.ts`**: `copyIfDebundled()` **chép nguyên cây `lib/`** sang thư mục đích, **KHÔNG build lại từ `src`** (vì `src` viết tay mỏng hơn bản gốc). Đây là lý do 14 gói này *không cần* `src`.
3. **`tools/p1b/denta-profile.ts`** (đổi id ở **bản CÀI**): dựng bảng từ `gbh.provenance.stock`, bỏ 3 id kernel, bỏ cặp có đích là chính gói, rồi regex trên `.js/.mjs/.cjs/.json` của profile. **Chỉ đổi khi thư mục đích có trong profile** (`coTrongProfile`). Có stamp `lib/.gbh-rewrite-stamp` để bỏ qua lượt sau.
4. **`scripts/sync-lib-to-profile.sh`**: chép `lib/ assets/ locale/ presets/ types/ *.patch.yml` vào profile theo **`name` trong package.json** (không suy từ tên thư mục — vd `packages/host/settings-controller` có tên `gbh-api-settings-controller`), rồi gọi denta lặp tới hội tụ.

**Không có "alias" nào trong profile.** Profile là **bản chép thật** (không symlink toàn cục): `~/.galaxy/blackhole/profiles/node_modules/@galaxy-blackhole/` = 217 thư mục + 118 symlink.

### 2.4 Rủi ro: sửa gì trong chúng thì MẤT

| Đối tượng | Sửa tay vào `lib/` thì sao? | Bằng chứng |
|---|---|---|
| **14 gói `.debundled`** | ❌ **MẤT** — `tools/debundle-host.ts:45-46` chạy `rmSync(lib, {recursive:true})` rồi `cpSync(stockLib, lib)`. Lượt debundle sau xoá sạch. | đọc mã |
| **12 vỏ bundle** | ✅ Sửa `cordis.patch.yml` là **đúng chỗ** (đó là nguồn thật). Sửa `lib/index.js` (11 B) là vô nghĩa. | `tools/gen-bundle-patches.ts` sinh lại patch |
| **Mọi gói có `src/`** | ⚠️ Sửa `lib/` cũng **MẤT** — `lib/` là artefact của Bun bundler từ `src` (`.gbh-build-stamp`). Phải sửa `src`. | `lib/.gbh-build-stamp` |
| **118 gói symlink trong profile** | ⚠️ Sửa `src` **KHÔNG tới app** cho tới khi rebuild + sync; và denta **không bao giờ** đổi id cho chúng. | `lstatSync().isDirectory()` |

Ngoài ra: **1 symlink gãy** — `gbh-client-connection` trỏ vào `/Applications/Galaxy Blackhole (Preview).app/...` (không còn tồn tại). 117 symlink còn lại trỏ qua `blackhole-tauri` — **đó là symlink → `blackhole-harness`** (tạo 11/11), nên nội dung vẫn đúng repo hiện tại.

---

## 3. Lộ trình đề xuất (chưa thực thi)

### Nhóm A — làm được NGAY, rủi ro thấp (không đổi hành vi)

| # | Việc | Cách làm | Vì sao an toàn |
|---|---|---|---|
| A1 | **Bù `gbh.provenance.stock` cho 4 gói đang thiếu** | thêm field vào `packages/client/ui-primitives`, `ui-goal`, `ui-approval`, `ui-settings-subagent`, `packages/host/tool-working-directory` | Không sửa mã. Hiện denta **không đổi id** cho chúng ⇒ bản cài luôn nạp bản stock dù ta đã có bản GBH |
| A2 | **Sửa `denta` để xử lý gói symlink** (hoặc chặn có cảnh báo) | `suaIdProfile`: nếu `lstat` là symlink thì `statSync` để biết là thư mục | 1.456 tham chiếu stock đang chạy ngoài cơ chế đổi id ở 118 gói |
| A3 | **Dọn 1 symlink gãy** `gbh-client-connection` | trỏ lại repo hoặc chép thật | tránh lỗi nạp khó truy |
| A4 | **Đổi import ở 24 tên ĐÃ CÓ TIỀN LỆ** (514 chỗ) | sửa `from '@deepseek-ai/x'` → `from '@galaxy-blackhole/gbh-x'` **và** đổi `package.json`; **loại trừ** cặp có đích là chính gói | tiền lệ đã chạy (221 tệp `.ts` đang import GBH), `.d.ts` byte-identical |

> **Lưu ý quan trọng về A4:** đổi import trong `src` **không** làm bản chạy khác đi (denta đã đổi sẵn) — lợi ích thật là **bỏ phụ thuộc vào bước đổi id** và làm `package.json` nói đúng sự thật. Nếu chỉ muốn "bản chạy không còn id stock" thì **A1 + A2 rẻ hơn nhiều**.

### Nhóm B — cần port nguồn TS trước, KHÔNG đổi bây giờ

| # | Việc | Vì sao chưa |
|---|---|---|
| B1 | 56 tên **chưa có tiền lệ** (355 chỗ) | chưa từng có `.ts` nào import tên GBH đó ⇒ chưa chứng minh mặt kiểu |
| B2 | `gbh-agent`, `gbh-sandbox`, `gbh-system-prompt` | **bộ export khác stock** (§1.5) — đổi là đổi API |
| B3 | 14 gói `.debundled` muốn sửa được | phải **port `src` TS** rồi bỏ `.debundled`, nếu không `debundle-host.ts` xoá sạch |
| B4 | `dsh-agent-loop-testkit`, `dsh-client-ui-slots`, `dsh-client-ui-dockkit`, `dsh-subagent-claude-code`, `dsh-subagent-codex`, `dsh-root`, `dsh-typert-generator` | **không có bản GBH** — phải viết mới hoặc chấp nhận stock |

### Nhóm C — PHẢI giữ stock (đừng đụng)

| # | Đối tượng | Lý do |
|---|---|---|
| C1 | `cordis`, `schemastery`, `cosmokit` — **372 chỗ** | ADR-0030 "một thể hiện kernel"; `KERNEL` trong denta; `paths` trong `gate.ts:175-177`. Đổi ⇒ 27+ vi phạm kiểu, và 2 thể hiện kernel lúc chạy |
| C2 | 13 self-import | `bangCuaGoi` bỏ cặp này; đổi ⇒ *"Detected cycle while resolving name"* |
| C3 | 7 tên không có bản GBH | không có đích |
| C4 | `libreoffice-kit-win32-*`, `-wasm`, `-darwin-arm64` | gói nền tảng, chỉ có `darwin-x64` |

### Thứ tự đề xuất

1. **A1** (1 buổi, chỉ sửa JSON) → đo lại: số ref nhóm D2/E giảm.
2. **A2 + A3** (1 buổi) → đo lại 3.804 → kỳ vọng giảm ~1.456.
3. **A4 theo từng đợt 1 gói**, sau mỗi đợt chạy `bun run gate` + `bun run check:app` (11 chỉ số). **Dừng ngay** nếu (8) tụt hoặc (5) khác 0.
4. **B1/B2** chỉ sau khi có test e2e mount cho module table.

---

## 4. Phụ lục — cách đo & giới hạn

- **graphify:** KHÔNG có binary (`which graphify` rỗng). `graphify-out/graph.json` có tồn tại ở workspace root nhưng **không có wiki/index.md** và CLI không có ⇒ dùng grep. Theo AGENTS.md, đây là trường hợp được phép thay bằng grep.
- **Đếm runtime** = dòng có `from '…'` / `import('…')` / `require('…')` / `import '…'` và **không** bắt đầu bằng `//`, `*`, `/*`.
- **"Có bản GBH"** = có `package.json` với `name` tương ứng, ánh xạ **ưu tiên `gbh.provenance.stock`** (301 gói), sau đó mới suy theo tên.
- **Đếm export** ở §1.5 là regex thô: `export *` chỉ được đếm 1 lần và không nhìn xuyên ⇒ **tín hiệu**, không phải kết luận API.
- **Rác trong 362 tên:** ~41 "tên" là văn xuôi bị regex bắt (`dsh-llm.`, `dsh-X`, `dsh-...`) — đã loại khỏi bảng.
- Không có thay đổi nào được ghi vào repo, profile, hay `~/.galaxy`.
