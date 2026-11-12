/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dịch vụ settings: chiếu schema Config của từng plugin trong profile thành biểu mẫu chỉ gồm
 *      trường sống, giữ revision cho từng entry, và ghi thay đổi qua tệp patch của profile.
 */
import { existsSync } from "node:fs";
import { readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { Service, type Context } from "@deepseek-ai/cordis";
import { interpolate } from "@deepseek-ai/cordis-plugin-loader";

import { cloneJsonShaped, applyPathOp, inheritedConfig, isPlainObject, member, mergeLayers } from "./paths.ts";
import { redactSecrets } from "./redact.ts";
import { isVolatilePath, plainConfig, projectForm, volatileForm } from "./schema.ts";
import type {
  SettingsDescriptor,
  SettingsDescribeOptions,
  SettingsEntry,
  SettingsHost,
  SettingsNamespace,
  SettingsPathOp,
  SettingsPresentation,
  SchemaLike,
} from "./types.ts";

/** Id của những mục settings.yaml đã bị bỏ, ánh xạ sang id entry đang sở hữu chúng. */
const LEGACY_SECTION_ENTRIES: Record<string, string> = {
  "ui-developer-tools": "ui-settings",
  "ui-onboarding": "ui-settings-general",
  shell: process.platform === "win32" ? "pwsh-sandbox" : "bash-sandbox",
};

/** Một dòng của sổ revision cho một entry. */
interface Revision {
  /** Ảnh chụp thô (uid + schema JSON + cấu hình) mà revision này gắn với. */
  raw: string | undefined;
  /** Số revision đơn điệu tăng của entry. */
  revision: number;
  /** Khoá namespace (options.id của entry). */
  ns: string;
  /** Chính sách trang tự động đang áp. */
  autoGenerate: boolean;
}

/**
 * Nhìn context cordis qua đúng góc hẹp mà lớp dịch vụ chạm tới.
 * Nhận: context cordis của dịch vụ.
 * Trả: cùng context ấy dưới kiểu SettingsHost (không tạo vật mới, không đổi hành vi).
 */
function hostOf(context: Context): SettingsHost {
  return context as unknown as SettingsHost;
}

/** Từ chối ghi đè cấu hình đã đổi kể từ lúc biểu mẫu được đọc. */
export class SettingsConflictError extends Error {
  /** Mã máy đọc được để tầng wire ánh xạ sang mã riêng của nó. */
  readonly code = "SETTINGS_CONFLICT";
  /** Revision mà lượt ghi kỳ vọng. */
  readonly expected: number;
  /** Revision mà namespace thực sự đang đứng. */
  readonly actual: number;
  /**
   * @param ns - namespace bị từ chối ghi.
   * @param expected - revision mà bên gọi gửi lên.
   * @param actual - revision đang được lưu.
   */
  constructor(ns: SettingsNamespace, expected: number, actual: number) {
    super(
      'settings namespace "' + ns + '" changed since it was read (expected revision ' + String(expected) + ", now " + String(actual) + ")",
    );
    this.name = "SettingsConflictError";
    this.expected = expected;
    this.actual = actual;
  }
}

/** Chiếu schema Config thành biểu mẫu và giữ chính sách trang cho từng thể hiện plugin. */
export class SettingsForms extends Service {
  /** Context sở hữu dịch vụ — nơi tra configEditor, profileContext và loader. */
  private readonly ownerContext: Context;
  /** Hai seam phải sẵn sàng trước khi dịch vụ dùng được. */
  static inject = ["configEditor", "profileContext"];
  /** Sổ revision của từng entry (khoá là id đầy đủ của entry). */
  private revisions = new Map<string, Revision>();
  /** Cờ dịch vụ đã bị dọn theo vòng đời plugin. */
  private closed = false;
  /** Cờ đã hẹn một lượt làm mới trong microtask. */
  private scheduled = false;
  /** Chính sách trang riêng của từng thể hiện plugin. */
  private readonly presentations = new Map<object, SettingsPresentation>();

  /**
   * Đăng ký dịch vụ settings trong context và nối hai hiệu ứng: dọn theo vòng đời + làm mới khi profile nạp lại.
   * Nhận: context sở hữu dịch vụ.
   * Trả: thể hiện dịch vụ; tài liệu settings.yaml cũ được nhập sau khi Loader ổn định (không chặn cấu trúc).
   */
  constructor(ownerContext: Context) {
    super(ownerContext, "settings");
    this.ownerContext = ownerContext;
    const host = hostOf(ownerContext);
    host.effect(() => () => {
      this.closed = true;
    });
    host.on("app-boot/config-reload", () => {
      this.invalidate();
    });
    host.root.loader
      .await()
      .then(() => this.importLegacyDocument())
      .catch((error: unknown) => {
        host.logger.error(error);
      });
  }

  /**
   * Chuyển các mục của settings.yaml đã bị bỏ vào profile đang chạy, sau khi Loader đã ổn định mọi entry.
   * Tệp được đổi tên TRƯỚC lượt ghi đầu tiên nên lượt nhập dở không bao giờ lặp; mục bị composition từ chối
   * được ghi log và chỉ còn nằm trong tệp đã đổi tên.
   * Nhận: không (đọc profileContext của chính dịch vụ).
   * Trả: promise hoàn tất khi mọi mục đã được nhập hoặc đã bị ghi log.
   */
  private async importLegacyDocument(): Promise<void> {
    const profile = hostOf(this.ownerContext).profileContext;
    const path = join(profile.home, "settings.yaml");
    if (!existsSync(path)) return;
    const imported = path + ".imported";
    await rename(path, imported);
    const sections = parse(await readFile(imported, "utf8")) as Record<string, unknown> | null;
    for (const [section, values] of Object.entries(sections ?? {})) {
      const ns = LEGACY_SECTION_ENTRIES[section] ?? section;
      try {
        await this.update(ns, values as object);
      } catch (error) {
        hostOf(this.ownerContext).logger.warn(
          "settings: section %s of %s was not imported into entry %s",
          section,
          imported,
          ns,
        );
        hostOf(this.ownerContext).logger.warn(error);
      }
    }
    hostOf(this.ownerContext).logger.info("settings: imported %s into profile %s", imported, profile.name);
  }

  /**
   * Đăng ký chính sách trang của thể hiện plugin đang gọi mà không đổi Config của nó.
   * Nhận: chính sách trang (auto mặc định true) + thể hiện sở hữu (mặc định fiber đang gọi).
   * Trả: hàm dọn dẹp — đăng ký vào hiệu ứng của plugin đang gọi; ném khi thể hiện đã có chính sách.
   */
  configure(presentation: SettingsPresentation, owner: object = this.ctx.fiber): () => void {
    const fiber = owner;
    if (this.presentations.has(fiber)) throw new Error("Settings presentation is already configured for this plugin instance");
    const policy: SettingsPresentation = { ...presentation };
    this.presentations.set(fiber, policy);
    this.invalidate();
    return () => {
      if (this.presentations.get(fiber) !== policy) return;
      this.presentations.delete(fiber);
      this.invalidate();
    };
  }

  /**
   * Hẹn MỘT lượt đọc lại biểu mẫu trong microtask (gộp nhiều thay đổi trong cùng một vòng).
   * Nhận: không.
   * Trả: không; lỗi của lượt đọc lại được ghi log chứ không ném ra ngoài.
   */
  private invalidate(): void {
    if (this.scheduled || this.closed) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (this.closed || hostOf(this.ownerContext).fiber.state !== 2) return;
      try {
        this.describe();
      } catch (error) {
        hostOf(this.ownerContext).logger.error(error);
      }
    });
  }

  /** Có cho phép sửa biểu mẫu trên profile đang chạy hay không (hiện luôn true, y bản gốc). */
  get writable(): boolean {
    return true;
  }

  /** Tệp patch của profile mà trình sửa cấu hình gốc đang hiển thị. */
  get documentPath(): string {
    return hostOf(this.ownerContext).configEditor.documentPath;
  }

  /**
   * Định vị tệp patch của profile để sửa bằng trình soạn thảo gốc.
   * Nhận: không.
   * Trả: promise của đường dẫn tệp patch đang tồn tại.
   */
  prepareDocument(): Promise<string> {
    return Promise.resolve(this.documentPath);
  }

  /**
   * Đọc schema đang sống của các plugin và giá trị hiện tại của chúng.
   * Nhận: tuỳ chọn che secret (đường wire luôn bật).
   * Trả: một biểu mẫu cho mỗi id entry duy nhất; revision đơn điệu tăng và sự kiện settings/document-updated
   *      được phát mỗi khi ảnh chụp thô hoặc chính sách trang đổi.
   */
  describe(options?: SettingsDescribeOptions): SettingsDescriptor[] {
    const host = hostOf(this.ownerContext);
    const active = new Set<string>();
    const descriptors = host.configEditor.configuration().flatMap(({ entry, inherited, override }): SettingsDescriptor[] => {
      const schema = this.schema(entry);
      if (schema === undefined || entry.fiber === undefined || entry.fiber.runtime === null || entry.fiber.state !== 2) return [];
      const form = volatileForm(schema);
      if (form === undefined) return [];
      active.add(entry.id);
      const raw = JSON.stringify([entry.fiber.uid, schema.toJSON(), entry.options.config ?? {}]);
      const autoGenerate = this.presentations.get(entry.fiber)?.auto ?? true;
      const previous = this.revisions.get(entry.id);
      const revision = previous === undefined ? 0 : previous.revision + Number(previous.raw !== raw);
      this.revisions.set(entry.id, { raw, revision, ns: entry.options.id, autoGenerate });
      if (previous?.raw !== raw || previous.autoGenerate !== autoGenerate) {
        host.emit("settings/document-updated", entry.options.id, revision);
      }
      const value = projectForm(form, plainConfig(entry.fiber.config));
      const resolved = interpolate(entry.fiber.ctx as Context, inherited);
      const base = projectForm(form, plainConfig(inheritedConfig(entry.fiber.runtime, resolved)));
      const user = projectForm(form, override);
      const redacted = redactSecrets(form, value);
      return [
        {
          autoGenerate,
          ns: entry.options.id,
          schema: form.toJSON(),
          revision,
          applies: "live",
          value: options?.redactSecrets ? redacted.value : value,
          base: options?.redactSecrets ? redactSecrets(form, base).value : base,
          user: options?.redactSecrets ? redactSecrets(form, user).value : user,
          ...(options?.redactSecrets ? { secrets: redacted.secrets } : {}),
        },
      ];
    });
    for (const [id, previous] of this.revisions) {
      if (active.has(id) || previous.raw === undefined) continue;
      const revision = previous.revision + 1;
      this.revisions.set(id, { ...previous, raw: undefined, revision });
      host.emit("settings/document-updated", previous.ns, revision);
    }
    return descriptors;
  }

  /**
   * Gộp các trường sửa được vào cấu hình của một entry.
   * Nhận: id entry trong profile + các trường cần gộp + revision mà người gọi đọc được (tuỳ chọn).
   * Trả: promise hoàn tất khi tệp patch đã ghi và đối soát xong.
   */
  async update(ns: string, patch: object, expectedRevision?: number): Promise<void> {
    const input = cloneJsonShaped(patch);
    await this.write(ns, (current) => mergeLayers(current, input), expectedRevision);
  }

  /**
   * Đặt lại toàn bộ trường sống rồi ghi các trường được cấp; cấu hình thường được giữ nguyên.
   * Nhận: id entry + giá trị đầy đủ của biểu mẫu + revision kỳ vọng (tuỳ chọn).
   * Trả: promise hoàn tất khi tệp patch đã ghi và đối soát xong.
   */
  async replace(ns: string, section: object, expectedRevision?: number): Promise<void> {
    const input = cloneJsonShaped(section);
    await this.write(ns, (_current, base) => mergeLayers(base, input), expectedRevision);
  }

  /**
   * Áp các phép sửa theo đường dẫn mà KHÔNG phải khai lại trường secret đã bị che; bỏ một chỉ số mảng là xoá phần tử.
   * Nhận: id entry + danh sách phép sửa theo thứ tự + revision kỳ vọng (tuỳ chọn).
   * Trả: promise hoàn tất khi tệp patch đã ghi và đối soát xong.
   */
  async mutate(ns: string, ops: readonly SettingsPathOp[], expectedRevision?: number): Promise<void> {
    await this.write(
      ns,
      (current, base, schema) =>
        ops.reduce<unknown>((value, op) => {
          if (op.op === "set") return applyPathOp(value, op, schema);
          const parent = op.path.slice(0, -1).reduce<unknown>((node, key) => member(node, key), value);
          if (Array.isArray(parent)) return applyPathOp(value, op, schema);
          const inherited = op.path.reduce<unknown>((node, key) => member(node, key, true), base);
          return applyPathOp(
            value,
            inherited === undefined ? op : { op: "set", path: op.path, value: inherited },
            schema,
          );
        }, current),
      expectedRevision,
      ops.map((op) => op.path),
    );
  }

  /**
   * Ghi cấu hình kế tiếp của một entry qua seam configEditor, sau khi kiểm revision và kiểm đường dẫn sống.
   * Nhận: id entry + hàm biến đổi (nhận lớp thô, lớp thừa kế, schema biểu mẫu) + revision kỳ vọng + các đường dẫn bị sửa.
   * Trả: promise hoàn tất khi seam đã ghi xong; ném lỗi nguyên văn của bản gốc ở mọi nhánh từ chối.
   */
  private async write(
    ns: string,
    change: (current: unknown, base: unknown, schema: SchemaLike) => unknown,
    expected?: number,
    paths: readonly (readonly string[])[] = [],
  ): Promise<void> {
    const host = hostOf(this.ownerContext);
    // ⚠️ 20/10/2026 (task-185) — LỖI THẬT: patch của ta mount row bằng `disable + insert <id>-ours`, nên id THẬT
    // trong cây cấu hình là `<id>-ours`, còn UI (bản gốc) vẫn gọi namespace theo id STOCK. Tra khớp CHÍNH XÁC
    // ⇒ không thấy entry ⇒ ném "No configurable plugin entry" ⇒ công tắc cài đặt không lưu được.
    // Nay: tra chính xác trước, rồi tới quy ước `<ns>-ours` của tầng mount.
    const entries = host.configEditor.entries();
    // 21/10/2026 (task-185, mat xich CUOI): voi row bi 'disable + insert <id>-ours', danh sach entry co the
    // chua ca row stock (da disable => KHONG co fiber => khong co schema) lan row dang chay. Tra theo id la
    // chua du - phai chon entry DANG CHAY, tuc entry co schema (fiber.runtime.Config). Do duoc: entry =
    // "ui-settings" nhung coSchema = false => nem "No configurable plugin entry".
    const ungVien = [ns, ns + "-ours"]
      .map((id) => entries.find((row) => row.options.id === id))
      .filter((row) => row !== undefined);
    const entry = ungVien.find((row) => this.schema(row) !== undefined) ?? ungVien[0];
    const schema = entry === undefined ? undefined : this.schema(entry);
    if (entry === undefined || schema === undefined) throw new Error('No configurable plugin entry "' + ns + '"');
    const form = volatileForm(schema);
    if (form === undefined) throw new Error('Plugin entry "' + ns + '" has no volatile fields');
    for (const path of paths) {
      if (path.length && !isVolatilePath(schema, path)) {
        throw new Error('Config field "' + path.join(".") + '" is not volatile');
      }
    }
    await host.configEditor.edit(entry, (raw, inherited) => {
      // Dùng id THẬT của entry đã phân giải (có thể là `<ns>-ours`), không phải `ns` do UI truyền.
      const effectiveNs = entry.options.id;
      // 20/10/2026: descriptor có thể được khai theo id STOCK (schema do gói khác đăng ký, ví dụ ui-settings-account),
      // trong khi entry thật là `<ns>-ours` ⇒ phải thử cả hai chiều, nếu không sẽ ném
      // 'is no longer configurable' và UI vẫn báo "Could not save".
      const descriptor =
        this.describe().find((row) => row.ns === effectiveNs) ?? this.describe().find((row) => row.ns === ns);
      if (descriptor === undefined) throw new Error('Plugin entry "' + ns + '" is no longer configurable');
      if (expected !== undefined && descriptor.revision !== expected) {
        throw new SettingsConflictError(effectiveNs, expected, descriptor.revision);
      }
      const next = cloneJsonShaped(change(projectForm(form, raw), projectForm(form, inherited), schema));
      const validatePaths = (value: Record<string, unknown>, node: SchemaLike, path: string[] = []): void => {
        for (const [key, child] of Object.entries(value)) {
          const target = [...path, key];
          if (isVolatilePath(schema, target)) continue;
          const fields = node.dict as Record<string, SchemaLike>;
          const field = Object.hasOwn(fields, key) ? fields[key] : undefined;
          if (isPlainObject(child) && field !== undefined) validatePaths(child, field, target);
          else throw new Error('Config field "' + target.join(".") + '" is not volatile');
        }
      };
      validatePaths(next, form);
      const strip = (value: unknown, node: SchemaLike, path: string[] = []): Record<string, unknown> => {
        if (isVolatilePath(schema, path)) return {};
        const result: Record<string, unknown> = { ...(value as Record<string, unknown>) };
        for (const [key, field] of Object.entries(node.dict ?? {})) {
          const target = [...path, key];
          if (isVolatilePath(schema, target)) Reflect.deleteProperty(result, key);
          else if (isPlainObject(result[key])) result[key] = strip(result[key], field, target);
        }
        return result;
      };
      return mergeLayers(strip(raw, form), next);
    });
    this.describe();
  }

  /**
   * Đọc schema Config của một entry, chỉ nhận schema thật (có toJSON).
   * Nhận: entry Loader cần đọc.
   * Trả: schema Config đang sống, hoặc undefined khi entry chưa có schema.
   */
  private schema(entry: SettingsEntry): SchemaLike | undefined {
    const schema = entry.fiber?.runtime?.Config;
    return schema !== undefined && "toJSON" in schema ? schema : undefined;
  }
}
