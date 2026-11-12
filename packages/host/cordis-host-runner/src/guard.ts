/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ranh giới đăng ký giữa host half chạy trong sandbox và runtime thật: chuẩn hoá + kiểm ParameterSchemaSpec kèm lỗi dạy học, cặp defineTool/registerTool có marker, chuẩn hoá handle, façade ctx sandbox và các helper nhận dạng plugin.
 */

import { Context, type Plugin } from '@deepseek-ai/cordis';
import { scopeOf } from '@deepseek-ai/dsh-scope';
import { assertSupportedJsonSchema, defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools';

/** Báo một lần từ chối của guard về Agent sở hữu plugin. */
type ReportFailure = (error: Error) => void;

/** Một nút schema đã được materialize sang realm của host. */
type NormalizedNode = Record<string, unknown>;

/** Đích gán của một giá trị trong `cloneJson`. */
type CloneDestination =
    | { kind: 'root' }
    | { kind: 'array'; target: unknown[]; index: number }
    | { kind: 'object'; target: Record<string, unknown>; key: string };

/** Một khung việc của vòng duyệt `cloneJson` (duyệt bằng ngăn xếp, không đệ quy). */
type CloneTask =
    | { kind: 'visit'; value: unknown; path: string; destination: CloneDestination }
    | { kind: 'leave'; source: object }
    | { kind: 'array-item'; source: unknown[]; index: number; path: string; target: unknown[] };

/** Đích gán một property map đã chuẩn hoá: gốc của spec hoặc `properties` của nút cha. */
type MapDestination =
    | { kind: 'root'; holder: { value?: NormalizedNode } }
    | { kind: 'properties'; target: NormalizedNode };

/** Đích gán một nút schema đã chuẩn hoá trong `normalizePropertyMap`. */
type ValueDestination =
    | { kind: 'property'; target: NormalizedNode; key: string }
    | { kind: 'item'; target: NormalizedNode }
    | { kind: 'one-of'; target: unknown[]; index: number };

/** Một khung việc của vòng duyệt `normalizePropertyMap`. */
type NormalizeTask =
    | { kind: 'map'; entries: Record<string, unknown>; path: string; requiredNames: Set<string>; raw: boolean; destination: MapDestination }
    | { kind: 'leave'; value: object }
    | { kind: 'value'; value: unknown; path: string; forceRequired: boolean; raw: boolean; parameterProperty: boolean; destination: ValueDestination };

/** Kết quả chuẩn hoá `parameters`: property map + annotation gốc (nếu có). */
interface NormalizedParameterSchema {
    /** Property map đã chuẩn hoá, dùng làm `parameters` của `defineTool`. */
    spec: NormalizedNode;
    /** Annotation của chính root object thô, chỉ có khi bản gốc khai ít nhất một annotation. */
    rootAnnotations?: NormalizedNode;
}

/** Ảnh chụp tối thiểu của một schema tool mà façade trả về (không bao giờ là định nghĩa sống). */
interface SchemaView {
    /** Tên tool. */
    readonly name: string;
}

/** Bề mặt `ctx.tools` mà façade sandbox phơi ra: đăng ký có marker + chỉ đọc metadata. */
interface SandboxTools {
    /** Đăng ký một tool đã gắn marker. */
    register(tool: unknown): () => void;
    /** Toàn bộ schema trong phạm vi của gói. */
    schemas(): SchemaView[];
    /** Một schema theo tên, hoặc `undefined`. */
    get(name: string): SchemaView | undefined;
}

const DYNAMIC_TOOL = Symbol('cordis-host-runner.dynamic-tool');
const SCHEMA_TYPES: ReadonlySet<unknown> = new Set(['string', 'number', 'integer', 'boolean', 'null', 'object', 'array', 'json']);
const VALID_TYPES = '\'string\' | \'number\' | \'integer\' | \'boolean\' | \'null\' | \'object\' | \'array\' | \'json\'';
const ANNOTATION_KEYS: readonly string[] = ['description', 'title', 'default', 'examples'];

/** Nhận diện một record thuần (không mảng, không lớp lạ) từ bất kỳ realm nào. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null
        || typeof prototype === 'object'
            && Object.getPrototypeOf(prototype) === null
            && hasIntrinsicConstructor(prototype, 'Object');
}
/* jscpd:ignore-start -- this VM boundary mirrors the session-owned realm-safe intrinsic test */
/** Whether a realm-owned intrinsic prototype is backed by its native constructor. */
function hasIntrinsicConstructor(prototype: object, name: string): boolean {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
    const constructor = descriptor?.value;
    if (typeof constructor !== 'function')
        return false;
    try {
        return constructor.name === name
            && constructor.prototype === prototype
            && Function.prototype.toString.call(constructor) === `function ${name}() { [native code] }`;
    }
    catch {
        return false;
    }
}
/** Whether an array uses one realm's intrinsic Array prototype rather than a subclass. */
function hasPlainArrayPrototype(value: unknown): boolean {
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(prototype) || !hasIntrinsicConstructor(prototype, 'Array'))
        return false;
    const objectPrototype = Object.getPrototypeOf(prototype);
    return typeof objectPrototype === 'object'
        && objectPrototype !== null
        && Object.getPrototypeOf(objectPrototype) === null
        && hasIntrinsicConstructor(objectPrototype, 'Object');
}
/* jscpd:ignore-end */
/** Whether a schema list is a dense intrinsic array with no JSON-invisible decorations. */
function isDensePlainArray(value: unknown): value is unknown[] {
    if (!Array.isArray(value) || !hasPlainArrayPrototype(value) || Reflect.ownKeys(value).length !== value.length + 1) {
        return false;
    }
    for (let index = 0; index < value.length; index++) {
        if (!Object.hasOwn(value, index))
            return false;
    }
    return true;
}
/** Reject schema records whose declarations would disappear from object enumeration. */
function assertSchemaContainerKeys(value: object, path: string): void {
    if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !Object.prototype.propertyIsEnumerable.call(value, key))) {
        throw new Error(`harness.defineTool ${path} must contain only own enumerable string keys`);
    }
}
/** Materialize realm-foreign lossless JSON without allowing JSON.stringify coercions; `path` carries the caller's own error prefix. */
function cloneJson(value: unknown, path: string): unknown {
    const ancestors = new Set<object>();
    let root!: unknown;
    const assign = (destination: CloneDestination, item: unknown): void => {
        if (destination.kind === 'root') {
            root = item;
            return;
        }
        if (destination.kind === 'array') {
            destination.target[destination.index] = item;
            return;
        }
        Object.defineProperty(destination.target, destination.key, {
            value: item,
            enumerable: true,
            configurable: true,
            writable: true,
        });
    };
    const reject: (at: string) => never = (at) => {
        // Naming the executable next step matters more than naming the rule: the
        // usual cause is a handler that returns whatever its last call produced,
        // and the fix is one keyword.
        throw new Error(`${at} must be lossless JSON data (objects, arrays, strings, numbers, booleans, null) — `
            + 'not a class instance, function, Map/Set, Date, or undefined. Return a plain object built from the '
            + 'values you need, or `return null` when the caller needs no value back.');
    };
    const tasks: CloneTask[] = [{ kind: 'visit', value, path, destination: { kind: 'root' } }];
    for (let task = tasks.pop(); task !== undefined; task = tasks.pop()) {
        if (task.kind === 'leave') {
            ancestors.delete(task.source);
            continue;
        }
        if (task.kind === 'array-item') {
            if (!Object.hasOwn(task.source, task.index))
                reject(task.path);
            tasks.push({
                kind: 'visit',
                value: task.source[task.index],
                path: `${task.path}[${task.index}]`,
                destination: { kind: 'array', target: task.target, index: task.index },
            });
            continue;
        }
        const current = task.value;
        if (current === null || typeof current === 'string' || typeof current === 'boolean') {
            assign(task.destination, current);
            continue;
        }
        if (typeof current === 'number') {
            if (!Number.isFinite(current) || Object.is(current, -0))
                reject(task.path);
            assign(task.destination, current);
            continue;
        }
        if (typeof current !== 'object' || ancestors.has(current as object))
            reject(task.path);
        if (Array.isArray(current)) {
            if (!hasPlainArrayPrototype(current) || Reflect.ownKeys(current).length !== current.length + 1)
                reject(task.path);
            const output: unknown[] = [];
            assign(task.destination, output);
            ancestors.add(current);
            tasks.push({ kind: 'leave', source: current });
            for (let index = current.length - 1; index >= 0; index--) {
                tasks.push({ kind: 'array-item', source: current, index, path: task.path, target: output });
            }
            continue;
        }
        if (!isPlainRecord(current))
            reject(task.path);
        const record = current;
        if (Reflect.ownKeys(record).some(key => typeof key !== 'string' || !Object.prototype.propertyIsEnumerable.call(record, key))) {
            reject(task.path);
        }
        const output: Record<string, unknown> = {};
        assign(task.destination, output);
        ancestors.add(record);
        tasks.push({ kind: 'leave', source: record });
        const entries = Object.entries(record);
        for (let index = entries.length - 1; index >= 0; index--) {
            const entry = entries[index];
            /* v8 ignore next -- the loop is bounded by the captured entry count. */
            if (entry === undefined)
                continue;
            tasks.push({
                kind: 'visit',
                value: entry[1],
                path: `${task.path}.${entry[0]}`,
                destination: { kind: 'object', target: output, key: entry[0] },
            });
        }
    }
    return root;
}
/** Copy and realm-materialize the shared annotation vocabulary. */
function copyAnnotations(value: Record<string, unknown>, output: NormalizedNode, path: string): void {
    if (Object.hasOwn(value, 'description'))
        output.description = value.description;
    if (Object.hasOwn(value, 'title'))
        output.title = value.title;
    if (Object.hasOwn(value, 'default'))
        output.default = cloneJson(value.default, `harness.defineTool ${path}.default`);
    if (Object.hasOwn(value, 'examples'))
        output.examples = cloneJson(value.examples, `harness.defineTool ${path}.examples`);
}
/** Reject sandbox schema keys that the unified DSL would otherwise ignore. */
function assertSchemaKeys(value: Record<string, unknown>, path: string, allowed: readonly string[]): void {
    assertSchemaContainerKeys(value, path);
    for (const key of Object.keys(value)) {
        if (!allowed.includes(key))
            throw new Error(`harness.defineTool ${path}.${key} is not supported by the unified schema DSL`);
    }
}
/**
 * Normalize a sandbox-provided `parameters` value into a fresh host-realm
 * ParameterSchemaSpec. A raw JSON-Schema object wrapper retains its open root
 * default, while the direct DSL is already an implicit open property map.
 */
