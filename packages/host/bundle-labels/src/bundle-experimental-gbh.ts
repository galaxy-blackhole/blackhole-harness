/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Danh sách HẰNG 12 bundle GBH thử nghiệm — nguồn sự thật dùng chung cho plugin-manager (lọc bundle stock,
 *      đánh dấu optional) và plugin-inventory (bù entry cho bundle đang TẮT để thẻ không biến mất).
 */

/**
 * 12 bundle GBH THỬ NGHIỆM — đúng bộ mà mục "Plugin thử nghiệm" của DSH liệt kê cho các bản tương ứng.
 * Dùng HẰNG (không suy động từ profile) vì khi người dùng TẮT bundle, `plugin-manager` xoá tên khỏi
 * `dsh.profile.bundles` (giống stock) ⇒ suy động sẽ mất chính tên vừa tắt và thẻ biến khỏi danh sách.
 * Nguồn đối chiếu: `~/.galaxy/blackhole/profiles/blackhole/package.json` → `dsh.profile.bundles`.
 */
export const BUNDLE_THU_NGHIEM_GBH: readonly string[] = [
  "@galaxy-blackhole/gbh-agent-team-profile",
  "@galaxy-blackhole/gbh-auto-review-bundle",
  "@galaxy-blackhole/gbh-badge-skill-bundle",
  "@galaxy-blackhole/gbh-cot-translation-bundle",
  "@galaxy-blackhole/gbh-inspector-profile",
  "@galaxy-blackhole/gbh-plugin-market-bundle",
  "@galaxy-blackhole/gbh-ralph-bundle",
  "@galaxy-blackhole/gbh-session-search",
  "@galaxy-blackhole/gbh-session-titles-bundle",
  "@galaxy-blackhole/gbh-terminal-bundle",
  "@galaxy-blackhole/gbh-tool-worktree-bundle",
  "@galaxy-blackhole/gbh-voice-input-bundle",
];
