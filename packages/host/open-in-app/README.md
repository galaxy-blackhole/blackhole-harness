<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README cua @galaxy-blackhole/gbh-host-open-in-app — ban viet lai cua dsh-host-open-in-app (M4b dot 1)
-->

# @galaxy-blackhole/gbh-host-open-in-app

Bản viết lại của Galaxy Blackhole cho row `open-in-app`: ba route trên seam `webServer` của kernel —
danh mục ứng dụng mở được (`/open-in-app/apps`), icon PNG 128px (`/open-in-app/icon/<id>`), và lệnh mở
(`/open-in-app/open`, POST JSON ≤ 64 KiB với `app` + `path`).

## Nguồn đối chiếu (G4)

| Hạng mục | Nguồn |
|---|---|
| Hợp đồng hành vi (route, an ninh, config) | `@deepseek-ai/dsh-host-open-in-app@0.2.1-alpha.4` — `lib/types/index.d.ts` + `resolver.d.ts` + `icons.d.ts` (đọc trong `apps/host/node_modules`, chỉ đọc) |
| Hàng rào tin cậy | seam `connection`: `requestRejection({ headers }): 401 \| 403 \| undefined` |
| Cơ chế mount + vì sao `name` là guard | [ADR 0004](../../../docs/ADR/0004-mount-package-cua-ta-vao-profile.md) |
| Row gốc trong cây | `id: open-in-app` — `docs/PARITY-MATRIX.md` |
| Test hành vi | `tests/host/open-in-app.test.ts` (9 test) |

**Không chép code**: mã nguồn viết lại theo hợp đồng, chỉ dùng `node:` builtins.

## Peer (theo luật seam của repo)

Chỉ khai `peerDependencies` vào các gói thuộc **seam của kernel**: `@deepseek-ai/cordis` và
`@deepseek-ai/schemastery`. Đây là peer — không bao giờ là dependency — để kernel cấp ĐÚNG MỘT instance;
ở M3 kernel của ta phơi cùng tên gói nên import tự nhiên trỏ về kernel của ta. Không có gói DSH nào khác được kéo vào.

## Cơ chế (giống hệt oracle)

- **Catalog**: 5 id theo đúng thứ tự oracle — `finder`, `vscode`, `xcode`, `iterm`, `terminal` — lọc theo
  bundle `.app` tồn tại thật trên máy. Resolve MỘT lần cho cả vòng đời plugin (click, mở menu, reload không dò lại).
- **Icon macOS**: `plutil -convert json -o - <bundle>/Contents/Info.plist` → `CFBundleIconFile` (thiếu đuôi thì tự thêm;
  không có thì lấy `Resources/*.icns` đầu tiên) → `sips -s format png -Z 128 <icns> --out <tmp>/icon.png`. Đúng hai công cụ
  hệ thống và đúng tham số như upstream nên **PNG khớp byte-for-byte**. Hỏng ⇒ 404 (browser vẽ glyph chung).
- **Mở ứng dụng**: `open -a <bundle> <path>` với cửa sổ `launchWatchMs` để bắt lỗi sớm; `path` phải tuyệt đối và
  trỏ tới thư mục tồn tại.
- **An ninh**: mọi route gọi seam `connection` trước — fence Host/Origin + cookie đăng nhập; bị chặn thì trả
  401/403 và KHÔNG trả dữ liệu.
- **Thân phản hồi luôn là BYTE** (bài học ADR 0004 §8): JSON và PNG đều đi qua `Buffer`, có test với `Uint8Array`.

## Bằng chứng parity (17/10/2026, app 5439)

| Route | Trước khi thay row (stock DSH) | Sau khi thay row (bản của ta) |
|---|---|---|
| `GET /open-in-app/apps` (có cookie) | 200 · 55 B · `{"apps":["finder","vscode","xcode","iterm","terminal"]}` | **y hệt** |
| `GET /open-in-app/icon/finder` | 200 · 12.418 B · PNG 128×128 RGBA | **12.418 B · byte-for-byte giống** |
| không cookie | 401 | 401 |

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-host-open-in-app` (shasum `en e6367ab19ad5...` · `zh 1f67717b81a8...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
## Phase C (08/11/2026) — đã sửa 5 lỗi hành vi, chốt phạm vi bề mặt

| # | lỗi | sửa | đối chiếu stock |
|---|---|---|---|
| 1 | `launch()` giữ tiến trình con trong vòng lặp sự kiện; app vừa cài/chuyển chỗ thì mở hỏng vĩnh viễn | `detached: true` + `child.unref()`; gặp `ENOENT` thì `quenCatalog()` rồi **dò lại MỘT lần** | `lib/index.js:363`, `:896`, `:1155` |
| 2 | `catalogOnce()` cache vĩnh viễn | thêm `quenCatalog()` để vô hiệu cache | stock invalidate tương ứng |
| 3 | `inject` khai `subprocess` mà không dùng | dùng thật: tên lệnh trần phân giải qua `ctx.get("subprocess").resolveExecutable` trước khi spawn | `lib/index.js:1227` |
| 4 | `Config` default `1500/5000/1200` lệch `gbh.row.config` | đổi về `10000/10000/1000` | hết hai nguồn sự thật |
| 5 | `darwinCandidates` chỉ `/Applications` | **giữ nguyên — khác biệt CÓ CHỦ ĐÍCH**: catalog của ta là 5 app cố định, không quét registry/XDG | — |

### Vì sao bề mặt export hẹp hơn bản gốc (11 vs 46)
**0 consumer** import `@galaxy-blackhole/gbh-open-in-app` trong toàn repo (đo bằng `grep -rn` trên `packages/`, `apps/cli/src`, `tests/`).
41 tên còn lại của bản gốc là **helper nội bộ** (`parseRegistryDump`, `xdgDataDirectories`, `readWindowsRegistryView`, `EXTRACT_ICON_PS1`…), không phải API công khai của row.
Row hoạt động qua **id** (mount), không qua import ⇒ port thêm 41 tên sẽ là mã chết, không test nào chạm tới.
