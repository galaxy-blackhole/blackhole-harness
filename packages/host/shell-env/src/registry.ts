/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Sổ đăng ký ctx.shellEnv: giữ các sự thật DSH_* dựng sẵn của shell, cho plugin khác đăng ký
 *      thêm biến kèm quyền sở hữu khoá, và dựng ảnh chụp BẤT BIẾN cho từng lượt gọi tool.
 */

import { Service, type Context } from "@deepseek-ai/cordis";
import { DSH_HOME_ENV, resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { DSH_ENV_PREFIX } from "@deepseek-ai/dsh-shell";

import type { BashEnvContributor, BashEnvVariableInfo, ShellEnvExecution } from "./types.ts";

/** Cấu hình mà sổ đăng ký ĐỌC — đúng một trường của schema Config công khai. */
interface RegistryConfig {
  /** Thư mục home của Galaxy Blackhole; vắng mặt thì rơi về $GBH_HOME, rồi $DSH_HOME, rồi ~/.dsh. */
  dshHome?: string;
}

/**
 * Phân giải thư mục home của harness theo thứ tự ưu tiên của Galaxy Blackhole (task-31, Wave D).
 *
 * Thứ tự: config.dshHome → $GBH_HOME (tên mới) → $DSH_HOME (TƯƠNG THÍCH: bản gốc + script cũ còn đặt
 * biến này) → mặc định của kernel (~/.dsh). Nhờ vậy đổi tên biến môi trường không phá môi trường cũ.
 * @param configHome giá trị dshHome từ config (nếu có).
 * @param env môi trường cần đọc (mặc định process.env; tham số để test).
 * @returns đường dẫn home đã phân giải.
 */
export function resolveHomeDir(configHome?: string, env: Record<string, string | undefined> = process.env): string {
  if (configHome !== undefined && configHome.trim() !== "") return configHome;
  const fromGbh = env.GBH_HOME;
  if (typeof fromGbh === "string" && fromGbh.trim() !== "") return fromGbh;
  // $DSH_HOME là ĐƯỜNG LÙI tương thích (bản gốc + script cũ còn đặt biến này) — xét TƯỜNG MINH từ env
  // truyền vào để test được, rồi mới tới mặc định của kernel (~/.dsh).
  const fromDsh = env.DSH_HOME;
  if (typeof fromDsh === "string" && fromDsh.trim() !== "") return fromDsh;
  return resolveDshHome(undefined);
}

/** Khoá dựng sẵn báo "đang chạy trong shell do DSH quản lý". */
const DSH_SHELL_KEY = DSH_ENV_PREFIX + "SHELL";

/** Khoá dựng sẵn mang id phiên của agent gọi tool. */
const DSH_SESSION_ID_KEY = DSH_ENV_PREFIX + "SESSION_ID";

/** Khoá dựng sẵn mang tên profile đang nạp. */
const DSH_PROFILE_KEY = DSH_ENV_PREFIX + "PROFILE";

/** Khoá dựng sẵn mang thư mục của profile đang nạp. */
const DSH_PROFILE_DIR_KEY = DSH_ENV_PREFIX + "PROFILE_DIR";

/**
 * Tập khoá BỊ GIỮ: sổ đăng ký tự sở hữu, đóng góp của plugin không được chiếm.
 * Bản gốc giữ đúng năm khoá này (bốn khoá DSH_* + DSH_HOME của dsh-home-paths).
 */
const RESERVED_BASH_ENV_KEYS: ReadonlySet<string> = new Set([
  DSH_HOME_ENV,
  DSH_SHELL_KEY,
  DSH_SESSION_ID_KEY,
  DSH_PROFILE_KEY,
  DSH_PROFILE_DIR_KEY,
]);

/** Hình dạng phần ĐUÔI của một khoá hợp lệ: chữ HOA, số, gạch dưới; bắt đầu bằng chữ HOA. */
const BASH_ENV_KEY_SUFFIX = /^[A-Z][A-Z0-9_]*$/;

/**
 * Sổ đăng ký (ctx.shellEnv) các biến DSH_* tin cậy, theo TỪNG lượt thi hành.
 * Không gian tên được dựng lại ở mỗi lời gọi shell của model: executor bỏ mọi giá trị DSH_*
 * có sẵn trong môi trường, rồi bơm ảnh chụp hiện tại của sổ. Các sự thật shell dựng sẵn do
 * chính sổ sở hữu, còn plugin đăng ký thêm được sự thật liệt kê được, với vòng đời theo hiệu
 * ứng của plugin gọi.
 */
export class ShellEnvRegistry extends Service {
  /** Đóng góp đang sống, khoá theo tên đóng góp. */
  private readonly contributors = new Map<string, BashEnvContributor>();

  /** Chủ sở hữu hiện tại của từng khoá DSH_*, khoá theo tên biến. */
  private readonly keyOwners = new Map<string, string>();

  /** Thư mục home của harness đã phân giải — giá trị của DSH_HOME. */
  private readonly dshHome: string;

  /**
   * Dựng và cài dịch vụ ctx.shellEnv.
   * Nhận: context cordis sở hữu dịch vụ + cấu hình home (tuỳ chọn).
   * Trả: thực thể đã đăng ký, với DSH_HOME đã phân giải theo đúng thứ tự ưu tiên của kernel.
   */
  constructor(ctx: Context, config: RegistryConfig = {}) {
    super(ctx, "shellEnv");
    this.dshHome = resolveHomeDir(config.dshHome);
  }

  /**
   * Đăng ký một đóng góp môi trường. Tên và khoá là duy nhất; khoá dựng sẵn bị giữ.
   * Đăng ký được dọn theo fiber của plugin gọi.
   * Nhận: vật khai quyền sở hữu khoá + hàm phân giải theo lượt thi hành.
   * Trả: hàm dọn — gọi để rút đóng góp khỏi sổ.
   */
  register(contributor: BashEnvContributor): () => void {
    const dispose = this.ctx.effect(
      function* (this: ShellEnvRegistry): Generator<() => void, void, void> {
        const registry = this;
        if (contributor.name.trim().length === 0) throw new Error("bash env contributor name must be non-empty");
        if (registry.contributors.has(contributor.name)) {
          throw new Error('bash env contributor "' + contributor.name + '" is already registered');
        }
        const variables = Object.entries(contributor.variables);
        for (const [key, variable] of variables) {
          if (!key.startsWith(DSH_ENV_PREFIX) || !BASH_ENV_KEY_SUFFIX.test(key.slice(DSH_ENV_PREFIX.length))) {
            throw new Error('bash env contributor "' + contributor.name + '" declared invalid key "' + key + '"');
          }
          if (RESERVED_BASH_ENV_KEYS.has(key)) {
            throw new Error('bash env contributor "' + contributor.name + '" cannot own reserved key "' + key + '"');
          }
          if (variable.description.trim().length === 0) {
            throw new Error('bash env contributor "' + contributor.name + '" must describe "' + key + '"');
          }
          const owner = registry.keyOwners.get(key);
          if (owner !== undefined) {
            throw new Error(
              'bash env key "' +
                key +
                '" is already owned by contributor "' +
                owner +
                '"; contributor "' +
                contributor.name +
                '" cannot also own it',
            );
          }
        }
        registry.contributors.set(contributor.name, contributor);
        for (const [key] of variables) registry.keyOwners.set(key, contributor.name);
        yield () => {
          registry.contributors.delete(contributor.name);
          for (const [key] of variables) registry.keyOwners.delete(key);
        };
      }.bind(this),
      "bashEnv.register()",
    );
    return () => void dispose();
  }

  /**
   * Dựng ảnh chụp DSH_* tin cậy cho MỘT lượt thi hành tool.
   * Nhận: lượt thi hành hiện tại (chỉ đọc agent.session.header.id).
   * Trả: vật phủ môi trường BẤT BIẾN, gồm các sự thật dựng sẵn và đóng góp hiện có, sắp theo tên biến.
   */
  collect(execution: ShellEnvExecution): Readonly<Record<string, string>> {
    const values: Record<string, string> = {
      [DSH_HOME_ENV]: this.dshHome,
      [DSH_SHELL_KEY]: "1",
    };
    if (execution.agent !== undefined) values[DSH_SESSION_ID_KEY] = execution.agent.session.header.id;
    const profile = this.ctx.get("profileContext") as { name: string; dir: string } | undefined;
    if (profile !== undefined) {
      values[DSH_PROFILE_KEY] = profile.name;
      values[DSH_PROFILE_DIR_KEY] = profile.dir;
    }
    const ordered = [...this.contributors.values()].sort((left, right) => left.name.localeCompare(right.name));
    for (const contributor of ordered) {
      const resolved = contributor.resolve(execution);
      for (const [key, value] of Object.entries(resolved)) {
        if (!Object.hasOwn(contributor.variables, key)) {
          throw new Error('bash env contributor "' + contributor.name + '" returned undeclared key "' + key + '"');
        }
        if (typeof value !== "string") {
          throw new Error(
            'bash env contributor "' + contributor.name + '" returned a non-string value for "' + key + '"',
          );
        }
        values[key] = value;
      }
    }
    const sorted = Object.entries(values).sort(([left], [right]) => left.localeCompare(right));
    return Object.freeze(Object.fromEntries(sorted));
  }

  /**
   * Liệt kê biến do plugin đóng góp mà KHÔNG chạy hàm phân giải của chúng.
   * Nhận: không.
   * Trả: mảng khai báo đã sắp theo tên biến môi trường.
   */
  list(): BashEnvVariableInfo[] {
    return [...this.contributors.values()]
      .flatMap((contributor) =>
        Object.entries(contributor.variables).map(([key, variable]) => ({
          contributor: contributor.name,
          description: variable.description,
          key,
        })),
      )
      .sort((left, right) => left.key.localeCompare(right.key));
  }
}
