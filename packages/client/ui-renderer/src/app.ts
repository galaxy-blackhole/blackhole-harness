/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Port 1:1 app.js cua bundle goc (dong 1279-1289): ham dung "factory ung dung" da lap rap
 */

/** Đầu vào có sau khi bộ inject của renderer kích hoạt (bản gốc: AssemblyDeps). */
export interface AssemblyDeps {
  /** Context client mang registry slot do renderer sở hữu. */
  ctx: {
    /** Seam slot (service `slots` do chính renderer cài). */
    slots: { renderSlot(key: string, owner: Record<string, unknown>): unknown };
  };
}

/**
 * Dựng factory của ứng dụng đã lắp ráp (bản gốc: buildRenderApp).
 *
 * Toàn bộ cây layout treo dưới slot 'root' dựng sẵn — đó là lần render slot DUY NHẤT ở cấp ctx trong
 * ứng dụng. Vỏ gọi `uiRenderer.mount(container)`; hàm này là thứ được gọi bên trong.
 *
 * Nhận: `deps` — `{ ctx }` sau khi renderer đã activate.
 * Trả: factory sinh cây React của ứng dụng.
 */
export function buildRenderApp(deps: AssemblyDeps): () => unknown {
  const { ctx } = deps;
  return () => ctx.slots.renderSlot("root", {});
}
