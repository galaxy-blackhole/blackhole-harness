<!--
  author Bùi Trọng Hiếu
  email kevinbui210191@gmail.com
  create date 15/10/2026
  modify date 12/11/2026
  desc README cua goi npm @galaxy-blackhole/blackhole-harness — ban LEAN, cai la boot duoc
-->

# @galaxy-blackhole/blackhole-harness

Harness của **Galaxy Blackhole**: boot host DSH với profile `blackhole` (bundle patch + gói viết lại của
GBH) và in ra URL `?token=` để vỏ app mở. Gói này là **bản chạy** — KHÔNG kèm mã nguồn, test hay docs:
chỉ artefact cần để boot (`lib/`, `locale/`, `assets/`, `runtime/`, `presets/`, `*.patch.yml`).

## Cài

```bash
npm i -g @galaxy-blackhole/blackhole-harness
bh host --port 5439 --profile blackhole      # hoac: blackhole-harness host ...
```

Không cần `git clone`, không cần giải nén ZIP: kernel (`@deepseek-ai/dsh*`) là dependency của gói nên
npm tự cài kèm (`apps/host/package.json` giữ đúng bộ pin).

## Yêu cầu

- **Node ≥ 26** để BOOT host (launcher từ chối major thấp hơn — xem `MIN_NODE_MAJOR` trong
  `apps/cli/src/paths.ts`). `engines` khai `>=22.6` vì phần launcher chạy được từ Node 22.6 (type
  stripping); muốn boot thì vẫn cần Node 26.
- macOS/Linux. Home của app: `~/.galaxy/blackhole` (đổi bằng `GBH_HOME`), credentials dùng chung
  `~/.galaxy/credentials.yaml`.

## Lệnh

```bash
bh host [--port 5439] [--profile blackhole] [--open] [--auto-port] [--patch <file>]
bh host --dry-run          # in runtime, home, patch, argv mà không boot
bh host --dump-config      # in cây plugin đã ghép (bằng chứng parity)
bh doctor                  # version runtime, profile, credentials, cách ly home
bh migrate [--from ~/.galaxy/gbh] [--to ~/.galaxy/blackhole] [--dry-run]
```


### Chạy trực tiếp (không qua `bh`)

```bash
node node_modules/@galaxy-blackhole/blackhole-harness/apps/cli/lib/main.js host --port 5439 --profile blackhole
```

`apps/cli/lib/main.js` là bản **đã build** (bun build) — chạy được bằng Node thường. `apps/cli/src/*.ts` chỉ là
nguồn đối chiếu: **Node từ chối strip-types cho tệp nằm trong `node_modules`**
(`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), nên đừng chạy `main.ts` từ gói đã cài.

## Biến môi trường

| Biến | Ý nghĩa |
| --- | --- |
| `GBH_HOME` | home của app (mặc định `~/.galaxy/blackhole`) |
| `GBH_CREDENTIALS` | đường dẫn credentials dùng chung |
| `GBH_NODE` | ép binary Node ≥ 26 dùng để boot |
| `GBH_DSH_BIN` | ép entry point kernel (`.../@deepseek-ai/dsh/lib/bin.js`) |
| `GBH_KERNEL_MODULES` | ép thư mục `node_modules` chứa kernel |
| `GBH_REPO_ROOT` | ép gốc gói (mặc định suy từ vị trí tệp) |
| `GBH_PREBUILT_LIB` | `1` = dùng `lib/` có sẵn (mặc định ở bản npm), `0` = build từ `src/` (chỉ có trong repo) |

## Có gì trong gói

- `apps/cli/lib/main.js` — launcher `bh` đã build; `apps/cli/src/*.ts` là nguồn đối chiếu.
- `apps/host/package.json` — bộ pin kernel để `bh doctor` đối chiếu.
- `packages/**` — gói viết lại của GBH, chỉ `package.json` + `lib/` + `locale/` + `assets/` + `runtime/`
  + `presets/` + `*.patch.yml`.
- `profiles/blackhole/*.yml` — template patch (parity, preset-redirect, cordis) + danh sách bundle.
- `tools/p1b/denta-profile.ts` — bước đổi id stock → GBH khi mount.
- `bin/bh.mjs` — shim `bh`, tự bật `--experimental-strip-types` khi Node < 22.18.

## Ghi chú kỹ thuật

- Bản repo cài kernel riêng ở `apps/host/node_modules`; bản npm để kernel ở `<gói>/node_modules`.
  `paths.kernelModulesDir()` dò cả hai, và `mount.ts`/`profile.ts` đọc qua helper đó.
- Không có marker `.gbh-embedded`: bản npm chạy từ thư mục thật, không phải host nhúng trong `.app`.
- Muốn sinh lại gói từ cây repo: `node npm-package/prepare.mjs` (idempotent, in số tệp + dung lượng).

## Giấy phép

MIT — xem `LICENSE`. Thông báo bên thứ ba: `THIRD_PARTY_NOTICES.md`.