<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Bản viết lại Galaxy Blackhole cho plugin tool-ralph (@deepseek-ai/dsh-tool-ralph): 3 lát NGUYÊN VĂN
      de-bundle + cổng byte delta 0; khai gbh.nested kind:'group' preset optional-ralph; KHÔNG gbh.row
-->

# @galaxy-blackhole/gbh-tool-ralph

> Plugin **host-only** tool-ralph: công cụ hướng mô hình ralph — vòng lặp TIỀN CẢNH, mỗi vòng một con
> structured-output TƯƠI, chỉ mang mục tiêu BẤT BIẾN + bản bàn giao có trần. Thân bundle gốc được tái lập
> **NGUYÊN VĂN TỪNG BYTE** bằng pipeline de-bundle (3 lát), có cổng byte chặn build.

## 1. Nguồn đối chiếu

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Package | @deepseek-ai/dsh-tool-ralph @0.2.1-alpha.4 | @galaxy-blackhole/gbh-tool-ralph @0.1.0 (private) |
| Host bundle | lib/index.js · 371 dòng · **17.330 B** · sha256 ad2f2f60… | lib/index.js **byte-identical**, delta 0 |
| Client | KHÔNG có (dsh.client không tồn tại) | — |
| Locale | locale/{en,zh}.json | chép **byte-for-byte** toàn bộ cây locale/ |
| Peer/dep | 7 peer + 1 dependency (schemastery) | **CHÉP JSON stock** + symlink node_modules về kernel |

## 2. Pipeline de-bundle — cổng byte

| Lát | Dòng | Nội dung nguyên văn |
|---|---:|---|
| src/parts/part-00-head.ts | 13 | 2 dòng import đầu bundle |
| src/parts/part-01-index.ts | 379 | region //#region lib/types/index.js … //#endregion |
| src/parts/part-02-tail.ts | 13 | dòng export { Config, apply, inject, name }; + newline cuối |

Mỗi lát = header 5 dòng + // @ts-nocheck + dòng trống + **stock nguyên văn** + dòng trống + export {};.
src/assemble.ts gỡ đúng phần giao kèo (stripSliceScaffold) rồi nối bằng ký tự xuống dòng (assembleBundle).
build.ts là hàm **ĐỒNG BỘ** buildPackage(outDir?: string): string: ghép lát, so **từng byte** với bundle
gốc, chỉ ghi lib/index.js khi assembled === stock; lệch ⇒ ném lỗi kèm bytes / delta / sha / byte lệch đầu.

~~~bash
bun run build.ts    # built …/lib/index.js · 17330 B · delta 0 · sha256 ad2f2f60…
~~~

## 3. Bề mặt plugin (4 export, giữ nguyên tên)

name (tool-ralph) · inject (tools · workflowEngine · subagents · systemPrompt) · Config · apply.

apply đăng ký (1) section system prompt tool:ralph — chính sách **chỉ dùng khi người dùng yêu cầu rõ**,
(2) công cụ ralph qua defineTool với objective (bắt buộc) + maxRounds (tuỳ chọn, bị chặn bởi trần triển
khai). execute kiểm exec.agent, chuẩn hoá objective, đối chiếu trần vòng, bắt buộc provider TƯƠI (có output
schema, KHÔNG thừa kế ngữ cảnh), mở **MỘT** workflow bằng script CỐ ĐỊNH, huỷ theo bước gọi, và luôn
dispose(). Kết quả render theo 4 trạng thái + cắt theo maxResultChars.

## 4. Khai báo gói — gbh.nested, KHÔNG gbh.row

Bản gốc là **CON** của row NHÓM optional-ralph (name: cordis:group, isolate.workflowEngine) do
@deepseek-ai/dsh-experimental-ralph-bundle/cordis.patch.yml chèn, cạnh con optional-ralph-workflow
(dsh-workflow-ptc). Khai gbh.row id optional-ralph sẽ thay **cả NHÓM** ⇒ mất workflowEngine ⇒ ralph chết.
Vì vậy gói khai:

~~~json
"nested": {
  "kind": "group",
  "pluginId": "tool-ralph",
  "stockId": "@deepseek-ai/dsh-tool-ralph",
  "presets": ["optional-ralph"]
}
~~~

Không còn gbh.row / row_unmounted_ly_do. Cấu hình ĐANG CHẠY của row: subagentProvider: spawn,
**maxRounds: 64** (không phải mặc định 256) — test dùng đúng cấu hình này.

## 5. Test đối chứng A/B

tests/host/tool-ralph.test.ts — **20 ca / 252 expect / 0 fail**. A = bundle gốc, B = artefact lib/index.js
của ta; mỗi ca dựng HAI giàn GIỐNG HỆT trên **Context cordis THẬT**, cấp 4 seam GIẢ đọc từ inject
(tools · workflowEngine · subagents · systemPrompt). **Không mạng, không spawn/shell.**

| Nhóm | Nội dung |
|---|---|
| A | Artefact byte-identical (17.330 B, cùng sha256) + tập export runtime |
| B | String(Config) + mặc định + **6 cấu hình** + đối chứng âm schema |
| C | apply đăng ký đúng 1 section (tool:ralph, order 250) + 1 tool (id/description/parameters/schema); config sai ném TRƯỚC đăng ký |
| D | workflowEngine.start nhận cùng script/meta/args/provider/parent/signal; 4 trạng thái kết thúc; lỗi tham số/provider; kết quả hỏng + stopReason bẩn; **abort trước và giữa vòng**; **timeout** (seam result reject); render + cắt |
| E | package.json (exports mirror, bỏ ./src/* + types nguồn), nested group, peers = peer+deps, 8 symlink resolve được, locale **byte-for-byte** |

## 6. Khác biệt có chủ đích so với bản gốc

1. **Thân bundle**: không viết lại — 3 lát nguyên văn + cổng byte, nên hành vi runtime giống hệt.
2. **Đóng gói**: private: true, không phát lib/types ⇒ exports bỏ điều kiện types và subpath ./src/*.
3. **Khai báo mount**: gbh.nested kind:'group' preset optional-ralph thay cho gbh.row bị park.
4. **Peer**: đúng 7 peer + schemastery như stock; bỏ dsh-util-values (bản cũ chỉ mượn kiểu, bundle không import).

## 7. Lệnh

~~~bash
bun run build.ts                          # cổng byte + ghi lib/index.js
bun test tests/host/tool-ralph.test.ts    # 20 ca A/B
bun run check:rows                        # gói không khai gbh.row ⇒ cổng row bỏ qua
~~~
