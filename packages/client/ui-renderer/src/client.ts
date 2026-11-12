/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Diem vao nua BROWSER: nap module tu bang module cua trang, lap rap renderer, phoi apply/inject
 *      (port 1:1 vung index.js cua bundle goc, dong 1826-1883)
 */
import { buildRenderApp } from "./app.ts";
import { createBindings, type RendererRuntime } from "./bindings.ts";
import { createFactories } from "./factories.ts";
import { createOutlets } from "./outlets.ts";
import { createRegistry, type CordisContextLike, type SlotRegistryLike } from "./registry.ts";
import { createScopedSlots } from "./scoped-slots.ts";
import { DUPLICATE_INSTALL_WARNING, INJECT, PACKAGE_NAME, SERVICE_UI_RENDERER } from "./ids.ts";
import type { RequireFn, SlotRenderer, SlotsApi } from "./slots-api.ts";
import type { ReactModule } from "./bind.ts";

/** Bảng module của trang — thứ DUY NHẤT mà bundle được phép đăng ký vào. */
export interface ModuleLoaderLike {
  /**
   * Đăng ký một factory theo id module.
   * Nhận: `spec` — cặp `{ id, factory }`.
   * Trả: giá trị trả của loader (bị bỏ qua).
   */
  load(spec: { readonly id: string; readonly factory: (requireFn: RequireFn) => unknown }): unknown;
}

/** Module `react/jsx-runtime` mà trang cấp. */
export interface JsxRuntimeModule {
  /** Dựng element một con. */
  jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Dựng element nhiều con. */
  jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Bao nhiều con không cần node bọc. */
  Fragment: unknown;
}

/** Module `react-dom` mà trang cấp (chỉ cần `flushSync`). */
export interface ReactDomModule {
  /** Vẽ đồng bộ ngay trong callback. */
  flushSync(callback: () => void): void;
}

/** Root React mà `react-dom/client` trả về. */
export interface ReactRootLike {
  /** Vẽ cây. */
  render(node: unknown): void;
  /** Gỡ cây. */
  unmount(): void;
}

/** Module `react-dom/client` mà trang cấp. */
export interface ReactDomClientModule {
  /** Tạo root thường. */
  createRoot(container: Element): ReactRootLike;
  /** Thuỷ hoá DOM chờ của kernel. */
  hydrateRoot(container: Element, node: unknown): ReactRootLike;
}

/** Module `@deepseek-ai/cordis` mà trang cấp (chỉ cần `Service`). */
export interface CordisModule {
  /** Lớp nền của service. */
  Service: new (ctx: CordisContextLike, name: string) => { ctx: CordisContextLike };
}

/** Sáu module ngoài mà nửa client require từ bảng module của trang (nguyên văn danh sách gốc). */
export interface PageModules {
  /** `react`. */
  react: ReactModule;
  /** `react/jsx-runtime`. */
  jsxRuntime: JsxRuntimeModule;
  /** `react-dom`. */
  reactDom: ReactDomModule;
  /** `react-dom/client`. */
  reactDomClient: ReactDomClientModule;
  /** `@deepseek-ai/cordis`. */
  cordis: CordisModule;
  /** `@galaxy-blackhole/gbh-client-ui-slots`. */
  slotsApi: SlotsApi;
}

/** Bề mặt plugin mà Loader nhận — ĐÚNG các export của bundle gốc (`SlotRegistry` · `apply` · `inject`). */
export interface PluginSurface {
  /** Tên plugin (quy ước của repo: để chẩn đoán + HMR). */
  name: string;
  /** Điểm vào phía browser. */
  apply(ctx: CordisContextLike): void;
  /** Seam service mà thân plugin cần (bản gốc: mảng RỖNG). */
  inject: string[];
  /** Lớp service slot (bản gốc phơi ra ngoài module). */
  SlotRegistry: new (ctx: CordisContextLike) => SlotRegistryLike;
  /** Sản phẩm renderer (dùng cho test + `install`). */
  createSlotRenderer(): SlotRenderer;
  /** Bộ xử lý sự kiện cầu nối (chỉ để test quan sát). */
  createPlugin: (requireFn: RequireFn) => PluginSurface;
}

