<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Bằng chứng task-105: cordis-host-runner — cổng ownership typert (lỗi boot-smoke 19/10/2026), số đo tái lập được, rủi ro mount
-->

# task-105 · `cordis-host-runner` — bằng chứng cho reviewer

Gói: **`@galaxy-blackhole/gbh-host-cordis-host-runner`** · port 1:1 của `@deepseek-ai/dsh-cordis-host-runner`
· 9 tệp TS / 4.044 dòng · row **PARKED** (`gbh.row_unmounted_ly_do`) · chưa mount.

## 1. Sự cố boot-smoke 19/10/2026 (nguyên nhân + cách vá)

**Triệu chứng** (log Lead):
```
web boot: 1 entry did not activate
[session-controller] control stream failed: RemoteError: typert gateway: session/control: its strict definition was withdrawn
[ui-cordis] reading the Cordis inventory failed: gateway/definition-unavailable: typert gateway: dynamicCordisRunner/inventory
```

**Nguyên nhân**: hai artefact typert được **phát ra `lib/` lúc build** từ kernel nên vẫn khai `package: '@deepseek-ai/dsh-cordis-host-runner'`;
`typert-loader` từ chối manifest **không do gói export nó** ⇒ face không đăng ký ⇒ `definition withdrawn` / `definition-unavailable`.
(Cùng lớp lỗi đã gặp ở `session-reference`.)

**Cách vá** (`packages/host/cordis-host-runner/build.ts`): thêm **CỔNG OWNERSHIP chạy SAU CỔNG BYTE**, đúng khuôn `api-remotes`:
1. đọc artefact sinh **nguyên văn** từ kernel (bằng chứng de-bundle);
2. đếm số lần id stock **từ chính bundle gốc** (không hard-code);
3. đổi `@deepseek-ai/dsh-cordis-host-runner` → **id đọc từ `package.json` của gói** (`@galaxy-blackhole/gbh-host-cordis-host-runner`);
4. còn id stock **hoặc** số lần id ta ≠ kỳ vọng ⇒ **DỪNG build** kèm số đo.

## 2. Số đo tái lập được

| phép đo | lệnh | kết quả |
|---|---|---|
| test A/B | `bun test tests/host/cordis-host-runner.test.ts` | **21 pass · 68 expect · 0 fail** |
| id stock còn trong `lib/` | `grep -o '@deepseek-ai/dsh-cordis-host-runner' packages/host/cordis-host-runner/lib/*.js \| wc -l` | **0** |
| số lần đổi ownership | log `bun run packages/host/cordis-host-runner/build.ts` | `typert.host.js` **64** · `typert.remote-client.js` **63** |
| id ta trong artefact | `grep -o '@galaxy-blackhole/gbh-host-cordis-host-runner' lib/typert.host.js \| wc -l` | **64** (và **63** ở remote-client) |
| tsc | `tsc --noEmit --strict… src/*.ts` | **0 lỗi** (9 tệp · 4.044 dòng) |
| cổng repo | header · file-length · jsdoc · hygiene | **XANH** (2.553 tệp · 0 vi phạm · hygiene 0) |

Bằng chứng byte (sha256):

```
41f8ae239835c606e247c0077894ee69543ec61b0645697f44de4f91a735fa32  lib/typert.host.js          213.189 B  (gốc 212.547 B)
7ca306d39e153c9c00b2823f901d0de4e2ae62997dd415fa5c7cd103c90f263c  lib/typert.remote-client.js  89.167 B  (gốc  88.535 B)
e7a0de86ca397c58cf2c6d67f9c1db0efd27d5d0321bd4e4178f7834eee78203  lib/index.js                 82.658 B
```

Chênh lệch kích thước = do id ta dài hơn id stock × số lần đổi (64/63) — phần còn lại **byte-for-byte**.

## 3. ⚠️ Rủi ro mount (reviewer phải đọc trước khi ký)

1. **Phải tắt row stock TRONG CÙNG PATCH.** Row stock `cordis-host-runner` đang BẬT; gói ta đăng ký **đúng hai service**
   `dynamicCordisRunner` + `cordisInspect`. Mount khi row stock còn bật ⇒ **đăng ký trùng cả hai** ⇒ hỏng cordis động
   (define/run/cancel plugin) + route typert-gateway. Nguy hiểm **âm thầm**: face sinh giống 12/12 nên **không báo lỗi schema**.
   Khuôn patch đúng (như `mount.ts` sinh):
   ```yaml
   - id: cordis-host-runner
     disabled: true
   - insert:
       - id: cordis-host-runner-ours
         name: '@galaxy-blackhole/gbh-host-cordis-host-runner'
   ```
2. **Mắt xích phía client**: `packages/host/api-remotes/lib/client.js` phải quy đổi ownership
   `@deepseek-ai/dsh-cordis-host-runner` → `@galaxy-blackhole/gbh-host-cordis-host-runner` (63 lần trong bundle client).
   Việc này Lead đã giao **tm-evidence**; nếu client còn id stock thì host đúng vẫn `definition-unavailable`.
3. **Rủi ro chức năng**: sandbox `vm` 2 realm + vòng đời plugin động + inspect RPC ⇒ nên thử **define → run → stop**
   một plugin động trên profile tạm trước khi nghiệm thu.
4. `api-remotes` hardcode typeSymbol `@deepseek-ai/dsh-cordis-host-runner/…` ở biên client ⇒ sau quy đổi **hai bên phải cùng một id**.

## 4. Việc cùng lớp đã vá kèm: `plugin-manager`
- thêm cùng cổng ownership (đổi **42** lần) ⇒ `lib/*.js` **0** id stock;
- thêm tự bảo vệ: `protectedModules` = id stock **+** `@galaxy-blackhole/gbh-host-plugin-manager`;
- test: **18 pass · 52 expect · 0 fail** (ca “khớp BYTE” đổi thành “khớp byte SAU quy đổi ownership + id stock = 0”).