function normalizeParameterSchemaSpec(value: unknown, path = 'parameters'): NormalizedParameterSchema {
    if (!isPlainRecord(value)) {
        throw new Error(`harness.defineTool ${path} must be a ParameterSchemaSpec object`);
    }
    if (value.type === 'object') {
        assertSchemaKeys(value, path, ['type', 'properties', 'required', 'additionalProperties', ...ANNOTATION_KEYS]);
        if (!isPlainRecord(value.properties)) {
            throw new Error(`harness.defineTool ${path}.properties must be an object of schemas`);
        }
        if (Object.hasOwn(value, 'additionalProperties') && value.additionalProperties !== true) {
            throw new Error(`harness.defineTool ${path}.additionalProperties must be true or omitted because the implicit parameter root is open`);
        }
        if (Object.hasOwn(value, 'required') && value.required === undefined) {
            throw new Error(`harness.defineTool ${path}.required must be an array of declared property names`);
        }
        const required = normalizeRequiredNames(value.required, value.properties, `${path}.required`);
        const rootAnnotations: NormalizedNode = {};
        copyAnnotations(value, rootAnnotations, path);
        return {
            spec: normalizePropertyMap(value.properties, path, required, true),
            ...(Object.keys(rootAnnotations).length === 0 ? {} : { rootAnnotations }),
        };
    }
    return { spec: normalizePropertyMap(value, path, new Set<string>(), false) };
}
/** Validate raw required names and return their lookup set. */
function normalizeRequiredNames(value: unknown, properties: Record<string, unknown>, path: string): Set<string> {
    if (value === undefined)
        return new Set();
    if (!isDensePlainArray(value)) {
        throw new Error(`harness.defineTool ${path} must be an array of declared property names`);
    }
    const names = new Set<string>();
    for (let index = 0; index < value.length; index++) {
        const name = value[index];
        if (typeof name !== 'string') {
            throw new Error(`harness.defineTool ${path} must be an array of declared property names`);
        }
        names.add(name);
        if (!Object.hasOwn(properties, name))
            throw new Error(`harness.defineTool ${path} names undeclared property ${JSON.stringify(name)}`);
    }
    return names;
}
/** Install one normalized node without `__proto__` assignment semantics. */
function assignNormalizedValue(destination: ValueDestination, value: unknown): void {
    if (destination.kind === 'property') {
        Object.defineProperty(destination.target, destination.key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true,
        });
    }
    else if (destination.kind === 'item') {
        destination.target.items = value;
    }
    else {
        destination.target[destination.index] = value;
    }
}
/** Install one normalized property map at its root or containing object. */
function assignNormalizedMap(destination: MapDestination, value: NormalizedNode): void {
    if (destination.kind === 'root')
        destination.holder.value = value;
    else
        destination.target.properties = value;
}
/** Normalize one implicit property map and all descendants with explicit work frames. */
function normalizePropertyMap(entries: Record<string, unknown>, path: string, requiredNames: Set<string>, raw: boolean): NormalizedNode {
    const holder: { value?: NormalizedNode } = {};
    const ancestors = new Set<object>();
    const tasks: NormalizeTask[] = [{
            kind: 'map',
            entries,
            path,
            requiredNames,
            raw,
            destination: { kind: 'root', holder },
        }];
    for (let task = tasks.pop(); task !== undefined; task = tasks.pop()) {
        if (task.kind === 'leave') {
            ancestors.delete(task.value);
            continue;
        }
        if (task.kind === 'map') {
            if (ancestors.has(task.entries))
                throw new Error(`harness.defineTool ${task.path} is circular`);
            assertSchemaContainerKeys(task.entries, task.path);
            ancestors.add(task.entries);
            const spec: NormalizedNode = {};
            assignNormalizedMap(task.destination, spec);
            tasks.push({ kind: 'leave', value: task.entries });
            const mapEntries = Object.entries(task.entries);
            for (let index = mapEntries.length - 1; index >= 0; index--) {
                const entry = mapEntries[index];
                /* v8 ignore next -- the loop is bounded by the captured entry count. */
                if (entry === undefined)
                    continue;
                tasks.push({
                    kind: 'value',
                    value: entry[1],
                    path: `${task.path}.${entry[0]}`,
                    forceRequired: task.requiredNames.has(entry[0]),
                    raw: task.raw,
                    parameterProperty: true,
                    destination: { kind: 'property', target: spec, key: entry[0] },
                });
            }
            continue;
        }
        const { value, path } = task;
        if (!isPlainRecord(value)) {
            throw new Error(`harness.defineTool ${path} must be a ParameterSchemaSpec property object`);
        }
        assertSchemaContainerKeys(value, path);
        if (ancestors.has(value))
            throw new Error(`harness.defineTool ${path} is circular`);
        ancestors.add(value);
        const requiredKey = task.parameterProperty && !task.raw ? ['required'] : [];
        if (task.parameterProperty && task.raw && Object.hasOwn(value, 'required') && value.type !== 'object') {
            throw new Error(`harness.defineTool ${path}.required belongs to the containing raw object schema`);
        }
        if (task.parameterProperty && !task.raw && Object.hasOwn(value, 'required') && value.required !== true) {
            throw new Error(`harness.defineTool ${path}.required must be true when present`);
        }
        const prop: NormalizedNode = {};
        assignNormalizedValue(task.destination, prop);
        tasks.push({ kind: 'leave', value });
        if (task.forceRequired || value.required === true)
            prop.required = true;
        copyAnnotations(value, prop, path);
        if (Object.hasOwn(value, 'oneOf')) {
            assertSchemaKeys(value, path, ['oneOf', ...requiredKey, ...ANNOTATION_KEYS]);
            if (!isDensePlainArray(value.oneOf) || value.oneOf.length < 2) {
                throw new Error(`harness.defineTool ${path}.oneOf must contain at least two schemas`);
            }
            const oneOf: unknown[] = [];
            prop.oneOf = oneOf;
            for (let index = value.oneOf.length - 1; index >= 0; index--) {
                tasks.push({
                    kind: 'value',
                    value: value.oneOf[index],
                    path: `${path}.oneOf[${index}]`,
                    forceRequired: false,
                    raw: task.raw,
                    parameterProperty: false,
                    destination: { kind: 'one-of', target: oneOf, index },
                });
            }
            continue;
        }
        if (task.raw && !Object.hasOwn(value, 'type')) {
            assertSchemaKeys(value, path, ANNOTATION_KEYS);
            prop.type = 'json';
            continue;
        }
        if (!SCHEMA_TYPES.has(value.type) || task.raw && value.type === 'json') {
            throw new Error(`harness.defineTool ${path} must declare a valid type: ${VALID_TYPES} (got ${JSON.stringify(value.type)})`);
        }
        const type = value.type;
        prop.type = type;
        switch (type) {
            case 'object': {
                assertSchemaKeys(value, path, ['type', 'properties', 'additionalProperties', ...requiredKey, ...(task.raw ? ['required'] : []), ...ANNOTATION_KEYS]);
                if (!task.raw && (!Object.hasOwn(value, 'additionalProperties') || typeof value.additionalProperties !== 'boolean')) {
                    throw new Error(`harness.defineTool ${path}.additionalProperties must be explicitly true or false`);
                }
                if (task.raw && Object.hasOwn(value, 'additionalProperties') && typeof value.additionalProperties !== 'boolean') {
                    throw new Error(`harness.defineTool ${path}.additionalProperties must be a boolean`);
                }
                if (task.raw && Object.hasOwn(value, 'required') && value.required === undefined) {
                    throw new Error(`harness.defineTool ${path}.required must be an array of declared property names`);
                }
                prop.additionalProperties = task.raw ? value.additionalProperties ?? true : value.additionalProperties;
                if (Object.hasOwn(value, 'properties')) {
                    const properties = value.properties;
                    if (!isPlainRecord(properties))
                        throw new Error(`harness.defineTool ${path}.properties must be an object of schemas`);
                    const nestedRequired = task.raw
                        ? normalizeRequiredNames(value.required, properties, `${path}.required`)
                        : new Set<string>();
                    tasks.push({
                        kind: 'map',
                        entries: properties,
                        path: `${path}.properties`,
                        requiredNames: nestedRequired,
                        raw: task.raw,
                        destination: { kind: 'properties', target: prop },
                    });
                }
                else if (task.raw && value.required !== undefined) {
                    normalizeRequiredNames(value.required, {}, `${path}.required`);
                }
                break;
            }
            case 'array':
                assertSchemaKeys(value, path, ['type', 'items', ...requiredKey, ...ANNOTATION_KEYS]);
                if (Object.hasOwn(value, 'items')) {
                    tasks.push({
                        kind: 'value',
                        value: value.items,
                        path: `${path}.items`,
                        forceRequired: false,
                        raw: task.raw,
                        parameterProperty: false,
                        destination: { kind: 'item', target: prop },
                    });
                }
                break;
            case 'string':
            case 'number':
            case 'integer':
            case 'boolean':
            case 'null':
                assertSchemaKeys(value, path, ['type', 'enum', 'const', ...requiredKey, ...ANNOTATION_KEYS]);
                if (Object.hasOwn(value, 'enum')) {
                    if (!isDensePlainArray(value.enum) || value.enum.length === 0) {
                        throw new Error(`harness.defineTool ${path}.enum must be a non-empty array`);
                    }
                    prop.enum = cloneJson(value.enum, `harness.defineTool ${path}.enum`);
                }
                if (Object.hasOwn(value, 'const'))
                    prop.const = cloneJson(value.const, `harness.defineTool ${path}.const`);
                break;
            case 'json':
                assertSchemaKeys(value, path, ['type', ...requiredKey, ...ANNOTATION_KEYS]);
                break;
            /* v8 ignore next 2 -- SCHEMA_TYPES narrows this closed switch before dispatch. */
            default:
                throw new Error(`harness.defineTool ${path} must declare a valid type: ${VALID_TYPES}`);
        }
    }
    /* v8 ignore next -- the root map task assigns before scheduling descendants. */
    return holder.value ?? {};
}
/** Gắn marker `DYNAMIC_TOOL` lên một định nghĩa tool vừa dựng. */
function markDynamicTool(tool: ToolDefinition): ToolDefinition {
    Object.defineProperty(tool, DYNAMIC_TOOL, { value: true });
    return tool;
}
/** Khẳng định một giá trị là tool do `sandboxDefineTool` tạo ra (có marker). */
function assertDynamicTool(tool: unknown): asserts tool is ToolDefinition {
    if (!isPlainRecord(tool) || (tool as Record<PropertyKey, unknown>)[DYNAMIC_TOOL] !== true) {
        throw new Error('dynamic tool registration must use a tool returned by harness.defineTool(...)');
    }
}
/**
 * Structurally a content block, checked AFTER the JSON round-trip: a plain
 * object carrying a string `type` tag. Deliberately nothing deeper — the
 * ContentBlock union is merge-extensible (an unknown tag must pass), and every
 * downstream consumer dispatches on `type` and falls through unknowns.
 */
