/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 27/10/2026
 * desc Deep-link phiên cho vỏ web: đọc #session=<id> (và ?session= khi có) rồi ghi lựa chọn phiên vào
 *      localStorage TRƯỚC khi graph client boot, để ui-workspace.restoreSelection() mở đúng phiên đó.
 *      Vì sao là hash: URL token trả 303 về './' nên QUERY bị mất, còn FRAGMENT được giữ qua redirect.
 */

/** Khoá lựa chọn phiên của bản GBH (ui-workspace đọc khoá này). */
export const SELECTION_STORAGE_KEY = "gbh.sessions.current";
/** Khoá cũ của DSH — vẫn ghi để client đang chạy đọc được (migration đọc cả hai). */
export const LEGACY_SELECTION_STORAGE_KEY = "dsh.sessions.current";

/**
 * Sinh thẻ script đọc #session= (hoặc ?session=) và ghi lựa chọn phiên vào localStorage.
 * Nhận: không.
 * Trả: chuỗi thẻ script tự chứa, chạy được trước mọi module của app.
 */
export function deepLinkScript(): string {
  const keys = JSON.stringify([SELECTION_STORAGE_KEY, LEGACY_SELECTION_STORAGE_KEY]);
  return (
    "<script>(function(){try{" +
    "var hash=location.hash&&location.hash.length>1?location.hash.slice(1):'';" +
    "var id=new URLSearchParams(hash).get('session')||new URLSearchParams(location.search).get('session');" +
    "if(!id)return;var raw=JSON.stringify({sessionId:id});" +
    "var keys=" + keys + ";for(var i=0;i<keys.length;i++)localStorage.setItem(keys[i],raw);" +
    "if(location.hash.indexOf('session=')>=0)history.replaceState(null,'',location.pathname+location.search);" +
    "}catch(_error){}})();</script>"
  );
}

/**
 * Chèn script deep-link ngay sau thẻ mở head (chạy trước script của app).
 * Nhận: html — thân index.html vỏ trả về.
 * Trả: html đã chèn; html không có head thì trả nguyên văn (idempotent: chạy hai lần vẫn một thẻ).
 */
export function injectDeepLink(html: string): string {
  if (html.includes("data-gbh-deep-link")) return html;
  const marker = "<head>";
  const at = html.indexOf(marker);
  if (at < 0) return html;
  const script = deepLinkScript().replace("<script>", "<script data-gbh-deep-link=\"1\">");
  return html.slice(0, at + marker.length) + script + html.slice(at + marker.length);
}
