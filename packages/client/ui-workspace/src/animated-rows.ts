/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc AnimatedRows — lop phu thoat dong Qg_5Eq_exits: di chuyen + mo dan dong theo khoa, nguyen hanh vi ban goc
 */

import { animatedRowsStyles } from "./css.ts";
import { ROW_FADE_MS, ROW_GLIDE_MS } from "./ids.ts";
import { ext, fragment, h, hs, type Dyn } from "./runtime.ts";

/** Khoa cua mot dong dang render (chuoi `workspace:…` / `session:…` / `overflow:…` / `empty`). */
export interface AnimatedRowsProps {
  /** Ten lop cua khung danh sach. */
  className: string;
  /** Nhan tro nang cho khung role="tree". */
  label: string;
  /** Khoa cac dong theo dung thu tu render — doi thu tu hoac doi thanh vien la co hieu ung. */
  rowKeys: readonly string[];
  /** Chi bat hieu ung khi du lieu da san sang. */
  ready: boolean;
  /** Khoa dat lai hieu ung (doi la xoa sach hieu ung dang chay). */
  resetKey: string;
  /** Cac dong con. */
  children: Dyn;
}

/** Vi tri va do mo cua mot dong tai mot thoi diem. */
interface RowPosition {
  /** Phan tu dong. */
  element: Dyn;
  /** Hop bao hinh hoc tai thoi diem doc. */
  rect: Dyn;
  /** Do mo doc tu computed style khi dong dang co hieu ung chay. */
  opacity: number;
}

/** Anh chup truoc khi commit: vi tri cu va cac dong vua bi bo. */
interface RowsSnapshot {
  /** Vi tri moi dong truoc khi commit. */
  positions: Map<string, RowPosition>;
  /** Ban sao cua cac dong vua bi bo khoi cay. */
  removed: Map<string, RowPosition>;
}

/**
 * Hai lan render co cung tap khoa dong theo cung thu tu khong?
 * Nhan: previous — props lan truoc; next — props lan nay.
 * Tra: true khi tap khoa va thu tu y nguyen.
 */
function sameRows(previous: AnimatedRowsProps, next: AnimatedRowsProps): boolean {
  return previous.rowKeys.length === next.rowKeys.length && previous.rowKeys.every((key, index) => key === next.rowKeys[index]);
}

/**
 * Hop cua mot dong co giao voi khung nhin khong?
 * Nhan: row — hop cua dong; viewport — hop cua khung nhin.
 * Tra: true khi hai hop giao nhau.
 */
function intersects(row: Dyn, viewport: Dyn): boolean {
  return row.bottom > viewport.top && row.top < viewport.bottom && row.right > viewport.left && row.left < viewport.right;
}

/**
 * Dung lop AnimatedRows tren lop Component cua React dang nap (lop phai sinh SAU khi nap runtime,
 * vi `extends` duoc danh gia luc nap module).
 *
 * Hieu ung chi bat dau sau lan nhap chuot hoac ban phim DAU TIEN trong danh sach da mount (co `armed`).
 * Khung cha phai la mot vung dinh vi de lop phu tro `Qg_5Eq_exits` nam tuyet doi trong do — day chinh la
 * lop giu cho dong dang thoat KHONG chiem cho trong luong (contain:strict + position:absolute + inset:0),
 * nho do bo cuc khong lech khi mot dong bien mat.
 * Nhan: deps — { Component, createRef } lay tu module react.
 * Tra: { AnimatedRows } — lop component san sang dua vao slot.
 */
