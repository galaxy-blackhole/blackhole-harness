/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Port 1:1 'lib/types/index.js' (994 dòng) của @deepseek-ai/dsh-plugin-manager: service Remote `pluginManager` — quản lý plugin/bundle của hồ sơ hiện tại (liệt kê, bật/tắt, cài, chờ, huỷ, gỡ) trên các phép toán pnpm dùng chung.
 *      11/11/2026: `listBundles` chuyển thân sang `list-bundles.ts` (tệp này ở 998/1000 dòng) — lý do: trang Plugins
 *      liệt kê SAI gói lõi stock `@deepseek-ai/dsh-terminal` vào nhóm "Plugin đã cài" kèm badge đỏ "Trục trặc".
 */

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { Context } from "@deepseek-ai/cordis";
import type { EntryOptions } from "@deepseek-ai/cordis-plugin-loader";
import {
  OFFICIAL_ON_DEMAND_CATALOG, OPTIONAL_BUNDLES, PROFILE_COMPATIBILITY_FILENAME, ResolutionRestartRequired,
  bundlePatchPaths, composeEntries, evaluatePluginCompatibility, getDshRuntimeVersion, loadOverlayPatches,
  readPluginMeta, readProfileCompatibility, readProfileManifest, readProfilePatches, readProfileVersionExemptions,
  resolveBundleDir, setProfileVersionExemption,
} from "@deepseek-ai/dsh-app-boot";
import type { OfficialBundleCatalogEntry, ProfileContext, ProfileManifest } from "@deepseek-ai/dsh-app-boot";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { pluginEntryId, readPluginInventory } from "@deepseek-ai/dsh-host-plugin-inventory";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import z from "@deepseek-ai/schemastery";

import { bundleMetaVi, rowDescriptionVi, rowTitleVi, traMetaVi } from "@galaxy-blackhole/gbh-host-bundle-labels";
import { KHONG_HO_TRO, laCungBundle, quyTen, quyTenBundle } from "./bundle-rename.ts";
import { ICON_BUNDLE_GBH } from "@galaxy-blackhole/gbh-host-bundle-labels";
import { listBundlesFor } from "./list-bundles.ts";
import { metaBundle } from "./meta-bundle.ts";
import { BUNDLE_THU_NGHIEM_GBH, entryCatalogThuNghiem, laStockCoBanGbh } from "./catalog-thu-nghiem.ts";

import { approveBuilds, recordPendingBuilds } from "./build-approval.ts";
import { incompatiblePlugin, ManagementFailure } from "./failure.ts";
import { checkGithubConnection } from "./github-connection.ts";
import { classifyInstallFailure } from "./install-failure.ts";
import { InvalidInstallSpecError, dependencySpec, parseInstallSpec } from "./install-spec.ts";
import type { ParsedInstallSpec } from "./install-spec.ts";
import { officialBundleInstallTarget } from "./official-install-target.ts";
import { bundleManifest, readProfileRegistry, registryArguments, runProfilePnpm, saveManifest, viewProfilePackage } from "./operations.ts";
import { flatten, writePluginEnabled } from "./patch.ts";
import { NPMMIRROR_REGISTRY, attributeFailure, normalizeRegistry, registryPlan } from "./registry.ts";
import type {
  BundleInfo, BundleRowInfo, ChangeResult, InspectOptions, InstallBundleOptions, ManagementError, PackageResult,
  PluginEntryId, PluginInfo, PluginInspectProblem, PluginInstallCancellation, PluginInstallRequestId,
  PluginRegistries, PluginSpecInspection, ReadOnlyReason, Registry,
} from "./types.ts";

import {
  ANSI_SEQUENCE, InstallCancelledError, REGISTRY_URL, RESTORED_FILES, bundleSelection, chonBundle, inspectionOf, managementError,
  messageOf, parsedForRegistry, printedError, protectedModules, refused, specPackageName, } from "./manager-support.ts";
import type {
  ChangeReason, ChangeRequest, Config, InstallControl, LiveRow, ManagerContext, RefusedInspection, ReloadOutcome,
  ResolvedConfig,
} from "./manager-support.ts";

/**
 * Quản lý tệp của hồ sơ và áp vòng đời reload mà chúng khai.
 * Nhận: `ctx` — Context sở hữu plugin; `config` — cấu hình row đã kiểm bởi `static Config`.
 * Trả: thể hiện service `pluginManager` đã đăng ký; mọi phương thức `@Remote` là mặt RPC của nó.
 */
export class PluginManager extends TypertRemoteService {
  /** Seam bắt buộc: Loader của kernel và dữ kiện hồ sơ. */
  static inject = ["loader", "profileContext"];

  /** Schema cấu hình — nguyên văn bản gốc (default, pattern, step/min). */
  static Config = z.object({
    pnpmCommand: z.string().default("pnpm"),
    outputBytes: z.number().step(1).min(1).default(16384),
    lockWaitMs: z.number().step(1).min(0).default(120000),
    inspectTimeoutMs: z.number().step(1).min(1000).default(20000),
    githubConnectionTimeoutMs: z.number().step(1).min(1000).default(5000),
    idleTimeoutMs: z.number().step(1).min(1000).default(600000),
    registry: z.string().pattern(REGISTRY_URL),
    fallbackRegistries: z.array(z.string().pattern(REGISTRY_URL)).default([NPMMIRROR_REGISTRY]),
  });

  /** Bundle quản trị vẫn được bảo vệ nếu tệp của chúng trở nên không đọc được. */
  private readonly managementBundles = new Set<string>();
  /**
   * Registry mà mỗi package được cài lần cuối bởi manager này trong tiến trình. pnpm kiểm URL tarball trong
   * lockfile với registry mặc định của nó trừ khi chúng thuộc một registry có tên, nên lần gỡ sau nêu lại nó.
   */
  private readonly installedFrom = new Map<string, Registry>();
  private readonly ownerEntryId: string | undefined;
  private readonly packageOperations = new Set<Promise<unknown>>();
  private readonly profile: ProfileContext;
  private readonly outputBytes: number;
  private readonly lockWaitMs: number;
  private readonly inspectTimeoutMs: number;
  private readonly githubConnectionTimeoutMs: number;
  private readonly idleTimeoutMs: number;
  private readonly pnpmCommand: string;
  private readonly configuredRegistries: { registry: Registry; fallbackRegistries: string[] };
  private readonly ownerContext: ManagerContext;
  private readonly abort = new AbortController();
  /** Các lần cài theo request id, từ lúc gọi tới khi kết thúc. */
  private readonly installs = new Map<PluginInstallRequestId, InstallControl>();

