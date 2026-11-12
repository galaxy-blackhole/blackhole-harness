/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Giao thuc khung SSE cua /plugins/events: kieu khung, bo kiem tra vo khung, bo boc SSE (khong dung thu vien ngoai).
 */

/** Mot khung SSE: graph da chot, hoac mot bundle vua build lai. */
export type PluginsEventFrame =
  | { type: "graph"; graph: unknown }
  | { type: "rebuilt"; id: string; rev: string };

/** Ket qua boc mot khung: khung da biet, loai la (forward-compatible), hoac sai dinh dang. */
export type PluginsEventParseResult =
  | { kind: "frame"; frame: PluginsEventFrame }
  | { kind: "unknown" }
  | { kind: "invalid" };

/**
 * Kiem tra vo khung; phan graph day du do bo dieu khien module tu boc truoc khi cap nhat chi muc.
 * @param value - gia tri JSON da parse tu message cua EventSource.
 * @returns khung da biet, dau hieu loai la, hoac dau hieu sai dinh dang.
 */
export function parsePluginsEventFrame(value: unknown): PluginsEventParseResult {
  if (typeof value !== "object" || value === null) return { kind: "invalid" };
  const record = value as Record<string, unknown>;
  if (record.type === "rebuilt") {
    return typeof record.id === "string" && typeof record.rev === "string"
      ? { kind: "frame", frame: { type: "rebuilt", id: record.id, rev: record.rev } }
      : { kind: "invalid" };
  }
  if (record.type === "graph") {
    return typeof record.graph === "object" && record.graph !== null
      ? { kind: "frame", frame: { type: "graph", graph: record.graph } }
      : { kind: "invalid" };
  }
  return typeof record.type === "string" ? { kind: "unknown" } : { kind: "invalid" };
}

/**
 * Dong goi mot khung thanh dung mot dong `data:` cua SSE (ket thuc bang dong trong).
 * @param frame - khung can gui.
 * @returns chuoi se ghi len ket noi.
 */
export function sseData(frame: PluginsEventFrame): string {
  return "data: " + JSON.stringify(frame) + "\n\n";
}

/**
 * Bo boc SSE toi gian theo dung luat: gom dong `data:`, bo qua dong chu thich `:`, tra ve khi gap dong trong.
 * Khong dung thu vien ngoai — hai nua cua goi cung dung ham nay nen khong the lech nhau.
 * @returns bo gom co `feed(chunk)` tra ve danh sach payload hoan chinh.
 */
export function createSseDecoder(): { feed(chunk: string): string[] } {
  let buffer = "";
  let data: string[] = [];
  return {
    feed(chunk: string): string[] {
      buffer += chunk;
      const out: string[] = [];
      for (;;) {
        const breakAt = buffer.indexOf("\n");
        if (breakAt === -1) break;
        let line = buffer.slice(0, breakAt);
        buffer = buffer.slice(breakAt + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line === "") {
          if (data.length > 0) out.push(data.join("\n"));
          data = [];
          continue;
        }
        if (line.startsWith(":")) continue;
        if (line.startsWith("data:")) {
          const value = line.slice(5);
          data.push(value.startsWith(" ") ? value.slice(1) : value);
        }
      }
      return out;
    },
  };
}