/**
 * Đăng ký bundle vào bảng module của trang — bản CÓ KIỂU của ĐÚNG dòng mà `build.ts` in vào
 * `lib/client.js`.
 *
 * Vì sao hàm này tồn tại (không chỉ là tiện ích): `bun run check:rows` đọc **văn bản src/** để tìm lời gọi
 * đăng ký id; khuôn CJS-bọc-IIFE sinh lời gọi đó trong `build.ts` nên cổng **không thấy** ⇒ báo
 * "nua client khong goi load() o dau trong src/" ⇒ CHẶN MỌI LƯỢT BOOT của dàn. Đo 18/10/2026: khai
 * `gbh.row` khi chưa có hàm này làm `check:rows` ĐỎ ngay.
 *
 * Nhận: `loader` — bảng module của trang; `factory` — hàm dựng mặt plugin.
 * Trả: không.
 */
export function loadBundle(loader: ModuleLoaderLike, factory: (requireFn: RequireFn) => unknown): void {
  loader.load({ id: PACKAGE_NAME, factory });
}

/**
 * Id module mà artifact phải đăng ký — nguồn sự thật cho test đối chiếu artifact ↔ src.
 * Nhận: không.
 * Trả: chuỗi id module.
 */
export function bundleId(): string {
  return PACKAGE_NAME;
}

/**
 * Cổng chống cài hai lần — `let` PHẠM VI MODULE, đặt TRƯỚC JSDoc của hàm (luật C).
 *
 * Vì sao không khoá theo `ctx`: hai entry ⇒ HAI ctx (`parent.extend({fiber})`) nên cổng khoá-theo-ctx
 * không bao giờ kích hoạt. Cờ CHỈ bật SAU KHI phần đăng ký chạy XONG: bật sớm thì một lần ném giữa
 * đường sẽ làm lần cài thứ hai thoát sớm ⇒ slot không bao giờ được đăng ký lại ⇒ React #130.
 */
let rendererInstalled = false;

/**
 * Nạp sáu module ngoài từ bảng module của trang.
 *
 * Nhận: `requireFn` — hàm require do loader cấp cho factory.
 * Trả: bộ module đã nạp.
 */
export function loadPageModules(requireFn: RequireFn): PageModules {
  return {
    react: requireFn("react") as ReactModule,
    jsxRuntime: requireFn("react/jsx-runtime") as JsxRuntimeModule,
    reactDom: requireFn("react-dom") as ReactDomModule,
    reactDomClient: requireFn("react-dom/client") as ReactDomClientModule,
    cordis: requireFn("@deepseek-ai/cordis") as CordisModule,
    slotsApi: requireFn("@galaxy-blackhole/gbh-client-ui-slots") as SlotsApi,
  };
}

/**
 * Dựng runtime renderer từ bảng module của trang (một lần cho mỗi lần vạt chất hoá module).
 *
 * Nhận: `requireFn` — hàm require của loader.
 * Trả: `{ runtime, modules }` — runtime đã đủ cho bindings/scoped/factories/outlets/registry.
 */
export function createRendererRuntime(requireFn: RequireFn): { runtime: RendererRuntime; modules: PageModules } {
  const modules = loadPageModules(requireFn);
  const runtime: RendererRuntime = { hooks: modules.react, jsx: modules.jsxRuntime, slotsApi: modules.slotsApi };
  return { runtime, modules };
}

/**
 * Thành phần bắc cầu DOM chờ của kernel sang ứng dụng (bản gốc: `BootHandoff`).
 *
 * Vì sao cần: kernel vẽ sẵn DOM "đang tải" (`[data-dsh-boot]`) TRƯỚC khi JS chạy; vẽ lại từ đầu sẽ làm
 * màn hình nháy trắng. Component này giữ NGUYÊN DOM đó ở lần render đầu, rồi thay bằng ứng dụng thật ở
 * lần kế tiếp — đúng cơ chế hydrate của bản gốc.
 *
 * Nhận: `props.app` — factory cây ứng dụng; `props.boot` — className + html của DOM chờ.
 * Trả: DOM chờ, hoặc cây ứng dụng.
 */