  /**
   * Đăng ký service `pluginManager` và hiệu ứng huỷ các phép toán package khi disposed.
   * Nhận: `ctx` — Context sở hữu plugin; `config` — cấu hình row đã kiểm bởi `static Config`.
   * Trả: thể hiện service đã cài (cordis dùng ngay sau khi dựng).
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "pluginManager");
    const owner = ctx as unknown as ManagerContext;
    const resolved = config as ResolvedConfig;
    this.ownerEntryId = owner.fiber.entry?.id;
    this.ownerContext = owner;
    this.profile = owner.profileContext;
    for (const name of this.profile.startedBundles) this.protectsManager(name);
    this.outputBytes = resolved.outputBytes;
    this.lockWaitMs = resolved.lockWaitMs;
    this.inspectTimeoutMs = resolved.inspectTimeoutMs;
    this.githubConnectionTimeoutMs = resolved.githubConnectionTimeoutMs;
    this.idleTimeoutMs = resolved.idleTimeoutMs;
    this.pnpmCommand = resolved.pnpmCommand;
    this.configuredRegistries = {
      registry: config.registry === undefined ? null : normalizeRegistry(config.registry),
      fallbackRegistries: resolved.fallbackRegistries.map(normalizeRegistry),
    };
    owner.effect(() => async () => {
      this.abort.abort();
      await Promise.allSettled([...this.packageOperations]);
    }, "plugin-manager: package cancellation");
  }

  /**
   * Đọc đúng các miễn trừ phiên bản plugin đã lưu trong hồ sơ này.
   * Nhận: không. Trả: các khoá package-name@version đã nhận kèm runtime version được phép, và mọi vấn đề tệp/record.
   */
  @Remote
  listVersionExemptions(): { exemptions: Record<string, string[]>; warnings: string[] } {
    const { exemptions, warnings } = readProfileCompatibility(this.profile.dir);
    return { exemptions, warnings };
  }

  /**
   * Cấp hoặc thu hồi MỘT miễn trừ plugin/runtime chính xác và đánh giá lại plugin đang sống.
   * Nhận: `packageVersion` — tên manifest kèm @version (không phải spec/alias); `runtimeVersion` — version DSH chính
   * xác khi cấp; `enabled` — cấp hay thu hồi; `acceptRisk` — phải true khi cấp sau khi chấp nhận rủi ro.
   * Trả: kết cục đã lưu và runtime; hồ sơ chỉ-khởi-động cần restart.
   * @throws khi định danh không canonical, thiếu đồng ý, runtime cũ, hoặc tệp compatibility bị reader từ chối.
   */
  @Remote
  setVersionExemption(packageVersion: string, runtimeVersion: string, enabled: boolean, acceptRisk?: boolean): Promise<ChangeResult> {
    return this.change((result) => this.configure(async () => {
      await setProfileVersionExemption(this.profile.dir, packageVersion, runtimeVersion, enabled, acceptRisk === true);
      Object.assign(result, await this.reload());
    }), { stage: "enable", target: packageVersion, enabled }, "bundle");
  }

  /**
   * Đọc các plugin hiện tại, kèm lý do một row không đổi được qua profile patch.
   * Nhận: không. Trả: các entry runtime hiện tại kèm đích patch bền vững.
   */
  @Remote
  async listPlugins(): Promise<PluginInfo[]> {
    // 25/10/2026 (yêu cầu Lead): `readProfilePatches` chỉ gộp patch của bundle nằm trong
    const manifest = readProfileManifest("dsh", this.profile.dir);
    const bundleRows = bundleSelection(manifest).flatMap((name) => {
      try {
        // Bundle cục bộ của ta nằm ngay trong node_modules của hồ sơ (không phải dependency ⇒
        // resolveBundleDir theo installAnchor sẽ ném); thử đường đó trước, rồi mới tới anchor.
        const local = join(this.profile.dir, "node_modules", name);
        const dir = existsSync(join(local, "package.json"))
          ? local
          : resolveBundleDir("dsh", name, this.profile.installAnchor, this.profile.dir);
        const info = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as ProfileManifest;
        return this.declaredRowsAt(dir, info).rows.map((row) => ({ id: row.rowId, name: row.moduleName }));
      } catch {
        return [];
      }
    });
    // 25/10/2026 — GỘP TRÙNG theo id (lớp sau thắng, đúng luật compose của Loader). Trước đó cùng một id
    const composed = [...flatten(composeEntries([readProfilePatches("dsh", this.profile)])), ...bundleRows];
    const byId = new Map<string, { id: string; name: string }>();
    for (const row of composed) {
      if (typeof row.id === "string" && typeof row.name === "string") byId.set(row.id, { id: row.id, name: row.name });
    }
    const rows = [...byId.values()];
    const snapshot = await readPluginInventory(this.ctx);
    return snapshot.entries.map((entry): PluginInfo => {
      const actual = [...this.ctx.loader.entries()].find((row) => row.id === entry.entryId);
      const candidates = rows.filter((row) => row.id === actual?.options.id);
      const candidate = candidates[0];
      if (protectedModules.has(entry.moduleName) || entry.entryId === this.ownerEntryId)
        return { ...entry, readOnlyReason: "management-required" };
      // 25/10/2026 — BỎ điều kiện parent === "include": row đến từ BUNDLE PATCH (bundle bật qua
      if (candidate === undefined || candidates.length > 1 || quyTen(candidate.name) !== quyTen(entry.moduleName))
        return { ...entry, readOnlyReason: "unaddressable" };
      return { ...entry, patchId: candidate.id };
    });
  }

