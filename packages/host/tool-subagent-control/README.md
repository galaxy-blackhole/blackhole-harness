<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port @deepseek-ai/dsh-tool-subagent-control → gbh-tool-subagent-control: metadata §4f ĐÃ KHAI
      (row_unmounted_ly_do cho row TOP-LEVEL dòng 390 + gbh.nested kind:'preset' cho 3 preset) — CHƯA mount/flip
-->

# @galaxy-blackhole/gbh-tool-subagent-control — row TOP-LEVEL bị tắt + LỒNG 3 preset (CHƯA mount/flip)

Port 1:1 **@deepseek-ai/dsh-tool-subagent-control 0.2.1-alpha.4**: copy NGUYÊN VĂN lib/index.js
(**3.398 B** · sha **3f64ef2d…**) + **2 tệp** lib/types/*.js + **4 tệp** locale. Không sửa một byte artefact nào.

## 1. Vị trí row — ĐO /tmp/dump-now2.txt bằng script bun cắt block theo depth

| kiểu | dòng | depth (thụt lề) | id | khoá dump CÓ | ngữ cảnh đo được |
|---|---|---|---|---|---|
| **TOP-LEVEL** | **390–392** | 0 | tool-subagent-control | id · name · disabled: true | patch bởi @deepseek-ai/dsh-web-app (chú thích dòng 389) |
| TOP-LEVEL (sibling) | 393–395 | 0 | tool-subagent-list-agents | id · name · disabled: true | subpath ./list-agents của CHÍNH gói này phục vụ |
| **LỒNG** | **959** | 10 | tool-subagent-control | id · name | preset-standard (835) → config (2) → plugins (4) → delegation (6) → config (8) |
| **LỒNG** | **1123** | 10 | tool-subagent-control | id · name | preset-ptc (999) → config (2) → plugins (4) → delegation (1117) → config (8) |
| **LỒNG** | **1386** | 10 | tool-subagent-control | id · name | preset-cordis (1266) → config (2) → plugins (4) → delegation (1380) → config (8) |

Đo thêm (cùng script, không đoán):

- group **delegation** (name cordis:group · group: true · isolate.workflowEngine: true · KHÔNG disabled) ở dòng **953 / 1117 / 1380**, thụt lề 6.
- **preset-minimal (dòng 1169)** KHÔNG có group delegation ⇒ gói này KHÔNG có mặt ở preset đó.
- Entry tool-subagent-control **KHÔNG disabled · KHÔNG config · KHÔNG inject** ở cả 3 preset.
- Preset disabled **KHÁC NHAU**: preset-ptc có 2 sibling **disabled: true** (workflow-ptc dòng 1140 · tool-workflow dòng 1145); preset-standard và preset-cordis thì không.

⇒ Cách khai: row TOP-LEVEL bị patch tắt ⇒ **gbh.row_unmounted_ly_do**; entry LỒNG ⇒ **gbh.nested**
kind **'preset'** + presetGroup **'delegation'**; **KHÔNG** khai gbh.row (tránh hai nguồn cấu hình).

## 2. Metadata đã khai (package.json)

    "row_unmounted_ly_do": {
      "ly_do": "PARK 19/10/2026 (đo /tmp/dump-now2.txt …): row TOP-LEVEL 'tool-subagent-control' = dòng 390–392,
                 thụt lề 0, CHỈ id + name + disabled: true (LITERAL, KHÔNG phải !!js) … CHƯA mount/flip …",
      "row": {
        "id": "tool-subagent-control",
        "disabled": true,
        "moduleIds": ["@galaxy-blackhole/gbh-tool-subagent-control"],
        "aliases": ["@deepseek-ai/dsh-tool-subagent-control"],
        "tests": ["tests/host/tool-subagent-control.test.ts"]
      }
    },
    "nested": {
      "kind": "preset",
      "pluginId": "tool-subagent-control",
      "stockId": "@deepseek-ai/dsh-tool-subagent-control",
      "presetGroup": "delegation",
      "presets": ["preset-standard", "preset-ptc", "preset-cordis"],
      "note": "preset-ptc có workflow-ptc + tool-workflow disabled: true; preset-standard/cordis thì không …
               preset-minimal (1169) KHÔNG có group delegation"
    }

Chỉ khoá dump CÓ: row **không** config, **không** inject; disabled là literal **true** (không phải !!js
⇒ không có biểu thức nào để chép vào README). Bản cũ khai nested kind **'group'** + presets **['delegation']**
là SAI theo phép đo (delegation là GROUP chứa entry, còn entry nằm trong 3 PRESET) — đã sửa.

## 3. Vì sao KHÔNG gbh.row và CHƯA mount/flip

- Row TOP-LEVEL đang bị tắt bởi patch (@deepseek-ai/dsh-web-app); khai gbh.row = thay row stock trong khi gói
  mới ở trạng thái park ⇒ hai nguồn cấu hình.
- Bản đang dùng thật là 3 entry LỒNG trong preset; tầng mount **không** thay row lồng (§4d CONVERSION-RUNBOOK).
- **CHƯA mount/flip**: chưa có lab:row + boot-smoke + check:app TRƯỚC/SAU ⇒ giữ park.

## 4. Số đo TRƯỚC → SAU

| Phép đo | TRƯỚC | SAU |
|---|---|---|
| gbh.row_unmounted_ly_do | KHÔNG có (test còn khẳng định phải undefined) | **CÓ**: id · disabled: true · moduleIds · aliases · tests |
| gbh.nested | kind:'group' · presets:['delegation'] (SAI) | **kind:'preset'** · presetGroup:'delegation' · 3 preset · note preset disabled khác nhau |
| artefact byte-parity | 3.398 B + 2 tệp types + 4 locale | **KHÔNG đổi** (vẫn byte-identical) |
| build TỪNG entry | chưa đo | **.** → 2.966 B · **./list-agents** → 4.185 B (bun build · external '*') |
| test A/B | 10 ca / 33 expect | **21 ca / 115 expect / 0 fail** |
| tsc (2 tệp của gói, flags của gate) | chưa đo | **0 lỗi** (exit 0) |
| lint scoped (header · file-length · jsdoc) | — | **0 vi phạm · 0 cảnh báo** |

## 5. Test A/B — chạy THẬT cả hai bản trên CÙNG fixture

- A = bundle stock, B = artefact của ta; cùng một Context giả, cùng fixture (2 con continuable running/inactive,
  1 one-shot, 2 diagnostic, 1 cháu), **không mạng / không audio**.
- 10 ca runtime so: bề mặt tool (tên · mô tả · schema tham số · schema đầu ra · marker
  Symbol.for("dsh.subagent.adjacentAgentSendMessageTool")); send_message (kết quả · vết seam · render ·
  thiếu exec.agent · thiếu tham số); interrupt_agent (accepted · kind 'ancestor' · caller · thiếu agent);
  list_agents (children bỏ one-shot + status · descendants parent/depth · rỗng · scope lạ · thiếu agent).
- **Đối chứng âm**: sửa 1 ký tự mô tả ở bản B ⇒ so sánh bật false (baseline true) — assertion không xanh oan.
- 11 ca còn lại: byte-identical · sha · export surface · locale · provenance · metadata §4f.

## 6. Đồng bộ artefact

bun run src/sync.ts — quét ĐỘNG lib/types/*.js + locale/**, in bytes/delta, đối chiếu gbh.provenance.sha,
**ném nếu lệch 1 byte**.

## 7. Nợ kỹ thuật / CHƯA làm

- **CHƯA mount/flip**: không khai gbh.row; chưa lab:row · chưa boot-smoke · chưa check:app TRƯỚC/SAU.
- Gói **KHÔNG có build.ts**: artefact là bản copy nguyên văn, cổng byte nằm ở src/sync.ts; phép "build từng entry"
  đo bằng bun build ra /tmp (2/2 entry OK).
- Không ship .d.ts / ./src/*; exports chỉ subpath RUNTIME stock có.
- Row top-level vẫn do patch tắt.
- gate TOÀN REPO tại thời điểm đo **ĐỎ**: typecheck 20 vi phạm ở 3 gói experimental KHÁC
  (experimental-api-speech-to-text-harness · experimental-client-ui-voice-input · experimental-speech-to-text),
  cổng test toàn bộ cũng đỏ; **gói này chạy riêng 21/21 xanh** — ngoài phạm vi, không sửa hộ.