export function BootHandoff(props: {
  app: () => unknown;
  boot: { className: string; html: string };
  react: ReactModule;
}): unknown {
  const { react } = props;
  const [ready, setReady] = react.useState<boolean>(false);
  react.useLayoutEffect(() => {
    setReady(true);
  }, []);
  if (ready) return props.app();
  return react.createElement("div", {
    className: props.boot.className,
    "data-dsh-boot": "",
    dangerouslySetInnerHTML: { __html: props.boot.html },
  });
}

/**
 * Mount React, GIỮ NGUYÊN DOM chờ của kernel qua hydrate (bản gốc: `mountApp`).
 *
 * Nhận: `modules` — bộ module của trang; `container` — điểm mount; `app` — factory cây ứng dụng.
 * Trả: root React (có `unmount()`).
 */
export function mountApp(modules: PageModules, container: Element, app: () => unknown): ReactRootLike {
  const boot = container.querySelector(":scope > [data-dsh-boot]");
  if (boot !== null) {
    return modules.reactDomClient.hydrateRoot(
      container,
      modules.react.createElement(BootHandoff, {
        app,
        boot: { className: boot.className, html: boot.innerHTML },
        react: modules.react,
      }),
    );
  }
  const root = modules.reactDomClient.createRoot(container);
  modules.reactDom.flushSync(() => {
    root.render(app());
  });
  return root;
}

/**
 * Dựng mặt plugin của bundle (được `factory` trong `lib/client.js` trả về).
 *
 * Nhận: `requireFn` — hàm require của bảng module.
 * Trả: mặt plugin `{ name, apply, inject, SlotRegistry, createSlotRenderer, createPlugin }`.
 */
export function createPlugin(requireFn: RequireFn): PluginSurface {
  const { runtime, modules } = createRendererRuntime(requireFn);
  const bindings = createBindings(runtime);
  const scoped = createScopedSlots(runtime, bindings);
  const factories = createFactories(runtime, bindings, scoped);
  const outlets = createOutlets(runtime, bindings, scoped);
  void factories;
  const { SlotRegistry } = createRegistry({ ...runtime, cordis: modules.cordis });

  /**
   * Điểm vào phía browser: cài slot renderer rồi phơi `uiRenderer.mount` cho vỏ.
   *
   * Nhận: `ctx` — context client của cordis.
   * Trả: không.
   */
  function applyInner(ctx: CordisContextLike): void {
    new SlotRegistry(ctx).install(outlets.createSlotRenderer());
    ctx.reflect.provide(SERVICE_UI_RENDERER, {
      /**
       * Mount ứng dụng đã lắp ráp vào một element.
       * Nhận: `container` — điểm mount do vỏ cấp.
       * Trả: hàm gỡ (unmount root React).
       */
      mount: (container: Element): (() => void) => {
        const root = mountApp(modules, container, buildRenderApp({ ctx: ctx as unknown as Parameters<typeof buildRenderApp>[0]["ctx"] }));
        return () => {
          root.unmount();
        };
      },
    });
  }

  /**
   * Điểm vào phía browser ĐÃ CÓ CỔNG chống cài hai lần.
   * Nhận: `ctx` — context client của cordis.
   * Trả: không.
   */
  function apply(ctx: CordisContextLike): void {
    // Luật C: cổng là CỜ PHẠM VI MODULE — KHÔNG khoá theo ctx (hai entry ⇒ hai ctx ⇒ cổng khoá-ctx
    // không bao giờ kích hoạt). `check:rows` cũng cảnh báo nếu artifact còn cổng khoá theo ctx.
    if (rendererInstalled) {
      console.warn(DUPLICATE_INSTALL_WARNING);
      return;
    }
    applyInner(ctx);
    // Cờ CHỈ bật sau khi cài xong (xem JSDoc của `rendererInstalled`).
    rendererInstalled = true;
  }

  const surface: PluginSurface = {
    name: PACKAGE_NAME,
    apply,
    inject: [...INJECT],
    SlotRegistry: SlotRegistry as unknown as new (ctx: CordisContextLike) => SlotRegistryLike,
    createSlotRenderer: outlets.createSlotRenderer,
    createPlugin,
  };
  return surface;
}