function isContentBlockShape(value: unknown): boolean {
    return isPlainRecord(value) && typeof value.type === 'string';
}
/**
 * How much of an invalid execute return the teaching error echoes back — a
 * huge blob would burn the model turn the error is trying to save.
 */
const RETURN_PREVIEW_LIMIT = 120;
/**
 * Compact JSON preview of an invalid execute return for the teaching error
 * (`String(…)` for the un-stringifiable undefined case), truncated to
 * {@link RETURN_PREVIEW_LIMIT}.
 */
function describeReturn(value: unknown): string {
    // The caller has already crossed cloneJson, so this value is lossless JSON
    // and serialization cannot produce undefined.
    const json = JSON.stringify(value);
    return json.length > RETURN_PREVIEW_LIMIT ? `${json.slice(0, RETURN_PREVIEW_LIMIT)}…` : json;
}
/**
 * Validate and host-materialize a sandbox renderer's content blocks.
 */
function assertRenderedContent(value: unknown): unknown[] {
    if (Array.isArray(value) && value.every(isContentBlockShape)) {
        return value;
    }
    throw new Error(`output.render returned ${describeReturn(value)} — it must return an ARRAY of content blocks:\n`
        + '  ✓ return [{ type: \'text\', text: String(value) }]');
}
/**
 * `harness.defineTool` trao vào sandbox: DSL thật, với `parameters` được chuẩn hoá thành một ParameterSchemaSpec mới của realm host (wrapper object thô được bóc, mảng required được ánh xạ, độ mở của object DSL được cưỡng bức) và giá trị `execute` trả về được chuẩn hoá sang realm host bằng JSON round-trip.
 * Nhận: `options` — tuỳ chọn `defineTool` chuẩn; `parameters` có thể là DSL ParameterSchemaSpec hoặc wrapper kiểu JSON-Schema.
 * Trả: định nghĩa đã gắn marker mà `harness.registerTool` (và `ctx.tools.register` có guard) chấp nhận.
 * @throws Error khi options/output/execute sai hình dạng, schema nằm ngoài tập được hỗ trợ, hoặc giá trị trả về không phải JSON lossless.
 */
