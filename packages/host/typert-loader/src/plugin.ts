/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Thân plugin typert-loader: quét entry của Loader lúc kích hoạt, rồi theo dõi mount/unmount
 *      trong suốt vòng đời plugin. Quét TĂNG DẦN theo tên entry — mỗi lần kernel phát
 *      `internal/plugin` đánh dấu tên của fiber là BẨN, một lượt microtask đối chiếu từng tên bẩn
 *      với entry đang sống; lượt kích hoạt mồi cùng tập bẩn bằng mọi entry hiện có.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import z from "@deepseek-ai/schemastery";
import { TYPERT_HOST_EXPORT, typertExportOf, validateTypertManifest } from "./manifest.ts";
import type { PluginPackagesSeam, TypertContribution, TypertLoaderContext } from "./types.ts";

/** Tên plugin cordis — nguyên văn của bản gốc. */
export const name = "typert-loader";

/** Service bắt buộc trước khi đăng ký: sổ mà plugin này nuôi, và Loader mà nó quan sát. */
export const inject: string[] = ["typert", "loader"];

/** Cấu hình: kiểm tên package tường minh, mặc định chỉ dò theo entry của Loader. */
export interface Config {
  /** Tên package chính xác phải giải được VÀ export `./typert`. */
  packages?: string[];
}

/** Schema cấu hình lúc chạy cho {@link Config}: mảng tên package, mặc định rỗng. */
export const Config: z<Config> = z.object({ packages: z.array(z.string().min(1)).default([]) });

/** Một tệp typert của mặt host đã giải được từ một gói. */
interface TypertArtifact {
  /** Tên package khai trong package.json (có thể khác tên tra cứu của entry). */
  packageName: string;
  /** Đường dẫn tuyệt đối tới tệp typert. */
  path: string;
}

/** Manifest package đọc từ đĩa: chỉ phần bộ nạp này dùng. */
interface PackageManifest {
  /** Tên package, khi manifest khai. */
  name?: unknown;
  /** Khối `exports`, khi manifest khai. */
  exports?: unknown;
}

/**
 * Quét entry của Loader lúc kích hoạt, rồi theo dõi mount/unmount trong suốt vòng đời plugin.
 * @param ctx - context plugin mang `typert` và `loader`.
 * @param config - tệp typert tường minh, thêm vào các entry của Loader.
 * @returns promise hoàn tất khi lượt quét kích hoạt xong; ném khi có gói hỏng.
 * @throws {Error} khi `ctx.baseUrl` chưa đặt — bộ nạp cần neo của cây cấu hình để giải gói.
 * @throws {AggregateError} khi một hoặc nhiều gói đóng góp hỏng ngay ở lượt kích hoạt.
 */
