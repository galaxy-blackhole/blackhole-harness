<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README cua @galaxy-blackhole/gbh-client-resources — ban viet lai cua dsh-client-resources (M5, task-16)
-->

# @galaxy-blackhole/gbh-client-resources

Bản viết lại của Galaxy Blackhole cho row `resources`: **mô hình resource phía browser** — provider theo
protocol, pin, nguồn sống theo từng địa chỉ, và hook chuẩn `useResource` đi tới mọi slot component.

## Nguồn đối chiếu (G4)

| Hạng mục | Nguồn |
|---|---|
| Hợp đồng bề mặt (browser) | `apps/host/node_modules/@deepseek-ai/dsh-client-resources/lib/types/client/contract.d.ts` (CHỈ ĐỌC) — `Resources`, `ResourceProvider`, `ResourceSnapshot`, `UseResource` |
| Bản gốc nửa client | `…/lib/client.js` (184 dòng): `ResourceRegistry`, `protocolOf`, `idle`, `apply` |
| Bản gốc nửa host | `…/lib/index.js` (6 dòng): host không có hành vi |
| Dữ liệu thật (cây app) | `tests/contract/fixtures/c1-boot-graph.json` — row `resources` inject `@deepseek-ai/dsh-client-ui-renderer`; **5 row inject nó ở tầng DỊCH VỤ** (`api-workspace-files` · `ui-sidebar-right` · `ui-sidebar-documentpreview` · `ui-subagent` · `ui-plan`), **0 row require module của nó** |
| Cơ chế mount | ADR 0004 · công thức HOST-ROW-REWRITE.md |
| Test hành vi | `tests/client/resources.test.ts` (8 ca) |

**Không chép code**: viết lại theo hợp đồng đã đọc; chỉ dùng `node:` builtins và peer `@deepseek-ai/cordis`.

## Điều quyết định việc thay row này: GIỮ NGUYÊN TÊN SERVICE + HOOK

Năm row kia **không** require module của `resources` — chúng chờ ở tầng **dịch vụ**. Hợp đồng thật của row
này là hai thứ sau, và cả hai đều được giữ nguyên:

1. Service `ctx.resources` (qua `ctx.reflect.provide("resources", …)`) với đúng bề mặt: `register(provider)`
   theo `protocol` (trùng protocol ⇒ ném lỗi) · `pin(address, signal)` · `source(address)` trả nguồn ổn
   định tham chiếu, trạng thái `none/loading/live/failed` (frame lỗi GIỮ giá trị cũ).
2. Hook gốc `resource` đóng góp vào tầng `slots`: `ctx.slots.provideRoot({ keyedHooks: { resource } })` —
   đó là thứ biến mọi slot component thành nơi gọi được `useResource`.

Sai một trong hai ⇒ 5 row kia `pending`, UI mất bảng con / sidebar phải (đúng loại cascade đã gặp với row
gateway). Vì **0 row require module của nó**, row này **không cần alias id** — khác ca hai mặt như
`client-modules` hay `api-gateway`.

## Khác biệt có chủ đích

- `createSnapshotStore` tự viết (41 dòng) thay vì require `@galaxy-blackhole/gbh-client-store`: bớt một phụ thuộc
  ngoài bảng peer §3b, giữ đúng hợp đồng store mà React `useSyncExternalStore` cần.
- Khai báo kiểu tường minh cho cả bề mặt (bản gốc là JS bundle); nửa browser không import cordis.
- Giữ nguyên ngữ nghĩa vòng đời: `hold`/`release` theo người nghe và pin, `attach`/`detach` khi provider
  đến/đi, luồng bị huỷ khi người giữ cuối cùng nhả.

## Bằng chứng đã đo

| Việc | Số liệu |
|---|---|
| Test | **8 ca xanh**: protocol · none→loading→live · frame lỗi giữ giá trị · trùng protocol ném lỗi · dispose ⇒ none · pin không cần nghe · hook `resource` trả đúng nguồn · bundle build ra chỉ đăng ký MỘT id (id của ta) |
| Home cách ly (cổng 5455) | UI render **89.015 ký tự** (bằng baseline lành) · `mode: live` · **0 lỗi console** |
| App thật 5439 (sau restart) | **200 · 48.623 B** · row `resources` = `@galaxy-blackhole/gbh-client-resources` · `mode: live` · UI **99.349 ký tự** · **0 lỗi console** |

## Test

    bun test tests/client/resources.test.ts

## Tình trạng

- M5 đợt 1 (17/10/2026): thay row `resources` theo cặp disable + insert; khai `gbh.row` ngay trong package.
- License: MIT (theo repo).


`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-resources` (shasum `en 79ce1e016446...` · `zh 383c5fe70674...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