export function sandboxDefineTool(options: unknown): ToolDefinition {
    if (!isPlainRecord(options))
        throw new Error('harness.defineTool options must be an object');
    const normalized = normalizeParameterSchemaSpec(options.parameters);
    if (!isPlainRecord(options.output)) {
        throw new Error('harness.defineTool output must declare { schema, render, presentationMeta? }');
    }
    const output = options.output;
    if (typeof output.render !== 'function')
        throw new Error('harness.defineTool output.render must be a function');
    if (output.presentationMeta !== undefined && typeof output.presentationMeta !== 'function') {
        throw new Error('harness.defineTool output.presentationMeta must be a function when present');
    }
    if (typeof options.execute !== 'function')
        throw new Error('harness.defineTool execute must be a function');
    const schema = cloneJson(output.schema, 'harness.defineTool output.schema');
    const rawExecute = options.execute as (args: unknown, exec: unknown) => unknown;
    const rawRender = output.render as (args: unknown, value: unknown) => unknown;
    const rawPresentationMeta = output.presentationMeta as ((args: unknown, value: unknown) => unknown) | undefined;
    const erasedDefineTool = defineTool as unknown as (options: Record<string, unknown>) => ToolDefinition;
    const tool = erasedDefineTool({
        ...options,
        parameters: normalized.spec,
        output: {
            schema,
            render(args: unknown, value: unknown) {
                return assertRenderedContent(cloneJson(rawRender(args, value), 'harness.defineTool output.render result'));
            },
            ...rawPresentationMeta !== undefined ? {
                presentationMeta(args: unknown, value: unknown) {
                    return cloneJson(rawPresentationMeta(args, value), 'harness.defineTool output.presentationMeta result');
                },
            } : {},
        },
        async execute(args: unknown, exec: unknown) {
            return cloneJson(await rawExecute(args, exec), 'harness.defineTool execute result');
        },
    });
    const parameters = { ...tool.parameters, ...normalized.rootAnnotations };
    assertSupportedJsonSchema(parameters);
    return markDynamicTool({
        ...tool,
        parameters,
    });
}
/**
 * Chuẩn hoá một lượt đăng ký `harness.handle` tại ranh giới sandbox: tên method phải là chuỗi khác rỗng, handler phải là hàm và kết quả của nó được materialize sang realm host bằng đúng phép clone JSON như giá trị trả về của tool `execute` (object của realm VM nếu không sẽ thoát khỏi khế ước plain-object của wire).
 * Nhận: `method` — tên handler mà nửa browser của gói gọi qua `host.call`; `fn` — handler sandbox nhận tham số JSON đã giải mã từ wire.
 * Trả: `{ method, handler }` — tên đã kiểm và handler đã bọc clone.
 * @throws Error khi `method` không phải chuỗi khác rỗng, hoặc `fn` không phải hàm.
 */