  /**
   * Đọc các bundle đã cài, do bản cài cấp, và mục danh mục Official offline, cộng các tên không-bundle đã chọn.
   * 11/11/2026: thân hàm chuyển sang `list-bundles.ts` (tệp này đã ở 998/1000 dòng); mỗi dòng trả về mang cờ
   * `origin` (`user` | `core`) để client tách thành phần lõi khỏi plugin người dùng.
   * Nhận: không. Trả: version package, description, spec cài được, row, metadata hiển thị, lựa chọn kích hoạt,
   * việc bản cài có cấp bundle không, và khả năng gỡ.
   */
  @Remote
  listBundles(): Promise<BundleInfo[]> {
    return listBundlesFor(this.profile, {
      protectsManager: (name) => this.protectsManager(name),
      declaredRows: (name, info) => this.declaredRows(name, info),
    });
  }

  /**
   * Đọc các registry mà manager này hỏi: registry cấu hình đầu, các fallback theo thứ tự, và registry pnpm tự khai.
   * Nhận: không. Trả: các registry ở dạng pnpm so sánh; null là registry pnpm tự khai, `resolved` như pnpm đọc hiện tại.
   * @throws khi không đọc được câu trả lời của pnpm về registry.
   */
  @Remote
  async registries(): Promise<PluginRegistries> {
    return {
      ...this.configuredRegistries, fallbackRegistries: [...this.configuredRegistries.fallbackRegistries],
      resolved: await readProfileRegistry(this.profile.dir, {
        ...(this.profile.packageManager ?? { command: this.pnpmCommand }), timeoutMs: this.inspectTimeoutMs,
      }),
    };
  }

  /**
   * Đọc spec nêu gì trước khi cài.
   * Nhận: `spec` — một spec package (tên registry, đường dẫn tuyệt đối, địa chỉ git, hay tarball); `options` —
   * registry hỏi trước; `signal` — kết thúc sớm một lần tra registry.
   * Trả: package mà spec nêu, hoặc lý do bị từ chối.
   * @throws khi lần tra registry ném lỗi ngoài dự kiến (không phải lời từ chối spec).
   */
  @Remote
  async inspect(spec: string, options?: InspectOptions, signal?: AbortSignal): Promise<PluginSpecInspection> {
    let parsed: ParsedInstallSpec;
    try {
      parsed = parseInstallSpec(spec);
    } catch (error) {
      /* v8 ignore next 2 -- parseInstallSpec throws nothing but its own refusal */
      if (!(error instanceof InvalidInstallSpecError)) throw error;
      return refused("invalid-spec", error.reason);
    }
    const manifest = readProfileManifest("dsh", this.profile.dir);
    const installation = JSON.parse(readFileSync(this.profile.installAnchor, "utf8")) as { dependencies?: Record<string, string> };
    const known = new Set([
      ...bundleSelection(manifest), ...Object.keys(manifest.dependencies ?? {}), ...Object.keys(installation.dependencies ?? {}),
    ]);
    const plan = registryPlan(options?.registry, await this.registries());
    const registry = plan[0]!;
    switch (parsed.kind) {
      case "git": return { status: "accepted", kind: "git", bundle: null, registry, host: parsed.host };
      case "tarball":
        if (parsed.path !== undefined && !existsSync(parsed.path)) return refused("not-a-package", "the tarball does not exist");
        return { status: "accepted", kind: "tarball", bundle: null, registry, ...(parsed.host === undefined ? {} : { host: parsed.host }) };
      case "path": {
        if (!existsSync(parsed.path)) return refused("not-a-package", "the path does not exist");
        let read: ProfileManifest;
        try {
          read = JSON.parse(await readFile(join(parsed.path, "package.json"), "utf8"));
        } catch (error) {
          return refused("not-a-package", `no readable package.json at the path: ${messageOf(error)}`);
        }
        const inspection = inspectionOf("path", read, registry);
        if (inspection.name === undefined) return refused("not-a-package", "the package.json names no package");
        if (known.has(inspection.name)) return refused("already-installed", `${inspection.name} is already installed`);
        if (!inspection.bundle) return refused("not-a-bundle", `${inspection.name} declares no dsh.bundle`);
        return inspection;
      }
      case "registry": {
        if (known.has(parsed.name)) return refused("already-installed", `${parsed.name} is already installed`);
        const registries: Registry[] = [];
        const refusedBy = (problem: PluginInspectProblem, reason: string): RefusedInspection =>
          ({ status: "refused", problem, reason, registries });
        for (const current of plan) {
          registries.push(current);
          const view = await viewProfilePackage(this.profile.dir, spec.trim(), {
            ...(this.profile.packageManager ?? { command: this.pnpmCommand }),
            timeoutMs: this.inspectTimeoutMs, ...(signal === undefined ? {} : { signal }), registry: current,
          });
          const printed = view.stdout.replace(ANSI_SEQUENCE, "").trim();
          if (view.exitCode !== 0 || view.cause !== undefined || view.timedOut) {
            // pnpm prints a refusal as `{ error: { code, message } }` on stdout, with nothing on stderr.
            const log = [view.stderr.trim(), printedError(printed), view.cause === undefined ? "" : messageOf(view.cause)].filter(Boolean).join("\n");
            const kind = classifyInstallFailure({ log, timedOut: view.timedOut, ...(view.cause === undefined ? {} : { cause: view.cause }) });
            // A lookup the caller dropped is not carried to the next registry.
            if (registries.length < plan.length && signal?.aborted !== true && attributeFailure(kind, log, parsed) === "registry")
              continue;
            const reason = view.timedOut ? `pnpm view timed out after ${String(this.inspectTimeoutMs)}ms` : log || printed || `pnpm view exited with ${String(view.exitCode)}`;
            if (kind === "not-found" || kind === "no-matching-version")
              return refusedBy("not-found", reason);
            if (kind === "network" || kind === "timeout")
              return refusedBy("network", reason);
            return refusedBy("unknown", reason);
          }
          let answer: unknown;
          try {
            answer = JSON.parse(printed || "null");
          } catch (error) {
            return refusedBy("unknown", `unreadable pnpm view output: ${messageOf(error)}`);
          }
          // A range answers one object per matching version, oldest first.
          const latest = Array.isArray(answer) ? answer.at(-1) : answer;
          if (typeof latest !== "object" || latest === null) return refusedBy("unknown", "pnpm view answered no package");
          const inspection = inspectionOf("registry", latest as ProfileManifest, current);
          const named = inspection.name === undefined ? { ...inspection, name: parsed.name } : inspection;
          if (!named.bundle) return refusedBy("not-a-bundle", `${named.name} declares no dsh.bundle`);
          return named;
        }
        /* v8 ignore next -- the plan is never empty: every attempt returns or continues to the next */
        throw new Error("no registry was asked");
      }
    }
  }

