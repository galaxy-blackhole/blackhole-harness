/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hai component hien thi cua row ui-skill: the tool-call (SkillRow) va chip /ten-skill (SkillReference)
 */

import { SKILL_ROW_CLASSES, SKILL_ROW_CSS, SKILL_ROW_STYLE_TAG } from "./skill-row-css.ts";

/** `require` của factory do vỏ cấp (seed nền tảng). */
declare const require: (specifier: string) => unknown;
/** `document` của trang (có thể vắng khi test không DOM). */
declare const document:
  | {
      querySelector(selector: string): unknown;
      createElement(tag: string): { dataset: Record<string, string>; textContent: string };
      head: { appendChild(node: unknown): void };
    }
  | undefined;

/** Hai hàm jsx của React + Fragment. */
interface JsxRuntime {
  /** Dựng element một con. */
  jsx(type: unknown, props: unknown): unknown;
  /** Dựng element nhiều con. */
  jsxs(type: unknown, props: unknown): unknown;
  /** Fragment của React. */
  Fragment: unknown;
}
/** Bề mặt React mà thẻ này dùng. */
interface ReactFace {
  /** Hook trạng thái mở/đóng. */
  useState<T>(initial: T): [T, (update: (previous: T) => T) => void];
}
/** Bề mặt seed primitives mà hai component dùng (tra từ bản gốc). */
interface PrimitivesFace {
  /** Icon skill. */
  IconSkillOutlineRegular: unknown;
  /** Icon chevron xuống. */
  IconChevronDownOutlineRegular: unknown;
  /** Icon inspect. */
  IconInspectOutlineRegular: unknown;
  /** Chữ chạy shimmer khi đang tải. */
  TextShimmer: unknown;
  /** Chip tham chiếu. */
  ReferenceChip: unknown;
}
/** Một khối nội dung trong kết quả tool. */
interface ContentBlock {
  /** Loại khối. */
  type: string;
  /** Nội dung văn bản khi là text. */
  text?: string;
}
/** Bản ghi tool-call mà tầng tool truyền vào. */
interface SkillBlock {
  /** Có mặt khi call đã kết thúc. */
  kind?: string;
  /** Id của call. */
  callId: string;
  /** Tham số thô của call. */
  argsRaw?: string;
  /** Call đã xong. */
  call?: { argsRaw?: string };
  /** Call lỗi. */
  isError?: boolean;
  /** Lỗi kèm mã. */
  error?: { code?: string; name?: string };
  /** Các khối kết quả. */
  content?: ContentBlock[];
}
/** Props mà tầng slots truyền cho thẻ. */
interface SkillRowProps {
  /** `preparing` khi thẻ chưa bắt đầu chạy. */
  phase?: string;
  /** Bản ghi call. */
  block: SkillBlock;
  /** Mở file skill đang chạy (nếu tầng tool cấp). */
  inspect?: () => void;
  /** Hàm đọc chuỗi theo namespace `skill`. */
  t: (key: string) => string;
}
/** Props của chip tham chiếu. */
interface SkillReferenceProps {
  /** Node tham chiếu (mang tên skill). */
  node: { data: { name: string } };
  /** Chuỗi gốc trong nội dung. */
  raw: string;
  /** Có bấm mở được không. */
  interactive: boolean;
  /** Mở skill theo tên. */
  openSkill: (name: string) => void;
}

/** Hai hàm jsx lấy từ seed nền tảng. */
const jsxRuntime = require("react/jsx-runtime") as JsxRuntime;
/** React (hook trạng thái) lấy từ seed nền tảng. */
const react = require("react") as ReactFace;
/** Bộ primitive lấy từ seed nền tảng. */
const primitives = require("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesFace;

/** Chèn CSS của thẻ một lần duy nhất (bundle tự tiêm thẻ style, không qua pipeline CSS của bundler). */
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(SKILL_ROW_STYLE_TAG) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "@galaxy-blackhole/gbh-client-ui-skill";
  tag.dataset.pluginCss = SKILL_ROW_STYLE_TAG;
  tag.textContent = SKILL_ROW_CSS;
  document.head.appendChild(tag);
}

/** Nối tên lớp, bỏ giá trị rỗng. */
const cx = (...names: (string | false | undefined)[]): string => names.filter((name) => typeof name === "string" && name !== "").join(" ");