export function normalizeHandler(method: unknown, fn: unknown): { method: string; handler: (args: unknown) => Promise<unknown> } {
    if (typeof method !== 'string' || method.length === 0) {
        throw new Error('harness.handle(method, fn) needs a non-empty string method name');
    }
    if (typeof fn !== 'function') {
        throw new Error(`harness.handle("${method}") needs a handler function as its second argument`);
    }
    const rawHandler = fn as (args: unknown) => unknown;
    return {
        method,
        handler: async (args) => cloneJson(await rawHandler(args), `harness.handle("${method}") result`),
    };
}
/**
 * `harness.registerTool` trao vào sandbox: đăng ký một tool động đã kiểm marker vào sổ của context được cấp.
 * Nhận: `ctx` — context (đã guard) mà service `tools` nhận tool; `tool` — định nghĩa do `sandboxDefineTool` tạo, mọi thứ khác bị từ chối.
 * Trả: hàm disposer của lượt đăng ký trong sổ.
 * @throws Error khi `tool` không mang marker của `sandboxDefineTool`.
 */
export function sandboxRegisterTool(ctx: Context, tool: unknown): () => void {
    assertDynamicTool(tool);
    return ctx.tools.register(tool);
}
/**
 * The verbs a running host half may reach through the sandbox `ctx` façade, beyond its injected
 * services. `on`/`once` observe events, `provide` exposes a service to other packages, and the
 * timer helpers schedule work — each a fiber effect that unwinds when the package stops.
 */
