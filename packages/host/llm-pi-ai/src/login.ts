/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Vùng login của @deepseek-ai/dsh-llm-pi-ai — port 1:1 lib/index.js dòng 2438–2596 (nguồn
 *      per-file: lib/types/login.js): toàn bộ phần dịch giữa từ vựng notice/prompt trung tính của
 *      harness và `AuthInteraction` của pi-ai. Đăng ký MỘT flow uỷ quyền cho mỗi provider catalog
 *      đã cài có login, kèm hàm restate prompt và relay event.
 *      Export: registerPiAiFlows.
 */

/**
 * Authorization flows for the pi-ai providers that ship a login. This is the
 * whole of the translation between the harness's neutral notice/prompt
 * vocabulary and pi-ai's `AuthInteraction`; nothing above it knows which
 * library ran the conversation.
 *
 * @module dsh-llm-pi-ai/login
 */

import type { Context } from "@deepseek-ai/cordis";
import type { AuthorizationMethod, AuthorizationPrompt, AuthorizationSession } from "@galaxy-blackhole/gbh-authorization";
import { isCredentialKeySegment } from "@deepseek-ai/dsh-credentials";
import type { AuthEvent, AuthPrompt, Provider } from "@earendil-works/pi-ai";
import type { PiAiAuthInjection } from "./adapter.ts";
import { recordKeyFor } from "./auth.ts";
import { catalogProvider, catalogProviderIds } from "./catalog.ts";
import { createModels } from "./models.ts";

/**
 * Catalog providers whose OAuth login this adapter does not offer. pi-ai's Sign
 * in with ChatGPT (`openai`) identifies the installation to OpenAI with a
 * stable UUID that the app supplies through `LoginOptions.getDeviceId`, and it
 * refuses to start without one. The harness keeps no installation ID meant for
 * a third-party account sign-in, so the route signs in with an API key.
 */
const UNSERVED_OAUTH = new Set(["openai"]);

/**
 * The login methods one catalog provider offers.
 *
 * A method appears only when pi-ai can actually run it: `oauth` carries a
 * `login` that runs without app-supplied login options except for the
 * providers in {@link UNSERVED_OAUTH}, while an api-key method has one only
 * when the provider collects its key interactively — which every installed one
 * currently does, so a key is typed into pi-ai's own prompt rather than into
 * the settings form.
 * @param provider - the installed catalog provider, if pi-ai ships one.
 * @returns its methods, most preferred first; empty when it offers no login.
 * Nhận: provider — provider catalog đã cài, nếu pi-ai có ship.
 * Trả: các method, ưu tiên nhất đứng đầu; rỗng khi provider không có login.
 */
function loginMethods(provider: Provider | undefined): AuthorizationMethod[] {
  const methods: AuthorizationMethod[] = [];
  const oauth = provider === void 0 || UNSERVED_OAUTH.has(provider.id) ? void 0 : provider.auth.oauth;
  if (oauth !== void 0)
    methods.push({
      id: "oauth",
      label: oauth.loginLabel ?? oauth.name,
    });
  const apiKey = provider?.auth.apiKey;
  if (apiKey?.login !== void 0)
    methods.push({
      id: "api-key",
      label: apiKey.name,
    });
  return methods;
}

/**
 * Restate one pi-ai login event in the seam's vocabulary.
 *
 * A device-code grant is the one event carrying two things the human needs at
 * once — where to go and what to type there — which is why the neutral notice
 * has a `code` beside its `url` rather than folding the code into the message.
 * @param event - what pi-ai reported.
 * @param session - the attempt to report it to.
 * Nhận: event — điều pi-ai vừa báo; session — lượt uỷ quyền đang chạy để báo cho nó.
 * Trả: không; notice được đẩy qua `session.notify`.
 */
