/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng lib/types/core/menu.js của bản gốc — lõi thuần giảm trạng thái menu: roster, thế hệ, tự đóng, tô sáng
 */

import type { InputTriggerSource, MenuEvent, MenuGroup, MenuHighlight, MenuState } from "./types.ts";

/**
 * Trạng thái nghỉ đã đóng với thế hệ 0; giá trị khởi tạo store và hạt giống test.
 * Nhận: không có.
 * Trả: trạng thái menu đóng, không nhóm, không tô sáng.
 */
export const MENU_CLOSED: MenuState = {
  open: false,
  hit: null,
  generation: 0,
  groups: [],
  highlight: null,
};

/**
 * Thay roster nhóm bằng các nhóm đang chờ cho sources, theo thứ tự.
 * Bước phía shell trước khi phát hit khi menu mở mới.
 *
 * Nhận: state — trạng thái menu hiện tại; sources — các nguồn đã đăng ký cho trigger của hit, theo thứ tự menu.
 * Trả: trạng thái mang roster chờ mới; tô sáng bị xoá.
 */
export function seedGroups(
  state: MenuState,
  sources: readonly Pick<InputTriggerSource, "name" | "showGroupTitle">[],
): MenuState {
  return {
    ...state,
    groups: sources.map((source) => ({
      source: source.name,
      ...(source.showGroupTitle === false ? { showGroupTitle: false } : {}),
      status: "pending" as const,
      items: [] as const,
    })),
    highlight: null,
  };
}

/**
 * Đóng menu, giữ nguyên thế hệ để các kết quả đang bay vẫn bị bỏ đúng.
 * Nhận: state — trạng thái menu hiện tại.
 * Trả: trạng thái đã đóng (chính state khi vốn đã nghỉ).
 */
const closed = (state: MenuState): MenuState =>
  state.open || state.hit !== null || state.groups.length > 0 || state.highlight !== null
    ? {
        open: false,
        hit: null,
        generation: state.generation,
        groups: [],
        highlight: null,
      }
    : state;

/**
 * Ứng viên đầu tiên của nhóm sẵn sàng đầu tiên có phần tử.
 * Nhận: groups — các nhóm menu.
 * Trả: vị trí tô sáng mặc định, hoặc null khi mọi nhóm rỗng/chưa sẵn sàng.
 */
function firstHighlight(groups: readonly MenuGroup[]): MenuHighlight | null {
  for (const g of groups) {
    if (g.status === "ready" && g.items.length > 0) {
      return {
        source: g.source,
        index: 0,
      };
    }
  }
  return null;
}

/**
 * Giữ tô sáng khi nó còn trỏ vào một ứng viên sẵn sàng.
 * Nhận: highlight — vị trí đang tô sáng; groups — các nhóm menu.
 * Trả: chính highlight khi còn hợp lệ, ngược lại null.
 */
function validHighlight(highlight: MenuHighlight | null, groups: readonly MenuGroup[]): MenuHighlight | null {
  if (!highlight) return null;
  const g = groups.find((x) => x.source === highlight.source);
  return g && g.status === "ready" && highlight.index < g.items.length ? highlight : null;
}

/**
 * Trải các ứng viên sẵn sàng thành vị trí (nguồn, chỉ số) theo thứ tự nhóm.
 * Nhận: groups — các nhóm menu.
 * Trả: mảng vị trí của mọi ứng viên sẵn sàng.
 */
function positions(groups: readonly MenuGroup[]): MenuHighlight[] {
  const out: MenuHighlight[] = [];
  for (const g of groups) {
    if (g.status !== "ready") continue;
    for (let i = 0; i < g.items.length; i++) {
      out.push({
        source: g.source,
        index: i,
      });
    }
  }
  return out;
}

/**
 * True khi mọi nhóm đều sẵn sàng và rỗng (điều kiện tự đóng).
 * Nhận: groups — các nhóm menu.
 * Trả: true khi mọi nhóm ready với 0 ứng viên.
 */
const allReadyEmpty = (groups: readonly MenuGroup[]): boolean =>
  groups.every((g) => g.status === "ready" && g.items.length === 0);

/**
 * Bộ giảm thuần của menu. hit mở một thế hệ mới trên roster đã gieo (hit null thì đóng);
 * source-settled ngoài thế hệ hiện tại, ngoài menu đang mở, hoặc ngoài roster thì bị bỏ; một kết quả
 * hoặc lỗi để mọi nhóm sẵn sàng-và-rỗng (hoặc không nhóm nào) thì tự đóng; source-failed âm thầm
 * xoá nhóm (shell ghi log); move xoay tô sáng qua các ứng viên sẵn sàng; hover đỗ nó lên một ứng viên
 * sẵn sàng (chuột và bàn phím dùng chung một tô sáng — đầu vào cuối thắng).
 *
 * Nhận: state — trạng thái menu hiện tại; ev — sự kiện menu.
 * Trả: trạng thái kế tiếp; chính tham chiếu cũ khi sự kiện cũ hoặc không đổi gì.
 */
export const menuReduce = (state: MenuState, ev: MenuEvent): MenuState => {
  switch (ev.type) {
    case "hit": {
      if (ev.hit === null) return closed(state);
      return {
        open: true,
        hit: ev.hit,
        generation: state.generation + 1,
        groups: state.groups.map((g) => ({
          ...g,
          status: "pending" as const,
        })),
        highlight: state.highlight,
      };
    }
    case "source-settled": {
      if (!state.open || ev.generation !== state.generation) return state;
      const idx = state.groups.findIndex((g) => g.source === ev.source);
      if (idx < 0) return state;
      const items = ev.items ?? [];
      const groups = state.groups.map((g, i) => (i === idx ? { ...g, status: "ready" as const, items } : g));
      if (allReadyEmpty(groups)) return closed(state);
      const highlight = validHighlight(state.highlight, groups) ?? firstHighlight(groups);
      return {
        ...state,
        groups,
        highlight,
      };
    }
    case "source-failed": {
      if (!state.open || ev.generation !== state.generation) return state;
      if (!state.groups.some((g) => g.source === ev.source)) return state;
      const groups = state.groups.filter((g) => g.source !== ev.source);
      if (groups.length === 0 || allReadyEmpty(groups)) return closed(state);
      const highlight = validHighlight(state.highlight, groups) ?? firstHighlight(groups);
      return {
        ...state,
        groups,
        highlight,
      };
    }
    case "move": {
      if (!state.open) return state;
      const pos = positions(state.groups);
      if (pos.length === 0) return state;
      const hl = state.highlight;
      const at = hl ? pos.findIndex((p) => p.source === hl.source && p.index === hl.index) : -1;
      const next = pos[at < 0 ? (ev.dir === 1 ? 0 : pos.length - 1) : (at + ev.dir + pos.length) % pos.length];
      if (next === undefined) return state;
      if (hl && next.source === hl.source && next.index === hl.index) return state;
      return {
        ...state,
        highlight: next,
      };
    }
    case "hover": {
      if (!state.open) return state;
      const target = validHighlight(
        {
          source: ev.source,
          index: ev.index,
        },
        state.groups,
      );
      if (target === null) return state;
      const hl = state.highlight;
      if (hl && hl.source === target.source && hl.index === target.index) return state;
      return {
        ...state,
        highlight: target,
      };
    }
    case "close": {
      return closed(state);
    }
  }
};