const CTX_VERBS: ReadonlySet<string> = new Set(['effect', 'on', 'once', 'provide', 'timeout', 'interval', 'setTimeout', 'setInterval', 'throttle', 'debounce']);
const TIMER_VERBS: ReadonlySet<string> = new Set(['timeout', 'interval', 'setTimeout', 'setInterval', 'throttle', 'debounce']);
/**
 * The tool-registry façade: `register` (marker-guarded) plus READ-ONLY
 * metadata (`schemas`, and `get` returning a schema view, never the live
 * `ToolDefinition`). Exposing the raw definition would hand package code the
 * tool's `execute` function, letting it call another tool directly and bypass
 * `ToolRuntime.execute` — identity protection, pre-policy, monotonic guards,
 * around dispatch, post-policy, final observation, and result normalization. So `get` returns the same
 * name/description/parameters view as `schemas()`, and nothing invocable.
 */
function sandboxTools(ctx: Context): SandboxTools {
    // Resolve reads and writes through the package's own scope.
    return {
        register: (tool: unknown) => sandboxRegisterTool(ctx, tool),
        schemas: () => ctx.tools.schemas(scopeOf(ctx)),
        get: (name: string) => ctx.tools.schemas(scopeOf(ctx)).find(schema => schema.name === name),
    };
}
/**
 * Reject any injected-service return that is a cordis `Context`. Harness
 * services return data, never a context; a value that is one would be a
 * fresh, unguarded handle back into the runtime — the exact escape the façade
 * exists to close — so it fails loud instead of reaching sandbox code.
 */
