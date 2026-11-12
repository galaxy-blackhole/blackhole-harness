/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Doc cache module cua Node (ESM + CommonJS), do thi phu thuoc, va so module cua mot runtime khi thay the.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Ban ghi bat ky cua Node internals. */
type Any = any;

/** Trang thai module `kErrored` cua Node — giong nhau o moi phien ban duoc ho tro. */
export const MODULE_ERRORED = 5;

/**
 * Giai mot duong dan ve dang THAT (theo lien ket), chiu duoc tep chua ton tai: giai thu muc cha roi noi ten.
 * @param filename - duong dan can giai.
 * @returns Duong dan that.
 * @throws Khi gap loi khac ENOENT.
 */
export function canonicalPath(filename: string): string {
  try {
    return realpathSync(filename);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const parent = dirname(filename);
    if (parent === filename) throw error;
    return resolve(canonicalPath(parent), basename(filename));
  }
}

/**
 * Cac job ma mot module job lien ket toi. Node 24+ co the tra mang; Node 22 giu job cua lan import hong ma
 * lien ket bi tu choi — job nhu vay khong dong gop lien ket nao.
 * @param job - module job.
 * @returns Danh sach job lien ket.
 */
export async function linkedJobs(job: Any): Promise<Any[]> {
  const linked = await Promise.resolve(job.linked).catch((_error: unknown) => []);
  return Array.from(linked as Iterable<Any>);
}

/**
 * Namespace cua mot module job da cache, hoac `undefined` khi khong co hoac lan danh gia da nem.
 * @param job - module job.
 * @returns Namespace, hoac `undefined`.
 */
export function namespaceOf(job: Any): Any {
  if (job?.module === undefined) return undefined;
  if (Reflect.apply(Reflect.get(job.module, "getStatus"), job.module, []) === MODULE_ERRORED) return undefined;
  try {
    return job.module.getNamespace();
  } catch (_error) {
    return undefined;
  }
}

/** Cache CommonJS tuong thich Node; worker dong goi cai `require` ma khong lo cache nay. */
export function commonJsCache(): Record<string, Any> {
  return Reflect.get(createRequire(import.meta.url), "cache") ?? {};
}

/**
 * Moi module job trong cache cua loader (Node's `LoadCache` anh xa moi URL toi job theo tung dinh dang).
 * @param internal - bo giao dien Node internals.
 * @returns Cac module job.
 */
export function* moduleJobs(internal: Any): Generator<Any> {
  for (const value of (Map.prototype.values as Any).call(internal.loadCache)) {
    yield* Object.values(value as Record<string, Any>).filter((job) => job !== undefined);
  }
}

/**
 * Thu thap DE QUY moi phu thuoc module cua mot ModuleJob.
 * Bo qua builtin `node:`, va bo qua `node_modules` tru khi `includeNodeModules` duoc bat.
 * @param job - module job goc.
 * @param ignored - tap URL da bi tu choi (khong duyet tiep).
 * @param includeNodeModules - co duyet ca module trong `node_modules` khong.
 * @returns Tap URL cua cac module phu thuoc.
 */
export async function loadDependencies(job: Any, ignored: Set<string> = new Set(), includeNodeModules = false): Promise<Set<string>> {
  const dependencies = new Set<string>();
  async function traverse(current: Any): Promise<void> {
    if (ignored.has(current.url) || dependencies.has(current.url)) return;
    if (current.url.startsWith("node:") || (!includeNodeModules && current.url.includes("/node_modules/"))) return;
    dependencies.add(current.url);
    const children = await linkedJobs(current);
    await Promise.all(children.map(traverse));
  }
  await traverse(job);
  return dependencies;
}

/** Ten entry co namespace phan biet; vong lap bo qua namespace chua nap chi khi ten co nhieu namespace. */
export class EntryNamespaces {
  /** Bo giao dien Node internals. */
  internal: Any;
  /** URL cua tung namespace da nap. */
  moduleUrls: Map<Any, string>;
  /** Namespace theo ten entry. */
  names = new Map<string, Set<Any>>();

  /**
   * Dung mot bo gom namespace theo ten entry.
   * @param internal - bo giao dien Node internals.
   * @param moduleUrls - URL cua tung namespace da nap.
   */
  constructor(internal: Any, moduleUrls: Map<Any, string>) {
    this.internal = internal;
    this.moduleUrls = moduleUrls;
  }

  /**
   * Doc URL cua tung namespace da nap tu cache cua loader.
   * @param internal - bo giao dien Node internals.
   * @returns Anh xa namespace sang URL.
   */
  static getModuleUrls(internal: Any): Map<Any, string> {
    const moduleUrls = new Map<Any, string>();
    for (const url of (Map.prototype.keys as Any).call(internal.loadCache) as Iterable<string>) {
      const job = (Map.prototype.get as Any).call(internal.loadCache, url);
      if (!job?.module) continue;
      try {
        moduleUrls.set(job.module.getNamespace(), url);
      } catch (_error) {}
    }
    return moduleUrls;
  }

