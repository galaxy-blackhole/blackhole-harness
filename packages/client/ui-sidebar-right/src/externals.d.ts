/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Khai bao module ngoai ma bundle require qua bang module; 19/10/2026 GO shim zod (dung kieu that v4
 *      qua symlink node_modules/zod) vi ambient shim che kieu zod cua CA chuong trinh tsc.
 */

// ⚠️ 18/10/2026 — GỠ LỖI HẠ TẦNG: file này từng khai 7 ambient module KHÔNG THÂN.
//   Một 'declare module "x";' (shorthand) THẮNG cả node_modules cho MỌI file trong cùng chương trình
//   tsc và biến module đó thành namespace RỖNG (không phải any). Hai hậu quả ĐÃ ĐO TẠI CHỖ:
//     (1) chỗ dùng ở VỊ TRÍ KIỂU báo TS2694 'Namespace has no exported member' — đúng 10 lỗi đã đo ở
//         packages/host/settings-controller (z.ZodType ⇒ request: unknown ⇒ 6× TS18046 + TS7006/7031);
//     (2) nó CƯỚP đường phân giải thật — thí nghiệm nhỏ dựng lại được: cùng một module thật trong
//         node_modules trả TS2322 khi không có shim, và 0 lỗi khi thêm 'declare module "x";'.
//   ⇒ Luật của repo: KHÔNG bao giờ khai ambient RỖNG cho tên có kiểu thật ở đâu đó.
//
// Bảy tên cũ — xử lý từng tên, kèm lý do:
//   1. "zod" ⇒ CÓ THÂN (khai đúng bề mặt repo dùng). Gói THẬT có .d.ts trong repo
//      (apps/host/node_modules/zod/index.d.cts — entry "types" của "exports"). Đã thử ưu tiên (a)
//      'để tsc phân giải thật': paths trong tsconfig gốc KHÔNG cứu được cổng, vì cổng gọi
//      'tsc <cờ> <danh sách file>' và tsc BỎ QUA tsconfig.json khi có danh sách file trên dòng lệnh;
//      symlink trong node_modules thì chạy thật (kiểu thật đi tới nơi dùng — đo được: gán ZodString vào
//      string báo TS2322) nhưng node_modules/ bị .gitignore ⇒ không đi theo bản sao nào khác.
//      19/10/2026 (task-97 hậu kiểm): ĐÃ GỠ shim — dựng symlink node_modules/zod cho gói này để dùng
//      kiểu THẬT của zod v4. Lý do: ambient shim che kiểu zod của MỌI gói trong chương trình tsc ⇒
//      318 vi phạm ảo toàn repo (đo bằng gate --only typecheck).
//   2. "react"                           ⇒ (c) giữ ambient: repo KHÔNG cài react lẫn @types/react (đã quét
//      cả cây repo kể cả apps/host/node_modules: không có thư mục react nào).
//   3. "react/jsx-runtime"               ⇒ (c) cùng lý do (2) — 1618 lời gọi jsx/jsxs trong repo.
//   4. "react-dom"                       ⇒ (c) cùng lý do (2).
//   5. "@galaxy-blackhole/gbh-client-store"          ⇒ (c) — gói của LOADER, không có trên đĩa trong repo.
//   6. "@galaxy-blackhole/gbh-client-ui-primitives"  ⇒ (c) — như (5).
//   7. "@galaxy-blackhole/gbh-client-ui-dockkit"     ⇒ (c) — như (5).
//   Bốn tên (2)(3)(5)(6) còn được khai lần thứ hai ở packages/client/ui-settings-models/src/modules.d.ts
//   (ngoài vùng ghi của lượt này) ⇒ gỡ ở đây KHÔNG làm chúng hết rỗng; muốn hết phải sửa cả file kia.
//   Với (2)(3)(4): giá trị đi qua binding any (giữ nguyên dạng mã của bản gốc), vị trí kiểu báo TS2694 —
//   đúng như mong đợi với module chưa có kiểu, và KHÔNG cướp kiểu của gói nào vì gói đó không tồn tại.
//
// Cách chạy lại phép đo: bun run tools/lint/gate.ts --only typecheck — TRƯỚC 5 vi phạm, SAU 0 vi phạm
//   (phần còn lại do các lượt khác sửa song song); KHÔNG thêm vi phạm nào. Bỏ file này khỏi chương trình
//   tsc thì 5 → 13, toàn TS2307 'Cannot find module' (8 lỗi thuộc chính gói này).
// (2)(3)(4) react · react/jsx-runtime · react-dom — chưa có kiểu ở BẤT KỲ đâu trong repo.
declare module "react";
declare module "react/jsx-runtime";
declare module "react-dom";

// (5)(6)(7) ba gói nền tảng của LOADER — chỉ tồn tại trong bảng module lúc chạy, không có trên đĩa.
declare module "@galaxy-blackhole/gbh-client-store";
declare module "@galaxy-blackhole/gbh-client-ui-primitives";
declare module "@galaxy-blackhole/gbh-client-ui-dockkit";