  /**
   * Lưu trạng thái bật mong muốn của một entry plugin và áp lên hồ sơ đang sống.
   * Nhận: `id` — danh tính entry Loader do listPlugins trả; `enabled` — plugin có nên chạy không.
   * Trả: kết cục đã lưu và runtime, kể cả override ưu tiên cao hơn.
   * @throws khi không tìm thấy entry, row chỉ đọc, hoặc phép toán không lấy được khoá hồ sơ.
   */
  @Remote
  setPluginEnabled(id: PluginEntryId, enabled: boolean): Promise<ChangeResult> {
    return this.change((result) => this.configure(async () => {
      const row = (await this.listPlugins()).find((item) => item.entryId === id);
      if (row === undefined) throw new ManagementFailure("unknown-plugin");
      if (row.readOnlyReason !== undefined) throw new ManagementFailure(row.readOnlyReason);
      await writePluginEnabled(this.profile, row.patchId, row.moduleName, enabled);
      Object.assign(result, await this.reload(enabled ? [row.patchId] : []));
      const current = (await this.listPlugins()).find((item) => item.entryId === id);
      return current?.enabled !== enabled && this.ownerContext.get("hmr") !== undefined ? "overridden" : undefined;
    }), { stage: "enable", target: id, enabled }, "plugin");
  }

  /**
   * Chọn hoặc bỏ lớp bundle trong khi vẫn giữ dependency đã cài.
   * Nhận: `name` — tên package bundle; `enabled` — bundle có đóng góp lớp patch không.
   * Trả: kết cục đã lưu và runtime.
   * @throws khi bundle không đọc được, không tương thích, hoặc là bundle quản trị khi bị tắt.
   */
  @Remote
  setBundleEnabled(name: string, enabled: boolean): Promise<ChangeResult> {
    return this.change((result) => this.configure(async () => {
      await this.selectBundle(name, enabled);
      Object.assign(result, enabled ? await this.publishAndReload(this.bundleRows(name).map((row) => row.id)) : await this.reload());
    }), { stage: "enable", target: name, enabled }, "bundle");
  }