export function createAnimatedRowsComponents(deps: { Component: Dyn; createRef: Dyn }): { AnimatedRows: Dyn } {
  const Component = deps.Component as Dyn;
  const createRef = deps.createRef as Dyn;
  class AnimatedRows extends Component {
    /** Da co lan nhap dau tien trong danh sach chua. */
    armed = false;
    /** Tham chieu khung danh sach. */
    list = createRef();
    /** Tham chieu lop phu chua dong dang thoat. */
    overlay = createRef();
    /** Cac hieu ung di chuyen dang chay, theo phan tu. */
    movements = new Map<Dyn, Dyn>();
    /** Cac dong dang thoat, theo khoa. */
    exits = new Map<string, { element: Dyn; animation: Dyn }>();

    /**
     * Chup vi tri moi dong truoc khi React commit ban moi, va nhan ban sao cua cac dong sap bi bo.
     * Nhan: previous — props cua lan render truoc.
     * Tra: anh chup vi tri + dong da bo, hoac null khi khong co gi de lam hieu ung.
     */
    getSnapshotBeforeUpdate(previous: AnimatedRowsProps): RowsSnapshot | null {
      const list = this.list.current;
      if (
        !this.armed ||
        sameRows(previous, this.props) ||
        previous.resetKey !== this.props.resetKey ||
        !previous.ready ||
        !this.props.ready ||
        list === null ||
        typeof list.animate !== "function" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) return null;
      const viewport = list.getBoundingClientRect();
      const positions = this.readPositions();
      const nextKeys = new Set(this.props.rowKeys);
      const removed = new Map<string, RowPosition>();
      for (const [key, row] of positions) {
        if (nextKeys.has(key) || !intersects(row.rect, viewport)) continue;
        const clone = row.element.cloneNode(true);
        clone.removeAttribute("data-row-key");
        clone.inert = true;
        clone.style.setProperty("--dsh-workspace-indent", getComputedStyle(row.element).getPropertyValue("--dsh-workspace-indent"));
        removed.set(key, { ...row, element: clone });
      }
      return { positions, removed };
    }

    /**
     * Chay hieu ung cho ban commit vua roi: dong moi mo dan vao, dong cu truot ve cho moi, dong bi bo mo dan ra.
     * Nhan: previous — props lan truoc; _state — state (khong dung); snapshot — anh chup tu getSnapshotBeforeUpdate.
     * Tra: khong co.
     */
    componentDidUpdate(previous: AnimatedRowsProps, _state: unknown, snapshot: RowsSnapshot | null): void {
      if (snapshot === null) {
        if (!sameRows(previous, this.props) || previous.resetKey !== this.props.resetKey || previous.ready !== this.props.ready) this.clear();
        return;
      }
      this.cancelMovements();
      const list = this.list.current;
      const overlay = this.overlay.current;
      const viewport = list.getBoundingClientRect();
      const origin = overlay.getBoundingClientRect();
      const positions = this.readPositions();
      for (const [key, row] of positions) {
        this.removeExit(key);
        const previousRow = snapshot.positions.get(key);
        if (!intersects(row.rect, viewport) && (previousRow === undefined || !intersects(previousRow.rect, viewport))) continue;
        if (previousRow === undefined) {
          this.move(row.element, [{ opacity: 0 }, { opacity: 1 }], ROW_FADE_MS);
          continue;
        }
        const dx = previousRow.rect.left - row.rect.left;
        const dy = previousRow.rect.top - row.rect.top;
        if (dx === 0 && dy === 0 && previousRow.opacity === 1) continue;
        this.move(
          row.element,
          [
            { transform: "translate(" + String(dx) + "px, " + String(dy) + "px)", opacity: previousRow.opacity },
            { transform: "translate(0, 0)", opacity: 1 },
          ],
          ROW_GLIDE_MS,
        );
      }
      for (const [key, row] of snapshot.removed) {
        const element = row.element;
        this.removeExit(key);
        Object.assign(element.style, {
          position: "absolute",
          margin: "0",
          transform: "none",
          boxSizing: "border-box",
          left: String(row.rect.left - origin.left) + "px",
          top: String(row.rect.top - origin.top) + "px",
          width: String(row.rect.width) + "px",
          height: String(row.rect.height) + "px",
        });
        overlay.append(element);
        const animation = element.animate([{ opacity: row.opacity }, { opacity: 0 }], { duration: ROW_FADE_MS, easing: "ease-out", fill: "forwards" });
        this.exits.set(key, { element, animation });
        animation.onfinish = () => {
          this.removeExit(key);
        };
      }
    }

    /**
     * Don sach moi hieu ung khi component bi go khoi cay.
     * Nhan: khong co.
     * Tra: khong co.
     */
    componentWillUnmount(): void {
      this.clear();
    }

    /**
     * Doc vi tri hien tai cua moi dong co `data-row-key` trong danh sach.
     * Nhan: khong co.
     * Tra: anh xa khoa dong -> phan tu, hop, do mo.
     */
    readPositions(): Map<string, RowPosition> {
      const rows = this.list.current.querySelectorAll("[data-row-key]");
      return new Map(
        Array.from(rows, (element: Dyn) => [
          element.dataset.rowKey,
          {
            element,
            rect: element.getBoundingClientRect(),
            opacity: this.movements.has(element) ? Number(getComputedStyle(element).opacity) : 1,
          },
        ]),
      );
    }

    /**
     * Chay mot hieu ung tren mot phan tu va ghi lai de huy khi can.
     * Nhan: element — phan tu; keyframes — cac khung hinh; duration — thoi luong (ms).
     * Tra: khong co.
     */
    move(element: Dyn, keyframes: Dyn, duration: number): void {
      const animation = element.animate(keyframes, { duration, easing: "ease-out" });
      this.movements.set(element, animation);
      animation.onfinish = () => {
        this.movements.delete(element);
        animation.cancel();
      };
    }

    /**
     * Huy moi hieu ung di chuyen dang chay.
     * Nhan: khong co.
     * Tra: khong co.
     */
    cancelMovements(): void {
      for (const animation of this.movements.values()) {
        animation.onfinish = null;
        animation.cancel();
      }
      this.movements.clear();
    }

    /**
     * Go mot dong dang thoat khoi lop phu.
     * Nhan: key — khoa cua dong dang thoat.
     * Tra: khong co.
     */
    removeExit(key: string): void {
      const exit = this.exits.get(key);
      if (exit === undefined) return;
      exit.animation.onfinish = null;
      exit.animation.cancel();
      exit.element.remove();
      this.exits.delete(key);
    }

    /**
     * Don sach moi hieu ung va moi dong dang thoat.
     * Nhan: khong co.
     * Tra: khong co.
     */
    clear(): void {
      this.cancelMovements();
      for (const key of this.exits.keys()) this.removeExit(key);
    }

    /**
     * Render khung danh sach role="tree" va lop phu tro chua dong dang thoat.
     * Nhan: khong co.
     * Tra: cap [khung danh sach, lop phu].
     */
    render(): Dyn {
      return hs(fragment(), {
        children: [
          h("div", {
            ref: this.list,
            className: this.props.className,
            role: "tree",
            "aria-label": this.props.label,
            onPointerDownCapture: () => {
              this.armed = true;
            },
            onKeyDownCapture: () => {
              this.armed = true;
            },
            children: this.props.children,
          }),
          h("div", { ref: this.overlay, className: animatedRowsStyles.exits, "aria-hidden": "true" }),
        ],
      });
    }
  }
  void ext;
  return { AnimatedRows };
}