  /**
   * Them mot namespace duoi mot ten entry.
   * @param name - ten entry (tu tuy chon cua Loader).
   * @param moduleNamespace - namespace cua module.
   * @returns Chinh bo gom nay.
   */
  add(name: string, moduleNamespace: Any): this {
    const namespaces = this.names.get(name) ?? new Set<Any>();
    namespaces.add(moduleNamespace);
    this.names.set(name, namespaces);
    return this;
  }

  /**
   * Duyet tung cap (ten, namespace) — bo qua namespace chua nap khi ten co nhieu namespace.
   * @returns Vong lap cap.
   */
  *[Symbol.iterator](): Generator<[string, Any]> {
    for (const [name, namespaces] of this.names) {
      for (const moduleNamespace of namespaces) {
        if (moduleNamespace === undefined && namespaces.size > 1) continue;
        yield [name, moduleNamespace];
      }
    }
  }

  /**
   * Giai mot ten entry thanh URL module da nap (hoac qua loader khi khong co namespace).
   * @param name - ten entry / specifier.
   * @param baseUrl - base URL cua context so huu.
   * @param moduleNamespace - namespace da nap (khi co).
   * @returns `{ url }` cua module da nap.
   * @throws Khi khong dinh vi duoc module da nap cho ten nay.
   */
  async resolve(name: string, baseUrl: string, moduleNamespace: Any): Promise<{ url: string }> {
    if (moduleNamespace === undefined || name.startsWith("cordis:")) {
      switch (this.internal.version) {
        case "v1":
          return await this.internal.resolve(name, baseUrl, {});
        case "v2":
          return await this.internal.resolveSync(baseUrl, { specifier: name, attributes: {} });
      }
    }
    const url = this.moduleUrls.get(moduleNamespace);
    if (url === undefined) throw new Error(`HMR cannot locate the loaded module for ${name} from ${baseUrl}`);
    return { url };
  }
}

/** Entry module cua MOT runtime, khoa theo namespace GOC qua lan thay the. */
export class ReloadModules {
  /** Module theo namespace goc. */
  modules = new Map<Any, { filename: string; moduleNamespace: Any; plugin: Any }>();

  /**
   * Gop mot module job vao lan thay the cua plugin (hoac runtime) da co.
   * @param reloads - so lan thay the dang lap.
   * @param plugin - plugin dang chay.
   * @param job - module job can gop.
   * @param runtime - runtime cua plugin (khi co).
   * @returns `true` khi da gop.
   */
  static include(reloads: ReadonlyMap<Any, Any>, plugin: Any, job: Any, runtime: Any): boolean {
    let info = reloads.get(plugin);
    if (info === undefined && runtime) info = [...reloads.values()].find((candidate) => candidate.runtime === runtime);
    if (info === undefined) return false;
    info.modules.add(job, plugin);
    return true;
  }

  /**
   * Them mot module job vao so module cua runtime.
   * @param job - module job (phai da co module).
   * @param plugin - plugin ma module xuat ra.
   * @returns Chinh so nay.
   */
  add(job: Any, plugin: Any): this {
    assert(job.module, `HMR pending module is missing: ${job.url}`);
    const moduleNamespace = job.module.getNamespace();
    this.modules.set(moduleNamespace, { filename: job.url, moduleNamespace, plugin });
    return this;
  }

  /**
   * Nap lai moi module con lai cua runtime (tru module chinh da nap).
   * @param loader - Loader cua kernel.
   * @param getOuterStack - ham giu khung stack ngoai.
   * @param primary - module chinh cua lan thay the.
   * @returns Bo module thay the, khoa theo namespace GOC.
   */
  async importRemaining(loader: Any, getOuterStack: () => string[], primary: { filename: string; moduleNamespace: Any; plugin: Any }): Promise<ReloadModules> {
    const replacements = new ReloadModules();
    for (const [originalNamespace, { filename }] of this.modules) {
      if (filename === primary.filename) {
        replacements.modules.set(originalNamespace, primary);
        continue;
      }
      const moduleNamespace = await loader.import(filename, getOuterStack);
      const plugin = loader.unwrapExports(moduleNamespace);
      replacements.modules.set(originalNamespace, { filename, moduleNamespace, plugin });
    }
    return replacements;
  }