export async function apply(ctx: TypertLoaderContext, config: Config): Promise<void> {
  if (ctx.baseUrl === undefined) {
    throw new Error("typert-loader: ctx.baseUrl is unset — the loader needs the config-tree anchor to resolve plugin packages");
  }
  const baseUrl = ctx.baseUrl;
  const require = createRequire(baseUrl);
  const configured = new Set<string>(config.packages as string[]);
  const registered = new Map<string, () => Promise<void>>();
  const pending = new Map<string, Promise<void>>();
  const artifactPath = new Map<string, TypertArtifact | null>();
  const manifests = new Map<string, Promise<TypertContribution>>();
  const dirty = new Set<string>();
  let flushQueued = false;
  let active = true;
  ctx.effect(function* () {
    yield () => {
      active = false;
      dirty.clear();
    };
  }, "typert loader lifetime");

  /**
   * Giải tệp typert của một gói, CACHE theo tên gói (quyết định không bao giờ hết hạn).
   * @param pkgName - tên entry của Loader, hoặc tên package tường minh.
   * @returns tệp typert đã giải, hoặc `null` khi gói không export `./typert`.
   * @throws khi gói TƯỜNG MINH không giải được hoặc không export `./typert`.
   */
  const resolveArtifact = (pkgName: string): TypertArtifact | null => {
    const cached = artifactPath.get(pkgName);
    if (cached !== undefined) return cached;
    const firstSlash = pkgName.indexOf("/");
    if (firstSlash >= 0 && (pkgName[0] !== "@" || pkgName.indexOf("/", firstSlash + 1) >= 0)) {
      if (configured.has(pkgName)) {
        throw new Error(
          `typert-loader: configured package "${pkgName}" cannot be resolved from the config tree — add it to the composition package dependencies or remove it from packages`,
        );
      }
      artifactPath.set(pkgName, null);
      return null;
    }
    let pkgPath: string;
    let pkg: PackageManifest | undefined;
    try {
      const packages = ctx.get("pluginPackages") as PluginPackagesSeam | undefined;
      const resolvedPackage = packages?.packageOf(pkgName, baseUrl);
      if (packages !== undefined && resolvedPackage === undefined) throw new Error("package is absent from the active resolver");
      pkgPath = resolvedPackage === undefined ? require.resolve(`${pkgName}/package.json`) : resolvedPackage.manifestPath;
      pkg = resolvedPackage?.manifest as PackageManifest | undefined;
    } catch (cause) {
      if (configured.has(pkgName)) {
        throw new Error(
          `typert-loader: configured package "${pkgName}" cannot be resolved from the config tree — add it to the composition package dependencies or remove it from packages`,
          { cause },
        );
      }
      artifactPath.set(pkgName, null);
      return null;
    }
    const manifest = pkg ?? (JSON.parse(readFileSync(pkgPath, "utf8")) as PackageManifest);
    const manifestName = typeof manifest.name === "string" ? manifest.name : pkgName;
    const rel = typertExportOf(manifestName, manifest.exports);
    if (rel === undefined && configured.has(pkgName)) {
      throw new Error(`typert-loader: configured package "${pkgName}" does not export "${TYPERT_HOST_EXPORT}"`);
    }
    const resolved = rel === undefined ? null : { packageName: manifestName, path: join(dirname(pkgPath), rel) };
    artifactPath.set(pkgName, resolved);
    return resolved;
  };

  /**
   * Import mặt typert của một gói và kiểm vật thể của nó; CACHE lời hứa theo tên package.
   * @param pkgName - tên package sở hữu tệp typert.
   * @param path - đường dẫn tuyệt đối tới tệp typert.
   * @returns lời hứa đóng góp đã kiểm.
   */
  const loadManifest = (pkgName: string, path: string): Promise<TypertContribution> => {
    let loading = manifests.get(pkgName);
    if (loading === undefined) {
      loading = import(pathToFileURL(path).href).then(
        (mod) => validateTypertManifest(pkgName, (mod as { TYPERT?: unknown }).TYPERT),
        (cause) => {
          throw new Error(`typert-loader: ${pkgName} exports "${TYPERT_HOST_EXPORT}" but importing ${path} failed: ${String(cause)}`);
        },
      );
      manifests.set(pkgName, loading);
    }
    return loading;
  };

  /**
   * Một tên entry có đáng được nạp typert không: hoặc tường minh, hoặc có entry ĐANG SỐNG.
   * @param entryName - tên package cần xét.
   * @returns `true` khi tên đó là package tường minh hoặc có entry đã mount và chưa tắt.
   */
  const qualifies = (entryName: string): boolean => {
    if (configured.has(entryName)) return true;
    for (const entry of ctx.loader.entries()) {
      if (entry.options.name === entryName && entry.fiber !== undefined && !entry.disabled) return true;
    }
    return false;
  };

  /**
   * Đối chiếu MỘT tên entry với entry đang sống; một lần mount trả về tác vụ bất đồng bộ của nó.
   * @param entryName - tên package cần đối chiếu.
   * @returns tác vụ đăng ký (nếu vừa mount), hoặc `undefined` khi không có việc gì để chờ.
   */
  const processOne = (entryName: string): Promise<void> | undefined => {
    if (!qualifies(entryName)) {
      const dispose = registered.get(entryName);
      if (dispose !== undefined) {
        registered.delete(entryName);
        return dispose();
      }
      return undefined;
    }
    if (registered.has(entryName) || pending.has(entryName)) return undefined;
    const artifact = resolveArtifact(entryName);
    if (artifact === null) return undefined;
    const task = loadManifest(artifact.packageName, artifact.path).then((manifest) => {
      if (!active || !qualifies(entryName) || registered.has(entryName)) return;
      registered.set(entryName, ctx.typert.register(manifest));
    });
    pending.set(entryName, task);
    const settle = (): void => {
      pending.delete(entryName);
    };
    task.then(settle, settle);
    return task;
  };

  /**
   * Đối chiếu MỌI tên đang bẩn rồi xoá dấu bẩn của chúng.
   * @param onError - nơi nhận lỗi của từng tên (không ném ra ngoài vòng lặp).
   * @returns các tác vụ đã bắt lỗi, để người gọi chờ.
   */
  const flush = (onError: (error: Error) => void): Promise<void>[] => {
    const tasks: Promise<void>[] = [];
    for (const entryName of [...dirty]) {
      dirty.delete(entryName);
      try {
        const task = processOne(entryName);
        if (task !== undefined) {
          tasks.push(
            task.catch((error: unknown) => {
              onError(toError(error));
            }),
          );
        }
      } catch (error) {
        onError(toError(error));
      }
    }
    return tasks;
  };

  ctx.on("internal/plugin", (fiber) => {
    const entryName = (fiber as { entry?: { options?: { name?: string } } }).entry?.options?.name;
    if (entryName === undefined) return;
    dirty.add(entryName);
    if (flushQueued) return;
    flushQueued = true;
    queueMicrotask(() => {
      flushQueued = false;
      if (!active) return;
      for (const task of flush((err) => {
        ctx.logger.error(err);
      })) void task;
    });
  });
  for (const packageName of configured) dirty.add(packageName);
  for (const entry of ctx.loader.entries()) dirty.add(entry.options.name);
  const failures: Error[] = [];
  await Promise.all(
    flush((err) => {
      failures.push(err);
    }),
  );
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `typert-loader: ${String(failures.length)} typert contributor(s) failed to register:\n${failures.map((e) => `  - ${e.message}`).join("\n")}`,
    );
  }
}

/**
 * Chuẩn hoá một hỏng hóc bất kỳ (import hoặc manifest) thành `Error`.
 * @param error - giá trị bị ném, có thể không phải `Error`.
 * @returns chính lỗi đó nếu đã là `Error`, ngược lại là `Error` bọc chuỗi của nó.
 */
function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
