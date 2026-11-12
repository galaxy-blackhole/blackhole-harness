/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN 2/2 của bundle gốc @deepseek-ai/dsh-tool-fs — sinh tự động từ bundle gốc, không sửa tay
 */
// @ts-nocheck

//#region lib/types/edit.js
/**
* Model-facing literal edit, unique-match by default. It obtains an optional guard from the
* single intent slot, calls `ctx.fs.editText` without a separate stat, then records the observed
* version; no policy means an unconditional atomic edit.
* @module @deepseek-ai/dsh-tool-fs/src/edit
*/
/**
* Validate value constraints the schema DSL can't express: a non-blank
* `file_path`, a non-empty `old_string`, and `old_string !== new_string`
* (an equal pair would be a guaranteed no-op edit).
* @param args - the schema-validated raw tool arguments.
* @returns the camelCased input with `replace_all` defaulted to false.
*/
function parseEditArgs(args) {
	if (args.file_path.trim().length === 0) throw new Error("file_path must be a non-empty string");
	if (args.old_string.length === 0) throw new Error("old_string must be a non-empty string");
	if (args.old_string === args.new_string) throw new Error("old_string and new_string must differ");
	return {
		filePath: args.file_path,
		oldString: args.old_string,
		newString: args.new_string,
		replaceAll: args.replace_all ?? false
	};
}
/**
* Format an edit success (single-match or replace-all) as a Claude-style model-facing message.
* @param displayPath - the backend-resolved path shown to the model.
* @param replaceAll - selects the all-occurrences wording over the single-replacement one.
* @returns the confirmation sentence the model sees as the tool result.
*/
function formatEditOutput(displayPath, replaceAll) {
	return replaceAll ? `The file ${displayPath} has been updated. All occurrences were successfully replaced.` : `The file ${displayPath} has been updated successfully.`;
}
/**
* Register the `edit` tool and its scope-aware system-prompt guidance.
* @param ctx - the plugin context; registrations are effects scoped to it, and execution uses its `fs` service.
* @param sandbox - the shared sandbox-escalation API (advertisement, mode stamping, denial mapping).
*/
function applyEditTool(ctx, sandbox) {
	ctx.systemPrompt.section({
		name: "tool:edit",
		order: ctx.systemPrompt.getSectionOrder("TOOL_EDIT"),
		text: ({ scope }) => ctx.tools.get("edit", scope) === void 0 ? "" : "Read a file before editing it (the default fs-observation-policy requires it), unless you just created or edited it in this session."
	});
	ctx.tools.register(defineTool({
		name: "edit",
		description: "Edit an existing UTF-8 text file by replacing literal text.",
		parameters: {
			file_path: {
				type: "string",
				required: true,
				description: "Path to edit, resolved by the filesystem backend. Provide `file_path` before `old_string` and `new_string` in the arguments."
			},
			old_string: {
				type: "string",
				required: true,
				description: "Literal text to replace."
			},
			new_string: {
				type: "string",
				required: true,
				description: "Literal replacement text. Use an empty string to delete the match."
			},
			replace_all: {
				type: "boolean",
				description: "Replace all matches. Defaults to false; when false, old_string must appear exactly once."
			},
			...sandbox.escalationModes.length > 0 ? sandbox.schemaFields() : {}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					path: {
						type: "string",
						required: true,
						description: "Canonical absolute path in the filesystem execution world."
					},
					before: {
						type: "string",
						required: true
					},
					after: {
						type: "string",
						required: true
					}
				}
			},
			render: (args, value) => [{
				type: "text",
				text: formatEditOutput(value.path, args.replace_all ?? false)
			}],
			presentationMeta: (_args, value) => ({
				path: value.path,
				diffs: computeHunkDiffs(value.path, value.before, value.after).map(({ path, oldText, newText }) => ({
					path,
					oldText,
					newText
				}))
			})
		},
		async execute(args, exec) {
			const input = parseEditArgs(args);
			const sandboxPolicy = await sandbox.resolvePolicy("edit", args, exec);
			const target = await ctx.fs.resolve(input.filePath, await sessionResolveOptions(ctx, exec));
			let outcome;
			try {
				const intent = await ctx.waterfall("fs/edit-intent", target, exec, () => void 0);
				outcome = await ctx.fs.editText(target, {
					oldString: input.oldString,
					newString: input.newString,
					replaceAll: input.replaceAll
				}, intent, exec.signal, sandboxPolicy);
			} catch (error) {
				throw remediateFsError(sandbox.mapError(error, sandboxPolicy), target.displayPath);
			}
			return mutationResult(ctx, target, outcome, exec);
		},
		presentCall(args) {
			return {
				card: "diff",
				title: `Edit ${args.file_path}`,
				diffs: [{
					path: args.file_path,
					oldText: args.old_string || null,
					newText: args.new_string
				}],
				locations: [{ path: args.file_path }]
			};
		},
		presentResult(args, result) {
			if (result.isError) return void 0;
			const diffs = diffsFromMeta(result.meta);
			if (diffs === void 0) return void 0;
			return {
				card: "diff",
				title: `Edit ${args.file_path}`,
				diffs
			};
		}
	}));
}
//#endregion
//#region lib/types/read-image.js
/**
* The model-facing `read_image` tool commits a PNG/JPEG/WebP/GIF file. A path
* without a file extension is identified from its file signature, while the
* attachment service's full decode stays authoritative. The mounted `ctx.fs`
* backend owns path resolution and read access; names only declare media type.
*
* The route gate is deliberately stricter than the host upload preflight. An
* image-reading tool is useful only when the exact calling route can inspect
* its result, so unknown capability refuses instead of relying on an adapter
* failure after filesystem and attachment work.
* @module @deepseek-ai/dsh-tool-fs/src/read-image
*/
/** Extensions `read_image` accepts; magic-byte validation at the attachment service stays authoritative. */
const IMAGE_EXTENSIONS = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif": "image/gif"
};
const PNG_SIGNATURE = [
	137,
	80,
	78,
	71,
	13,
	10,
	26,
	10
];
const JPEG_SIGNATURE = [
	255,
	216,
	255
];
function matchesBytes(data, offset, expected) {
	if (data.byteLength < offset + expected.length) return false;
	return expected.every((byte, index) => data[offset + index] === byte);
}
function matchesAscii(data, offset, value) {
	if (data.byteLength < offset + value.length) return false;
	for (let index = 0; index < value.length; index += 1) if (data[offset + index] !== value.charCodeAt(index)) return false;
	return true;
}
/**
* Identify the media type declared by a supported image file signature.
* @param data - file bytes read through the current filesystem backend.
* @returns the detected supported media type, or undefined for other bytes.
*/
function sniffImageMediaType(data) {
	if (matchesBytes(data, 0, PNG_SIGNATURE)) return "image/png";
	if (matchesBytes(data, 0, JPEG_SIGNATURE)) return "image/jpeg";
	if (matchesAscii(data, 0, "GIF87a") || matchesAscii(data, 0, "GIF89a")) return "image/gif";
	if (matchesAscii(data, 0, "RIFF") && matchesAscii(data, 8, "WEBP")) return "image/webp";
}
const IMAGE_VALUE_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: true,
	properties: {
		attachmentId: {
			type: "string",
			required: true
		},
		mediaType: {
			type: "string",
			enum: [
				"image/png",
				"image/jpeg",
				"image/webp",
				"image/gif"
			],
			required: true
		},
		bytes: {
			type: "integer",
			required: true
		},
		width: {
			type: "integer",
			required: true
		},
		height: {
			type: "integer",
			required: true
		},
		name: { type: "string" },
		originalDimensions: {
			type: "object",
			additionalProperties: false,
			properties: {
				width: {
					type: "integer",
					required: true
				},
				height: {
					type: "integer",
					required: true
				}
			}
		}
	}
};
/**
* Map a model-supplied path to its declared image media type by extension.
* @param filePath - the raw `file_path` argument (not yet resolved).
* @returns the declared media type, or undefined when the path does not claim an image.
*/
function imageMediaTypeForPath(filePath) {
	return IMAGE_EXTENSIONS[extname(filePath).toLowerCase()];
}
/**
* Enforce the strict image-capability gate for the calling route. Resolves the
* session's latest routed provider/model (request header config, then agent
* options) and requires the exact resolved route to declare `image` input explicitly.
* @param ctx - the plugin context used to resolve the optional `llm` service.
* @param exec - the tool-execution context supplying the calling agent.
* @param requestedPath - the raw, not-yet-resolved path rendered in refusal messages.
*/
async function assertImageCapableRoute(ctx, exec, requestedPath) {
	const routed = exec.agent?.session.requestHeader()?.config;
	const provider = routed?.provider ?? exec.agent?.options.provider;
	const model = routed?.model ?? exec.agent?.options.model;
	const llm = ctx.get("llm");
	if (provider === void 0 || model === void 0 || llm === void 0) throw new Error(`cannot read "${requestedPath}" as an image: the current model route could not be resolved`);
	const active = await llm.resolveModelInfo(provider, model, exec.signal);
	if (active.inputModalities === void 0 || !active.inputModalities.includes("image")) throw new Error(`cannot read "${requestedPath}" as an image: model "${model}" does not declare image input; switch to an image-capable model to read images`);
}
/** Refuse a media type outside the deployment's accepted set, naming the offending path. */
function assertDeploymentAccepts(attachments, mediaType, displayPath) {
	if (!attachments.imageLimits.mediaTypes.includes(mediaType)) throw new Error(`cannot read "${displayPath}": ${mediaType} images are not accepted by this deployment`);
}
/**
* Re-brand a structured image outcome into the durable attachment reference an
* `ImageBlock` carries.
* @param image - the image metadata from the output schema.
* @returns the branded attachment reference.
*/
function imageRefFromValue(image) {
	return {
		attachmentId: AttachmentId(image.attachmentId),
		mediaType: image.mediaType,
		bytes: image.bytes,
		width: image.width,
		height: image.height,
		...image.name === void 0 ? {} : { name: image.name },
		...image.originalDimensions === void 0 ? {} : { originalDimensions: { ...image.originalDimensions } }
	};
}
/**
* Format an image read as the model-facing envelope beside its image block.
* A downscaled read names the on-disk dimensions and the multiplier that maps
* coordinates measured on the attached image back onto the original file.
* @param displayPath - the backend-resolved path rendered in the envelope's `<path>` element.
* @param image - the image metadata to summarize.
* @returns the model-facing envelope; the image itself rides the adjacent image block.
*/
function formatImageReadOutput(displayPath, image) {
	let scaled = "";
	if (image.originalDimensions !== void 0) {
		const x = (image.originalDimensions.width / image.width).toFixed(2);
		const y = (image.originalDimensions.height / image.height).toFixed(2);
		const advice = x === y ? `multiply coordinates by ${x}` : `multiply x coordinates by ${x} and y coordinates by ${y}`;
		scaled = ` (downscaled from ${image.originalDimensions.width}x${image.originalDimensions.height} px; ${advice} to locate features in the original file)`;
	}
	return `<path>${displayPath}</path>
<type>image</type>
<content>
${image.mediaType} image, ${image.width}x${image.height} px, ${image.bytes} bytes${scaled}
</content>`;
}
/**
* Project one structured image read into its model-facing envelope and image.
* @param value - the image-read outcome.
* @returns the two content blocks used by native and nested dispatches.
*/
function imageReadContent(value) {
	return [{
		type: "text",
		text: formatImageReadOutput(value.path, value.image)
	}, {
		type: "image",
		attachment: imageRefFromValue(value.image)
	}];
}
/**
* Register the `read_image` tool into the given context. The composing plugin
* owns the attachments gate: `src/index.ts` calls this inside
* `ctx.inject(['attachments'], …)` so the tool exists only while a durable
* store is mounted. Execution still re-checks `ctx.get('attachments')` for
* direct callers and gates on the calling route's declared image input.
* @param ctx - the registration scope; execution uses its `fs` service plus
*   the optional `attachments`/`llm` services.
*/
function applyReadImageTool(ctx) {
	ctx.tools.register(defineTool({
		name: "read_image",
		description: "Read a PNG/JPEG/WebP/GIF file and return the image itself. Large images are downscaled automatically; do not install image libraries or create thumbnails to inspect an image.",
		parameters: { file_path: {
			type: "string",
			required: true,
			description: "Path to the image file, resolved by the filesystem backend."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					path: {
						type: "string",
						required: true,
						description: "Canonical absolute path in the filesystem execution world."
					},
					image: IMAGE_VALUE_SCHEMA
				}
			},
			render: (_args, value) => imageReadContent(value),
			presentationMeta: (_args, value) => ({ path: value.path })
		},
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			if (args.file_path.trim().length === 0) throw new Error("file_path must be a non-empty string");
			const extension = extname(args.file_path).toLowerCase();
			const declared = imageMediaTypeForPath(args.file_path);
			if (declared === void 0 && extension !== "") throw new Error(`cannot read "${args.file_path}": the ${extension} extension does not declare a supported image format; read_image accepts PNG/JPEG/WebP/GIF files, including extension-less files in those formats`);
			const attachments = ctx.get("attachments");
			if (attachments === void 0) throw new Error(`cannot read "${args.file_path}" as an image: no attachment service is mounted`);
			if (declared !== void 0) assertDeploymentAccepts(attachments, declared, args.file_path);
			await assertImageCapableRoute(ctx, exec, args.file_path);
			const { target, info } = await resolveRegularReadTarget(ctx, exec, args.file_path);
			const byteCap = Math.min(attachments.imageLimits.maxImageBytes, attachments.imageLimits.maxMessageImageBytes);
			const data = await ctx.fs.readBytes(target, exec.signal, byteCap);
			const mediaType = declared ?? sniffImageMediaType(data);
			if (mediaType === void 0) throw new Error(`cannot read "${target.displayPath}": the file content is not a supported image format; read_image accepts PNG/JPEG/WebP/GIF`);
			if (declared === void 0) assertDeploymentAccepts(attachments, mediaType, target.displayPath);
			let ref;
			try {
				ref = await attachments.saveImage({
					data,
					mediaType,
					name: basename(target.displayPath)
				});
			} catch (error) {
				if (!(error instanceof AttachmentError)) throw error;
				if (error.code === "IMAGE_DIMENSION_TOO_LARGE") throw new Error(`cannot read "${target.displayPath}": at least one image side exceeds the ${attachments.imageLimits.maxImageDimension}px limit; downscale the image and read the smaller copy`, { cause: error });
				if (error.code === "IMAGE_TOO_MANY_PIXELS") throw new Error(`cannot read "${target.displayPath}": the image exceeds the ${attachments.imageLimits.maxImagePixels}-pixel decoded-size limit; downscale the image and read the smaller copy`, { cause: error });
				if (error.code === "IMAGE_TOO_LARGE") throw new Error(`cannot read "${target.displayPath}": the image cannot be stored within the deployment's byte limits; downscale the image and read the smaller copy`, { cause: error });
				if (error.code === "ATTACHMENT_WRITE_FAILED" && /16-bit PNG/iu.test(error.message)) throw new Error(`cannot read "${target.displayPath}": the 16-bit PNG could not be converted to the normalized 8-bit sRGB form; convert it to an 8-bit PNG/JPEG/WebP and retry`, { cause: error });
				if (error.code === "INVALID_IMAGE" && declared === void 0) throw new Error(`cannot read "${target.displayPath}": the bytes do not decode as a supported PNG/JPEG/WebP/GIF image; the file may be truncated or corrupt`, { cause: error });
				if (error.code !== "IMAGE_TYPE_MISMATCH") throw error;
				if (declared === void 0) throw new Error(`cannot read "${target.displayPath}": the file signature claims ${mediaType}, but the bytes decode as a different image format; the file may be corrupt`, { cause: error });
				throw new Error(`cannot read "${target.displayPath}": the ${extension} extension declares ${mediaType}, but the bytes use a different image format; rename the file to match its actual format if it is PNG/JPEG/WebP/GIF, or convert it to one of those formats`, { cause: error });
			}
			ctx.emit("fs/observed", target, {
				kind: "present",
				version: info.version
			}, exec);
			return {
				path: ctx.fs.processPath(target),
				image: {
					attachmentId: ref.attachmentId,
					mediaType: ref.mediaType,
					bytes: ref.bytes,
					width: ref.width,
					height: ref.height,
					...ref.name === void 0 ? {} : { name: ref.name },
					...ref.originalDimensions === void 0 ? {} : { originalDimensions: { ...ref.originalDimensions } }
				}
			};
		},
		presentCall(args) {
			return {
				card: "generic",
				title: `Read image ${args.file_path}`,
				kind: "read",
				locations: [{ path: args.file_path }]
			};
		}
	}));
}
//#endregion
//#region lib/types/sandbox.js
/**
* The sandbox-escalation API shared by the `write` and `edit` tools: the
* per-call policy resolution, the advertised escalation fields, and the denial-marker
* mapping — all delegating the vocabulary and the fail-closed approval
* sequence to `@deepseek-ai/dsh-sandbox` (the same pieces `@deepseek-ai/dsh-tool-bash`
* uses), so bash and fs escalate identically. Built ONCE per plugin from
* `ctx.fs.sandboxMode` (the capability fact — is a confining backend mounted?)
* and shared by both mutating tools.
*
* @module @deepseek-ai/dsh-tool-fs/sandbox
*/
/**
* The filesystem escalation API: advertisement gating, per-call policy
* resolution, the one-approved wider retry, and denial-marker mapping. A pure
* product of `ctx` at plugin apply time.
*/
var FsSandboxController = class {
	ctx;
	/** The escalation targets this composition advertises (`[]` when no confining backend is mounted). */
	escalationModes;
	/** Shared per-session policy resolver, required by a confining backend. */
	policy;
	constructor(ctx) {
		this.ctx = ctx;
		const defaultMode = ctx.fs.sandboxMode;
		this.escalationModes = defaultMode === void 0 ? [] : ESCALATION_TARGETS;
		this.policy = defaultMode === void 0 ? void 0 : ctx.get("sandboxPolicy");
		if (defaultMode !== void 0 && this.policy === void 0) throw new Error("tool-fs: the mounted filesystem confines but ctx.sandboxPolicy is missing");
	}
	/**
	* The escalation schema fields for a mutating tool's `parameters`. Call it
	* only under a confining backend (guard on {@link escalationModes}); the
	* enum pins the closed target vocabulary, the strict-wider check happens per
	* call at execution.
	* @returns the two escalation parameter specs.
	*/
	schemaFields() {
		return {
			sandbox_permissions: {
				type: "string",
				enum: [...this.escalationModes],
				description: sandboxPermissionsDescription("operation")
			},
			justification: {
				type: "string",
				description: "Required with sandbox_permissions: one sentence for the user explaining why this exact file operation needs the wider access. Use the language of the user’s current request."
			}
		};
	}
	/**
	* The policy to stamp onto this mutation: an approved escalation grant (a
	* strictly wider retry resolved through `ctx.approval` before anything
	* executes), else the Session's standing mode. Repeating the standing mode
	* requires no approval. The workspace root is the original Session
	* directory, or the deployment fallback when absent. Validates the escalation argument
	* pairing first.
	* @param toolName - the mutating tool's name, for the approval audit trail.
	* @param args - the call's escalation arguments.
	* @param exec - the tool-execution context (agent, callId, signal).
	* @returns the policy to pass to the mutation, or undefined for an
	*   unsandboxed backend.
	*/
	async resolvePolicy(toolName, args, exec) {
		validateEscalationArgs(args.sandbox_permissions, args.justification);
		const standingPolicy = this.policy?.resolve({ ...exec.agent ? { session: exec.agent.session } : {} });
		if (args.sandbox_permissions === void 0 || args.justification === void 0) return standingPolicy;
		if (this.escalationModes.length === 0) throw new Error("sandbox_permissions is not available in this composition (no sandboxing filesystem to escalate)");
		const policy = standingPolicy;
		const approvedMode = await approveEscalation({
			requestedMode: args.sandbox_permissions,
			justification: args.justification,
			effectiveMode: policy.mode,
			subject: "operation"
		}, {
			approver: this.ctx.get("approval"),
			agent: exec.agent,
			callId: exec.callId,
			toolName,
			signal: exec.signal
		});
		return {
			...policy,
			mode: approvedMode
		};
	}
	/**
	* Map a thrown provider error for the model: a `FS_SANDBOX_DENIED` becomes a
	* `FsError` whose text is the shared `[sandbox: …]` denial marker plus the
	* same-turn escalation hint, so a policy denial reads identically to bash's
	* WHILE keeping the structured `FS_SANDBOX_DENIED` code — `ToolRuntime`
	* populates `result.error` only for `HarnessError` instances, so a plain
	* `Error` would strip the code retry/observers key off. Any other error
	* passes through unchanged. A `FS_SANDBOX_DENIED` only arises under a
	* confining backend, which always advertises the escalation fields, so the
	* hint always applies here.
	* @param error - the error thrown by the mutation.
	* @param policy - the policy stamped onto the call (names the mode in the marker).
	* @returns the error to throw — the marker `FsError` for a sandbox denial, else the original.
	*/
	mapError(error, policy) {
		if (!(error instanceof FsError) || error.code !== "FS_SANDBOX_DENIED") return error;
		const mode = policy.mode;
		return new FsError(`${sandboxDenialMarker(mode)}\n${escalationHintMarker("operation")}`, "FS_SANDBOX_DENIED", { cause: error });
	}
};
//#endregion
//#region lib/types/index.js
/**
* Model-facing read, read_image, write, and edit tools over `ctx.fs`. This package owns schemas, validation,
* read windows, formatting, and observation events, never a concrete provider. An optional
* event policy supplies mutation guards; without one the tools use unconditional provider calls.
* @module @deepseek-ai/dsh-tool-fs
*/
/** Cordis plugin name used by loader diagnostics. */
const name = "tool-fs";
/** Services required by the filesystem tool suite. */
const inject = [
	"tools",
	"fs",
	"systemPrompt",
	"workingDirectory"
];
const Config = z.object({
	read: z.boolean().default(true),
	readImage: z.boolean().default(true),
	write: z.boolean().default(true),
	edit: z.boolean().default(true),
	readLimit: z.number().default(READ_LIMIT),
	readMaxLineLength: z.number().default(READ_MAX_LINE_LENGTH),
	readMaxBytes: z.number().default(READ_MAX_BYTES),
	readStreamMinSize: z.number().default(STREAM_MIN_SIZE)
});
/** Every read cap counts lines/chars/bytes — a positive integer, or windowing arithmetic misbehaves silently. */
function assertPositiveInteger(name, value) {
	if (!Number.isInteger(value) || value < 1) throw new Error(`tool-fs: ${name} must be a positive integer`);
}
/** Register the selected filesystem tools; `read_image` additionally requires a mounted attachment store. */
function apply(ctx, config) {
	const resolved = config;
	assertPositiveInteger("readLimit", resolved.readLimit);
	assertPositiveInteger("readMaxLineLength", resolved.readMaxLineLength);
	assertPositiveInteger("readMaxBytes", resolved.readMaxBytes);
	assertPositiveInteger("readStreamMinSize", resolved.readStreamMinSize);
	if (resolved.read) applyReadTool(ctx, {
		limit: resolved.readLimit,
		maxLineLength: resolved.readMaxLineLength,
		maxBytes: resolved.readMaxBytes,
		streamMinSize: resolved.readStreamMinSize
	});
	if (resolved.readImage) ctx.inject(["attachments"], (imageCtx) => {
		applyReadImageTool(imageCtx);
	});
	if (resolved.write || resolved.edit) {
		const sandbox = new FsSandboxController(ctx);
		if (resolved.write) applyWriteTool(ctx, sandbox);
		if (resolved.edit) applyEditTool(ctx, sandbox);
	}
}
//#endregion
export { Config, apply, inject, name };


export {};
