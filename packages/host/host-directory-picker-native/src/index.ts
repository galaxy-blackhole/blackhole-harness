/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Backend `native` của seam directory-picker: mở MỘT hộp chọn thư mục của hệ điều hành mỗi lần chọn — macOS AppKit panel (JXA) · Linux zenity/kdialog · Windows IFileOpenDialog trong tiến trình con (koffi/COM). Port 1:1 lib/index.js của @galaxy-blackhole/gbh-host-directory-picker-native (340 dòng); seam khai bằng interface HẸP cục bộ (luật repo: không import tĩnh @deepseek-ai/*).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Hình dạng HẸP của seam directory-picker (không import tĩnh DSH). */
abstract class DirectoryPickerBase {
  /** Giữ context cordis. */
  constructor(protected readonly ctx: unknown) {}
  /** Capability ổn định của service. */
  abstract capability(): unknown;
}

/** Tham số của một tiến trình native (bản gốc `runNativeCommand(spec, argv, signal, mode)`). */
export interface NativeRunResult { stdout: string; }
/** Hàm chạy lệnh native — injectable để test tất định. */
export type NativeRunner = (spec: string, argv: string[], signal: AbortSignal, mode: "hidden") => Promise<NativeRunResult>;
/** Hook nội bộ của nhánh win32. */
export interface Win32DialogInternals {
  spawnWorker?: (data: { title: string }) => ChildProcess;
  closeThreadWindows?: (threadId: number) => Promise<void>;
  closeRetryMs?: number;
}
/** Hook nội bộ của bộ chọn native (test tất định). */
export interface NativePickerInternals {
  platform?: string;
  run?: NativeRunner;
  pickWin32Dialog?: (signal: AbortSignal) => Promise<string | null>;
}
/** Thông báo từ tiến trình con Win32. */
type WorkerMessage = { kind: "showing"; threadId: number } | { kind: "done"; path: string | null } | { kind: "error"; message: string };

/** Mã đóng cửa sổ Win32 (`WM_CLOSE`). */
const WM_CLOSE = 16;
/** Tiêu đề hộp thoại mọi host hiển thị. */
const DIALOG_TITLE = "Select Workspace Directory";
/** Nhịp gửi lại `WM_CLOSE` trong lúc chờ worker thoát. */
const CLOSE_RETRY_MS = 150;
/** Số lần thử phục vụ abort trước khi kill worker. */
const CLOSE_MAX_ATTEMPTS = 20;

/**
 * Mã hoá GUID chuẩn thành 16 byte little-endian.
 * Nhận: chuỗi dạng xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.
 * Trả: Buffer 16 byte.
 */
function guidBytes(text: string): Buffer {
  const match = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i.exec(text);
  if (match === null) throw new Error("guid khong hop le: " + text);
  const bytes = Buffer.alloc(16);
  bytes.writeUInt32LE(parseInt(match[1] as string, 16), 0);
  bytes.writeUInt16LE(parseInt(match[2] as string, 16), 4);
  bytes.writeUInt16LE(parseInt(match[3] as string, 16), 6);
  Buffer.from((match[4] as string) + (match[5] as string), "hex").copy(bytes, 8);
  return bytes;
}
// Bản gốc giải mã 2 GUID ngay lúc nạp module (bắt lỗi sớm); giữ nguyên hành vi.
guidBytes("dc1c5a9c-e88a-4dde-a5a1-60f82a20aef7");
guidBytes("d57c7288-d4ad-4768-be02-9d969532d960");

/**
 * Gửi `WM_CLOSE` tới mọi cửa sổ của một thread native (đòn abort của driver).
 * Nhận: threadId của hộp thoại.
 * Trả: không.
 */
async function closeThreadWindows(threadId: number): Promise<void> {
  // Specifier KHÔNG phải literal: gói này không cài koffi (chỉ Windows cần) ⇒ tránh TS phân giải tĩnh.
  const koffiModule = "koffi";
  const koffi = ((await import(koffiModule)) as { default: KoffiLike }).default;
  const user32 = koffi.load("user32.dll");
  const enumThreadWindows = user32.func("__stdcall", "EnumThreadWindows", "int", ["uint32", "void *", "intptr"]);
  const postMessageW = user32.func("__stdcall", "PostMessageW", "int", ["void *", "uint32", "uintptr", "intptr"]);
  const protoEnumProc = koffi.proto("int __stdcall DshEnumThreadWndProc(void *hwnd, intptr lparam)");
  const callback = koffi.register((hwnd: unknown) => { postMessageW(hwnd, WM_CLOSE, 0, 0); return 1; }, koffi.pointer(protoEnumProc));
  try { enumThreadWindows(threadId, callback, 0); } finally { koffi.unregister(callback); }
}

/** Hình dạng tối thiểu của koffi (không import tĩnh). */
interface KoffiLike {
  load(name: string): { func(abi: string, name: string, ret: string, args: string[]): (...args: unknown[]) => unknown };
  proto(decl: string): unknown;
  register(callback: (hwnd: unknown) => number, type: unknown): unknown;
  pointer(type: unknown): unknown;
  unregister(value: unknown): void;
}

/**
 * Spawn tiến trình con mở hộp thoại.
 * Nhận: payload con (tiêu đề).
 * Trả: ChildProcess đã spawn.
 */
function spawnDialogWorker(data: { title: string }): ChildProcess {
  const env = { ...process.env, DSH_DIALOG_TITLE: data.title };
  const stdio: ["ignore", "inherit", "inherit", "ipc"] = ["ignore", "inherit", "inherit", "ipc"];
  const url = import.meta.url;
  if (!url.endsWith(".ts")) return spawn(process.execPath, [fileURLToPath(new URL("./worker.cjs", url))], { env, stdio, windowsHide: true });
  return spawn(process.execPath, ["--import", import.meta.resolve("tsx/esm"), fileURLToPath(new URL("./win32-dialog-worker.ts", url))], { env, stdio, windowsHide: true });
}

/**
 * Chốt union đóng của thông báo worker.
 * Nhận: giá trị không xác định.
 * Trả: không (luôn ném).
 */
function assertNever(value: never): never {
  throw new TypeError("unknown win32 dialog worker message kind: " + String(value));
}

/**
 * Mở hộp chọn thư mục Win32 hiện đại NGOÀI event loop.
 * Nhận: signal vòng đời · hook worker/window cho test tất định.
 * Trả: đường dẫn đã chọn, hoặc null khi người dùng huỷ.
 */
async function pickWin32Directory(signal: AbortSignal, internals: Win32DialogInternals = {}): Promise<string | null> {
  if (signal.aborted) throw new Error("native directory picker aborted");
  const spawnWorker = internals.spawnWorker ?? spawnDialogWorker;
  const closeWindows = internals.closeThreadWindows ?? closeThreadWindows;
  const closeRetryMs = internals.closeRetryMs ?? CLOSE_RETRY_MS;
  const worker = spawnWorker({ title: DIALOG_TITLE });
  let dialogThreadId: number | undefined;
  let closeTimer: ReturnType<typeof setInterval> | undefined;
  let settled = false;
  return await new Promise<string | null>((resolveValue, reject) => {
    const settle = (outcome: () => void): void => {
      if (settled) return;
      settled = true;
      if (closeTimer !== undefined) clearInterval(closeTimer);
      signal.removeEventListener("abort", onAbort);
      worker.unref?.();
      outcome();
    };
    const postClose = (): void => {
      if (dialogThreadId !== undefined) closeWindows(dialogThreadId).catch(() => undefined);
    };
    const serviceAbort = (): void => {
      let attempts = 0;
      closeTimer = setInterval(() => {
        attempts += 1;
        if (attempts > CLOSE_MAX_ATTEMPTS) {
          settle(() => { worker.kill(); reject(new Error("native directory picker aborted (dialog unresponsive; worker killed)")); });
          return;
        }
        postClose();
      }, closeRetryMs);
      postClose();
    };
    const onAbort = (): void => { serviceAbort(); };
    signal.addEventListener("abort", onAbort, { once: true });
    worker.on("message", (message: WorkerMessage) => {
      switch (message.kind) {
        case "showing":
          dialogThreadId = message.threadId;
          if (signal.aborted) postClose();
          return;
        case "done":
          settle(() => { if (signal.aborted) reject(new Error("native directory picker aborted")); else resolveValue(message.path); });
          return;
        case "error":
          settle(() => { reject(new Error("win32 folder dialog failed: " + message.message)); });
          return;
        default:
          assertNever(message);
      }
    });
    worker.on("error", (error: Error) => { settle(() => { reject(error); }); });
    worker.on("exit", () => { settle(() => { reject(new Error("win32 folder dialog worker exited before reporting a result")); }); });
  });
}

/** Nguồn panel macOS chạy bằng JXA (`osascript -l JavaScript`) — GIỮ NGUYÊN VĂN bản gốc. */
const MAC_PANEL = [
"",
"ObjC.import('AppKit');",
"function run(argv) {",
"  var app = $.NSApplication.sharedApplication;",
"  app.setActivationPolicy($.NSApplicationActivationPolicyAccessory);",
"  var mainMenu = $.NSMenu.alloc.init;",
"  mainMenu.addItem($.NSMenuItem.alloc.init);",
"  var editMenu = $.NSMenu.alloc.initWithTitle('Edit');",
"  var editItem = $.NSMenuItem.alloc.init;",
"  editItem.submenu = editMenu;",
"  mainMenu.addItem(editItem);",
"  editMenu.addItemWithTitleActionKeyEquivalent('Undo', 'undo:', 'z');",
"  editMenu.addItemWithTitleActionKeyEquivalent('Redo', 'redo:', 'Z');",
"  editMenu.addItemWithTitleActionKeyEquivalent('Cut', 'cut:', 'x');",
"  editMenu.addItemWithTitleActionKeyEquivalent('Copy', 'copy:', 'c');",
"  editMenu.addItemWithTitleActionKeyEquivalent('Paste', 'paste:', 'v');",
"  editMenu.addItemWithTitleActionKeyEquivalent('Select All', 'selectAll:', 'a');",
"  app.mainMenu = mainMenu;",
"  app.activateIgnoringOtherApps(true);",
"  var panel = $.NSOpenPanel.openPanel;",
"  panel.canChooseFiles = false;",
"  panel.canChooseDirectories = true;",
"  panel.canCreateDirectories = true;",
"  panel.allowsMultipleSelection = false;",
"  panel.message = argv[0];",
"  if (panel.runModal !== $.NSModalResponseOK) return '';",
"  var urls = panel.URLs;",
"  if (urls.count < 1) return '';",
"  return ObjC.unwrap(urls.objectAtIndex(0).path);",
"}",
].join("\n");

/**
 * Đường dẫn từ stdout ('' ⇒ null).
 * Nhận: stdout.
 * Trả: đường dẫn hoặc null.
 */
function outputPath(stdout: string): string | null {
  const path = stdout.replace(/[\r\n]+$/, "");
  return path === "" ? null : path;
}

/**
 * Mã lỗi của một giá trị bị ném (nếu có).
 * Nhận: giá trị.
 * Trả: mã dạng string/number hoặc undefined.
 */
function errorCode(error: unknown): string | number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" || typeof code === "number" ? code : undefined;
}

