<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README cua @galaxy-blackhole/gbh-session-query-sqlite — NUA HOST port NGUYEN VAN TUNG BYTE
      (bundle @deepseek-ai/dsh-session-query-sqlite 1.155 dong); MOT MAT nen du dieu kien khai gbh.row
-->

# @galaxy-blackhole/gbh-session-query-sqlite

Bản viết lại Galaxy Blackhole cho @deepseek-ai/dsh-session-query-sqlite (0.2.1-alpha.4) — engine truy vấn phiên
trên SQLite: tạo/khởi tạo schema, tìm kiếm phiên và sự kiện, phân trang, giới hạn kết quả và snippet.

## 1. Đo 4 bước TRƯỚC khi viết (19/10/2026)

| phép đo | kết quả | hệ quả |
|---|---|---|
| gói hai mặt? | **KHÔNG** — chỉ lib/index.js **1.155 dòng**; không có lib/client.js; manifest gốc không dsh.client | một mặt ⇒ đủ điều kiện khai gbh.row |
| row trong dump | '- id: session-query-sqlite' **TOP-LEVEL** (dòng 144) với config `path: ':memory:'`, `openAt: never`; thêm một bản LỒNG 'optional-session-query-sqlite' trong group | thay được row TOP-LEVEL; bản LỒNG cần overlay tầng NHÓM (task riêng) |
| trùng tên | không có 'session-query-sqlite' trong packages của ta | an toàn |
| DB/runtime | bundle dùng **node:sqlite** (builtin). ĐO: **bun 1.3.14 KHÔNG hỗ trợ** ('No such built-in module: node:sqlite'); **app host chạy bằng Node v26.9.0** (ps: .../node .../dsh/lib/bin.js) ⇒ node:sqlite CÓ trong app thật | test phải chạy phần DB qua SPAWN node + DB TẠM |
| bề mặt export | 8 tên: 6 hằng số + SqliteSessionQueryEngine + default | artefact giữ đúng 8 tên |
| vendor | không có khối vendor nhúng (chỉ schemastery) | khai dependency + 5 peer |

## 2. TRƯỚC → SAU

| hạng mục | TRƯỚC | SAU |
|---|---|---|
| gói trong repo | **chưa tồn tại** | packages/host/session-query-sqlite/ (src 4 lát + build + tools) |
| nguồn | chỉ trong bundle stock | **artefact 1.155 dòng · 46.487 BYTE · sha256 dbecf83320e10d93d735b3d01384ab817a0b90102ccecb0a22c013c71dfe70a0 = sha256 bundle gốc** (cmp IDENTICAL; build DỪNG nếu lệch 1 byte) |
| bề mặt kiểu | lib/types/* của stock | lib/types 3 tệp .d.ts chép nguyên (diff -r IDENTICAL) + lib/index.d.ts 2 dòng (có default) |
| test | 0 | **27 ca / 102 expect / 0 fail** (772 dòng) |
| row session-query-sqlite | stock | khai gbh.row (id 'session-query-sqlite', aliases stock, moduleIds = tên gói) SAU khi lab:row + boot-smoke ĐẠT |

## 3. De-bundle: 4 lát NGUYÊN VĂN (0 lát gãy, mọi lát ≤ 706 dòng)

| lát | dòng thân | dòng tệp | nội dung |
|---|---:|---:|---|
| part-00-head.ts | 7 | 18 | 7 dòng import |
| part-01-schema.ts | 452 | 463 | vùng lib/types/schema.js |
| part-02-index.ts | 695 | 706 | vùng lib/types/index.js |
| part-03-tail.ts | 2 | 13 | dòng export + dòng trống cuối |

**Phát hiện kỹ thuật (đã sửa trong build.ts):** bundle là UTF-8 nhiều byte — **46.455 KÝ TỰ nhưng 46.487 BYTE**.
Bản build đầu tiên đếm ký tự nên in 'B' sai; cổng nay so **Buffer từng byte** (báo byte lệch đầu tiên + sha256 trên
byte). Đã kiểm cả hai nhánh lỗi trong cây TẠM /tmp: lệch 1 byte trong thân lát ⇒ exit 1 kèm 'lech dau tien o byte
17366'; thiếu lib/types ⇒ exit 1. Tệp thật không bị chạm.

## 4. Test A/B — 27 ca (mỗi ca chạy CẢ artefact ta và bundle gốc)

| nhóm | nội dung |
|---|---|
| artefact | byte-identical (byte length + toàn văn/sha256) |
| bề mặt export | đúng 8 tên · 6 hằng số trùng giá trị · default là class · static inject ['sessions'] |
| Config | validate({}) cùng issues ('$.path missing required value') · validate({path}) cùng mặc định (openAt startup, journalMode wal, 20/100/240) |
| engine trên Context cordis THẬT + DB TẠM | schema khởi tạo (application_id 1146308689 + user_version 8 + bảng search_state/persisted_docs) · search rỗng · limit cap · tham số sai · đóng/mở lại · hai engine cùng DB |
| vòng đời | close() hai lần cùng promise · dùng lại sau đóng ⇒ SESSION_QUERY_INDEX_FAILED 'index is closed' · dispose Context ⇒ engine tự đóng · dọn DB tạm (không còn index/wal) · MỌI đường dẫn DB trong mkdtemp (không đụng ~/.galaxy hay ~/.dsh) |

Trung thực: bun không hỗ trợ node:sqlite nên phần DB THẬT chạy bằng **spawn Node v26.9.0** với DB trong thư mục tạm;
ca nào không dựng nổi dịch vụ thật đều chọn nhánh A/B 'cùng ném cùng thông điệp' và ghi lý do ngay trong tên ca.

## 5. Nợ kỹ thuật / việc còn lại

1. Row LỒNG 'optional-session-query-sqlite' trong group 'optional-session-search' — muốn thay phải overlay patch tầng NHÓM.
2. Mount row TOP-LEVEL: khai gbh.row → check:rows → lab:row session-query-sqlite → boot-smoke → Lead boot (đúng kỷ luật).
3. packages/README.md §4: gói nay khai gbh.row nên cần một dòng §4/§4z (tệp dùng chung — Lead/asset quản lý).

## 6. Ghi chú vận hành

- Symlink 5 peer trong node_modules/@deepseek-ai/ (5 cấp ../../../../../apps/host/node_modules/@deepseek-ai/...).
- Test phần DB spawn node: /Users/buitronghieu/.nvm/versions/node/v26.9.0/bin/node (fallback v24.4.1, /usr/local/bin/node).