// Twinned with the browser half's guard for the same reason as the ctx façade
// below: this is the rule "a service must never hand sandboxed code a Context",
// and each half must test against the Context class of ITS OWN face. Moving the
// rule into a shared package would move a security invariant out of the halves
// that enforce it, which is a design decision rather than a duplication fix.
/* jscpd:ignore-start */
function denyContext(value: unknown, service: string, reportFailure: ReportFailure): unknown {
    if (value instanceof Context) {
        return rejectGuard(reportFailure, `service "${service}" returned a cordis Context, which the sandbox does not expose. `
            + 'Operate through your own plugin ctx (ctx.on / ctx.provide / ctx.tools.register) '
            + 'and the services you inject — never another context.');
    }
    return value;
}
/**
 * Wrap an injected service so its methods forward to the real instance but
 * their return values pass through {@link denyContext}. Non-function members
 * (plain data) pass through as-is; a returned Promise is guarded on resolve.
 */
function guardedService(service: object, name: string, reportFailure: ReportFailure): object {
    return new Proxy(service, {
        get(target, prop) {
            const value = Reflect.get(target, prop, target);
            if (typeof value !== 'function')
                return denyContext(value, name, reportFailure);
            return (...args: unknown[]) => {
                const result = Reflect.apply(value, target, args);
                if (result instanceof Promise)
                    return result.then(v => denyContext(v, name, reportFailure));
                return denyContext(result, name, reportFailure);
            };
        },
    });
}
/* jscpd:ignore-end */
/**
 * The service names a plugin declared in `inject`, as a lookup set. Whatever
 * declaration style the plugin used — an `inject: ['bash', 'tools']` array or
 * the `{ required, optional }` object form — cordis resolves it into a single
 * name-keyed map on the fiber before `apply` runs (`{ bash: null, tools: null }`),
 * so the gate just reads that map's keys. A host half may reach only the services
 * it declared — that is what lets cordis park it when a declared provider
 * goes away.
 */
function declaredInjects(ctx: Context): Set<string> {
    return new Set(Object.keys(ctx.fiber.inject));
}
/**
 * Whitelist context for running host halves: lifecycle-safe verbs, guarded
 * tools, optional `ctx.get()` lookup, and declared-service property access.
 * Framework plumbing is denied, and service methods cannot return a Context.
 */