  /**
   * Duyet cac cap (fiber cu, plugin thay the) can chay lai; nem khi mot plugin khong co entry ma viec thay the
   * la MO HO.
   * @param ctx - context cua service.
   * @param plugin - plugin thay the mac dinh.
   * @param fibers - cac fiber cu cua runtime.
   * @returns Vong lap cap (fiber cu, implementation).
   */
  *getActiveImplementations(ctx: Any, plugin: Any, fibers: readonly any[]): Generator<[any, Any]> {
    const callbacks = new Set([...this.modules.values()].map((value) => ctx.registry.resolve(value.plugin)));
    const implementations = fibers.map((previousFiber) => {
      if (previousFiber.entry === undefined) return [previousFiber, plugin] as const;
      const replacement = this.modules.get(previousFiber.moduleNamespace);
      const implementation = replacement ? replacement.plugin : ctx.loader.unwrapExports(previousFiber.moduleNamespace);
      callbacks.add(ctx.registry.resolve(implementation));
      return [previousFiber, implementation] as const;
    });
    for (const [previousFiber, implementation] of implementations) {
      if (previousFiber.fiber.parent.fiber.uid === null) continue;
      if (previousFiber.entry === undefined && callbacks.size > 1) {
        throw new Error("HMR replacement is ambiguous for a plugin instance without a Loader entry");
      }
      yield [previousFiber, implementation];
    }
  }

  /**
   * Cap nhat namespace cua cac entry Loader sang namespace MOI, de lan sau con tim duoc.
   * @param loader - Loader cua kernel.
   */
  updateEntries(loader: Any): void {
    for (const [originalNamespace, { moduleNamespace }] of this.modules) {
      for (const entry of loader.entries()) if (entry.moduleNamespace === originalNamespace) entry.moduleNamespace = moduleNamespace;
    }
  }
}

/**
 * Thu muc cua cac mapping profile va cac goc lien ket cua mot runtime resolution, o MOI cach viet that cua
 * nhung duong dan ton tai, moi duong dan kem dau phan cach cuoi.
 * @param resolution - resolution da publish (neu co).
 * @returns Tap thu muc (rong khi chua co resolution).
 */
export function mappedDirectories(resolution: Any): Set<string> {
  const directories = new Set<string>();
  if (resolution === undefined) return directories;
  const dirs = [
    ...resolution.entries.filter((entry: Any) => entry.scope === "profile").map((entry: Any) => entry.packageDir),
    ...resolution.linkedRoots.map((root: Any) => root.realPath),
  ];
  for (const dir of dirs) for (const spelling of existsSync(dir) ? realSpellings(dir) : [dir]) directories.add(spelling + sep);
  return directories;
}

/**
 * Cach viet that cua mot duong dan: ban JavaScript va ban native (worker dong goi khong co realpath native).
 * @param path - duong dan dang ton tai.
 * @returns Cac cach viet khac nhau.
 */
export function realSpellings(path: string): string[] {
  const native = Reflect.get(realpathSync, "native");
  return [realpathSync(path), ...(typeof native === "function" ? [String(Reflect.apply(native, realpathSync, [path]))] : [])];
}

/**
 * Thu muc that (kem dau phan cach) cua profile va cua cac dich ma package lien ket tro toi, o ca hai cach viet.
 * @param dir - thu muc profile.
 * @returns Cac goc profile.
 */
export function profileRoots(dir: string): string[] {
  const modules = join(realpathSync(dir), "node_modules");
  const linked = (existsSync(modules) ? readdirSync(modules) : [])
    .flatMap((name) => (name.startsWith("@") ? readdirSync(join(modules, name)).map((child) => join(modules, name, child)) : [join(modules, name)]))
    .filter((path) => lstatSync(path).isSymbolicLink() && existsSync(path));
  return [...new Set([dir, ...linked].flatMap((path) => realSpellings(path)).map((root) => root + sep))];
}

/**
 * Moi `package.json` tu thu muc cua mot module len toi goc profile (hoac dich lien ket) chua no.
 * @param url - URL cua module.
 * @param roots - cac goc (kem dau phan cach) gioi han viec do.
 * @returns Duong dan cac manifest, tu gan toi xa.
 */
export function packageManifests(url: string, roots: readonly string[]): string[] {
  const manifests: string[] = [];
  const contains = (directory: string) => roots.some((root) => (directory + sep).startsWith(root));
  for (let directory = dirname(fileURLToPath(url)); contains(directory); directory = dirname(directory)) {
    const candidate = join(directory, "package.json");
    if (existsSync(candidate)) manifests.push(candidate);
  }
  return manifests;
}

/** Doc danh sach ten tep trong mot thu muc (tien ich cho test/chan doan; khong dung trong duong nong). */
export async function listDirectory(dir: string): Promise<string[]> {
  return (await readdir(dir)) as string[];
}
