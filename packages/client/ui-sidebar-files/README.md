<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-client-ui-sidebar-files — bảng nguồn đối chiếu (G4), lý do peer, TRƯỚC/SAU
-->

# @galaxy-blackhole/gbh-client-ui-sidebar-files

Bản viết lại của Galaxy Blackhole cho row **`ui-sidebar-files`** của DSH
(gốc: `@deepseek-ai/dsh-client-ui-sidebar-files`, bundle gốc **1.025 dòng**).
Tab `files` của sidebar phải: cây thư mục của workspace phiên, đọc từng mức qua Remote `workspaceFiles`,
mở tệp vào sidebar, tự làm mới theo luồng `changes`.

## 1. Bảng nguồn đối chiếu (G4)

| Thứ tự | Bản gốc (chỉ đọc) | Bản của ta | Ghi chú |
|---|---|---|---|
| Kiểu tab | `lib/client.js` §definition.js§ — `id` · `kind: "files"` · `priority: "builtin"` · `guide[0]` | `src/definition.ts` | nhãn là HÀM (đổi ngôn ngữ là đổi ngay); guide `id: "workspace"` · `commandId: "workspace.files"` · `order: 10` |
| Cây thư mục | §directory-node.js§ | `src/directory-node.ts` | một nút = một mức được đọc + giám sát; con mở theo nhu cầu; `restore` giữ tập đang mở qua lần đọc lại |
| Mặt Remote | §face.js§ | `src/face.ts` | `createWatch` (luồng `changes`) · `createList` (giữ `entries`/`truncated`) · `filesFace` (thế hệ theo tab/đường dẫn) |
| Store | §store.js§ — `defineStore` | `src/store.ts` | 9 action nguyên văn: `autoRefresh · start · loading · loaded · failed · toggled · scrolled · reset · forget` |
| Thân tab | §FilesBody.js§ | `src/files-body.ts` | giữ nguyên mọi `data-files-*` và cách bấm: thư mục mở/đóng · tệp mở qua `tab.actions.openResource` · loại khác thì không mở |
| Tiêu đề tab | §FilesTitle.js§ | `src/files-title.ts` | `FileTypeIcon(kind: "folder", size: 16)` rồi tên tab |
| Từ điển | §locales.js§ — namespace `sidebarFiles` | `src/locales.ts` | **17 khoá**, `zh` là nguồn đúng của tập khoá |
| CSS | §FilesBody.module.css§ (16 lớp, hash `k-1LKG_`) | `src/body-css.ts` | **nguyên khai báo**, chỉ đổi tiền tố lớp sang `gbhFiles_`; màu/khoảng đều là token `--dsw-*` |
| Địa chỉ tệp | `@deepseek-ai/dsh-util-workspace-path` (bản gốc bundle kèm) | `src/paths.ts` | `dsh-resource://file/session/<sessionId>/<path>`; đường dẫn ngoài workspace giữ dạng tuyệt đối |
| Chỗ ngồi | `sidebar.right.pane.tab` · `sidebar.right.pane.tab.title` | `src/plugin.ts` | **HAI slot**, tên viết LITERAL; component là **tham số thứ hai** của `register(spec, Component)` |
| Manifest | `dsh.client: { inject: [5 gói], platform: "web" }` | `package.json` | **không** `immediately` (y bản gốc); thêm `exports["./client"]` + `exports["./locale/*.json"]` |

## 2. Vì sao có peer `@deepseek-ai/cordis`

Chỉ để khớp quy ước workspace của repo (một kernel do vỏ cấp). Nửa browser **không** `import` gói nào:
mọi thứ (`react` · `react/jsx-runtime` · `ui-primitives` · `dsh-client-store`) đi qua **bảng module** của trang.

## 3. Luật một-id (docs/recipes/HOST-ROW-REWRITE.md §8)

- Bundle tự đăng ký **ĐÚNG MỘT** id: `@galaxy-blackhole/gbh-client-ui-sidebar-files`.
- `@deepseek-ai/dsh-client-ui-sidebar-files` **không** được đăng ký trong bundle — nó nằm ở
  `gbh.row.aliases`, và tầng nạp tự phát entry alias dùng **cùng URL** (một bundle ⇒ một plugin).
- Đo trên artifact: `grep -c 'id: "@deepseek-ai' lib/client.js` = **0** · `grep -c 'id: "@galaxy-blackhole'` = **1**.

