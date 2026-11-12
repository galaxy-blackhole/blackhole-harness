/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Sự kiện danh mục subagent BỀN do phiên CHA sở hữu và phép chiếu dạng khối của nó: mỗi con
 *      trực tiếp một dòng (one-shot · continuable · external · unknown), gộp TĂNG DẦN từ log đã cam
 *      kết; fact hỏng của chính gói này làm hỏng phép khôi phục. Port 1:1 lib/types/catalog.js của
 *      @deepseek-ai/dsh-subagent; seam kernel khai theo CẤU TRÚC (không augment module).
 */

// Nạp zod qua "zod/v4" (quy ước repo): ambient shim `declare module "zod"` ở
// packages/client/ui-sidebar-right/src/externals.d.ts che mất kiểu thật khi tsc đọc CẢ chương trình.
import { z } from "zod/v4";
import { brandNumber, brandString } from "@deepseek-ai/dsh-brand";
import { appendChunkedList, chunkedListSchema, iterateChunkedList } from "@deepseek-ai/dsh-chunked-list";
import type { ChunkedList } from "@deepseek-ai/dsh-chunked-list";
import type { Session, SessionEvent, SessionHeader, SessionId, SessionLogOffset } from "@galaxy-blackhole/gbh-session";
import type { SubagentCatalogEntry } from "./projection-types.ts";

/** Phiên bản thân danh mục mà lượt TẠO CON CỤC BỘ phát ra. */
export const SUBAGENT_CATALOG_VERSION = 0;

/**
 * Danh tính phiên trên dây.
 * Nhận: chuỗi bất kỳ do JSON giải mã.
 * Trả: chuỗi đó đóng dấu `SessionId` ở mức KIỂU (giá trị lúc chạy không đổi).
 */
const sessionIdSchema = z.string().transform(value => brandString<SessionId>(value));

/** Thân danh mục một con one-shot (v0/v1): nhãn tuỳ chọn vì con một lần có thể không có nhãn. */
const oneShotCatalogSchema = z.object({
    version: z.union([z.literal(0), z.literal(1)]),
    childId: sessionIdSchema,
    childCreatedAt: z.number().int().nonnegative(),
    mode: z.literal('one-shot'),
    label: z.string().optional(),
}).strict();

/** Thân danh mục một con continuable (v0/v1): nhãn BẮT BUỘC vì con nhận thêm việc phải định danh được. */
const continuableCatalogSchema = z.object({
    version: z.union([z.literal(0), z.literal(1)]),
    childId: sessionIdSchema,
    childCreatedAt: z.number().int().nonnegative(),
    mode: z.literal('continuable'),
    label: z.string(),
}).strict();

/** Thân danh mục một lượt thực thi NGOÀI (v2): không có phiên con cục bộ, nhãn tuỳ chọn. */
const externalCatalogSchema = oneShotCatalogSchema.extend({ version: z.literal(2), mode: z.literal('external') });

/** Thân danh mục một con CHƯA NHẬN RA (v1): giữ chỗ để phép khôi phục không mất dòng. */
const unknownCatalogSchema = oneShotCatalogSchema.extend({ version: z.literal(1), mode: z.literal('unknown') });

/** Hợp bốn thân danh mục mà log của phiên cha chấp nhận. */
const eventDataSchema = z.union([
    oneShotCatalogSchema,
    externalCatalogSchema,
    continuableCatalogSchema,
    unknownCatalogSchema,
]);

/** Khung nhìn dây: bỏ phần đóng gói sự kiện (version · childId · childCreatedAt), đổi sang (id · createdAt). */
const viewSchema = z.array(z.union([
    oneShotCatalogSchema.omit({ version: true, childId: true, childCreatedAt: true }).extend({
        id: sessionIdSchema,
        createdAt: oneShotCatalogSchema.shape.childCreatedAt,
    }),
    externalCatalogSchema.omit({ version: true, childId: true, childCreatedAt: true }).extend({
        id: sessionIdSchema,
        createdAt: externalCatalogSchema.shape.childCreatedAt,
    }),
    continuableCatalogSchema.omit({ version: true, childId: true, childCreatedAt: true }).extend({
        id: sessionIdSchema,
        createdAt: continuableCatalogSchema.shape.childCreatedAt,
    }),
    unknownCatalogSchema.omit({ version: true, childId: true, childCreatedAt: true }).extend({
        id: sessionIdSchema,
        createdAt: unknownCatalogSchema.shape.childCreatedAt,
    }),
]));

