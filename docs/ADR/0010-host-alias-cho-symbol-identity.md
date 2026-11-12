<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc ADR 0010 — Host alias cho symbol/identity: vì sao alias phải áp ở lượt TOÀN CỤC sau khi mount xong,
      kèm 2 phương án đã cân nhắc, bằng chứng đo được và cách kiểm tự động
-->

# ADR 0010 — Host alias cho symbol/identity (task-110)

## Bối cảnh (đo được)

- Nhiều gói của ta thay row mà **20+ gói kernel vẫn `import "@deepseek-ai/dsh-<gói>"`**. Nếu chỉ thay row, kernel nạp
  **bản stock** ⇒ hai bản cùng tên trong một tiến trình. Với symbol/identity, hậu quả không chỉ là "dư bộ nhớ":
  `ours.TOOL_RUNTIME_SCHEDULER !== stock.TOOL_RUNTIME_SCHEDULER` (mỗi bản tạo `Symbol()` riêng) ⇒ mất điều phối
  scheduler/PTC dù mọi thứ "boot được".
- Cơ chế `gbh.row.hostAliases` (symlink `<profile>/node_modules/<tên stock> -> gói của ta`) đã thi công trong
  `apps/cli/src/mount.ts`, log in đúng, app 11/11 — nhưng `readlink` sau đó **vẫn trỏ kernel**.
- **Đo lại mã harness (chỉ đọc) để tìm nguyên nhân thật:**
  - `apps/host/node_modules/@deepseek-ai/*/lib/index.js`: **0 lời gọi `symlinkSync`**. Harness KHÔNG tự tạo symlink
    trong `profiles/node_modules`; nó dùng resolver trong tiến trình (`ProfileRuntimeResolution` trong
    `dsh-app-boot`), với bảng ưu tiên: **installation scope** (kernel) đứng trước profile scope cho tên bị "reserved".
  - Vậy ai ghi kernel vào `profiles/node_modules/@deepseek-ai/dsh-session`? **Chính vòng peer của mount của ta.**
    Mỗi package khai `peers` (gồm `@deepseek-ai/dsh-session`, `dsh-tools`…) và `mountRewritePackage` làm
    `rmSync(link); symlinkSync(kernel/<peer>, link)`. Package mount **sau** ghi đè đường dẫn mà package mount **trước**
    vừa đặt alias ⇒ alias "mất tác dụng mà vẫn báo OK". Đây là lỗi thứ tự, không phải harness.
- Hệ quả thiết kế: alias phải là **lượt cuối**, sau khi MỌI package đã mount (và sau mọi vòng peer).

## Phương án đã cân nhắc

### (A) Đặt alias ở thư mục harness không ghi đè
Ví dụ symlink trong `<profile>/node_modules` (profile đang hoạt động) thay vì `<profiles>/node_modules` (cây chia sẻ),
hoặc dùng `--import` preload đăng ký resolve hook chỉ cho tiến trình harness.
- Ưu: không đụng thứ tự mount; tách khỏi vòng peer.
- Nhược: (1) resolver của harness ưu tiên installation scope cho tên reserved ⇒ phải kiểm từng tên, dễ "xanh giả";
  (2) preload hook là bề mặt mới trong tiến trình harness (rủi ro cao hơn symlink); (3) đường dẫn profile-active
  khác nhau giữa app/lab ⇒ thêm nhánh cấu hình.

### (B) Hook sau bước link — lượt alias TOÀN CỤC ở cuối mount (ĐÃ CHỌN)
`ensureRewriteMounts()` mount từng package (kèm vòng peer như cũ), rồi gọi `applyHostAliases(results)` **một lần**:
với mỗi `result.ok`, đọc `row.hostAliases`, `rmSync + symlinkSync` trỏ về `result.dir` (gói của ta).
- Ưu: đúng bản chất lỗi (thứ tự); idempotent; không thêm bề mặt tiến trình; fail-soft (alias lỗi chỉ cảnh báo);
  cùng một lượt với mount nên không có cửa sổ "boot giữa hai bước".
- Nhược: phải giữ kỷ luật "alias luôn cuối" — đã ghi ngay tại chỗ gọi + test canh.

## Quyết định

Chọn **(B)**. `applyHostAliases` là hàm export của `apps/cli/src/mount.ts`, được gọi ở cuối `ensureRewriteMounts()`
(đường `bh host` và `--dump-config` đều đi qua). Vòng peer trong `mountRewritePackage` giữ nguyên; khối alias cũ
trong từng package đã bị **gỡ** để không ai tạo alias sớm.

## Bằng chứng (đo thật, 19/10/2026)

| Phép đo | Kết quả |
|---|---|
| `--dump-config` | log `[bh] host alias (toan cuc): @deepseek-ai/dsh-session -> @galaxy-blackhole/gbh-session` |
| `readlink ~/.galaxy/blackhole/profiles/node_modules/@deepseek-ai/dsh-session` | `.../node_modules/@galaxy-blackhole/gbh-session` (**của ta**) |
| `createRequire(profile/.../gbh-session-reference/package.json).resolve("@deepseek-ai/dsh-session")` | `.../gbh-session/lib/index.js` (**của ta**) |
| Test `tests/cli/host-alias.test.ts` | 4 ca / 7 expect — alias sau cùng thắng peer-link trước đó; consumer resolve về ta; **symbol identity: `fromAlias.SYMBOL === fromOurs.SYMBOL`**; row không khai hostAliases ⇒ không tạo gì |

## Hệ quả & việc tiếp

- `session` khai `gbh.row.hostAliases: ["@deepseek-ai/dsh-session"]` ⇒ hết nợ "hai bản cùng tên" của ADR trước.
- Gói `tools` sẽ khai `hostAliases: ["@deepseek-ai/dsh-tools"]`; khi đó `TOOL_RUNTIME_SCHEDULER` chỉ còn MỘT bản
  trong tiến trình — nhưng chỉ flip `tools` sau khi Lead boot-smoke lại và `check:app` 11/11.
- Cảnh báo cho reviewer: resolver của harness vẫn ưu tiên installation scope cho tên reserved; bằng chứng ở đây là
  **đường dẫn resolve của Node trong profile** + boot 11/11, không phải suy luận.
