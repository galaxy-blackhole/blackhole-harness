/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Tài khoản DeepSeek cho LLM: đăng ký route `deepseek-account` dưới dạng provider cấu hình được,
 *      phân giải token theo TỪNG request qua service tài khoản, nạp danh mục từ GET /models của tài
 *      khoản, và chặn model mà bản build này không phục vụ được. Bản viết lại của Galaxy Blackhole cho
 *      row llm-deepseek-account (@deepseek-ai/dsh-llm-deepseek-account) — nguồn đối chiếu: README.md (G4).
 */

import type { Context } from "@deepseek-ai/cordis";
import {
  ACCOUNT_QUOTA_EXCEEDED_CODE,
  APP_IDENTITY,
  LlmError,
  QUOTA_EXCEEDED_CODE,
} from "@deepseek-ai/dsh-llm";
import type { LlmConfigurableProvider } from "@deepseek-ai/dsh-llm";
import { catalogModelInfo, registerDeepSeekProvider, resolveAdapterOptions } from "@deepseek-ai/dsh-llm-deepseek";
import type { ResolvedDeepSeekOptions } from "@deepseek-ai/dsh-llm-deepseek";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";

import { AccountModelCatalog } from "./catalog.ts";
import type { CatalogView } from "./catalog.ts";
import { Config, plainAccountOptions, resolveAccountOptions } from "./config.ts";
import { requestModelListing } from "./listing.ts";
import type { ModelListing } from "./listing.ts";
import { resolveAccountCatalog } from "./resolve-catalog.ts";
import type { AccountCatalog, CatalogRefusal } from "./resolve-catalog.ts";

export { Config };

/** Tên plugin cordis — nguyên văn của bản gốc. */
export const name = "llm-deepseek-account";

/** Service bắt buộc: sổ provider của LLM (`llm`). Tài khoản KHÔNG inject — nó là seam TUỲ CHỌN. */
export const inject: string[] = ["llm"];

/** Route mà row này sở hữu — nguyên văn của bản gốc. */
const PROVIDER = "deepseek-account";

/** Header mang token tài khoản trên request Messages, Files và xin danh sách model. */
const TOKEN_HEADER = "x-dsh-auth-token";

/** Nhãn console của chẩn đoán danh sách; profile sản phẩm không mount console exporter cho `ctx.logger`. */
const LOG_TAG = "[llm-deepseek-account]";

/**
 * Phần của service `deepseekAccount` mà row này gọi. Khai theo CẤU TRÚC, không import kiểu của gói
 * tài khoản: chính row đó đang được viết lại, và một `import type` sẽ buộc kernel cấp thêm một peer
 * chỉ để lấy kiểu. Hai chữ ký dưới đây là nguyên văn hợp đồng của service.
 */
interface DeepSeekAccountSeam {
  /** Token đã lưu cho `url` (chỉ origin suy luận được phép), hoặc `undefined` khi chưa đăng nhập. */
  resolveToken(url: string): Promise<string | undefined>;
  /** Xoá token đã bị suy luận từ chối, chỉ khi nó vẫn khớp phiên đăng nhập đã lưu. */
  rejectToken(token: string): Promise<void>;
}

/** Ảnh chụp kết nối của route tài khoản: cấu hình Messages + danh mục đã phân giải. */
interface AccountConnection extends ResolvedDeepSeekOptions {
  /** Danh mục đã phân giải cho khung nhìn hiện tại (đã chào, bị từ chối, chẩn đoán). */
  readonly catalog: AccountCatalog;
}

/** Ảnh chụp trường `entry` mà tầng nạp gắn lên fiber (kiểu thật đến từ `cordis-plugin-loader`). */
interface EntryCarrier {
  /** Entry đang nạp plugin này, nếu có. */
  entry?: {
    /** Tuỳ chọn của entry — `id` là id row. */
    options: { id?: string };
  };
}

/**
 * Đọc id của ROW đang nạp plugin; dùng làm không gian tên cấu hình của provider.
 * Nhận: context cordis của plugin.
 * Trả: id entry, hoặc `undefined` khi plugin không được nạp từ một entry của loader.
 */
function entryIdOf(ctx: Context): string | undefined {
  return (ctx.fiber as unknown as EntryCarrier).entry?.options.id;
}

/**
 * Đọc service tài khoản nếu nó đang sống. KHÔNG `inject`: bản gốc coi route tài khoản là tuỳ chọn —
 * thiếu service thì request báo `ACCOUNT_SIGN_IN_REQUIRED`, không làm plugin không activate.
 * Nhận: context cordis của plugin.
 * Trả: seam tài khoản, hoặc `undefined` khi service vắng mặt.
 */
