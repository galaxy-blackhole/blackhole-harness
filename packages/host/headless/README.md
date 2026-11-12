<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Bản sao 1:1 @deepseek-ai/dsh-headless (bundle patch + mã host one-shot)
-->

# @galaxy-blackhole/gbh-headless

Bản gốc: `@deepseek-ai/dsh-headless` @0.2.1-alpha.4.

## Đã giao (bước 1/2)

- `cordis.patch.yml`: **44 dòng**, thân patch nguyên văn (sha256 `f4d5f53f070089a7fc5209bd47c9ae4e85b99d042cbe76be88ab1ed63dfb8fc8`), chỉ khác 6 dòng header YAML; thay id: **0 lần**; hai chiều đã assert.
- `package.json`: exports khớp stock `.` · **`./startup`** · `./cordis.patch.yml` · `./package.json` · `./src/*`; `dsh.bundle.patch`; `gbh.provenance` đủ (gồm sha gốc + sha thân).

## Chưa giao (bước 2/2)

- Mã host: `lib/index.js` **387** dòng · `lib/json-stream-BA-F3lfb.js` **280** dòng · `lib/startup.js` **93** dòng → port sang `src/{index,json-stream,startup}.ts` + `build.ts` (giữ `./startup` là entry riêng).
- Test A/B `tests/host/headless.test.ts` (export surface · startup argv · json-stream framing).

## Cảnh báo
Gói này chạy ở chế độ one-shot **không mở Host/HTTP/Web**; port sai chỉ lộ khi boot `--profile headless` ⇒ nghiệm thu bằng `boot-smoke`/CLI do Lead cho phép, KHÔNG mount.

## Port 3 tệp (task-161, 20/10/2026) — cổng byte delta 0

| Tệp | Dòng | Bytes | sha256 (đầu) |
|---|---|---|---|
| `lib/index.js` | 387 | 14.646 | `5402e990dd82d33bccee722e220b518e7f26f82acb79ed707bfebc8eb5c3bead` |
| `lib/json-stream-BA-F3lfb.js` (chunk thuần hàm) | 280 | 10.055 | `b6ede8da01119f5caf4b…` |
| `lib/startup.js` (entry phụ `./startup`) | 93 | 4.471 | `66bb82dc445d5852de776401a00c1ad963276c741e39749d187c4c292b86330b` |

`build.ts` ghép 2 entry từ `src/parts/` (mỗi entry có cổng byte riêng, **ném nếu lệch 1 byte**) + copy NGUYÊN VĂN chunk
(index/startup import đúng tên `./json-stream-BA-F3lfb.js`). Test A/B: **9 ca / 0 fail** (3 tệp byte+sha · assemble 2 entry ·
exports mirror stock · argv/help `--session-id`/`--json`/`--help`/`[task...]` · chunk thuần hàm · provenance 3 tệp · patch 44 dòng).
