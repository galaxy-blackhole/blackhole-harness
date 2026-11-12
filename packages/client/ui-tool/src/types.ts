/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kieu dung chung cua row ui-tool: bang module cua tang nap, primitive, va kieu du lieu tho cua cay Tool
 */

/** Ham tao phan tu cua react/jsx-runtime. */
export type JsxFn = (type: unknown, props: Record<string, unknown> | null, key?: unknown) => unknown;

/** Bang module react/jsx-runtime nhu ban goc dung. */
export interface JsxRuntime {
  /** Tao mot phan tu. */
  jsx: JsxFn;
  /** Tao mot phan tu nhieu con. */
  jsxs: JsxFn;
  /** Node boc nhieu con khong co phan tu cha. */
  Fragment: unknown;
}

/** Bang module react: chi nhung hook ma row nay that su dung. */
export interface ReactModule {
  /** Trang thai cuc bo. */
  useState: <T>(initial: T | (() => T)) => [T, (next: T | ((current: T) => T)) => void];
  /** O nho. */
  useRef: <T>(initial: T) => { current: T };
  /** Hieu ung vong doi, tra ham don dep. */
  useEffect: (run: () => void | (() => void), deps?: readonly unknown[]) => void;
  /** Ghi nho gia tri dan xuat. */
  useMemo: <T>(factory: () => T, deps: readonly unknown[]) => T;
  /** Ghi nho ham. */
  useCallback?: <T>(fn: T, deps: readonly unknown[]) => T;
  /** Gop context cua React. */
  useContext?: (context: unknown) => unknown;
  /** Nha React dung cho portal. */
  createElement?: unknown;
}

/** Bang module primitive cua DSH — chi doc trong than ham render. */
export type PrimitivesModule = Record<string, unknown>;

/** Bang module ma factory nhan tu tang nap. */
export interface ToolRuntimeDeps {
  /** react/jsx-runtime. */
  jsx: JsxRuntime;
  /** react. */
  react: ReactModule;
  /** @galaxy-blackhole/gbh-client-ui-primitives. */
  primitives: PrimitivesModule;
}

/** Pham vi slot ma mot toolview dung de dang ky — dung chung cho ca context that lan context gia. */
export interface SlotScope {
  /** So slot cua context. */
  slots: {
    /** Tiem vao mot slot (ten slot LITERAL). */
    inject: (name: string, body: () => unknown) => unknown;
    /** Dang ky mot nguoi ngoi — component la THAM SO THU HAI. */
    register: (spec: Record<string, unknown>, component: unknown) => unknown;
  };
}

/** Mat dich vu hoi thoai ma toolview todo can (ban goc tiem qua ctx.uiConversation). */
export interface UiConversationService {
  /** So dang ky dinh nghia su kien cua hoi thoai. */
  events: { register: (definition: unknown) => unknown };
  /** So dang ky view cua hoi thoai. */
  views: { register: (view: unknown) => unknown };
  /** Neo vao mot phien de lay dich cua hook. */
  binding: (sessionId: string) => { target: (name: string) => unknown };
}

/** Pham vi day du cho toolview todo — thieu uiConversation thi chi dang ky duoc slot tran. */
export interface ToolviewScope extends SlotScope {
  /** Mat dich vu hoi thoai (co the thieu o profile khong bat row hoi thoai). */
  uiConversation?: UiConversationService;
}

/** Mot lan dang ky slot bat duoc tu context gia hoac that. */
export interface SlotRegistration {
  /** Spec slot (name/key/locale/children/inject...). */
  spec: Record<string, unknown>;
  /** Component — luon la THAM SO THU HAI cua register. */
  component: unknown;
}
