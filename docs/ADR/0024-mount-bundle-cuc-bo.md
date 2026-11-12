<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 25/10/2026
 desc ADR 0024 — mount chép MỌI bundle cục bộ vào profile để bật/tắt được ngay
-->
# ADR 0024 — Bundle cục bộ phải có mặt trong profile trước khi bật

## Bối cảnh

Bật một bundle *chưa từng cài* trong **Plugin → Plugin thử nghiệm** làm host trả:

```json
{ "application": "failed", "error": { "code": "operation-error", "diagnostic": "dsh: cannot resolve profile …" } }
```

Vì `apps/cli/src/mount.ts` chỉ mount các gói có `gbh.row`/`gbh.nested` (row package) và các bundle nằm sẵn trong
`dsh.profile.bundles`; bundle cục bộ của repo (`packages/host/bundle-*`) chưa từng được chép vào
`<profile>/node_modules` ⇒ Loader không resolve được.

## Quyết định

Thêm `mountLocalBundles()` vào cuối `ensureRewriteMounts()`: chép `package.json` + `cordis.patch.yml` của **mọi**
thư mục `packages/host/bundle-*` vào `<profile>/node_modules/<tên gói>` (bỏ qua khi nội dung đã giống).

## Hệ quả

- Profile có 10 bundle cục bộ; bật/tắt bất kỳ mục thử nghiệm nào cũng chạy, không còn lỗi "cannot resolve profile".
- Bundle chỉ gồm 2 tệp khai báo (không có mã chạy) nên chi phí mount không đáng kể.
- Liên quan: [ADR 0023] vá `assets/` + `build.ts` của gói skill; [ADR 0022] nội dung ghi công bằng văn bản.