function accountOf(ctx: Context): DeepSeekAccountSeam | undefined {
  return ctx.get("deepseekAccount") as DeepSeekAccountSeam | undefined;
}


/**
 * Nhận diện một lớp lỗi theo TÊN, bền với MỌI bản sao module của lớp đó.
 * Vì sao (01/11/2026): `LlmError` được import qua peer `@deepseek-ai/dsh-llm`; trong test specifier đó
 * phân giải về MỘT BẢN SAO khác kernel nên `instanceof` trượt, và `onRequestError` bỏ qua lỗi kernel
 * thay vì dịch mã (đo được: ACCOUNT_QUOTA / ACCOUNT_TOKEN_INVALID không xuất hiện). Dò tên lớp trên
 * chuỗi prototype giữ đúng ngữ nghĩa `instanceof` — kể cả lớp con như `DeepSeekFilesError`.
 * Nhận: error — giá trị bắt được; name — tên lớp cần khớp.
 * Trả: true khi chuỗi prototype của lỗi chứa một lớp mang đúng tên đó.
 */
function isNamedError(error: unknown, name: string): boolean {
  try {
    if (!(error instanceof Error)) return false;
    for (let proto: object | null = Object.getPrototypeOf(error); proto !== null; proto = Object.getPrototypeOf(proto)) {
      const ctor = (proto as { constructor?: { name?: string } }).constructor;
      if (typeof ctor === "function" && ctor.name === name) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Từ chối MỘT model trước mọi I/O mạng, bằng đúng mã + nguyên văn thông điệp của bản gốc.
 * Nhận: id model và lý do từ chối đã phân giải (hoặc `undefined` khi model được nhận).
 * Trả: không; ném `LlmError` `CLIENT_UPGRADE_REQUIRED`/`MODEL_UNSUPPORTED` khi bị từ chối.
 */
function refuse(model: string, refusal: CatalogRefusal | undefined): void {
  if (refusal === undefined) return;
  switch (refusal.kind) {
    case "upgrade-required":
      throw new LlmError(
        `DeepSeek model "${model}" requires Galaxy Blackhole ${refusal.requiredVersion} or later; current version is ${APP_IDENTITY.version}`,
        "CLIENT_UPGRADE_REQUIRED",
      );
    case "unsupported":
      throw new LlmError(
        `DeepSeek model "${model}" is not supported by Galaxy Blackhole; current version is ${APP_IDENTITY.version}`,
        "MODEL_UNSUPPORTED",
      );
    default:
      throw new Error(`unreachable variant in account catalog refusal: ${JSON.stringify(refusal)}`);
  }
}

/**
 * Cài đặt route tài khoản của DeepSeek: khai provider cấu hình được, trao adapter hàm phân giải token
 * theo từng request, hàm nạp danh mục theo tài khoản, và hàm chặn model trước I/O.
 * Nhận: context cordis (đã có seam `llm`) và cấu hình đã kiểm bởi {@link Config}.
 * Trả: không; ném ngay khi cấu hình không phân giải được (fail loud như bản gốc).
 */
export function apply(ctx: Context, config: Config): void {
  const environment = launchEnvironmentOf(ctx);
  /** Ảnh chụp cấu hình MỚI cho mỗi thao tác — không bao giờ dùng lại vật của lượt trước. */
  const settings = () => resolveAccountOptions(plainAccountOptions(config), environment);
  // Phân giải ngay lúc nạp: cấu hình sai phải nổ ở đây, không phải ở request đầu tiên.
  settings();

  /** Model mà bản build này hỗ trợ — kiến thức phía client dùng để xếp lớp danh sách. */
  const supported = resolveAdapterOptions({}).models;
  const account = (): DeepSeekAccountSeam | undefined => accountOf(ctx);

  /**
   * Phân giải xác thực cho MỘT request: token tài khoản, và callback phân loại lỗi GIỮ CÙNG token.
   * Nhận: ảnh chụp kết nối của request (lấy `baseURL` để service tài khoản tự kiểm origin).
   * Trả: header `x-dsh-auth-token` + callback `onRequestError`; ném `LlmError` khi chưa đăng nhập.
   */
  const resolveAuth = async (connection: AccountConnection) => {
    const token = await account()?.resolveToken(connection.baseURL);
    if (token === undefined) {
      throw new LlmError(
        "Sign in to DeepSeek to use the account provider. The request destination must allow account authentication.",
        "ACCOUNT_SIGN_IN_REQUIRED",
      );
    }
    return {
      headers: { [TOKEN_HEADER]: token },
      onRequestError: async (error: unknown): Promise<unknown> => {
        if (!isNamedError(error, "LlmError")) return error;
        const failure = error as LlmError;
        if (failure.code === QUOTA_EXCEEDED_CODE) {
          return new LlmError(failure.message, ACCOUNT_QUOTA_EXCEEDED_CODE, {
            ...failure.failure,
            cause: error,
          });
        }
        if (failure.failure.status !== 401) return error;
        const rejected = new LlmError(failure.message, "ACCOUNT_TOKEN_INVALID", {
          ...failure.failure,
          cause: error,
        });
        try {
          await account()?.rejectToken(token);
        } catch (_credentialRemovalFailed) {
          // Bản gốc nuốt lỗi xoá credential: lỗi được báo vẫn là lỗi SUY LUẬN vừa bị từ chối.
        }
        return rejected;
      },
    };
  };

  const catalog = new AccountModelCatalog({
    settings: () => settings().catalog,
    token: async (url: string) => account()?.resolveToken(url),
    load: (url, token, signal) => requestModelListing(url, { [TOKEN_HEADER]: token }, signal),
    now: () => Date.now(),
    info: (message) => {
      console.info(LOG_TAG, message);
    },
    warn: (message) => {
      console.warn(LOG_TAG, message);
    },
  });

  /** Danh sách đã báo chẩn đoán — mỗi danh sách chỉ báo các mục bị che MỘT lần. */
  let loggedListing: ModelListing | undefined;

  /**
   * Phân giải danh mục cho MỘT khung nhìn, và báo các mục bị che một lần cho mỗi danh sách.
   * Nhận: khung nhìn của đệm danh sách.
   * Trả: ảnh chụp kết nối đầy đủ (`models` = danh mục đã phân giải, `catalog` = toàn bộ kết quả).
   */
  const connectionOf = (view: CatalogView): AccountConnection => {
    const resolved = settings();
    const result = resolveAccountCatalog({
      listing: view.listing?.entries,
      supported,
      overrides: resolved.modelOverrides,
      routeMaxTokens: resolved.protocol.maxTokens,
      clientVersion: APP_IDENTITY.version,
    });
    if (view.listing !== loggedListing) {
      loggedListing = view.listing;
      for (const problem of result.problems) console.warn(LOG_TAG, problem);
    }
    return {
      ...resolved.protocol,
      models: result.resolution,
      catalog: result,
    };
  };

  const entry: LlmConfigurableProvider = {
    provider: PROVIDER,
    displayName: "DeepSeek Account",
    settingsNs: entryIdOf(ctx) ?? "llm-deepseek-account",
    settingsPath: [],
  };
  const directory = ctx.llm.registerConfigurableProviders([entry]);

  /** Chẩn đoán ghi đè đã công bố lần trước; đổi giá trị mới cập nhật mục provider. */
  let reportedError: string | undefined;

  /**
   * Công bố chẩn đoán `modelOverrides` lên sổ provider (màn Models hiển thị `error`).
   * Nhận: khung nhìn của đệm danh sách.
   * Trả: ảnh chụp kết nối đầy đủ của khung nhìn đó.
   */
  const discovered = (view: CatalogView): AccountConnection => {
    const connection = connectionOf(view);
    const error = connection.catalog.overrideErrors.length === 0
      ? undefined
      : connection.catalog.overrideErrors.join("; ");
    if (error !== reportedError) {
      reportedError = error;
      directory.replace([error === undefined ? entry : { ...entry, error }]);
    }
    return connection;
  };

  registerDeepSeekProvider<AccountConnection>(ctx, PROVIDER, {
    providerName: "DeepSeek Account",
    options: () => connectionOf(catalog.current()),
    connect: async (signal) => connectionOf(await catalog.view(signal)),
    resolveAuth,
    admit: (connection, model) => {
      refuse(model, connection.catalog.refusals.get(model));
    },
    discoverModels: async (provider) => {
      const view = await catalog.view();
      return view.signedIn
        ? discovered(view).catalog.offered.map((model) => catalogModelInfo(provider, model))
        : [];
    },
  });
  ctx.effect(() => () => {
    catalog.dispose();
  }, "llm-deepseek-account: model catalog");
}
