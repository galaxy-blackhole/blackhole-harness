/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khai báo module nền tảng do vỏ cấp qua require của factory — repo KHÔNG cài @types/react
 */

// Bốn seed nền tảng mà bundle require lúc chạy: vỏ (bảng module) cấp chúng qua chính require của
// factory. Repo không cài @types/react nên ở đây khai báo ambient để tsc biết tên module; kiểu chi
// tiết không cần vì mọi giá trị đều đi qua một binding any (giữ nguyên dạng mã của bản gốc).
// Theo LUAT 000d-2 (docs/recipes/HOST-ROW-REWRITE.md): ambient KHONG THAN chi duoc phep khi ten
// do KHONG TON TAI O DAU trong repo. Da kiem 18/10/2026 bang:
//   find . -maxdepth 4 -path "*/node_modules/<ten>"   => RONG voi ca 4 ten duoi day
// (khong co @types/react, khong co react/react-dom, 3 goi dsh-client-* chi co trong bang module
//  cua vo luc chay). Neu SAU NAY ai cai that mot trong cac ten nay thi PHAI XOA ambient tuong ung,
// neu khong no se DE kieu that va gay lai dung su co 000d (typecheck 5 -> 53 vi pham).

declare module "react";                 // seed nen tang: khong co tren dia, khong co @types/react
declare module "react/jsx-runtime";       // seed nen tang: di kem react o tren
declare module "@galaxy-blackhole/gbh-client-ui-primitives"; // chi co trong bang module cua vo luc chay
declare module "@galaxy-blackhole/gbh-client-store";        // chi co trong bang module cua vo luc chay
