/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bộ dựng chỉ mục Remote của seam typert — NGUYÊN VĂN vùng
 *      ../../typert/protocol/lib/types/remote-info.js trong bundle gốc lib/client.js (vùng 1)
 */

import type { ZodNamespaceLike, ZodSchemaLike } from "./runtime-types.ts";

/** Một codec (bộ mã hoá tham số hoặc kết quả) trong spec Remote đã sinh. */
export interface RemoteCodecLike {
  /** Chế độ mã hoá (strict/loose). */
  mode: string;
  /** Ký hiệu kiểu mà bộ sinh đã ghi. */
  typeSymbol: string;
  /** Dựng schema zod cho codec (lười, chỉ khi có người hỏi). */
  create: () => ZodSchemaLike;
  /** JSON Schema đã chiếu sẵn, nếu có. */
  jsonSchema?: Record<string, unknown>;
  /** Lỗi chiếu JSON Schema, nếu có. */
  jsonSchemaError?: string;
}

/** Một tham số của phương thức Remote trong spec (`wire` có thể chưa khai). */
export interface RemoteParameterLike {
  /** Tên tham số trong mã nguồn. */
  name: string;
  /** Mô tả cho người đọc. */
  description?: string;
  /** Nguồn giá trị: `json` là tham số thật, còn lại do transport cấp. */
  source: string;
  /** Codec thường. */
  codec: RemoteCodecLike;
  /** Codec nghiêm ngặt (đầu vào có khoá lạ bị từ chối). */
  strictCodec: RemoteCodecLike;
  /** Tên trên đường truyền (mặc định là `name`). */
  wire?: string;
  /** Tham số JSON được phép vắng mặt. */
  acceptsUndefined?: boolean;
}

/** Một tham số đã gắn tên trên đường truyền. */
export type WireParameterLike = RemoteParameterLike & { wire: string };

/** Mô tả kết quả của phương thức Remote. */
export interface RemoteResultSpecLike {
  /** Chế độ mã hoá. */
  mode: string;
  /** Ký hiệu kiểu của kết quả. */
  typeSymbol: string;
  /** Dựng schema zod cho kết quả (lười). */
  create: () => ZodSchemaLike;
  /** Mô tả cho người đọc. */
  description?: string;
  /** JSON Schema đã chiếu sẵn, nếu có. */
  jsonSchema?: Record<string, unknown>;
  /** Lỗi chiếu JSON Schema, nếu có. */
  jsonSchemaError?: string;
  /** Hàm giải mã tuỳ biến, nếu có. */
  decode?: unknown;
  /** Hàm mã hoá tuỳ biến, nếu có. */
  encode?: unknown;
}

/** Một phương thức trong spec Remote đã sinh. */
export interface RemoteMethodSpecLike {
  /** Tên service sở hữu phương thức. */
  service: string;
  /** Mô tả cho người đọc. */
  description: string;
  /** Kiểu gọi: `direct` là gọi thẳng qua descriptor. */
  invocation: { kind: string };
  /** Danh sách tham số theo đúng thứ tự bản gốc. */
  parameters: RemoteParameterLike[];
  /** Tham số huỷ, nếu phương thức nhận signal. */
  cancellation?: { parameter: string };
  /** Mô tả kết quả. */
  result: RemoteResultSpecLike;
  /** Vị trí sinh trong mã nguồn gốc. */
  sourceLocation?: Record<string, unknown>;
}

/** Spec Remote đã sinh (một gói + các phương thức của nó). */
export interface RemoteSpecLike {
  /** Tên package sở hữu spec. */
  package: string;
  /** Phương thức theo endpoint `namespace/method`. */
  methods: Record<string, RemoteMethodSpecLike>;
}

/** Phương thức đã dựng chỉ mục: có `input`/`invoke` cho lời gọi trực tiếp. */
export interface RemoteMethodLike extends Record<string, unknown> {
  /** Trả bộ đọc đầu vào đã đặt tên (cache theo chế độ nghiêm ngặt). */
  input(options?: { strict?: boolean }): unknown;
  /** Gọi thẳng phương thức trên service nhận. */
  invoke(remote: unknown, input: unknown, signal?: AbortSignal): unknown;
}

/** Chỉ mục đã dựng của một spec Remote. */
export interface RemoteIndexLike {
  /** Mô tả của mọi phương thức, theo đúng thứ tự khai. */
  descriptors: Record<string, unknown>[];
  /** Phương thức gọi được theo endpoint. */
  methods: Record<string, RemoteMethodLike>;
}

