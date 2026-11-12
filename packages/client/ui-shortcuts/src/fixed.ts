/*
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ba hanh dong menu CO DINH (move/select/dismiss) de hien thi va kiem tra xung dot
*/

/** Mot hanh dong CO DINH cua menu. */
export interface FixedCommand {
  /** Id day du (co tien to `fixed.`). */
  readonly id: string;
  /** Nhan hien thi (lay tu tu dien). */
  readonly label: () => string;
  /** Phim hien thi. */
  readonly keys: readonly string[];
  /** To hop vat ly ma no chiem. */
  readonly bindings: readonly { readonly code: string; readonly modifiers: readonly string[] }[];
  /** Nhom hien thi. */
  readonly group: string;
}

/**
* Describe shared menu actions for display and conflict checking.
* @param t - shortcut dictionary.
* @returns read-only actions and each physical combination they occupy.
*/
export function fixedCommands(t: (key: string, params?: Record<string, unknown>) => string): FixedCommand[] {
return [
	{
id: "move",
keys: ["↑", "↓"],
bindings: [{
	code: "ArrowUp",
	modifiers: []
}, {
	code: "ArrowDown",
	modifiers: []
}],
group: "menus"
	},
	{
id: "select",
keys: ["Enter"],
bindings: [{
	code: "Enter",
	modifiers: []
}],
group: "menus"
	},
	{
id: "dismiss",
keys: ["Esc"],
bindings: [{
	code: "Escape",
	modifiers: []
}],
group: "menus"
	}
].map((row) => ({
	...row,
	id: `fixed.${row.id}`,
	label: () => t(row.id)
}));
}