/** Dòng vật lý đầu tiên — cho summary khi lỗi và cho tham số hỏng. */
function firstLine(text: string): string {
  const newline = text.indexOf("\n");
  return newline === -1 ? text : text.slice(0, newline);
}

/** Tên skill là tham số duy nhất mà thẻ rút gọn trình bày. */
function skillName(argsRaw: string, callId: string): string {
  try {
    const parsed: unknown = JSON.parse(argsRaw);
    if (typeof parsed === "object" && parsed !== null) {
      const name = (parsed as { name?: unknown }).name;
      if (typeof name === "string" && name !== "") return firstLine(name);
    }
  } catch {
    // tham số không phải JSON: rơi xuống nhánh dưới, đúng như bản gốc
  }
  return argsRaw === "" ? callId : firstLine(argsRaw);
}

/** Gộp các khối kết quả thành văn bản theo hợp đồng của thẻ tool chung. */
function resultText(block: SkillBlock): string | null {
  if (block.kind === undefined) return null;
  const parts: string[] = [];
  for (const item of block.content ?? []) parts.push(item.type === "text" ? item.text ?? "" : JSON.stringify(item, null, 2));
  if (parts.length === 0 && block.error !== undefined) parts.push((block.error.name ?? "error") + ": " + (block.error.code ?? ""));
  return parts.join("\n") || null;
}

/** Suy trạng thái hiển thị mà không cần hỏi catalog skill đang sống. */
function skillRowModel(block: SkillBlock): { name: string; output: string | null; errorSummary: string | null; state: string } {
  const settled = block.kind !== undefined;
  const argsRaw = (settled ? block.call?.argsRaw : block.argsRaw) ?? "";
  const state = !settled ? "running" : block.error?.code === "interrupted" ? "stopped" : block.isError ? "error" : "ok";
  const output = resultText(block);
  return { name: skillName(argsRaw, block.callId), output, errorSummary: state === "error" && output !== null ? firstLine(output) : null, state };
}

/** Ô dẫn dắt: icon trạng thái lúc nghỉ, chevron khi hover hoặc khi đang mở. */
function disclosureLeading(open: boolean, expandable: boolean): unknown {
  if (open) return jsxRuntime.jsx(primitives.IconChevronDownOutlineRegular, { className: SKILL_ROW_CLASSES.chevron });
  const icon = jsxRuntime.jsx(primitives.IconSkillOutlineRegular, { size: 14 });
  if (!expandable) return icon;
  return jsxRuntime.jsxs(jsxRuntime.Fragment, {
    children: [
      jsxRuntime.jsx("span", { className: SKILL_ROW_CLASSES.iconIdle, children: icon }),
      jsxRuntime.jsx(primitives.IconChevronDownOutlineRegular, { className: cx(SKILL_ROW_CLASSES.chevron, SKILL_ROW_CLASSES.chevronHover) }),
    ],
  });
}

/** Chữ trạng thái cho screen reader (màu không đủ để truyền đạt trạng thái). */
function stateStatus(state: string, t: (key: string) => string): string | null {
  if (state === "running") return t("row.running");
  if (state === "error") return t("row.failed");
  return null;
}

/**
 * Thẻ tool-call của skill: nhánh `preparing` khi chưa chạy, còn lại là thẻ đã bắt đầu.
 * Nhận: props do tầng slots truyền (phase, block, inspect, t).
 * Trả: element React của thẻ.
 */
export function SkillRow(props: SkillRowProps): unknown {
  if (props.phase === "preparing")
    return jsxRuntime.jsx("div", {
      className: SKILL_ROW_CLASSES.card,
      "data-tool": "skill",
      "data-state": "preparing",
      children: jsxRuntime.jsxs("div", {
        className: SKILL_ROW_CLASSES.row,
        children: [
          jsxRuntime.jsx("span", { className: SKILL_ROW_CLASSES.leading, children: jsxRuntime.jsx(primitives.IconSkillOutlineRegular, { size: 14 }) }),
          jsxRuntime.jsx("span", { className: SKILL_ROW_CLASSES.visuallyHidden, children: props.t("row.preparing") }),
          jsxRuntime.jsx(primitives.TextShimmer, { active: true, className: SKILL_ROW_CLASSES.title, children: props.t("row.title") }),
        ],
      }),
    });
  return jsxRuntime.jsx(StartedSkillRow, props);
}