function relay(event: AuthEvent, session: AuthorizationSession): void {
  switch (event.type) {
    case "info": {
      const link = event.links?.[0];
      session.notify({
        message: event.message,
        ...link === void 0 ? {} : { url: link.url },
      });
      return;
    }
    case "auth_url":
      session.notify({
        message: event.instructions ?? "Open this page to continue signing in.",
        url: event.url,
      });
      return;
    case "device_code":
      session.notify({
        message: "Enter this code on the verification page to finish signing in.",
        url: event.verificationUri,
        code: event.userCode,
      });
      return;
    case "progress":
      session.notify({ message: event.message });
      return;
    default: session.notify({ message: "Signing in…" });
  }
}

/**
 * Restate one pi-ai prompt in the seam's vocabulary.
 *
 * `manual_code` becomes a plain text question because the difference pi-ai
 * draws — a code the human copies from a browser rather than a value they know
 * — changes nothing a surface renders. Its own `signal` is carried through, and
 * that is the part which matters: it is how a flow racing a typed code against
 * a browser callback withdraws the losing question.
 * @param prompt - what pi-ai asked.
 * @returns the neutral prompt to put to the human.
 * Nhận: prompt — câu pi-ai vừa hỏi.
 * Trả: prompt trung tính để đặt cho người dùng.
 */
function restate(prompt: AuthPrompt): AuthorizationPrompt {
  const signal = prompt.signal === void 0 ? {} : { signal: prompt.signal };
  switch (prompt.type) {
    case "select": return {
      ...signal,
      kind: "select",
      message: prompt.message,
      options: prompt.options,
    };
    case "secret": return {
      ...signal,
      kind: "secret",
      message: prompt.message,
      ...prompt.placeholder === void 0 ? {} : { placeholder: prompt.placeholder },
    };
    default: return {
      ...signal,
      kind: "text",
      message: prompt.message,
      ...prompt.placeholder === void 0 ? {} : { placeholder: prompt.placeholder },
    };
  }
}

/**
 * Register one authorization flow per installed provider that ships a login.
 *
 * Registration is unconditional on configuration: a provider has to be signed
 * into before a route for it is worth adding, so the flow exists from the
 * moment the plugin mounts rather than appearing once a profile does.
 * Nhận: ctx — context plugin mang `ctx.authorization`; auth — hai injectable
 *   mà mọi collection ở đây được dựng cùng.
 * Trả: không; mỗi provider catalog đã cài có login nhận một flow trong sổ
 *   uỷ quyền, flow chạy `models.login` và ghi credential qua chính pi-ai.
 */
export function registerPiAiFlows(ctx: Context, auth: PiAiAuthInjection): void {
  for (const providerId of catalogProviderIds()) {
    const provider = catalogProvider(providerId);
    const [first, ...rest] = loginMethods(provider);
    /* v8 ignore next 3 -- every id here names an installed provider and every
    installed provider ships a login, so no entry is skipped; the guard
    is what keeps that from becoming a crash if either stops being true. */
    if (provider === void 0 || first === void 0) continue;
    /* v8 ignore next 7 -- every installed catalog id is a lowercase
    hyphenated identifier; the guard keeps a future upstream id outside the
    record grammar (dotted or uppercase, as vendor ids elsewhere already
    are) from throwing in `recordKeyFor` and failing the whole mount. */
    if (!isCredentialKeySegment(providerId)) {
      ctx.logger.warn("llm-pi-ai: catalog provider \"%s\" cannot address a credential record; its sign-in is not offered", providerId);
      continue;
    }
    ctx.authorization.registerFlow({
      key: recordKeyFor(providerId),
      label: provider.name,
      methods: [first, ...rest],
      async run(session) {
        const models = createModels(auth);
        models.setProvider(provider);
        const type = session.method === "oauth" ? "oauth" : "api_key";
        await models.login(providerId, type, {
          signal: session.signal,
          notify: (event) => {
            relay(event, session);
          },
          prompt: (prompt) => session.prompt(restate(prompt)),
        });
      },
    });
  }
}
