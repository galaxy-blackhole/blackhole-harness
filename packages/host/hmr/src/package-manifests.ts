/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Lam HET HAN cau hinh package ma Node da cache cho cac thu muc package co manifest doi.
 */
import { createRequire, isBuiltin } from "node:module";
import { isUtf8 } from "node:buffer";
import { readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, sep, toNamespacedPath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Kieu ham thay the cua Node internals. */
type AnyFn = (...args: any[]) => any;

/**
 * Kiem mot chuoi co "well-formed" (khong co nua doi tuong UTF-16 le) hay khong — thay `String.prototype.isWellFormed`
 * (lib cua cong typecheck khong bat ES2024).
 * @param value - chuoi can kiem.
 * @returns `true` khi moi cap surrogate deu tron ven.
 */
function isWellFormedString(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}

/** Bo ba ham cua Node internals ma ta thay the, kem ban goc. */
interface ReplaceHelper {
  /** Ban goc cua tung method (de tra lai). */
  rawImpl: Record<string, any>;
  /**
   * Thay mot method va tra ham hoan nguyen — hoan nguyen CHI khi method hien tai van la ban thay the.
   * @param key - ten method.
   * @param replacement - ban thay the.
   * @returns Ham hoan nguyen.
   */
  replaceMethod(key: string, replacement: AnyFn): () => void;
}

/**
 * Chup cac method rieng cua mot object; moi disposer chi tra method VE khi ban thay the con dang duoc cai.
 * @param target - object cua Node internals.
 * @returns Ban goc + ham thay method co the hoan nguyen.
 */
function createReplaceHelper(target: Record<string, any>): ReplaceHelper {
  const rawImpl = { ...target } as Record<string, any>;
  return {
    rawImpl,
    replaceMethod(key, replacement) {
      target[key] = replacement;
      return () => {
        if (target[key] === replacement) target[key] = rawImpl[key];
      };
    },
  };
}

/**
 * Tra mot module noi bo cua Node: `--expose-internals` truoc, roi toi addon builtin.
 * @param id - specifier noi bo (vi du `internal/bootstrap/realm`).
 * @returns Module noi bo, hoac `undefined` khi khong lay duoc.
 */
function requireInternal(id: string): any {
  const require = createRequire(import.meta.url);
  if (process.execArgv.includes("--expose-internals")) {
    try {
      return require(id);
    } catch (_error) {}
  }
  try {
    return require("node-addon-require-builtin").requireBuiltin(id);
  } catch (_error) {}
}

/** Bo giao dien Node internals ma HMR can de lam het han cau hinh package. */
export interface NodeInternals {
  /** Binding `modules` cua realm. */
  binding: Record<string, any>;
  /** Bo doc package.json noi bo. */
  reader: Record<string, any>;
  /** Lop cache giai ma cua ESM loader. */
  ResolveCache: new () => { get: AnyFn };
  /** Lop Module cua CommonJS loader. */
  cjs: Record<string, any>;
  /** Loader ESM dang dung. */
  esmLoader: any;
}

/**
 * Nap bo giao dien Node internals can thiet cho viec lam het han cau hinh package.
 * @returns Cac doi tuong noi bo cua Node.
 * @throws Khi khong nap duoc (thieu `--expose-internals` va thieu addon builtin).
 */
export function loadNodeInternals(): NodeInternals {
  const realm = requireInternal("internal/bootstrap/realm");
  const esm = requireInternal("internal/modules/esm/loader");
  return {
    binding: realm.internalBinding("modules"),
    reader: requireInternal("internal/modules/package_json_reader"),
    ResolveCache: requireInternal("internal/modules/esm/module_map").ResolveCache,
    cjs: requireInternal("internal/modules/cjs/loader").Module,
    esmLoader: esm.getOrInitializeCascadedLoader(),
  };
}

/**
 * Doc cache giai ma cua ESM loader bang cach quan sat MOT luot tra cuu qua prototype; prototype duoc tra lai
 * truoc khi ham tron.
 * @param native - bo giao dien Node internals.
 * @param parentURL - URL cha dung cho luot tra cuu `node:path`.
 * @returns Cache giai ma da quan sat, hoac `undefined` khi khong quan sat duoc.
 */
function captureEsmResolveCache(native: NodeInternals, parentURL: string): any {
  const prototype = native.ResolveCache.prototype as { get: AnyFn };
  const original = prototype.get;
  const seen = new Set<any>();
  prototype.get = function (this: any, key: any, parent: any) {
    seen.add(this);
    return Reflect.apply(original, this, [key, parent]);
  };
  try {
    const loader = native.esmLoader;
    if ("getOrCreateModuleJob" in loader) loader.resolveSync(parentURL, { specifier: "node:path", attributes: {} });
    else loader.resolveSync("node:path", parentURL, {});
  } finally {
    prototype.get = original;
  }
  return [...seen][0];
}

/** Cau hinh package doc tu dia thay vi tu cache cua Node. */
interface PackageConfiguration {
  /** Truong da chuan hoa. */
  data: { name?: string; main?: string; type: string; exports?: unknown; imports?: unknown };
  /** Mang tuan tu ma Node dung lam khoa cache. */
  serialized: unknown[];
}

/**
 * Bo doc manifest `package.json` cua Node: cache cau hinh theo duong dan, cam hook doc package de HMR thay
 * manifest vua doi, va hoan nguyen duoc moi hook da cai.
 * Nhan: khong (lop tu giu cache va bo doc goc); `invalidate(manifest)` nhan duong dan tuyet doi cua manifest vua doi.
 * Tra: `readCachedPackageConfig`/`findNearestPackageConfig` tra cau hinh package (hoac `undefined`);
 *   `installPackageHooks` tra bo giao dien Node internals da cam hook.
 */
export class PackageManifests {
  /** Thu muc da lam het han. */
  directories = new Set<string>();

  /** Cau hinh doc tu dia theo duong dan. */
  configurations = new Map<string, PackageConfiguration | undefined>();

  /** Thu muc that cua tung thu muc ma mot luot tra cuu da cham toi. */
  realDirectories = new Map<string, string>();

  /** Bo giao dien Node internals, khi da cai hook. */
  native: NodeInternals | undefined;

  /** Ban goc cua binding. */
  rawBinding: Record<string, any> = {};

  /** Ban goc cua bo doc package. */
  rawReader: Record<string, any> = {};

  /** Ban goc cua CommonJS loader. */
  rawCommonJs: Record<string, any> = {};

  /** Cac ham hoan nguyen da dang ky. */
  restorers: (() => void)[] = [];

  /**
   * Lam het han cau hinh da cache cho MOT thu muc package. Module da nap van giu ket qua danh gia; cac lan giai
   * ma va kiem tra dinh dang sau do doc manifest tren dia.
   * @param manifest - duong dan tuyet doi cua `package.json` vua doi.
   */
  invalidate(manifest: string): void {
    const native = this.installPackageHooks();
    const directory = dirname(manifest);
    this.directories.add(directory);
    this.configurations.clear();
    this.realDirectories.clear();
    for (const key of Object.keys((native.cjs._pathCache ?? {}) as Record<string, unknown>)) Reflect.deleteProperty(native.cjs._pathCache, key);
    const cache = captureEsmResolveCache(native, pathToFileURL(directory).href + "/");
    if (cache !== undefined) (Map.prototype.clear as AnyFn).call(cache);
  }

  /** Tra lai moi method cua Node ma thuc the nay da thay. */
  dispose(): void {
    for (const restore of this.restorers.splice(0).reverse()) restore();
    this.native = undefined;
    this.realDirectories.clear();
  }

  /**
   * Kiem mot duong dan co nam trong mot thu muc hay khong.
   * @param path - duong dan can kiem.
   * @param directory - thu muc moc.
   * @returns `true` khi nam trong (hoac bang).
   */
  isPathWithinDirectory(path: string, directory: string): boolean {
    return path === directory || path.startsWith(join(directory, sep));
  }

  /**
   * Kiem mot duong dan co thuoc thu muc da lam het han hay khong (giai thu muc cha ve dang that).
   * @param path - duong dan tep.
   * @returns `true` khi thuoc.
   */
  isPathInInvalidatedDirectory(path: string): boolean {
    const parent = dirname(path);
    let real = this.realDirectories.get(parent);
    if (real === undefined) {
      try {
        real = realpathSync(parent);
      } catch (_error) {
        real = parent;
      }
      this.realDirectories.set(parent, real);
    }
    const target = join(real, basename(path));
    for (const directory of this.directories) if (this.isPathWithinDirectory(target, directory)) return true;
    return false;
  }

  /**
   * Kiem mot URL co thuoc thu muc da lam het han hay khong.
   * @param url - URL module.
   * @returns `true` khi thuoc (URL khong phai `file:` thi `false`).
   */
  isUrlInInvalidatedDirectory(url: string): boolean {
    try {
      return this.isPathInInvalidatedDirectory(fileURLToPath(url));
    } catch (_error) {
      return false;
    }
  }

  /**
   * Cai cac hook doc manifest (chi mot lan) va tra bo giao dien Node internals.
   * @returns Bo giao dien Node internals da cai hook.
   */
  installPackageHooks(): NodeInternals {
    if (this.native !== undefined) return this.native;
    const native = loadNodeInternals();
    this.native = native;
    const binding = createReplaceHelper(native.binding);
    const reader = createReplaceHelper(native.reader);
    const commonJs = createReplaceHelper(native.cjs);
    this.rawBinding = binding.rawImpl;
    this.rawReader = reader.rawImpl;
    this.rawCommonJs = commonJs.rawImpl;
    this.restorers.push(
      binding.replaceMethod("readPackageJSON", this.hookBindingReadPackageJSON.bind(this)),
      binding.replaceMethod("getPackageScopeConfig", this.hookBindingGetPackageScopeConfig.bind(this)),
      binding.replaceMethod("getPackageType", this.hookBindingGetPackageType.bind(this)),
      reader.replaceMethod("getNearestParentPackageJSON", this.hookReaderGetNearestParentPackageJSON.bind(this)),
      commonJs.replaceMethod("_load", this.hookCommonJsLoad.bind(this)),
    );
    return native;
  }

  /**
   * Hook `Module._load`: giai ten truoc khi nap, de tep trong thu muc da lam het han duoc danh gia lai.
   * @param request - ten module duoc yeu cau.
   * @param parent - module cha.
   * @param isMain - co phai module chinh khong.
   * @param options - cac tham so con lai cua Node.
   * @returns Ket qua cua ban goc.
   */
  hookCommonJsLoad(...[request, parent, isMain, ...options]: any[]): any {
    const native = this.installPackageHooks();
    const filename = request.startsWith("node:") || isBuiltin(request) ? request : native.cjs._resolveFilename(request, parent, isMain);
    return this.rawCommonJs._load.call(native.cjs, filename, parent, isMain, ...options);
  }

  /**
   * Hook `readPackageJSON`: thu muc da lam het han thi doc tu dia, con lai dung ban goc.
   * @param path - duong dan manifest.
   * @param isEsm - co phai luot doc cho ESM khong.
   * @param base - URL cha (khi co).
   * @param specifier - specifier dang import (khi co).
   * @returns Ban serialized cua cau hinh package.
   */
  hookBindingReadPackageJSON(path: string, isEsm: boolean, base?: string, specifier?: string): any {
    return this.isPathInInvalidatedDirectory(path)
      ? this.readCachedPackageConfig(path, isEsm && base !== undefined ? { base, specifier } : undefined)?.serialized
      : this.rawBinding.readPackageJSON(path, isEsm, base, specifier);
  }

  /**
   * Hook `getPackageScopeConfig`: tra cau hinh package gan nhat doc tu dia khi thu muc da lam het han.
   * @param url - URL can tra.
   * @returns Ban serialized hoac duong dan cua manifest ngoai vung lam het han.
   */
  hookBindingGetPackageScopeConfig(url: string): any {
    if (!this.isUrlInInvalidatedDirectory(url)) return this.rawBinding.getPackageScopeConfig(url);
    const found = this.findNearestPackageConfig(fileURLToPath(url), true);
    if (typeof found === "string") return this.rawBinding.getPackageScopeConfig(pathToFileURL(found).href);
    return found.configuration?.serialized ?? found.path;
  }

  /**
   * Hook `getPackageType`: tra `type` cua package gan nhat doc tu dia khi thu muc da lam het han.
   * @param url - URL can tra.
   * @returns Kieu module (`module` · `commonjs` · `none`).
   */
  hookBindingGetPackageType(url: string): any {
    if (!this.isUrlInInvalidatedDirectory(url)) return this.rawBinding.getPackageType(url);
    const found = this.findNearestPackageConfig(fileURLToPath(url), true);
    return typeof found === "string" ? this.rawBinding.getPackageType(pathToFileURL(found).href) : found.configuration?.data.type;
  }

  /**
   * Hook `getNearestParentPackageJSON`: doc manifest gan nhat tu dia khi duong dan da lam het han.
   * @param path - duong dan tep.
   * @returns Manifest dang `{ data, exists, path }` hoac ket qua cua ban goc.
   */
  hookReaderGetNearestParentPackageJSON(path: string): any {
    if (!this.isPathInInvalidatedDirectory(path)) return this.rawReader.getNearestParentPackageJSON(path);
    const found = this.findNearestPackageConfig(path, false);
    if (typeof found === "string") return this.rawReader.getNearestParentPackageJSON(found);
    if (found.configuration === undefined) return this.rawReader.getNearestParentPackageJSON(path);
    return { data: found.configuration.data, exists: true, path: found.path };
  }

  /**
   * Doc cau hinh package tu dia, co nho theo duong dan manifest.
   * @param path - duong dan manifest.
   * @param context - chi tiet import cua ESM (chi dung khi bao cau hinh khong hop le).
   * @returns Cau hinh, hoac `undefined` khi tep khong doc duoc.
   */
  readCachedPackageConfig(path: string, context?: { base: string; specifier?: string }): PackageConfiguration | undefined {
    if (!this.configurations.has(path)) this.configurations.set(path, this.readPackageConfigFromDisk(path, context));
    return this.configurations.get(path);
  }

  /**
   * Manifest gan nhat: chuoi la ten manifest DAU TIEN nam NGOAI cac thu muc da lam het han (Node tra loi ho),
   * object la cau hinh doc tu dia.
   * @param path - duong dan tep moc.
   * @param includeRoot - co xet ca thu muc goc dia khong.
   * @returns Duong dan manifest hoac cau hinh da doc.
   */
  findNearestPackageConfig(path: string, includeRoot: boolean): string | { path: string; configuration?: PackageConfiguration } {
    let directory = dirname(path);
    while (true) {
      const manifest = join(directory, "package.json");
      const parent = dirname(directory);
      if (basename(directory) === "node_modules" || (!includeRoot && parent === directory)) return { path: manifest };
      if (!this.isPathInInvalidatedDirectory(manifest)) return manifest;
      const configuration = this.readCachedPackageConfig(manifest);
      if (configuration !== undefined) return { path: toNamespacedPath(manifest), configuration };
      if (parent === directory) return { path: manifest };
      directory = parent;
    }
  }

  /**
   * Doc va chuan hoa mot manifest tu dia, theo dung luat cua Node (nem `ERR_INVALID_PACKAGE_CONFIG` khi hong).
   * @param path - duong dan manifest.
   * @param context - chi tiet import cua ESM, chi dung trong thong diep loi.
   * @returns Cau hinh da chuan hoa, hoac `undefined` khi tep khong doc duoc.
   */
  readPackageConfigFromDisk(path: string, context?: { base: string; specifier?: string }): PackageConfiguration | undefined {
    let bytes: Buffer;
    try {
      bytes = readFileSync(path);
    } catch (_error) {
      return undefined;
    }
    const throwInvalidPackageConfig = () => {
      const base = context?.base;
      const importing = base === undefined ? "" : ` while importing "${context?.specifier}" from ${base.startsWith("file:") ? fileURLToPath(base) : base}`;
      throw Object.assign(new Error(`Invalid package config ${toNamespacedPath(path)}${importing}.`), { code: "ERR_INVALID_PACKAGE_CONFIG" });
    };
    if (!isUtf8(bytes)) return throwInvalidPackageConfig();
    const source = bytes.toString("utf8");
    let parsed: any;
    try {
      parsed = JSON.parse(source.charCodeAt(0) === 65279 ? source.slice(1) : source);
    } catch (_error) {
      return throwInvalidPackageConfig();
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return throwInvalidPackageConfig();
    const fields = parsed as Record<string, any>;
    if (fields.name !== undefined && typeof fields.name !== "string") return throwInvalidPackageConfig();
    if (fields.type !== undefined && typeof fields.type !== "string") return throwInvalidPackageConfig();
    for (const key of ["name", "type", "exports", "imports"]) {
      const value = fields[key];
      if (typeof value === "string" && !isWellFormedString(value)) return throwInvalidPackageConfig();
    }
    const normalizePackageJsonField = (value: unknown) => (value !== null && (typeof value === "string" || typeof value === "object") ? value : undefined);
    const data: PackageConfiguration["data"] = {
      ...(typeof fields.name === "string" ? { name: fields.name } : {}),
      ...(typeof fields.main === "string" && isWellFormedString(fields.main) ? { main: fields.main } : {}),
      type: fields.type === "module" || fields.type === "commonjs" ? fields.type : "none",
      exports: normalizePackageJsonField(fields.exports),
      imports: normalizePackageJsonField(fields.imports),
    };
    const serializePackageJsonField = (value: unknown) => (value === undefined ? undefined : typeof value === "string" ? value : JSON.stringify(value));
    return {
      data,
      serialized: [
        data.name,
        data.main,
        data.type,
        serializePackageJsonField(data.imports),
        serializePackageJsonField(data.exports),
        toNamespacedPath(path),
      ],
    };
  }
}