  /**
   * Cài một package bằng đúng hiện thực pnpm của `dsh plugin`. Repository GitHub được kiểm kết nối, giới hạn bởi
   * `githubConnectionTimeoutMs`, trước khi pnpm chạy; chỉ lỗi mạng hoặc quá hạn mới dừng cài, còn pnpm sở hữu xác
   * thực và fallback transport. Một lần chạy hỏng, bị huỷ, hay thêm package không có bundle patch sẽ khôi phục
   * `package.json` và `pnpm-lock.yaml` như trước; tệp đã tải có thể còn lại.
   * Nhận: `spec` — một spec package, kể cả đường dẫn cục bộ tương đối với thư mục gọi; `options` — có kích hoạt
   * bundle vừa cài (mặc định true), request id để huỷ, build script chờ được phép, lưu dependency chính xác, registry
   * hỏi trước.
   * Trả: chẩn đoán package-manager, các registry đã hỏi, và kết cục kích hoạt quan sát được.
   * @throws khi không lấy được khoá hồ sơ hoặc service đã bị huỷ (mọi lỗi khác được gộp vào `ChangeResult`).
   */
  @Remote
  installBundle(spec: string, options?: InstallBundleOptions): Promise<ChangeResult> {
    const requestId = options?.requestId;
    const control: InstallControl = { abort: new AbortController(), phase: "installing", result: Promise.resolve(null) };
    const stopped = (): boolean => control.abort.signal.aborted || this.abort.signal.aborted;
    if (requestId !== undefined) this.installs.set(requestId, control);
    const announce = (phase: "installing" | "applying", attempt?: { registry: Registry; index: number; total: number }): void => {
      if (requestId !== undefined)
        this.ownerContext.emit("plugin-manager/install-state", { requestId, phase, ...(attempt === undefined ? {} : { attempt }) });
    };
    const result = this.change(async (result) => {
      if (spec.trim() === "" || spec.startsWith("-")) throw new ManagementFailure("invalid-spec");
      if (stopped()) throw new InstallCancelledError();
      const before = readProfileManifest("dsh", this.profile.dir).dependencies ?? {};
      // With HMR, an installed package is removed before another version is installed, so its plugins stop first.
      const known = specPackageName(spec, before, this.profile.dir);
      if (this.ownerContext.get("hmr") !== undefined && known !== undefined && Object.hasOwn(before, known))
        throw new ManagementFailure("already-installed");
      if (options?.approvedBuilds !== undefined) {
        await approveBuilds(this.profile.dir, options.approvedBuilds);
        result.approvedBuilds = options.approvedBuilds;
      }
      const files = await this.readRestoredFiles();
      let name!: string;
      let version: string | undefined;
      try {
        result.registries = [];
        const connection = checkGithubConnection(parsedForRegistry(spec), this.profile.dir, {
          timeoutMs: this.githubConnectionTimeoutMs, outputBytes: this.outputBytes,
          signal: AbortSignal.any([this.abort.signal, control.abort.signal]),
          ...(this.profile.packageManager?.env === undefined ? {} : { env: this.profile.packageManager.env }),
        });
        this.packageOperations.add(connection);
        let connectionFailure: PackageResult | undefined;
        try {
          connectionFailure = await connection;
        } finally {
          this.packageOperations.delete(connection);
        }
        if (stopped()) throw new InstallCancelledError();
        if (connectionFailure?.kind === "network" || connectionFailure?.kind === "timeout") {
          result.packageResult = connectionFailure;
          result.failedAt = "spec-host";
          throw new Error(connectionFailure.output);
        }
        // The last run is the result's; the registries asked stay listed whatever the outcome.
        const plan = registryPlan(options?.registry, await this.registries());
        let run: PackageResult | undefined;
        let used: Registry = null;
        for (const [index, registry] of plan.entries()) {
          if (index > 0) await this.restoreFiles(files);
          // A stop that landed while the files went back, or before the first run, starts no run with a dead signal.
          if (stopped()) throw new InstallCancelledError();
          result.registries!.push(registry);
          used = registry;
          announce("installing", { registry, index: index + 1, total: plan.length });
          // 25/10/2026 — hồ sơ của ta có `pnpm-workspace.yaml` nên pnpm coi nó là WORKSPACE ROOT: `pnpm add`
          // không kèm `-w` bị từ chối (ERR_PNPM_ADDING_TO_ROOT) ⇒ mọi lượt "Cài plugin" đều hỏng. Thêm `-w`.
          run = await this.runPnpm(["add", spec, "-w", ...(options?.saveExact === true ? ["--save-exact"] : []), ...registryArguments(registry)], control.abort.signal, requestId);
          result.packageResult = run;
          if (stopped()) throw new InstallCancelledError();
          // A compatibility refusal is the package's own answer, so no other registry is asked.
          if (run.incompatible !== undefined) throw new ManagementFailure("incompatible-version", run.incompatible);
          // A run this manager terminated is not a success, even when pnpm trapped the signal and exited 0.
          if (run.exitCode === 0 && run.timedOut !== true) break;
          /* v8 ignore next 2 -- runPnpm classifies every run it does not report as succeeded */
          if (run.kind === undefined) break;
          // What the last failed run could not reach; a later run that succeeds leaves nothing to say.
          delete result.failedAt;
          // A run this manager terminated got no answer from the registry at all, so no registry explains it.
          if (run.timedOut === true) break;
          const failedAt = attributeFailure(run.kind, run.output, parsedForRegistry(spec));
          if (failedAt !== "other") result.failedAt = failedAt;
          if (failedAt !== "registry" || index === plan.length - 1) break;
        }
        /* v8 ignore next -- the plan is never empty, so a run always settled */
        if (run === undefined) throw new Error("no registry was asked");
        // A terminated run reports no usable exit status, so neither its files nor its bundle are trusted.
        const succeeded = run.exitCode === 0 && run.timedOut !== true;
        if (succeeded) delete result.failedAt;
        if (!succeeded) {
          // pnpm-workspace.yaml is not restored, so the names it left undecided, or reported as ignored, are offered for approval.
          try {
            result.pendingBuilds = await recordPendingBuilds(this.profile.dir, run.output);
          } catch (error) {
            this.ownerContext.logger.warn("Could not read pending build approvals after pnpm failed", error);
          }
          throw new Error(run.output);
        }
        const after = readProfileManifest("dsh", this.profile.dir).dependencies ?? {};
        const installed = Object.keys(after).filter((name) => before[name] !== after[name]);
        // Without HMR a repeated installation can leave the saved dependency as it was.
        if (installed.length === 0) {
          const local = specPackageName(spec, after, this.profile.dir);
          if (local !== undefined && Object.hasOwn(after, local)) installed.push(local);
        }
        const target = installed[0];
        if (installed.length !== 1 || target === undefined) throw new ManagementFailure("ambiguous-install");
        name = target;
        const dir = resolveBundleDir("dsh", name, this.profile.installAnchor, this.profile.dir);
        const manifest = bundleManifest(name, this.profile.dir, this.profile.installAnchor);
        if (manifest?.dsh?.bundle === undefined) throw new ManagementFailure("not-bundle");
        const compatibility = evaluatePluginCompatibility(manifest, readProfileVersionExemptions(this.profile.dir));
        if (compatibility !== undefined && !compatibility.exempted)
          throw new ManagementFailure("incompatible-version", [incompatiblePlugin(compatibility)]);
        for (const file of bundlePatchPaths(dir, manifest.dsh.bundle)) loadOverlayPatches("dsh", file);
        version = manifest.version;
        this.installedFrom.set(name, used);
      } catch (error) {
        // pnpm has exited by now, so the files it rewrote go back as they were.
        await this.restoreFiles(files);
        throw error;
      }
      control.phase = "applying";
      announce("applying");
      result.bundle = name;
      if (version !== undefined) result.version = version;
      result.target = name;
      result.stage = "enable";
      return this.configure(async () => {
        if (options?.enabled !== false) await this.selectBundle(name, true);
        // Without HMR the replaced package's plugins keep running until the restart the result already reports.
        if (Object.hasOwn(before, name) && this.ownerContext.get("hmr") === undefined) return;
        // A selected bundle's own rows must start.
        const selected = bundleSelection(readProfileManifest("dsh", this.profile.dir)).some((viet) => laCungBundle(viet, name));
        Object.assign(result, await this.publishAndReload(selected ? this.bundleRows(name).map((row) => row.id) : []));
      });
    }, { stage: "install", target: spec, enabled: options?.enabled !== false }, "install");
    control.result = result;
    return result.finally(() => { if (requestId !== undefined) this.installs.delete(requestId); });
  }

  /**
   * Lấy lại kết quả của một lần cài đang chạy mà KHÔNG huỷ nó.
   * Nhận: `requestId` — id đã cấp khi bắt đầu cài.
   * Trả: kết cục sau khi lần cài kết thúc, hoặc null nếu không request đang chạy nào mang id đó; kết quả đã xong
   * không được giữ, và null không xác lập thành công hay bị huỷ.
   */
  @Remote
  async waitForInstall(requestId: PluginInstallRequestId): Promise<ChangeResult | null> {
    return this.installs.get(requestId)?.result ?? null;
  }

  /**
   * Dừng một lần cài do manager này sở hữu và chờ tới khi tệp của nó trở lại.
   * Nhận: `requestId` — id lần cài đã bắt đầu.
   * Trả: `cancelled` khi phép kiểm Git hoặc pnpm đã thoát và tệp được khôi phục, `too-late` khi bundle đang được áp,
   * `not-running` với mọi id khác.
   */
  @Remote
  async cancelInstall(requestId: PluginInstallRequestId): Promise<PluginInstallCancellation> {
    const control = this.installs.get(requestId);
    if (control === undefined) return { status: "not-running" };
    if (control.phase === "applying") return { status: "too-late" };
    this.ownerContext.emit("plugin-manager/install-state", { requestId, phase: "cancelling" });
    control.abort.abort();
    /* v8 ignore next -- change() folds every failure into its result; only a lock or disposal error rejects */
    await control.result.then(() => undefined, () => undefined);
    return { status: "cancelled" };
  }

