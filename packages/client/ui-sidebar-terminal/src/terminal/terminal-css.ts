/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc CSS của thân terminal trong chunk lazy (giữ nguyên khai báo, đổi tiền tố lớp)
 */

/** CSS của thân terminal; dùng token --dsw-* và biến --terminal-cursor-* như bản gốc. */
export const TERMINAL_CSS = ".gbhTerm_root{box-sizing:border-box;height:100%;min-height:0;color:var(--dsw-alias-label-primary);flex-direction:column;flex:1;padding-top:8px;font-size:13px;display:flex}.gbhTerm_screen{min-width:0;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);flex:1;padding:8px;overflow:hidden}.gbhTerm_screen .xterm{height:100%}.gbhTerm_screen .xterm-viewport{background:var(--dsw-alias-bg-base)}.gbhTerm_status{background:var(--dsw-alias-bg-l2);flex-wrap:wrap;align-items:center;gap:8px;padding:5px 12px;display:flex}.gbhTerm_error{overflow-wrap:anywhere;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-l2);margin:0;padding:10px 12px}.gbhTerm_empty{text-align:center;flex-direction:column;flex:1;justify-content:center;align-items:center;gap:16px;min-height:0;padding:24px;display:flex;overflow:auto}.gbhTerm_emptyMessage{overflow-wrap:anywhere;max-width:28ch;margin:0;line-height:1.6}.gbhTerm_actionIcon{display:flex}.gbhTerm_screen .xterm-cursor{opacity:1}.gbhTerm_screen .xterm .xterm-rows .xterm-cursor.xterm-cursor-block{background-color:var(--terminal-cursor);color:var(--terminal-cursor-accent)}.gbhTerm_screen .xterm .xterm-rows .xterm-cursor.xterm-cursor-block:not(.xterm-cursor-blink){background-color:var(--terminal-cursor)!important;color:var(--terminal-cursor-accent)!important}.gbhTerm_screen .xterm .xterm-rows .xterm-cursor.xterm-cursor-outline{outline-color:var(--terminal-cursor)}.gbhTerm_screen .xterm .xterm-rows .xterm-cursor.xterm-cursor-bar{box-shadow:1px 0 0 var(--terminal-cursor) inset}.gbhTerm_screen .xterm .xterm-rows .xterm-cursor.xterm-cursor-underline{border-bottom-color:var(--terminal-cursor)}.gbhTerm_screen .xterm .xterm-rows.xterm-focus .xterm-cursor.xterm-cursor-block.xterm-cursor-blink{animation:1s step-end infinite _UE8Aa_terminal-cursor-blink}@keyframes _UE8Aa_terminal-cursor-blink{0%{background-color:var(--terminal-cursor);color:var(--terminal-cursor-accent)}50%{background-color:var(--terminal-cursor-cell-background);color:var(--terminal-cursor-cell-foreground)}}";

/** Tên lớp sau khi đổi tiền tố. */
export const TERMINAL_CLASS = Object.freeze({
  "actionIcon": "gbhTerm_actionIcon",
  "empty": "gbhTerm_empty",
  "emptyMessage": "gbhTerm_emptyMessage",
  "error": "gbhTerm_error",
  "root": "gbhTerm_root",
  "screen": "gbhTerm_screen",
  "status": "gbhTerm_status",
  "terminal-cursor-blink": "gbhTerm_terminal-cursor-blink",
});
