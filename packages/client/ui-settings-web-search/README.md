<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README cua @galaxy-blackhole/gbh-client-ui-settings-web-search — ban viet lai cua dsh-client-ui-settings-web-search (M5, task-21)
-->

# @galaxy-blackhole/gbh-client-ui-settings-web-search

Bản viết lại của Galaxy Blackhole cho row `ui-settings-web-search`: thẻ cấu hình provider web-search trên
trang **Plugins**, gồm locale riêng, slot occupant `plugins.item`, và RPC credentials đi qua row HOST
`api-remotes`. **Trạng thái: đã viết xong + nghiệm thu trong home cách ly; đã bật `gbh.row`.**

## Nguồn đối chiếu (G4)

| Hạng mục | Nguồn |
|---|---|
| Bản gốc nửa client (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-settings-web-search/lib/client.js` (323 dòng) |
| Bản gốc nửa host | `…/lib/index.js` (13 dòng) |
| Kiểu công khai | `…/lib/types/client/index.d.ts`, `…/lib/types/client/*.d.ts` |
| Dữ liệu thật | `tests/contract/fixtures/c1-boot-graph.json` (dòng của row này) |
| Test hành vi | `tests/client/ui-settings-web-search.test.ts` (5 ca: bundle 1 id + seed external · inject 5 service · locale · RPC credentials · slot `plugins.item`) |

## Bản đồ hành vi ĐO ĐƯỢC (nguyên văn từ bản gốc + fixture)

Row trong đồ thị boot (đo từ fixture, không suy đoán):

    id: @deepseek-ai/dsh-client-ui-settings-web-search
    inject: [client-locale, ui-settings, ui-plugin-manager, api-remotes]   ← đúng 4 cái, nguyên văn
    external: KHÔNG có        (0 row require module của nó)
    immediately: KHÔNG có     (không thuộc tier nạp ngay)
    0 row inject nó · 0 row require nó   ⇒ thay row này KHÔNG cascade; rủi ro duy nhất là MẤT thẻ trên trang Plugins

Bề mặt nó chạm (đọc trực tiếp trong `lib/client.js` — chỉ đọc):

| Chạm gì | Chi tiết |
|---|---|
| Service (fiber inject) | `inject = ["@deepseek-ai/dsh-client-locale", "@deepseek-ai/dsh-client-ui-settings", "@deepseek-ai/dsh-client-ui-plugin-manager", "@deepseek-ai/dsh-api-remotes"]` |
| Locale | `ctx.locale.bind(NS)` + `ctx.effect(() => ctx.locale.register(NS, {...}))` — namespace của provider web-search |
| Config forms | `ctx.configForms.get(WEB_SEARCH_NS)` → `WebSearchCardController`; `ctx.configForms.whileServed([WEB_SEARCH_NS], …)` |
| **RPC chéo tầng (điểm chính của row này)** | `await this.ctx.remote.credentials.describe([ref])` · `await this.ctx.remote.credentials.set(ref, value)` · `ctx.remote.$on("credentials/reference-updated", cb)` ⇒ đi qua row HOST `api-remotes` |
| Slot occupant | `ctx.slots.inject("plugins.item", () => ctx.slots.register({ name: "plugins.item", id: "web-search", … }, card.inject()))` |
| Field id trong form | `plugin-config-web-search-key` · `plugin-config-web-search-endpoint` · `plugin-config-web-search-max-uses` |
| Seed nền tảng dùng | `react/jsx-runtime` · `@galaxy-blackhole/gbh-client-ui-primitives` |

## Số đo đã nghiệm thu (home cách ly, cổng 5460)

Home cách ly (đã gỡ khối row `ui-settings-shell` đang dở của teammate khỏi patch tạm): **72 entry · batch 1/57/14**
· row của ta thay đúng (`stockGone: true`) · `mode: live` · **UI 89.181 ký tự** · **0 lỗi console**.

Trong lúc viết, `gbh.row` đã được gỡ và có test canh — mẫu an toàn này giờ là một bước chính thức của công thức.

## Kế hoạch viết (đúng thứ tự, mỗi bước có test)

1. Nửa host `apply()` rỗng (khuôn đã có trong `resources`).
2. Locale: bảng chuỗi cho `NS` + `ctx.locale.bind/register` — đo bằng cách so chuỗi với bản gốc.
3. Card controller: `describe`/`set` credentials qua `ctx.remote`, nghe `credentials/reference-updated`.
4. Slot occupant: `plugins.item` / `web-search`, form 3 field đúng id — **viết tên slot nguyên văn tại chỗ**
   (`check:rows` đọc văn bản, khai qua hằng số sẽ bị báo oan).
5. Nửa browser build sang **CJS** rồi bọc `__ModuleLoader__.load({id, factory})` (ESM sẽ ném SyntaxError khi nạp bằng thẻ script).
6. Home cách ly + cổng riêng → 72 entry · 0 'did not activate' · UI render · rồi mới bật `gbh.row` và mount.

## License

MIT (theo repo).


`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-settings-web-search` (shasum `en 8191091534e9...` · `zh e185ddafa9f8...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