  /**
   * Gỡ một dependency là bundle của hồ sơ qua đường pnpm của `dsh plugin`; một tên đã chọn mà không dependency nào
   * giữ thì chỉ bị bỏ chọn.
   * Nhận: `name` — dependency đã cài hoặc tên bundle đã chọn.
   * Trả: chẩn đoán gỡ và trạng thái hồ sơ còn lại.
   * @throws khi bundle không gỡ được, hồ sơ chỉ-khởi-động, hoặc bundle đang được dùng trong Loader.
   */
  @Remote
  removeBundle(name: string): Promise<ChangeResult> {
    return this.change(async (result) => {
      const installed = await this.configure(async () => {
        const bundle = (await this.listBundles()).find((item) => item.name === name);
        if (bundle === undefined || !bundle.removable) throw new ManagementFailure("not-removable");
        if (this.ownerContext.get("hmr") === undefined && (this.profile.startedBundles.includes(name)
          || (bundle.error === undefined && this.bundleRows(name).some((row) => [...this.ctx.loader.entries()]
            .some((entry) => entry.options.id === row.id && entry.fiber !== undefined))))) {
          throw new ManagementFailure("stop-profile");
        }
        const contributions = bundle.error === undefined ? this.bundleRows(name) : [];
        if (bundle.enabled) {
          await this.selectBundle(name, false);
          Object.assign(result, await this.reload());
        }
        if ([...this.ctx.loader.entries()].some((entry) => entry.fiber?.uid != null
          && contributions.some((row) => row.id === entry.options.id && row.name === entry.options.name))) {
          throw new ManagementFailure("bundle-in-use");
        }
        return bundle.installed;
      });
      if (!installed) return;
      // `pnpm remove` takes no `--registry` option; the generic configuration flag sets the same setting. A package
      // installed before this process started is removed with the registry an installation asks first.
      const registry = this.installedFrom.has(name) ? this.installedFrom.get(name) : this.configuredRegistries.registry;
      result.packageResult = await this.runPnpm(["remove", name, ...(typeof registry === "string" ? [`--config.registry=${registry}`] : [])]);
      if (result.packageResult.exitCode !== 0 || result.packageResult.timedOut === true) throw new Error(result.packageResult.output);
      this.installedFrom.delete(name);
      Object.assign(result, await this.configure(() => this.publishAndReload()));
    }, { stage: "remove", target: name }, "remove");
  }

  /** Các row mà patch của một bundle chèn và các row có sẵn mà nó đổi; patch không đọc được thì ném. */
  private declaredRows(name: string, info: ProfileManifest): Pick<BundleInfo, "rows" | "overrides"> {
    return this.declaredRowsAt(resolveBundleDir("dsh", name, this.profile.installAnchor, this.profile.dir), info);
  }

  /**
   * Như {@link declaredRows} nhưng nhận THẲNG thư mục bundle (dùng cho bundle cục bộ nằm trong
   * node_modules của hồ sơ, không phải dependency nên `resolveBundleDir` theo anchor sẽ ném).
   * Nhận: dir — thư mục package bundle; info — manifest của nó.
   * Trả: rows + overrides của patch bundle.
   */
  private declaredRowsAt(dir: string, info: ProfileManifest): Pick<BundleInfo, "rows" | "overrides"> {
    const bundle = info.dsh?.bundle;
    /* v8 ignore next -- bundleManifest answers only manifests that declare a patch */
    if (bundle === undefined) return { rows: [], overrides: [] };
    const patches = bundlePatchPaths(dir, bundle).flatMap((file) => loadOverlayPatches("dsh", file));
    // One entry per row id: the Loader keeps a single entry for an id, whichever layer declared it last.
    const live = new Map<string, LiveRow>();
    for (const entry of this.ctx.loader.entries()) {
      /* v8 ignore next -- the Loader gives every entry an id before it is listed */
      if (typeof entry.options.id === "string") live.set(entry.options.id, { entryId: pluginEntryId(entry.id), baseUrl: entry.parent.tree.ctx.baseUrl });
    }
    const rows: BundleRowInfo[] = [];
    const packages = this.ctx.get("pluginPackages");
    for (const row of flatten(composeEntries([patches.filter((item) => item.insert !== undefined)]))) {
      // Group rows are containers without a plugin inventory entry; their children carry the switches.
      if (typeof row.id !== "string" || typeof row.name !== "string" || row.group === true) continue;
      const active = live.get(row.id);
      const entryId = active?.entryId;
      const base = active?.baseUrl ?? pathToFileURL(join(dir, "package.json")).href;
      const meta = packages?.metaOf(row.name, base);
      // 25/10/2026 (yêu cầu Lead): dòng "Thành phần" phải hiện TÊN CỦA TA + mô tả tiếng Việt, không hiện
      // "@deepseek-ai/…" kèm mô tả tiếng Anh của bản DSH.
      const moduleName = quyTen(row.name);
      // 25/10/2026 (yêu cầu chủ dự án: mô tả thành phần phải ĐÚNG mô tả gói bên DSH): KHÔNG tự viết lại mô tả
      const tenHienThi = rowTitleVi(row.name) ?? rowTitleVi(quyTen(row.name)) ?? meta?.title;
      // 26/10/2026 (yêu cầu chủ dự án: "Thành phần" đang để title-description tiếng Anh trong khi ngôn ngữ là vi):
      // ưu tiên mô tả tiếng Việt của ta; giữ nguyên mô tả stock khi chưa có bản dịch.
      const moTa = rowDescriptionVi(row.name) ?? rowDescriptionVi(quyTen(row.name)) ?? meta?.description;
      // 25/10/2026 (yêu cầu chủ dự án "tại sao lại hiển thị DSH ở đây?"): khi ta có tên riêng thì BỎ artwork/icon
      // của gói stock — icon stock của kỹ năng ghi công vẽ chữ "DSH", đứng cạnh tên ta là sai.
      const metaKhongIcon = Object.fromEntries(Object.entries(meta ?? {}).filter(([key]) => key !== "icon" && key !== "artwork"));
      const metaTa = {
        ...metaKhongIcon,
        ...(tenHienThi === undefined ? {} : { title: tenHienThi }),
        ...(moTa === undefined ? {} : { description: moTa }),
      };
      rows.push({ rowId: row.id, moduleName,
        ...(entryId === undefined ? {} : { entryId }), meta: metaTa });
    }
    const declared = new Set(rows.map((row) => row.rowId));
    const overrides = [...new Set(patches.flatMap((item) => item.insert === undefined && typeof item.id === "string" && !declared.has(item.id) ? [item.id] : []))];
    return { rows, overrides };
  }

