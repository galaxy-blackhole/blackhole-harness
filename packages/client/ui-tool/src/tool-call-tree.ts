/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cay goi tool: mot nut node hoi thoai, moi lenh tool di qua slot KEYED tool.call.toolview
 */

import { jsxRuntime, memo, react } from "./runtime.ts";
import { toolCallTreeClasses } from "./styles.ts";
import { toolRowModel } from "./model-tool-call.ts";
import { GenericToolCard } from "./component-tool-row.ts";

/** Du lieu tho cua mot lan goi tool trong cay (ban goc khong dat kieu, ta giu 'any' cho du lieu day). */
type Wire = any;

/**
 * Phan loai giai doan cua mot khoi goi tool: ket qua · dang chuan bi · da bat dau.
 * Nhan: block — khoi goi tool tu Session log.
 * Tra: { phase, block } voi phase la "result" · "preparing" · "start".
 */
function toolCallPhase(block: Wire): { phase: string; block: Wire } {
  if ("kind" in block) return { phase: "result", block };
  return block.phase === "preparing" ? { phase: "preparing", block } : { phase: "start", block };
}

/**
 * Doc ten tool tren day cua mot lan goi theo giai doan hien tai.
 * Nhan: call — cap { phase, block } da phan loai.
 * Tra: ten tool (chuoi rong khi chua biet).
 */
function callName(call: { phase: string; block: Wire }): string {
  return call.phase === "result" ? (call.block.call?.name ?? "") : call.block.name;
}

/** Mot lan goi tool nguyen tu, dispatch qua slot KEYED do chinh row nay so huu. */
const ToolCall = memo(function ToolCall({ renderSlot, callId, toolName, call, openFile, cwd, home, inspectCall, loadImage, useDisclosure, t, children }: Wire): Wire {
  const owner = react.useMemo(
    () => ({
      callId,
      toolName,
      ...call,
      openFile,
      cwd,
      home,
      loadImage,
      useDisclosure,
      inspect: inspectCall === undefined ? undefined : () => {
        inspectCall(callId);
      },
    }),
    [callId, toolName, call, openFile, cwd, home, loadImage, inspectCall, useDisclosure],
  );
  const autoReviewDenied = react.useMemo(
    () => call.phase === "result" && toolRowModel(toolName, call.block).autoReviewDenial !== null,
    [toolName, call],
  );
  return jsxRuntime.jsxs("div", {
    className: toolCallTreeClasses.callRow,
    "data-chat-anchor-key": `call:${callId}`,
    "data-chat-call-id": callId,
    children: [
      autoReviewDenied
        ? jsxRuntime.jsx(GenericToolCard, { ...owner, t })
        : renderSlot("tool.call.toolview", owner, {
            entryKey: toolName,
            fallback: jsxRuntime.jsx(GenericToolCard, { ...owner, t }),
          }),
      children,
    ],
  });
});

/** Mot nhanh cua cay: thanh phan goi tool kem cac lenh con long nhau. */
const ToolCallBranch = memo(function ToolCallBranch({ renderSlot, block, cwd, home, openFile, inspectCall, loadImage, useDisclosure, t }: Wire): Wire {
  const call = react.useMemo(() => toolCallPhase(block), [block]);
  return jsxRuntime.jsx(ToolCall, {
    renderSlot,
    callId: call.block.callId,
    toolName: callName(call),
    call,
    openFile,
    cwd,
    home,
    inspectCall,
    useDisclosure,
    loadImage,
    t,
    children:
      call.phase !== "preparing" && call.block.subCalls.length > 0
        ? jsxRuntime.jsx("div", {
            className: toolCallTreeClasses.subCalls,
            "data-subcalls": true,
            children: call.block.subCalls.map((child: Wire) =>
              jsxRuntime.jsx(
                ToolCallBranch,
                { renderSlot, block: child, cwd, home, openFile, inspectCall, useDisclosure, loadImage, t },
                child.callId,
              ),
            ),
          })
        : null,
  });
});

/**
 * Render mot lenh goi tool goc va toan bo lenh con qua cung mot duong dispatch KEYED.
 * Nhan: props — du lieu chu so huu (node · cwd · openFile · inspectCall · loadImage · useDisclosure · useHostInfo · t).
 * Tra: cay goi tool.
 */
export function ToolCallTree({ renderSlot, node, cwd, openFile, inspectCall, loadImage, useDisclosure, useHostInfo, t }: Wire): Wire {
  const home = useHostInfo((info: Wire) => info.home);
  return jsxRuntime.jsx(ToolCallBranch, {
    renderSlot,
    block: node.data.root,
    cwd,
    home,
    openFile,
    inspectCall,
    useDisclosure,
    loadImage,
    t,
  });
}
