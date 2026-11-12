<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port row session-persistence-jsonl: 10 lát NGUYÊN VĂN byte-identical với bundle gốc (147.273 B), cổng
      byte trong build, test round-trip trên bản ghi THẬT + mkdtemp, A/B đọc/ghi hai chiều với stock
-->

# @galaxy-blackhole/gbh-session-persistence-jsonl — row session-persistence-jsonl

Backend JSONL + zstd cho session của DSH (`lib/index.js` **3.642 dòng**, bundle MỘT khối — gói không ship runtime
`lib/types/*.js`, chỉ `.d.ts` và `worker/`). Port theo **precedent `session-query-sqlite`**: de-bundle thành 10 lát
NGUYÊN VĂN, ghép lại, **CỔNG BYTE** so với bundle gốc (lệch 1 byte là DỪNG).

## 0. Năm câu hỏi bắt buộc (§4f)

1. Row này làm gì? Cấp `ctx.sessionPersistence` — backend lưu phiên dạng JSONL + zstd: `create`/`open` handle, `append`,
   `flush`, `list`, materialize header/event, generation/migration (v3→v4), lease/flock, zstd (koffi + worker_threads).
2. Row nằm ở đâu? TOP-LEVEL `- id: session-persistence-jsonl` (dumps 138–141), **CÓ config** `root: !!js dshHomePath('sessions')`.
3. Hai mặt? KHÔNG — package.json không có `dsh`/client; exports `.` + `./locale/*`.
4. Trùng service? `sessionPersistence` chỉ do base peer `@deepseek-ai/dsh-session-persistence` cấp (kernel stock,
   chưa convert); plugin ta `apply()` dựng đúng MỘT instance subclass ⇒ thay backend, không đăng ký trùng.
5. Khai gbh.row? CHƯA — PARKED (`gbh.row_unmounted_ly_do = { ly_do, row: { id: 'session-persistence-jsonl', tests, config } }`).

## 1. Mười lát NGUYÊN VĂN + cổng byte

| Lát | Nguồn (dòng bundle gốc) | Nội dung |
|---|---|---|
| part-00-head.ts | 1–444 | import + helper zstd/đường dẫn |
| part-01-win32-lease.ts | 445–736 | win32.js + lease.js |
| part-02-format.ts | 737–1137 | format.js |
| part-03-zstd.ts | 1138–1403 | private decoder + public decoder + zstd |
| part-04-migration-verifier.ts | 1404–1551 | migration-verifier.js |
| part-05-generation.ts | 1552–2194 | generation.js |
| part-06-catalog-migration.ts | 2195–2275 | catalog-migration.js |
| part-07-index-head.ts | 2276–2800 | index.js: hằng số + helper + đầu class |
| part-08-persistence-body.ts | 2801–3400 | index.js: thân class JsonlSessionPersistence |
| part-09-plugin-tail.ts | 3401–3642 | index.js: tail class + name/Config/apply |

`build.ts`: ghép 10 lát ⇒ **so TỪNG BYTE** với 
`apps/host/node_modules/@deepseek-ai/dsh-session-persistence-jsonl/lib/index.js` ⇒ ghi `lib/index.js` + chép cây
`lib/types` của bản gốc. **Đo được: 147.273 B · sha256 `2446266c9cf54f20c6504a70031fd6600596637c` · bằng nhau TUYỆT ĐỐI**
(delta 0 byte).

## 2. Test A/B trên BẢN GHI THẬT (theo yêu cầu Lead)

`tests/host/session-persistence-jsonl.test.ts` — 4 ca / 7 expect:
1. bundle ghép **byte-identical** với gốc;
2. **stock GHI** phiên THẬT (giải nén `.jsonl.zstd` từ `~/.galaxy/blackhole/sessions`, CHỈ ĐỌC) vào `mkdtemp` ⇒ **ta ĐỌC** lại: từng event + header khớp tuyệt đối;
3. **ta GHI** cùng dữ liệu vào `mkdtemp` ⇒ **stock ĐỌC** lại: từng event khớp;
4. `list()` A/B trên cùng root: cùng id + cùng header.

## 3. Số đo TRƯỚC → SAU

| Phép đo | TRƯỚC | SAU |
|---|---|---|
| runtime port | 0 | 10 lát (3.751 dòng kể cả scaffold) ⇒ lib/index.js 147.273 B |
| cổng byte | — | **delta 0 B**, sha256 khớp |
| test A/B | 0 ca | **4 ca / 7 expect / 0 fail** (round-trip 2 chiều dữ liệu thật) |
| tsc strict | — | build.ts/assemble.ts/manifest.ts + test **0 lỗi** (lát là `// @ts-nocheck` theo precedent) |
| gate lint | — | header/file-length/jsdoc/dep-guard 0 vi phạm vùng này |

## 4. Nợ kỹ thuật
- 10 lát giữ `// @ts-nocheck` (precedent api-terminal-controller / session-query-sqlite); logic là NGUYÊN VĂN bundle gốc,
  không viết lại ⇒ không có kiểu riêng cho từng hàm.
- Bundle dùng `koffi` (FFI kernel32 cho win32) + `worker_threads` + `p-limit` + `@deepseek-ai/schemastery`; các gói này nằm
  trong `gbh.peers` để mount symlink từ kernel ⇒ profile chạy được mà không cần cài lại.
- Base class `SessionPersistence` vẫn là bản kernel stock (chưa convert) — đúng mẫu peer; nếu sau này convert
  `dsh-session-persistence` thì row này chỉ cần đổi peer.
- Row chưa flip: chờ Lead `boot-smoke session-persistence-jsonl` + dòng `packages/README.md` §4.