  /** Chạy MỘT lệnh pnpm trong hồ sơ, phát output của nó thành các chunk install-log; trả kết cục kèm `kind` khi hỏng. */
  private async runPnpm(args: string[], signal?: AbortSignal, requestId?: PluginInstallRequestId): Promise<PackageResult> {
    const jobId = randomUUID();
    const argv = ["pnpm", ...args];
    const cwd = this.profile.dir;
    const identity: { requestId?: PluginInstallRequestId } = requestId === undefined ? {} : { requestId };
    const task = runProfilePnpm({ ...this.profile, profile: this.profile.name }, args, {
      execution: "service", ...(this.profile.packageManager ?? { command: this.pnpmCommand }),
      signal: signal === undefined ? this.abort.signal : AbortSignal.any([this.abort.signal, signal]),
      outputBytes: this.outputBytes, activateNewBundles: false, idleTimeoutMs: this.idleTimeoutMs,
      lookupTimeoutMs: this.inspectTimeoutMs,
      onOutput: (text, stream) => {
        this.ownerContext.emit("plugin-manager/install-log", { ...identity, jobId, argv, cwd, stream, text });
      },
    });
    this.packageOperations.add(task);
    try {
      const result = await task;
      this.ownerContext.emit("plugin-manager/install-log", {
        ...identity, jobId, argv, cwd, stream: "stdout", text: "", exitCode: signal?.aborted === true ? null : result.exitCode,
      });
      // A terminated run keeps its own kind even when pnpm trapped the signal and exited 0.
      if (result.exitCode === 0 && result.timedOut !== true) return result;
      return { ...result, kind: classifyInstallFailure({ log: result.output, ...(result.timedOut === true ? { timedOut: true } : {}) }) };
    } catch (error) {
      this.ownerContext.emit("plugin-manager/install-log", { ...identity, jobId, argv, cwd, stream: "stderr", text: messageOf(error), exitCode: null });
      throw error;
    } finally {
      this.packageOperations.delete(task);
    }
  }

  /** Các tệp hồ sơ mà một lần cài có thể ghi lại, đúng như hiện tại; tệp vắng đọc là undefined. */
  private async readRestoredFiles(): Promise<Map<string, string | undefined>> {
    const files = new Map<string, string | undefined>();
    for (const name of RESTORED_FILES) {
      const path = join(this.profile.dir, name);
      files.set(path, existsSync(path) ? await readFile(path, "utf8") : undefined);
    }
    return files;
  }

  /** Đặt các tệp hồ sơ trở lại; pnpm đã thoát trước khi bước này chạy. */
  private async restoreFiles(files: Map<string, string | undefined>): Promise<void> {
    for (const [path, content] of files) {
      if (content === undefined) await rm(path, { force: true });
      else await writeFileAtomic(path, content, { mode: 0o600 });
    }
  }

  /**
   * Chọn hoặc bỏ chọn MỘT bundle trong `dsh.profile.bundles`, giữ nguyên dependency đã cài.
   * Nhận: `name` — tên bundle công tắc gửi lên (id stock hay tên của ta đều được); `enabled` — bật hay tắt.
   * Trả: promise hoàn tất sau khi manifest hồ sơ khớp trạng thái mới (không ghi khi không phải đổi).
   *
   * 10/11/2026 (dev-6, Lead đo: công tắc gửi `@deepseek-ai/dsh-experimental-…` trong khi hồ sơ khai
   * `@galaxy-blackhole/gbh-…-bundle`): bản cũ so ĐÚNG CHUỖI nên lượt TẮT không khớp tên nào ⇒ danh sách
   * không đổi ⇒ `setBundleEnabled` trả về sớm và vẫn báo `application: applied` (`changed: false`).
   * Nay gom theo danh tính lớp bundle ({@link chonBundle}) ⇒ TẮT bỏ mọi cách viết, BẬT chuẩn hoá về tên gốc.
   */
  private async selectBundle(name: string, enabled: boolean): Promise<void> {
    const manifest = readProfileManifest("dsh", this.profile.dir);
    const previous = bundleSelection(manifest);
    // Tên THẬT của lớp: ưu tiên cách viết đang khai trong hồ sơ (bản cài bị đổi id stock → id GBH nên
    // quy tên từ bảng có thể trỏ vào tên stock không tồn tại trong profile).
    const tenThat = previous.find((viet) => laCungBundle(viet, name)) ?? quyTenBundle(name);
    if (enabled || !previous.includes(tenThat)) {
      const metadata = bundleManifest(tenThat, this.profile.dir, this.profile.installAnchor);
      if (metadata === undefined) throw new ManagementFailure("not-bundle");
      if (enabled) {
        const compatibility = evaluatePluginCompatibility(metadata, readProfileVersionExemptions(this.profile.dir));
        if (compatibility !== undefined && !compatibility.exempted)
          throw new ManagementFailure("incompatible-version", [incompatiblePlugin(compatibility)]);
        this.bundleRows(tenThat);
      }
    }
    if (!enabled && previous.some((viet) => laCungBundle(viet, name))) {
      if (this.protectsManager(tenThat)) throw new ManagementFailure("management-required");
    }
    const bundles = chonBundle(previous, name, enabled);
    if (JSON.stringify(previous) === JSON.stringify(bundles)) return;
    manifest.dsh = { ...manifest.dsh, profile: { ...manifest.dsh?.profile, bundles: [...bundles] } };
    await saveManifest(this.profile.dir, manifest);
    if (enabled) this.protectsManager(name);
  }

  /** Các row mà patch của một bundle chèn, ở dạng phẳng; rỗng khi bundle không khai patch. */
  private bundleRows(name: string): EntryOptions[] {
    const info = bundleManifest(name, this.profile.dir, this.profile.installAnchor);
    if (info?.dsh?.bundle === undefined) return [];
    const dir = resolveBundleDir("dsh", name, this.profile.installAnchor, this.profile.dir);
    return flatten(composeEntries([bundlePatchPaths(dir, info.dsh.bundle).flatMap((file) => loadOverlayPatches("dsh", file))]));
  }