function sandboxContext(ctx: Context, reportFailure: ReportFailure): Context {
    const tools = sandboxTools(ctx);
    const declared = declaredInjects(ctx);
    // A framework member or an undeclared service — distinguish the two so the
    // error teaches the right fix (declare it in inject vs it is withheld).
    const denyRead = (prop: string): never => {
        if (ctx.get(prop) !== undefined) {
            return rejectGuard(reportFailure, `service "${prop}" is not injected. Declare it: inject: ['${prop}', …] on your plugin, `
                + 'so cordis parks this dynamic package if the provider later goes away.');
        }
        return rejectGuard(reportFailure, `sandbox ctx does not expose "${prop}". Available: ctx.tools.register / ctx.on / ctx.provide / `
            + 'the timer helpers after injecting timer, and any service you declared in inject. '
            + 'Framework internals (root, fiber, registry, extend, plugin, …) are withheld by design.');
    };
    // `get` is optional lookup; property access requires a declaration. `tools`
    // is the façade's own API on either path.
    const readService = (name: string, requireDeclaration: boolean): unknown => {
        if (name === 'tools')
            return tools;
        if (requireDeclaration && !declared.has(name))
            return denyRead(name);
        const service = denyContext(ctx.get(name), name, reportFailure);
        if (service === null || (typeof service !== 'object' && typeof service !== 'function'))
            return service;
        return guardedService(service, name, reportFailure);
    };
    const get = (name: string): unknown => readService(name, false);
    // The browser half builds the same façade over its own Context
    // (`@deepseek-ai/dsh-cordis-client-runner`, whose CTX_VERBS names this one its
    // twin), and the sameness is the point: a package author meets ONE contract on
    // both halves. Folding them together is not available — the two halves compile
    // in separate programs where `Context` merges different service keys — so the
    // duplication is declared here instead of hidden behind a config exception.
    /* jscpd:ignore-start */
    return new Proxy({}, {
        get(_target, prop) {
            if (prop === 'tools')
                return tools;
            if (prop === 'get')
                return get;
            if (typeof prop !== 'string')
                return undefined;
            // Lazy verb forwarder — reads `ctx[verb]` only when called. Timer mixins
            // additionally require the Service declaration before Cordis resolves them.
            if (CTX_VERBS.has(prop)) {
                return (...args: unknown[]) => {
                    if (TIMER_VERBS.has(prop) && !declared.has('timer'))
                        return denyRead('timer');
                    const method = (ctx as unknown as Record<string, (...methodArgs: unknown[]) => unknown>)[prop] as (...methodArgs: unknown[]) => unknown;
                    return Reflect.apply(method, ctx, args);
                };
            }
            return readService(prop, true);
        },
        // A façade is not the real ctx; block writes rather than let package code
        // stash state on a throwaway object and think it persisted.
        set(_target, prop) {
            return rejectGuard(reportFailure, `sandbox ctx is read-only; cannot assign "${String(prop)}"`);
        },
        // `in` reflects reachability: the façade API plus DECLARED services
        // (whether or not currently live). Does not resolve/wrap — no throw.
        has: (_target, prop) => prop === 'tools' || prop === 'get'
            || (typeof prop === 'string'
                && ((CTX_VERBS.has(prop) && (!TIMER_VERBS.has(prop) || declared.has('timer'))) || declared.has(prop))),
    }) as Context;
    /* jscpd:ignore-end */
}
/**
 * Thu hẹp một giá trị bất kỳ do sandbox trả về thành plugin cordis chạy được: một hàm, hoặc object có `apply` là hàm. (Một hàm trần khớp nhánh đầu, nên nhánh object không bao giờ chạm `Function.prototype.apply`.)
 * Nhận: `value` — bất kỳ giá trị nào nửa host trả về.
 * Trả: `true` nếu giá trị khởi động được bằng `ctx.plugin`.
 */
export function isPlugin(value: unknown): value is Plugin {
    if (typeof value === 'function')
        return true;
    return typeof value === 'object' && value !== null
        && typeof (value as { apply?: unknown }).apply === 'function';
}
/**
 * Bọc plugin để `apply` nhận façade context sandbox trong khi vẫn giữ nguyên metadata inject.
 * Nhận: `plugin` — plugin mà nửa host trả về; `reportFailure` — hàm báo một lần từ chối của guard về Agent sở hữu.
 * Trả: plugin tương đương mà `apply` chỉ thấy façade context sandbox.
 * @throws Error (khi chạy `apply`, không phải lúc bọc) nếu package chạm thành viên bị cấm, service chưa khai, hoặc service trả về một cordis Context.
 */
export function guardedPlugin(plugin: Plugin, reportFailure: ReportFailure): Plugin {
    if (typeof plugin === 'function') {
        const functionPlugin = plugin as Plugin.Function<unknown>;
        return {
            name: pluginName(plugin),
            apply(ctx: Context, config: unknown) {
                return functionPlugin(sandboxContext(ctx, reportFailure), config);
            },
        };
    }
    const objectPlugin = plugin as Plugin.Object<unknown>;
    return {
        ...plugin,
        apply(ctx: Context, config: unknown) {
            return objectPlugin.apply(sandboxContext(ctx, reportFailure), config);
        },
    };
}
/** Ném lỗi guard sau khi báo thất bại cho Agent sở hữu. */
function rejectGuard(reportFailure: ReportFailure, message: string): never {
    const error = new Error(message);
    reportFailure(error);
    throw error;
}
/**
 * Tên hiển thị của một plugin đang chạy: thuộc tính `name` của nó, không có thì ẩn danh.
 * Nhận: `plugin` — plugin mà nửa host trả về.
 * Trả: tên người đọc dùng trong kết quả run và output inspect.
 */
export function pluginName(plugin: Plugin): string {
    const named = plugin.name;
    if (typeof named === 'string' && named.length > 0)
        return named;
    return '<anonymous>';
}
