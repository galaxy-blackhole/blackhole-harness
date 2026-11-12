<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 24/10/2026
 desc ADR 0018 — vá chữ trên màn hình khởi động: "HARNESS" → "Galaxy Blackhole"
-->

# ADR 0018 — Chữ trên màn hình khởi động ("Loading plugins…")

## Bối cảnh

Màn hình khởi động (boot card) hiện **HARNESS** + "Loading plugins…". Chuỗi này KHÔNG nằm trong plugin nào
của ta — nó nằm trong artefact frontend của DSH:

```
this.wordmark = Yn(Kn.wordmark, "HARNESS")
this.hint     = Yn(Kn.hint, "Loading plugins…")
```

tức trong `dsh-web-frontend/dist/assets/index-<hash>.js` (bundle frontend đã đóng gói sẵn). Vì vậy mọi lần
vá `index.html`/manifest trước đây **không** chạm tới chữ này.

## Quyết định

Thay chuỗi mặc định `,"HARNESS"` → `,"Galaxy Blackhole"` trong **ba bản** của cùng artefact:

| Bản | Đường dẫn |
|---|---|
| Dev host (nguồn để `scripts/sync-frontend-dist.sh` đồng bộ vào profile) | `packages/host/host-frontend-static/dist/assets/index-*.js` |
| App đóng gói | `/Applications/Galaxy Blackhole.app/Contents/Resources/app/host/cli/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-*.js` |
| CLI toàn cục (nvm) | `~/.nvm/versions/node/*/lib/node_modules/@galaxy-stack/blackhole-cli/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-*.js` |

Đo lại sau khi restart: boot card hiện `Galaxy Blackhole` + `Loading plugins…`; asset đang phục vụ có
`0` lần `HARNESS`, `1` lần `,"Galaxy Blackhole"`.

## Hệ quả

- Vá trên **artefact sinh sẵn**, không phải mã nguồn ⇒ **cài lại/cập nhật** `dsh-web-frontend` sẽ **xoá** bản vá;
  quy trình đóng gói phải chạy lại phép thay này (nên đưa vào script build của packaging repo).
- Chuỗi này là **brand** chứ không phải i18n: không dịch, luôn là "Galaxy Blackhole".
