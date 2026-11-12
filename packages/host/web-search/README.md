<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Provider tìm kiếm web DeepSeek — bản viết lại 1:1 của @deepseek-ai/dsh-web-search-deepseek
-->

# @galaxy-blackhole/gbh-web-search

Bản gốc: `@deepseek-ai/dsh-web-search-deepseek` @0.2.1-alpha.4 — `lib/index.js` **341 dòng**.

## Bề mặt export (1:1)

`Config` · `DEEPSEEK_DEFAULT_API_VERSION` · `DEEPSEEK_DEFAULT_BASE_URL` · `DEEPSEEK_DEFAULT_MAX_TOKENS` · `DEEPSEEK_DEFAULT_MAX_USES` · `DEEPSEEK_DEFAULT_MODEL` · `DEEPSEEK_PROVIDER_ID` · `DeepSeekSearchProvider` · `WEB_SEARCH_DEEPSEEK_SETTINGS_NAMESPACE` · `apply` · `inject` · `name` (+ `mapAnthropicResponse`/`resolveOptions` để test 1:1).

## Hành vi giữ nguyên

- `search()` dựng body Messages: model + `max_tokens` + 1 message text `Perform a web search for the query: …` + tool `web_search_20250305` (`max_uses`); header `anthropic-version` · `content-type` · `accept` · `user-agent` ("deepseek-harness/0.0.1").
- `mapAnthropicResponse()` gom `web_search_tool_result` → `web_search_result`, dedupe **theo url**, snippet lấy từ `citations[].cited_text` (first-wins), `page_age` → `publishedAt`, `truncated` **luôn false**; không có block kết quả ⇒ `WEB_PROVIDER_ERROR`.
- Xác thực: token tài khoản (`x-dsh-auth-token`, chỉ khi provider của Session là `deepseek-account`) trước, sau đó API key (`x-api-key` + `authorization: Bearer …`); thiếu key ⇒ `WEB_PROVIDER_CREDENTIAL_MISSING` với đúng câu hướng dẫn gốc.
- Abort: `WEB_ABORTED` (giữ `cause` = `signal.reason`); lỗi sau khi dispatch ⇒ `WEB_PROVIDER_ERROR` kèm hướng dẫn endpoint.
- `available()`: cần nguồn credential + `baseURL` parse được + `maxTokens`/`maxUses` nguyên dương.

## Khác biệt so bản gốc (đều vì luật repo)

1. **Seam khai hẹp cục bộ** thay vì import tĩnh: `WebError` (code + cause), ctx (`web.registerSearchProvider`, `get()`), môi trường (`launchEnvironment.get`). Không import `@deepseek-ai/*`.
2. `Config` là **mô tả trường** (type/role/default/step/min/volatile) thay cho schemastery `z.object`, nhưng giữ **đúng mọi default** và thứ tự trường; `apply(ctx, config)` nhận **hàm trả cấu hình hiện hành** thay cho section có `.get()` từng trường.
3. `resolveOptions` nhận ctx hẹp nhưng giữ nguyên thứ tự fallback (literal → credentials service → môi trường; `DEEPSEEK_SEARCH_BASE_URL` cho endpoint).

## Test

`tests/host/web-search-deepseek.test.ts` — bề mặt export · locale byte-equal (55 + 123 B) · `mapAnthropicResponse` (dedupe/snippet/page_age/thiếu block ⇒ lỗi) · `available()` · xác thực api-key & account · abort · `search()` với **fetch stub** (không gọi mạng thật).
