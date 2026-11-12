<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Thong bao ben thu ba: nguon goc, license, va quy tac ghi cong khi dan xuat code
-->

# Third-party notices

Repo này **không** chứa `ai-coder-core` và **không** phụ thuộc nó ở bất kỳ tầng nào
(cổng `tools/lint/dep-guard.ts` chặn trong CI).

## Nguồn tham chiếu & phụ thuộc

| Gói / nguồn | Vai trò | License | Ghi công |
|---|---|---|---|
| `@deepseek-ai/dsh*` (DeepSeek Harness) | Runtime được nhúng ở bước 1; nguồn đối chiếu hành vi cho bước 2 | MIT | Giữ nguyên `LICENSE` của upstream; bản sao tham chiếu ở `vendor/dsh-reference` (không commit nội dung) |
| `@deepseek-ai/cordis`, `cosmokit`, `schemastery` | Meta-framework plugin mà DSH dựng trên đó | MIT | Nêu rõ ở `packages/kernel/README.md` khi bắt đầu M3 |
| `lucide-react` | **Chỉ** cho UI mới của Blackhole (không dùng cho UI parity) | ISC | Ghi trong `package.json` của package dùng nó |
| `tauri` (Rust) | Vỏ desktop | MIT / Apache-2.0 | Theo mặc định của crate |

## Quy tắc khi dẫn xuất code từ DSH

1. Nếu một file của ta **copy hoặc phóng tác trực tiếp** từ file upstream, giữ header gốc của upstream
   phía trên header của ta, và ghi rõ `derived from packages/<nhóm>/<gói>/src/<file>`.
2. Mọi package dẫn xuất phải khai báo trong README của nó: nguồn, mức độ dẫn xuất (copy / viết lại theo hành vi / chỉ tham khảo),
   và đường dẫn test chứng minh parity.
3. Giữ `LICENSE` của upstream trong bản đóng gói (`apps/desktop/` bundle) theo đúng yêu cầu MIT.
