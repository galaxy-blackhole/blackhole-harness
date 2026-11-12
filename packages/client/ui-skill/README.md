<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README cua @galaxy-blackhole/gbh-client-ui-skill — ban viet lai cua dsh-client-ui-skill (M5, task-24)
-->

# @galaxy-blackhole/gbh-client-ui-skill

Bản viết lại của Galaxy Blackhole cho row `ui-skill` — giao diện skill trong hội thoại: thẻ tool-call của
skill, nút chọn skill trong sidebar phải, và node trong dòng hội thoại. **Trạng thái: mới có BẢN ĐỒ HÀNH VI
đo được + test canh; CHƯA viết bề mặt, `gbh.row` đang được gỡ.**

## Nguồn đối chiếu (G4)

| Hạng mục | Nguồn |
|---|---|
| Bản gốc nửa client (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-skill/lib/client.js` (**498 dòng**) |
| Bản gốc nửa host | `…/lib/index.js` (11 dòng) |
| Dữ liệu thật | `tests/contract/fixtures/c1-boot-graph.json` (dòng của row này) |
| Test canh | `tests/client/ui-skill.test.ts` |

## Bản đồ hành vi ĐO ĐƯỢC (nguyên văn)

Row trong đồ thị boot — **8 gói, nguyên văn và đúng thứ tự**:

    api-session-controller · client-locale · ui-conversation · ui-renderer · ui-tool · ui-input-trigger · api-remotes · ui-sidebar-right
    external: KHÔNG có · immediately: false · 0 row inject nó · 0 row require nó

⇒ Row LÁ: thay nó không cascade; rủi ro duy nhất là mất phần giao diện skill (thẻ tool-call, nút chọn skill,
node trong hội thoại) — không cần alias id stock.

| Chạm gì | Chi tiết (đo từ `lib/client.js`) |
|---|---|
| Service (fiber inject) | Có mục `remote.skills` trong danh sách inject runtime (ngoài 8 gói trên là service: `slots`, `locale`, `remote`, `sessions`, `uiSession`, `layout`, `shortcuts`…) |
| **RPC** | `const skills = ctx.remote.skills;` (đọc danh sách skill từ Host) · `ctx.remote.$on("agent-preset/selected", invalidate)` — cùng họ với row web-search: client gọi row HOST qua seam RPC |
| Slot occupant 1 | `ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", … }))` — thẻ cho một tool-call của skill |
| Slot occupant 2 | `ctx.slots.inject("conversation.user.text.node", () => ctx.slots.register({ name: "conversation.user.text.node", … }))` — node trong dòng hội thoại |
| Id occupant | `skill` (xuất hiện ở cả hai chỗ đăng ký) — **id SLOT OCCUPANT, KHÔNG phải id module** |
| Seed nền tảng | `react` · `react/jsx-runtime` · `@galaxy-blackhole/gbh-client-ui-primitives` (ba seed, giữ external) |

## Ghi chú lịch sử: đã từng CHẶN mount (mẫu an toàn trước tốc độ)

Row cần **hai slot occupant + RPC skills + component React** — mount khi bề mặt chưa xong sẽ tắt row stock
và mất cả hai chỗ giao diện skill. Vì vậy `gbh.row` đã được gỡ và có **test canh** chặn mount cho tới khi
bề mặt + test xong (mẫu này là một bước chính thức của công thức).

## Kế hoạch viết (đúng thứ tự, mỗi bước có test)

1. Nửa host `apply()` rỗng (khuôn đã có ở `resources`).
2. Build hai nửa: node ESM + **browser CJS bọc `__ModuleLoader__.load({id, factory})`**, `packages: "external"` để giữ ba seed ở dạng `require`.
3. Slot occupant `tool.call.toolview` — tên slot **nguyên văn tại chỗ** (check:rows đọc văn bản).
4. Slot occupant `conversation.user.text.node` — cùng luật.
5. RPC `ctx.remote.skills` + nghe `agent-preset/selected` (đo bằng ctx giả, như test của `web-search`).
6. Boot thử home tạm + cổng riêng → `bun run check:app` (đọc **cả chỉ số 8 đo phía TRANG**) → bật `gbh.row` → mount.

## License

MIT (theo repo).




## Đã xong (17/10/2026) — ĐANG CHẠY THẬT trong app

Row `ui-skill` đã được thay trong app thật; `gbh.row` đã khai.

**Nghiệm thu `bun run check:app` — 11/11 ĐẠT, row của ta có tên trong danh sách gói đang chạy thật:**

| Chỉ số | Giá trị |
|---|---|
| Trang | 49.584 B |
| Entry boot | 72 · 3 batch · release 0.1.0 |
| did not activate | **0** |
| UI render | #root **99.183 ký tự** · **0 lỗi console** |
| Bố cục so đường nền | 1/80 phần tử (1 px có sẵn) |
| Bản mount khớp repo | 37 file |
| HMR | HTTP 200 · connected |

**Việc đã làm**: hai component `SkillRow` + `SkillReference` · CSS 20 rule (parity **byte-for-byte** với bản gốc) · build CJS bọc `__ModuleLoader__.load` (đúng **1** lời gọi, id của ta) · `src/register.ts` (cổng mount quét `src/` tìm `load(`) · 8 service `inject` + 8 id `dsh.client.inject` nguyên văn · hai slot occupant tên nguyên văn (`tool.call.toolview` · `conversation.user.text.node`) · RPC catalog `remote.skills` + `$on("agent-preset/selected")` + `on("connection/reset")` · 5 test xanh.

**Nguyên nhân gốc của lỗi `loading` kéo dài 5 lượt lab**: `apply` ném lỗi **bị cordis nuốt** nên fiber FAILED mà audit của vỏ lấy mẫu sớm nên in `loading`. Lỗi cụ thể: tôi dùng `ctx.inputTriggers.register(source)` trong khi bản gốc dùng `ctx.get("inputTriggers").registerSource(source)`. Ba bẫy kèm theo (đọc sai `ctx.fiber.inject` khi service chưa giải; lỗi bị nuốt làm lab trông như lỗi gói khác; cách moi lỗi bằng try/catch + probe `ctx.fiber.state`) đã ghi đủ trong `docs/recipes/HOST-ROW-REWRITE.md`.


`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-skill` (shasum `en 8f17f1b9adaf...` · `zh 7eb01ec9d28c...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