/**
 * Có phải lỗi 'không tìm thấy lệnh' (ENOENT).
 * Nhận: giá trị bị ném.
 * Trả: true/false.
 */
function isMissingCommand(error: unknown): boolean { return errorCode(error) === "ENOENT"; }

/**
 * Ném lại lỗi nếu signal đã abort.
 * Nhận: signal · lỗi.
 * Trả: không (ném khi abort).
 */
function rethrowIfAborted(signal: AbortSignal, error: unknown): void { if (signal.aborted) throw error; }

/**
 * Mở bộ chọn thư mục của nền tảng.
 * Nhận: signal vòng đời · hook nền tảng/runner cho test tất định.
 * Trả: đường dẫn đã chọn, hoặc null khi người dùng huỷ.
 */
export async function pickNativeDirectory(signal: AbortSignal, internals: NativePickerInternals = {}): Promise<string | null> {
  const platform = internals.platform ?? process.platform;
  const run: NativeRunner = internals.run ?? (async () => { throw new Error("chua cam runner native"); });
  if (platform === "darwin") return outputPath((await run("osascript", ["-l", "JavaScript", "-e", MAC_PANEL, DIALOG_TITLE], signal, "hidden")).stdout);
  if (platform === "win32") return await (internals.pickWin32Dialog ?? pickWin32Directory)(signal);
  if (platform === "linux") {
    try {
      return outputPath((await run("zenity", ["--file-selection", "--directory", "--title=" + DIALOG_TITLE], signal, "hidden")).stdout);
    } catch (error) {
      rethrowIfAborted(signal, error);
      if (errorCode(error) === 1) return null;
      if (!isMissingCommand(error)) throw error;
    }
    try {
      return outputPath((await run("kdialog", ["--getexistingdirectory", ".", "--title", DIALOG_TITLE], signal, "hidden")).stdout);
    } catch (error) {
      rethrowIfAborted(signal, error);
      if (errorCode(error) === 1) return null;
      if (isMissingCommand(error)) throw new Error("no supported native directory picker found (install zenity or kdialog)");
      throw error;
    }
  }
  throw new Error("native directory picker is unsupported on " + platform);
}

/** Backend `native` của `ctx.directoryPicker` (capability ổn định theo vòng đời service). */
export class NativeDirectoryPicker extends DirectoryPickerBase {
  /** Capability ổn định. */
  private readonly nativeCapability: { kind: "native"; pick: (signal: AbortSignal) => Promise<string | null> };
  /**
   * Dựng backend.
   * Nhận: ctx cordis.
   * Trả: instance.
   */
  constructor(ctx: unknown) {
    super(ctx);
    this.nativeCapability = { kind: "native", pick: (signal) => pickNativeDirectory(signal) };
  }
  /**
   * Capability native.
   * Nhận: không.
   * Trả: object capability ổn định.
   */
  capability(): unknown { return this.nativeCapability; }
}

export default NativeDirectoryPicker;