/**
 * `chunkedListSchema` của peer, bọc lại thành ký hiệu NÔNG.
 * Vì sao (01/11/2026): zod của ta (`zod/v4`, workspace) khác thể hiện với zod trong d.ts của peer (kernel), và
 * suy luận generic xuyên hai bản cài làm tsc báo TS2589 "instantiation excessively deep". Hành vi runtime
 * y nguyên; chỉ kiểu là nông đi (khai báo chiếu dưới đây không đi qua seam chặt nên không mất phép kiểm nào).
 */
const chunkedHeadSchema = chunkedListSchema as unknown as (valueSchema: unknown) => z.ZodType<unknown>;

/** Trạng thái phép gộp của MỘT danh mục cha: số sự kiện thừa kế + đầu danh sách dạng khối. */
const stateSchema = z.object({
    inheritedEventCount: z.number().int().nonnegative()
        .transform(value => brandNumber<SessionLogOffset>(value)),
    head: chunkedHeadSchema(eventDataSchema).optional(),
}).strict();

/** Một chế độ danh mục ĐÃ BIẾT của con cục bộ. */
type KnownCatalogMode = {
    readonly mode: 'one-shot';
    readonly label?: string;
} | {
    readonly mode: 'continuable';
    readonly label: string;
};

/**
 * Thân sự kiện `subagent/catalog` của MỘT con trực tiếp.
 * v0 ghi chế độ cục bộ, v1 thêm con chưa nhận ra, v2 ghi lượt thực thi ngoài.
 */
export type SubagentCatalogEvent = {
    readonly childId: SessionId;
    readonly childCreatedAt: number;
} & (({
    readonly version: 0;
} & KnownCatalogMode) | ({
    readonly version: 1;
} & (KnownCatalogMode | {
    readonly mode: 'unknown';
    readonly label?: string;
})) | {
    readonly version: 2;
    readonly mode: 'external';
    readonly label?: string;
});

/** Trạng thái phép gộp phía Host cho MỘT danh mục cha. */
export interface SubagentCatalogState {
    /** Số sự kiện thừa kế từ phiên nguồn khi fork: sự kiện trước mốc này KHÔNG thuộc danh mục này. */
    readonly inheritedEventCount: SessionLogOffset;
    /** Đầu danh sách dạng khối, `undefined` nghĩa là danh mục rỗng. */
    readonly head?: ChunkedList<SubagentCatalogEvent> | undefined;
}

/**
 * Dựng danh tính các con đã HOÀN CHỈNH và chưa nhận ra từ sự kiện danh mục của phiên cha.
 * Nhận: `state` — trạng thái phép gộp của danh mục cha.
 * Trả: các dòng con trực tiếp hiện tại, đúng thứ tự sự kiện danh mục của phiên cha.
 */
function subagentCatalogEntries(state: SubagentCatalogState): SubagentCatalogEntry[] {
    const entries: SubagentCatalogEntry[] = [];
    for (const data of iterateChunkedList(state.head)) {
        const { version: _version, childId, childCreatedAt, ...descriptor } = data;
        entries.push({ id: childId, createdAt: childCreatedAt, ...descriptor });
    }
    return entries;
}

/**
 * Ba trường của một sự kiện ĐÃ CAM KẾT mà phép gộp danh mục đọc, khai theo CẤU TRÚC.
 * Bản gốc nhận thẳng `SessionEvent` của kernel; phần gộp chỉ cần đúng ba trường này.
 */
interface CatalogFoldFact {
    /** Vị trí sự kiện trong log. */
    readonly seq: number;
    /** Thân sự kiện CHƯA kiểm (schema của đơn vị này kiểm sau). */
    readonly data: unknown;
}

