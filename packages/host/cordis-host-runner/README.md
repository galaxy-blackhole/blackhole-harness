<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README goi cordis-host-runner (RUNNER TRANSPORT LOI): TRUOC/SAU, KIEM TRUNG SERVICE, TAC DONG KHI MOUNT, bang chung A/B
-->

# `@galaxy-blackhole/gbh-host-cordis-host-runner`

Bản viết lại **1:1** của `@deepseek-ai/dsh-cordis-host-runner` — runner transport của cordis host: định nghĩa/chạy/huỷ
plugin động (`define`/`run`/`stop`/`undefine`), sandbox 2 realm, guard tool/service, inspect registry, và bề mặt typert RPC.

## 1. TRƯỚC → SAU

| hạng mục | TRƯỚC (DSH) | SAU (gói của ta) |
|---|---|---|
| mã nguồn | 6 module `lib/types/*.js` = **2.559 dòng** (index 1.152 · guard 765 · inspect-registry 236 · sandbox 223 · registry 130 · lifecycle 48) + types.js rỗng | **9 tệp TS / 4.057 dòng**: service.ts 909 · guard.ts 814 · service-support.ts 737 · types.ts 527 · inspect-registry.ts 402 · registry.ts 347 · sandbox.ts 243 · lifecycle.ts 59 · index.ts 19 |
| artefact typert | `typert.host.js` 2.968 + `typert.remote-client.js` 1.171 (SINH TỰ ĐỘNG) | **phát ra `lib/` lúc build**, đọc nguyên văn từ kernel — không lưu bản sao trong repo |
| export | `default` + `DynamicCordisRunnerService` + `CordisInspectRegistryService` + 4 brand function mang tên id | **giống hệt** (7 khoá runtime) |
| `String(Config)` | — | **trùng từng ký tự** |
| locale | en/zh | **chép byte-for-byte** |
| test | — | **21 ca / 68 expect · 0 fail** |

## 2. KIỂM TRÙNG SERVICE/EVENT (bắt buộc trước khi port — §4f)

| phép đo | kết quả |
|---|---|
| service gói này đăng ký | **2**: `dynamicCordisRunner` (DynamicCordisRunnerService) + `cordisInspect` (CordisInspectRegistryService) |
| FaceModel typert | **12 method**, tất cả thuộc `dynamicCordisRunner`; class có **12/12 @Remote**, arity khớp; `cordisInspect` có **0 @Remote** (nhất quán) |
| trùng với `typert-gateway` / `api-remotes` / các gói đã mount | **KHÔNG trùng** — `super(ctx,'dynamicCordisRunner')` và `super(ctx,'cordisInspect')` trong `packages/**` = **0 hit** |
| `api-remotes` | chỉ nhúng face 12/12 để route client — **không** đăng ký service; hardcode typeSymbol `@deepseek-ai/dsh-cordis-host-runner/...` |

## 3. ⚠️ TÁC ĐỘNG KHI MOUNT

1. Row stock `cordis-host-runner` **ĐANG BẬT**. Mount gói ta khi row stock còn bật ⇒ **đăng ký trùng CẢ HAI service** ⇒ hỏng cordis động (define/run/cancel plugin) + route typert-gateway. Vì build phát lại face sinh từ kernel, **face giống 12/12** nên mount trùng **không báo lỗi schema** — chỉ lặng lẽ tạo service thứ hai. ⇒ Flip row phải `disabled: true` cho row stock **trong cùng một patch** (khuôn của `mount.ts`).

   ```yaml
   - id: cordis-host-runner
     disabled: true
   - insert:
       - id: cordis-host-runner-ours
         name: '@galaxy-blackhole/gbh-host-cordis-host-runner'
   ```

   Bằng chứng đầy đủ cho reviewer: `docs/reports/task105-cordis-host-runner-evidence.md` (số đo tái lập + sha256 artefact).
2. **Sandbox thực thi code**: `evaluateHostCode`/`createSandbox` chạy code plugin động trong `vm` với prelude 2 realm; sai một nhánh ⇒ plugin động chạy sai hoặc thoát sandbox.
3. **Ghi đĩa/tiến trình**: `startHostHalf`, `guardedPlugin`, `sandboxRegisterTool` tác động vòng đời plugin và tool — lỗi ở đây làm **sập agent loop** (row này nằm dưới agent-loop đã mount).
4. **Inspect RPC**: `cordisInspect` phục vụ panel inspect của client; timeout/abort sai ⇒ client treo chờ.

## 4. Bằng chứng (21 ca, KHÔNG gọi mạng)

- **export**: 7 khoá trùng khít, `default === DynamicCordisRunnerService`; **prototype 43/43** method và `CordisInspectRegistryService` 6/6 trùng khít; `String(Config)` trùng; 4 brand id cho cùng kết quả.
- **guard**: `normalizeHandler` (run/Run/RUN) · `isPlugin` · `pluginName` · `sandboxDefineTool` lỗi schema — cùng kết quả/thông điệp.
- **sandbox**: `precheckCode` (hợp lệ/rỗng/import/export) · `syntaxErrorContext` · `parseErrorMessage` (3 ngữ cảnh × 2 nửa) · `createSandbox` cùng bộ khoá.
- **registry/lifecycle**: `DynamicCordisRegistry` mint id + khoá instance · `missingServices` với `fiber.inject` · `types.ts` 0 export runtime.
- **Context cordis THẬT**: constructor đăng ký đúng `dynamicCordisRunner` + `cordisInspect` (so cùng điều kiện với gốc) · **guard chống trùng**: quét `api-remotes`/`typert-gateway` khẳng định chúng KHÔNG `super(ctx, "dynamicCordisRunner"|"cordisInspect")` · row PARKED đúng quy ước.

## 5. Trạng thái row — **PARKED**

`package.json` KHÔNG khai `gbh.row`; park: `gbh.row_unmounted_ly_do = { ly_do, row: { id: "cordis-host-runner", tests: [...] } }`.
Flip chỉ khi: (1) test A/B xanh ✅, (2) Lead tự chạy `boot-smoke cordis-host-runner` ĐẠT, (3) dòng `packages/README.md` §4,
(4) mount + `check:app` 11/11 **và** thử define/run/stop một plugin động trên profile tạm.

## 6. Nợ kỹ thuật

1. Hai artefact typert là **sinh tự động**: build phát lại bản sinh của kernel; nếu method của ta lệch bản sinh, RPC sai — cần generator sinh từ chính class (nợ chung với `plugin-manager`).
2. Khối `declare module '@deepseek-ai/cordis' { interface Events … }` **không port** (ADR 000d) ⇒ thay bằng interface `CordisDynamicEvents` theo cấu trúc (6 sự kiện giữ nguyên tên/payload).
3. `types.ts` dài 527 dòng (không phải 5) vì từ vựng kiểu nằm ở `types.d.ts` gốc (363 dòng) và 3 module anh em import từ đó; runtime vẫn 0 export.
4. Test A/B **chưa** chạy một lượt define/run/stop plugin động thật trong lab — sẽ làm ở cửa sổ đo của Lead (đây là rủi ro chính của gói).