/** Thẻ đã bắt đầu: một dòng trạng thái + phần hướng dẫn mở rộng + nút Inspect. */
function StartedSkillRow({ block, inspect, t }: SkillRowProps): unknown {
  const model = skillRowModel(block);
  const [expanded, setExpanded] = react.useState(false);
  const expandable = model.output !== null;
  const open = expanded && expandable;
  const status = stateStatus(model.state, t);
  const running = model.state === "running";
  const summary = model.state === "stopped" ? t("row.stopped") : model.errorSummary ?? model.name;
  /** Đảo trạng thái mở/đóng. */
  const toggleExpand = (): void => {
    setExpanded((value) => !value);
  };
  /** Mở/đóng bằng bàn phím khi thẻ mở rộng được. */
  const toggleFromKeyboard = (event: { key: string; preventDefault(): void }): void => {
    if (!expandable || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    toggleExpand();
  };
  const disclosureProps =
    expandable === true
      ? { role: "button", tabIndex: 0, "aria-expanded": open, onClick: toggleExpand, onKeyDown: toggleFromKeyboard }
      : {};
  const summaryClass =
    model.state === "error" ? SKILL_ROW_CLASSES.errorSummary : model.state === "stopped" ? SKILL_ROW_CLASSES.stoppedSummary : "";
  return jsxRuntime.jsxs("div", {
    className: SKILL_ROW_CLASSES.card,
    "data-tool": "skill",
    "data-state": model.state,
    children: [
      jsxRuntime.jsxs("div", {
        className: SKILL_ROW_CLASSES.row,
        "data-expandable": expandable || undefined,
        ...disclosureProps,
        children: [
          jsxRuntime.jsx("span", { className: SKILL_ROW_CLASSES.leading, children: disclosureLeading(open, expandable) }),
          status === null ? null : jsxRuntime.jsx("span", { className: SKILL_ROW_CLASSES.visuallyHidden, children: status }),
          jsxRuntime.jsxs(primitives.TextShimmer, {
            active: running,
            children: [
              jsxRuntime.jsx("span", { className: SKILL_ROW_CLASSES.title, children: jsxRuntime.jsx(primitives.TextShimmer, { children: t("row.title") }) }),
              jsxRuntime.jsx("span", { className: SKILL_ROW_CLASSES.separator, "data-shimmer-decoration": true, "aria-hidden": true }),
              jsxRuntime.jsx("span", { className: cx(SKILL_ROW_CLASSES.summary, summaryClass), children: jsxRuntime.jsx(primitives.TextShimmer, { children: summary }) }),
            ],
          }),
        ],
      }),
      open
        ? jsxRuntime.jsxs("div", {
            className: SKILL_ROW_CLASSES.bodyWrap,
            children: [
              jsxRuntime.jsxs("section", {
                className: SKILL_ROW_CLASSES.instructionsCard,
                "aria-label": t("row.instructions"),
                children: [
                  jsxRuntime.jsx("div", { className: SKILL_ROW_CLASSES.instructionsHeader, children: t("row.instructions") }),
                  jsxRuntime.jsx("pre", { className: SKILL_ROW_CLASSES.instructions, "data-error": model.state === "error" || undefined, children: model.output }),
                ],
              }),
              inspect === undefined
                ? null
                : jsxRuntime.jsxs("button", {
                    type: "button",
                    className: SKILL_ROW_CLASSES.inspectButton,
                    onClick: inspect,
                    children: [jsxRuntime.jsx(primitives.IconInspectOutlineRegular, {}), t("row.inspect")],
                  }),
            ],
          })
        : null,
    ],
  });
}

/**
 * Chip `/ten-skill` trong nội dung người dùng (chỉ bấm mở được khi tầng hội thoại cho phép).
 * Nhận: node tham chiếu, chuỗi gốc, cờ interactive, hàm mở skill.
 * Trả: element React của chip.
 */
export function SkillReference({ node, raw, interactive, openSkill }: SkillReferenceProps): unknown {
  return jsxRuntime.jsx(primitives.ReferenceChip, {
    appearance: "skill",
    label: "/" + node.data.name,
    title: raw,
    ...(interactive
      ? {
          onActivate: () => {
            openSkill(node.data.name);
          },
        }
      : {}),
  });
}