## 4. Hai điều dễ sai đã khoá bằng ghi chú + test

1. **`key` của chỗ ngồi phải bằng id của kiểu tab.** `ui-sidebar-right` tra chỗ ngồi theo
   `entryKey: definition?.id ?? tab.kind` ⇒ lệch nhau là thân tab **không bao giờ được gọi**.
2. **Cổng chống cài hai lần là cờ PHẠM VI MODULE, bật SAU `applyInner`.** Khoá theo `ctx` là sai vì
   ca thật là **hai entry ⇒ hai ctx**; bật cờ trước khi đăng ký xong thì lần cài thứ hai không đăng ký lại
   ⇒ renderer gặp `undefined` ⇒ React #130.

## 5. TRƯỚC / SAU

| Phép đo | TRƯỚC (bản gốc) | SAU (bản của ta) |
|---|---|---|
| Id module trong artifact | 1 (`@deepseek-ai/…`) | **1** (`@galaxy-blackhole/…`) · id gốc **0** |
| Slot đăng ký | `sidebar.right.pane.tab` · `sidebar.right.pane.tab.title` | **y hệt** (tên literal) + slot con `sidebar.right.tab.files.actions` khai `{ kind: "list", scope: "session" }` |
| Từ điển `sidebarFiles` | 17 khoá × 2 ngữ | **y hệt từng chuỗi** (đối chứng trực tiếp với bundle gốc trong test) |
| Kiểu tab · phím tắt · chỗ ngồi | — | **trùng cấu trúc** với bundle gốc (cùng phép chuẩn hoá id) |
| `locale/{en,zh}.json` | có | **byte-for-byte** như bản gốc (`shasum` khớp) |
| Test | — | **8 ca** (`bun test tests/client/ui-sidebar-files.test.ts`) — có **đối chứng với chính bundle gốc**: từ điển · kiểu tab · phím tắt · spec hai chỗ ngồi · **cây render từng dòng** |
| `lab:row ui-sidebar-files` (home tạm + cổng riêng) | — | **200 · `#root` 58.588 ký tự · 110 entry · 0 lỗi console · 0 `did not activate` · 0 "Failed to load plugins"** |
| Bundle ĐANG PHỤC VỤ trong lab | — | combo 1.370.329 B chứa **ĐÚNG MỘT** `__ModuleLoader__.load` — id của ta; entry id **alias** trỏ **cùng URL** (một bundle ⇒ một plugin); không cú pháp ESM |
| `inject` trên row của đồ thị boot | 5 gói | **y hệt** 5 gói gốc, **không** `immediately` |
| A/B pixel · phần tử lạ (2 lớp đo) | — | **chưa đo** — chờ lượt boot của Lead (row chiếm slot; lab không có phiên nên không mở được tab) |

Lệnh tái lập:

```bash
cd <repo>/packages/client/ui-sidebar-files && bun run build.ts      # build hai nửa (nhận outDir qua argv[2])
grep -c 'id: "@deepseek-ai' lib/client.js                          # 0
grep -c 'id: "@galaxy-blackhole' lib/client.js                     # 1
cd <repo> && bun test tests/client/ui-sidebar-files.test.ts && bun run check:rows && bun run gate --no-tests
bun run lab:row ui-sidebar-files                                   # home tạm + cổng riêng, không đụng app thật
```

## 6. Phần CHƯA làm

- **Chưa mount lên app 5439** (chỉ Lead boot) và **chưa chạy hai lớp đo** A/B pixel + phần tử lạ trên màn
  có tab `files` — cần một lượt boot do Lead điều phối.
- **Thân tab chưa được mở trong lab**: home lab là home mới nên **không có phiên nào** ⇒ không có workspace
  để tab `files` trỏ tới (`commandTarget` trả `undefined` ⇒ phím tắt `workspace.files` bị `blocked`).
  Bằng chứng hiện có: entry của ta **activate sạch** (0 lỗi console, 0 `did not activate`) ⇒ `apply` đã
  đăng ký xong hai chỗ ngồi; và **ca render** trong test vẽ cả hai component.
- `lib/client.bundle.js` là sản phẩm phụ của `Bun.build` (bản Bun này bỏ qua `write: false`), giống
  `ui-brand-official`; artifact được phục vụ vẫn là `lib/client.js`.
