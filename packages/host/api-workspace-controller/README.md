<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo hoàn tất gói HAI MẶT api-workspace-controller: nửa host (đã port) + nửa client 530 dòng +
      hai manifest typert — slice nguyên văn + cổng byte + validate qua typert-loader THẬT
-->

# @galaxy-blackhole/gbh-api-workspace-controller — row workspace-controller

Gói HAI MẶT của DSH (lib/index.js 1.049 dòng · lib/client.js 530 · lib/typert.host.js 898 ·
lib/typert.remote-client.js 668): nửa host đã port trước đó; lượt này hoàn tất NỬA CLIENT + 2 MANIFEST TYPERT
bằng slice nguyên văn + cổng byte, và validate manifest qua TYPERT-LOADER THẬT.

## 0. Năm câu hỏi bắt buộc (§4f)

1. Row này làm gì? Cấp service workspaceController + directoryPickerController (namespace RPC workspace/
   directoryPicker): feed Workspace, các lệnh Workspace, chọn thư mục host, default workspace/directory lần đầu.
2. Row nằm ở đâu? TOP-LEVEL, id workspace-controller (stock đang bật) — gói ta thay cả hai mặt.
3. Hai mặt? CÓ — thiếu nửa client là UI Workspace mất (tiền lệ api-workspace-files/api-gateway).
4. Trùng service/event? Không: workspaceController/directoryPickerController chỉ do row này cấp; directoryPicker
   là seam peer; api-gateway là seam RPC.
5. Khai gbh.row? CHƯA — PARKED: gbh.row_unmounted_ly_do = { ly_do, row: { id: 'workspace-controller', tests } }.
   Chỉ flip sau (1) test xanh, (2) Lead boot-smoke workspace-controller ĐẠT, (3) Lead thêm dòng README §4.

## 1. Ba artefact hai mặt (slice nguyên văn + byte-gate)

| Artefact | Nguồn | Thay thế ownership/id | Đo được (build) |
|---|---|---|---|
| lib/client.js | stock client.js 530 dòng | id module → id của TA (1 lần) | 20.619 B (gốc 20.614, +5) · sha256 143f44ed… |
| lib/typert.host.js | stock typert.host.js 898 dòng | package: → id của TA (2 lần: descriptor + manifest) | 66.062 B (gốc 66.052, +10) · sha256 41e6d435… |
| lib/typert.remote-client.js | stock typert.remote-client.js 668 dòng | package: → id của TA (1 lần) | 50.874 B (gốc 50.869, +5) · sha256 898fcc31… |

slice → ghép do build.ts làm: bỏ header 5 dòng + dòng marker + dòng kết thúc module (chịu được dòng trống biên
và tôn trọng newline cuối của stock), rồi CỔNG BYTE assembled === stock.replaceAll(from, to) — sai một byte là
build đỏ. typeSymbol của consumer (…/types#Workspace…, …#workspace/init) GIỮ NGUYÊN vì là hợp đồng dây; chỉ
ownership đổi sang id của ta (typert-loader kiểm manifest.package === pkgName).

## 2. Validate qua typert-loader THẬT

validateTypertManifest('<id của TA>', TYPERT) → ACCEPTED. Cùng manifest khai tên stock → ném đúng câu
"TYPERT manifest names package … — the manifest must be owned by the package that exports it" (test bắt nguyên
văn). Remote manifest: package = id của ta, face + 14 method key khớp stock.

## 3. Số đo TRƯỚC → SAU

| Phép đo | TRƯỚC | SAU |
|---|---|---|
| nửa client + 2 manifest typert | 0 | 3/3 đã port (slice + byte-gate) |
| test A/B | 0 ca | 27 ca · 139 expect (host 20 ca/122 expect · hai mặt 7 ca/17 expect) |
| build | chỉ lib/index.js | 4 artefact + cổng byte |
| exports / dsh.client / gbh.row | không có | exports đủ 4 mặt + dsh.client + row PARKED |
| tsc strict | — | gói + 2 tệp test 0 lỗi |
| gate lint | — | header/file-length/jsdoc/dep-guard 0 vi phạm vùng này |

## 4. Nợ kỹ thuật

- Slice giữ marker ts-nocheck trong nguồn THÔ (precedent api-terminal-controller) và bị gỡ khi ghép; artefact
  lib/ không chứa marker.
- typeSymbol trong 2 manifest giữ tên stock (hợp đồng với consumer đã convert như ui-workspace); chỉ ownership
  đổi sang id của ta — đúng bài học session-reference.
- Row chưa flip: cần Lead boot-smoke workspace-controller + dòng packages/README.md §4.