/** Bề mặt một thực thể info Remote đã dựng. */
export interface RemoteInfoLike {
  /** Tên package sở hữu. */
  readonly package: string;
  /** Mô tả của mọi phương thức. */
  readonly descriptors: Record<string, unknown>[];
  /** Phương thức gọi được theo endpoint. */
  readonly methods: Record<string, RemoteMethodLike>;
  /** Dựng (và nhớ) chỉ mục của spec. */
  resolve(): RemoteIndexLike;
}

/**
 * Giữ một định nghĩa đã sinh cho mỗi endpoint mà chưa dựng parser hay phép chiếu.
 * Nhận: spec — dữ kiện phương thức do bộ sinh cấp; zod — namespace zod của artefact đã sinh.
 * Trả: thực thể info lười, mount được, không có tác dụng đăng ký hay transport.
 */
export function createTypertRemoteInfo(spec: RemoteSpecLike, zod: ZodNamespaceLike): RemoteInfoLike {
	return new RemoteInfo(spec, zod);
}

/** Có phải tham số JSON được phép vắng mặt (nguyên văn bản gốc). */
function optional(parameter: WireParameterLike): boolean {
	return parameter.source === "json" && parameter.acceptsUndefined === true;
}

/** Chỉ mục lười của một spec Remote: dựng descriptor/method một lần khi có người hỏi. */
class RemoteInfo implements RemoteInfoLike {
	/** Spec gốc. */
	readonly spec: RemoteSpecLike;
	/** Namespace zod dùng để dựng parser đầu vào. */
	readonly zod: ZodNamespaceLike;
	/** Chỉ mục đã dựng (cache). */
	private index: RemoteIndexLike | undefined;

	/**
	 * Nhận: spec — dữ kiện phương thức; zod — namespace zod của artefact.
	 * Trả: thực thể info chưa dựng chỉ mục.
	 */
	constructor(spec: RemoteSpecLike, zod: ZodNamespaceLike) {
		this.spec = spec;
		this.zod = zod;
	}

	/** Tên package sở hữu spec. */
	get package(): string {
		return this.spec.package;
	}

	/** Mô tả của mọi phương thức (dựng chỉ mục nếu chưa có). */
	get descriptors(): Record<string, unknown>[] {
		return this.resolve().descriptors;
	}

	/** Phương thức gọi được theo endpoint (dựng chỉ mục nếu chưa có). */
	get methods(): Record<string, RemoteMethodLike> {
		return this.resolve().methods;
	}

	/**
	 * Dựng chỉ mục descriptor + method của mọi endpoint trong spec.
	 * Nhận: không.
	 * Trả: chỉ mục đã dựng (cache lại cho các lần sau).
	 */
	resolve(): RemoteIndexLike {
		if (this.index !== undefined) return this.index;
		const zod = this.zod;
		const descriptors: Record<string, unknown>[] = [];
		const methods: Record<string, RemoteMethodLike> = Object.create(null) as Record<string, RemoteMethodLike>;
		for (const [endpoint, definition] of Object.entries(this.spec.methods)) {
			const separator = endpoint.indexOf("/");
			const namespace = endpoint.slice(0, separator);
			const method = endpoint.slice(separator + 1);
			const parameters: WireParameterLike[] = definition.parameters.map((parameter) => ({
				...parameter,
				wire: parameter.wire ?? parameter.name,
			}));
			const descriptor: Record<string, unknown> = {
				...definition,
				id: `${this.spec.package}#${endpoint}`,
				namespace,
				method,
				parameters,
				result: definition.result.description === void 0 ? definition.result : new ResultValue(definition.result),
			};
			if (definition.invocation.kind === "direct") {
				const inputs: unknown[] = [];
				methods[endpoint] = Object.assign(descriptor, {
					input(options?: { strict?: boolean }) {
						const strict = options?.strict === true;
						return (inputs[strict ? 1 : 0] ??= new NamedInput(parameters, strict, zod));
					},
					invoke(remote: unknown, input: unknown, signal?: AbortSignal) {
						const named = input as Record<string, unknown>;
						const values: unknown[] = parameters.map((parameter) => named[parameter.wire]);
						if (definition.cancellation !== void 0) values.push(signal);
						const receiver = Reflect.get(remote as object, namespace);
						return Reflect.get(receiver as object, method).apply(receiver, values);
					},
				}) as RemoteMethodLike;
			}
			descriptors.push(descriptor);
		}
		return (this.index = {
			descriptors,
			methods,
		});
	}
}

/** Bộ đọc đầu vào đã đặt tên của một phương thức (dựng schema lười, cache theo chế độ). */
class NamedInput {
	/** Tham số đã gắn wire. */
	private readonly parameters: WireParameterLike[];
	/** Chế độ nghiêm ngặt. */
	private readonly strict: boolean;
	/** Namespace zod. */
	private readonly zod: ZodNamespaceLike;
	/** Schema đã dựng (cache). */
	private schema: ZodSchemaLike | undefined;
	/** Phép chiếu JSON Schema đã dựng (cache). */
	private projection: { jsonSchema?: Record<string, unknown>; jsonSchemaError?: string } | undefined;