/**
 * Lọc một sự kiện phiên thành fact danh mục.
 * Nhận: `event` — sự kiện đã cam kết, đúng thứ tự log.
 * Trả: `{ seq, data }` khi sự kiện là `subagent/catalog`, ngược lại `undefined`.
 */
function catalogFoldFact(event: SessionEvent): CatalogFoldFact | undefined {
    const type: string = event.type;
    if (type !== 'subagent/catalog')
        return undefined;
    return { seq: event.seq, data: event.data };
}

/** Phép chiếu danh mục con trực tiếp do phiên CHA sở hữu; fact hỏng của chính gói này làm hỏng phép khôi phục. */
export const subagentCatalogProjectionDefinition = {
    key: 'subagentCatalog' as const,
    stateSchema,
    init: (_header: SessionHeader, inheritedEventCount: SessionLogOffset): SubagentCatalogState => ({ inheritedEventCount }),
    apply: (state: SubagentCatalogState, event: SessionEvent): SubagentCatalogState => {
        const fact = catalogFoldFact(event);
        if (fact === undefined || fact.seq < state.inheritedEventCount)
            return state;
        return { ...state, head: appendChunkedList(state.head, eventDataSchema.parse(fact.data)) };
    },
    stateVersion: 6,
    wire: { viewSchema, view: subagentCatalogEntries },
};

/**
 * Sổ phiên nhìn qua ĐÚNG một đường ghi mà tệp này dùng: sự kiện `subagent/catalog`.
 * Bản gốc mở rộng `SessionEventMap` của kernel; bản viết lại KHÔNG augment module (luật 000d) nên
 * khai theo CẤU TRÚC tại chỗ.
 */
interface CatalogWriteSession {
    /**
     * Ghi một fact danh mục vào log của phiên cha.
     * Nhận: `type` — luôn là `'subagent/catalog'`; `data` — thân sự kiện đã đóng phiên bản.
     * Trả: sự kiện đã cam kết (tệp này không đọc giá trị trả về).
     */
    append(type: 'subagent/catalog', data: SubagentCatalogEvent): unknown;
}

/**
 * Ép sổ phiên thật về đường ghi theo CẤU TRÚC — MỘT phép ép DUY NHẤT, tại đúng biên ghi.
 * Nhận: `session` — phiên cha thật của kernel.
 * Trả: cùng đối tượng đó, nhìn qua hình `CatalogWriteSession`.
 */
function catalogWriter(session: Session): CatalogWriteSession {
    return session as unknown as CatalogWriteSession;
}

/**
 * Ghi một fact phát hiện con trực tiếp HOÀN CHỈNH vào phiên cha của nó.
 * Nhận: `parent` — phiên cha bền nhận fact; `child` — metadata bất biến của con đã dựng;
 *   `descriptor` — nhãn tạo con đã đóng băng theo con, phân biệt bằng `mode`.
 * Trả: không (hiệu ứng là một sự kiện đã cam kết trong log của phiên cha).
 */
export function establishCatalogChild(parent: Session, child: SessionHeader, descriptor: {
    readonly mode: 'continuable';
    readonly label: string;
}): void {
    catalogWriter(parent).append('subagent/catalog', {
        version: SUBAGENT_CATALOG_VERSION,
        childId: child.id,
        childCreatedAt: child.createdAt,
        mode: descriptor.mode,
        label: descriptor.label,
    });
}

/** Phiên bản thân danh mục mà lượt TẠO THỰC THI NGOÀI phát ra. */
const EXTERNAL_SUBAGENT_CATALOG_VERSION = 2;

/**
 * Ghi một lượt thực thi NGOÀI, không có phiên con cục bộ.
 * Nhận: `parent` — phiên cha bền nhận fact; `childId` — danh tính do nhà cung cấp ngoài trả;
 *   `label` — nhãn hiển thị do bên gọi gán.
 * Trả: không (hiệu ứng là một sự kiện đã cam kết trong log của phiên cha).
 */
export function establishExternalCatalogChild(parent: Session, childId: SessionId, label: string): void {
    catalogWriter(parent).append('subagent/catalog', {
        version: EXTERNAL_SUBAGENT_CATALOG_VERSION,
        childId,
        childCreatedAt: Date.now(),
        mode: 'external',
        label,
    });
}