  /** Bundle này có chứa module quản trị (hoặc chính include của row này) không; true thì phải bảo vệ. */
  private protectsManager(name: string): boolean {
    if (this.managementBundles.has(name)) return true;
    let rows: EntryOptions[];
    try {
      rows = this.bundleRows(name);
    } catch {
      // Unreadable bundles contribute no new rows; listBundles reports their diagnostics.
      return false;
    }
    const protectedBundle = rows.some((row) => protectedModules.has(row.name) || `include:${row.id}` === this.ownerEntryId);
    if (protectedBundle) this.managementBundles.add(name);
    return protectedBundle;
  }

  /** Chạy một phép toán trong vùng độc quyền của HMR khi có, hoặc trực tiếp khi không; đã kiểm huỷ trước khi chạy. */
  private configure<T>(operation: () => Promise<T>): Promise<T> {
    const hmr = this.ownerContext.get("hmr");
    const apply = (): Promise<T> => { this.abort.signal.throwIfAborted(); return operation(); };
    return hmr === undefined ? apply() : hmr.runExclusive(apply);
  }

  /**
   * Công bố runtime resolution của hồ sơ khi không có HMR, trừ khi một bundle khởi động đã bị bỏ chọn vẫn chạy và
   * cần bảng hiện tại. Một lần công bố cần restart sẽ chờ lần restart mà kết quả đã báo.
   */
  private async refreshPackages(): Promise<void> {
    const selected = bundleSelection(readProfileManifest("dsh", this.profile.dir));
    if (this.profile.startedBundles.some((name) => !selected.includes(name))) return;
    try {
      const packages = this.ownerContext.get("pluginPackages");
      // A dropped mapping's bundle is not running: the guard above keeps the table while a deselected startup bundle runs.
      if (packages?.resolution !== undefined) await packages.refresh();
    } catch (error) {
      if (!(error instanceof ResolutionRestartRequired)) throw error;
    }
  }

  /** Áp một thay đổi package: khi không có HMR, công bố runtime resolution nếu an toàn, rồi {@link reload}. */
  private async publishAndReload(requiredIds: readonly string[] = []): Promise<ReloadOutcome> {
    if (this.ownerContext.get("hmr") === undefined) await this.refreshPackages();
    return this.reload(requiredIds);
  }

  /** Áp hồ sơ đã lưu; với HMR thì compose lại trực tiếp, kể cả runtime resolution. */
  /** Tim service hmr theo nhieu duong (ctx cua plugin-manager co the la ctx con nen get truc tiep truot).
   * @returns service hmr va nhan duong di, hoac undefined.
   */
  private hmrService(): { svc: unknown; via: string } | undefined {
    const ds: { via: string; ctx: unknown }[] = [
      { via: "ownerContext", ctx: this.ownerContext },
      { via: "ownerContext.root", ctx: (this.ownerContext as unknown as { root?: unknown }).root },
      { via: "this.ctx.root", ctx: (this.ctx as unknown as { root?: unknown }).root },
    ];
    for (const mot of ds) {
      const ctxNay = mot.ctx as { get?: (ten: string) => unknown } | undefined;
      if (ctxNay === undefined || typeof ctxNay.get !== "function") continue;
      try {
        const svc = ctxNay.get("hmr");
        if (svc !== undefined) return { svc, via: mot.via };
      } catch {
        continue;
      }
    }
    return undefined;
  }

  private async reload(requiredIds: readonly string[] = []): Promise<ReloadOutcome> {
    const timThay = this.hmrService();
    const hmr = timThay?.svc as { reconcileProfile: (ids: readonly string[]) => Promise<any> } | undefined;
    if (hmr === undefined) {
      // Startup-only profiles recompose at restart; the saved patches still have to compose.
      composeEntries([readProfilePatches("dsh", this.profile)]);
      return { warnings: [] };
    }
    const { warnings, pending, restartReason } = await hmr.reconcileProfile(requiredIds);
    const restart = restartReason ?? pending[0]?.reason;
    return restart === undefined ? { warnings } : { warnings, restartReason: restart as never };
  }

  /** Chạy MỘT lần đổi dưới khoá ghi của hồ sơ, gộp mọi lỗi vào kết quả. */
  private async change(
    operation: (result: ChangeResult) => void | ChangeResult["application"] | Promise<void | ChangeResult["application"]>,
    request: ChangeRequest,
    reason: ChangeReason,
  ): Promise<ChangeResult> {
    return withFileLock(join(this.profile.dir, "package.json"), async () => {
      this.abort.signal.throwIfAborted();
      const before = this.diskState();
      const result: ChangeResult = { ...request, changed: false,
        ...(this.hmrService() !== undefined
          ? { application: "applied" as const }
          : { application: "restart-required" as const, restartReason: "no-hmr" as const }) };
      try {
        const outcome = await operation(result);
        if (outcome !== undefined) result.application = outcome;
        // A reload that waits for a restart leaves the change saved but not applied.
        else if (result.application === "applied" && result.restartReason !== undefined)
          result.application = "restart-required";
      } catch (error) {
        if (error instanceof InstallCancelledError) {
          result.application = "cancelled";
        } else {
          result.application = "failed";
          result.error = managementError(error);
        }
      }
      if (result.application !== "restart-required") delete result.restartReason;
      result.changed = before !== this.diskState();
      this.ownerContext.emit("plugin-manager/changed", { reason });
      return result;
    }, { waitMs: this.lockWaitMs });
  }

  /** Ảnh chụp nội dung bốn tệp quyết định trạng thái hồ sơ, ghép bằng ký tự NUL; tệp vắng đọc là chuỗi rỗng. */
  private diskState(): string {
    return ["package.json", "cordis.patch.yml", "pnpm-workspace.yaml", PROFILE_COMPATIBILITY_FILENAME].map((file) => {
      try {
        return readFileSync(join(this.profile.dir, file), "utf8");
      } catch (error) {
        if ((error as { code?: string }).code === "ENOENT") return "";
        throw error;
      }
    }).join("\0");
  }
}

export type * from "./types.ts";
export type { Config } from "./manager-support.ts";
export type { InstallFailureFacts } from "./install-failure.ts";
export type { ParsedInstallSpec } from "./install-spec.ts";
export { classifyInstallFailure } from "./install-failure.ts";
export { InvalidInstallSpecError, parseInstallSpec } from "./install-spec.ts";

export default PluginManager;