	/**
	 * Nhận: parameters — tham số đã gắn wire; strict — chế độ nghiêm ngặt; zod — namespace zod.
	 * Trả: bộ đọc đầu vào chưa dựng schema.
	 */
	constructor(parameters: WireParameterLike[], strict: boolean, zod: ZodNamespaceLike) {
		this.parameters = parameters;
		this.strict = strict;
		this.zod = zod;
	}

	/** Codec của một tham số theo chế độ hiện tại. */
	private codec(parameter: WireParameterLike): RemoteCodecLike {
		return this.strict ? parameter.strictCodec : parameter.codec;
	}

	/** Dựng schema strictObject cho toàn bộ đầu vào (cache). */
	create = (): ZodSchemaLike =>
		(this.schema ??= this.zod.strictObject(
			Object.fromEntries(
				this.parameters.map((parameter) => {
					const value = this.codec(parameter).create();
					return [parameter.wire, optional(parameter) ? value.optional() : value.nonoptional()];
				}),
			),
		));

	/** JSON Schema của đầu vào (chiếu lười). */
	get jsonSchema(): Record<string, unknown> | undefined {
		return this.project().jsonSchema;
	}

	/** Lỗi chiếu JSON Schema của đầu vào, nếu có. */
	get jsonSchemaError(): string | undefined {
		return this.project().jsonSchemaError;
	}

	/**
	 * Chiếu đầu vào thành JSON Schema, hoặc ghi lý do không chiếu được.
	 * Nhận: không.
	 * Trả: phép chiếu đã cache (jsonSchema hoặc jsonSchemaError).
	 */
	project(): { jsonSchema?: Record<string, unknown>; jsonSchemaError?: string } {
		if (this.projection !== undefined) return this.projection;
		const unavailable = this.parameters.find((parameter) => this.codec(parameter).jsonSchema === undefined);
		if (unavailable !== undefined)
			return (this.projection = { jsonSchemaError: this.codec(unavailable).jsonSchemaError ?? `No JSON Schema for parameter ${unavailable.wire}` });
		return (this.projection = {
			jsonSchema: {
				type: "object",
				properties: Object.fromEntries(
					this.parameters.map((parameter) => [
						parameter.wire,
						{
							...this.codec(parameter).jsonSchema,
							...(parameter.description === void 0 ? {} : { description: parameter.description }),
						},
					]),
				),
				required: this.parameters.filter((parameter) => !optional(parameter)).map((parameter) => parameter.wire),
				additionalProperties: false,
			},
		});
	}
}

/** Mô tả kết quả đã bọc: chiếu JSON Schema kèm mô tả (nguyên văn bản gốc). */
class ResultValue {
	/** Spec kết quả gốc. */
	private readonly spec: RemoteResultSpecLike;
	/** Phép chiếu đã cache. */
	private projection: { value?: Record<string, unknown> } | undefined;

	/**
	 * Nhận: spec — mô tả kết quả do bộ sinh cấp.
	 * Trả: giá trị bọc chưa chiếu JSON Schema.
	 */
	constructor(spec: RemoteResultSpecLike) {
		this.spec = spec;
	}

	/** Chế độ mã hoá của kết quả. */
	get mode(): string {
		return this.spec.mode;
	}

	/** Ký hiệu kiểu của kết quả. */
	get typeSymbol(): string {
		return this.spec.typeSymbol;
	}

	/** Hàm dựng schema kết quả. */
	get create(): () => ZodSchemaLike {
		return this.spec.create;
	}

	/** Hàm giải mã tuỳ biến, nếu có. */
	get decode(): unknown {
		return this.spec.decode;
	}

	/** Hàm mã hoá tuỳ biến, nếu có. */
	get encode(): unknown {
		return this.spec.encode;
	}

	/** Mô tả kết quả. */
	get description(): string | undefined {
		return this.spec.description;
	}

	/** Lỗi chiếu JSON Schema, nếu có. */
	get jsonSchemaError(): string | undefined {
		return this.spec.jsonSchemaError;
	}

	/** JSON Schema của kết quả, kèm mô tả (chiếu lười). */
	get jsonSchema(): Record<string, unknown> | undefined {
		if (this.projection === void 0) {
			const schema = this.spec.jsonSchema;
			this.projection = {
				value:
					schema === void 0
						? void 0
						: {
								...schema,
								description: this.spec.description,
							},
			};
		}
		return this.projection.value;
	}
}
