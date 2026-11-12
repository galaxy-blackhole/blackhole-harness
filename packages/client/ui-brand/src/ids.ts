/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bang dinh danh cua goi ui-brand: id module + slot HERO (slot sidebar da co chu roi — single slot chi 1 occupant)
 */

/** Ten package/id bundle DUY NHAT duoc dang ky (khop manifest + rev HMR tra theo ownerId). */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-brand";

/**
 * Slot dau thuong hieu o HERO — nguyen van tu bundle ui-conversation (slot `single`).
 *
 * ⚠️ 18/10/2026 — BAI HOC SU CO: slot `sidebar.brand.mark`/`sidebar.brand.name` la `single` va
 * row `ui-brand-official` cua ta DA giu. Dang ky them o day ⇒ tang nap nem
 * 'single slot "sidebar.brand.mark" already has a registration' ⇒ sidebar crash.
 * ⇒ Goi nay CHI duoc chiem slot HERO (slot duy nhat chua co chu).
 */
export const SLOT_HERO_MARK = "conversation.hero.brand.mark";

/** Kich thuoc mac dinh cua dau thuong hieu o hero (bundle goc render slot voi size 34). */
export const HERO_MARK_SIZE = 34;
