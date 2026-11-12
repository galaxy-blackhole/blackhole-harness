/*
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Store cua bang phim tat: hien/an, yeu cau focus, tu khoa tim
*/

/** Ham 'defineStore' do bang module cap. */
export type DefineStore = (spec: Record<string, unknown>) => StoreHandle;

/** Handle store ma ban goc tra ve. */
/** Ban nhap ma actions cua store thao tac. */
export interface ShortcutsDraft {
  /** Dialog dang mo. */
  open: boolean;
  /** Tu khoa tim. */
  query: string;
  /** So lan yeu cau focus. */
  focusRequest: number;
}

export interface StoreHandle {
  /** Tao instance (khong tham so = scope root). */
  create: () => unknown;
}

/** Shortcut reference visibility and search state, shared by its entry points. */
/**
* Declare the reference dialog store.
* @returns root-scoped visibility, focus request, and search actions.
*/
export function createShortcutsStore(defineStore: DefineStore): StoreHandle {
return defineStore({
	init: () => ({
open: false,
query: "",
focusRequest: 0
	}),
	actions: {
open: (d: ShortcutsDraft) => {
	d.open = true;
	d.focusRequest++;
},
close: (d: ShortcutsDraft) => {
	d.open = false;
	d.query = "";
},
search: (d: ShortcutsDraft, query: string) => {
	d.query = query;
}
	}
});
}
