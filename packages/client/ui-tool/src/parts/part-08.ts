/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		* @param content - the settled result's content blocks.
		* @returns the narrowed references, or null when no valid image block is present.
		*/
		function imageReferences(content) {
			const refs = [];
			for (const part of content) {
				if (typeof part !== "object" || part === null) continue;
				const { type, attachment } = part;
				if (type !== "image") continue;
				if (typeof attachment !== "object" || attachment === null || Array.isArray(attachment)) return null;
				const { attachmentId, mediaType, bytes, width, height, name, originalDimensions } = attachment;
				if (typeof attachmentId !== "string" || attachmentId === "") return null;
				if (typeof mediaType !== "string" || !isImageMediaType(mediaType)) return null;
				if (!positiveInteger(bytes) || !positiveInteger(width) || !positiveInteger(height)) return null;
				if (name !== void 0 && typeof name !== "string") return null;
				let inputDimensions;
				if (originalDimensions !== void 0) {
					if (typeof originalDimensions !== "object" || originalDimensions === null || Array.isArray(originalDimensions)) return null;
					const { width: inputWidth, height: inputHeight } = originalDimensions;
					if (!positiveInteger(inputWidth) || !positiveInteger(inputHeight)) return null;
					inputDimensions = {
						width: inputWidth,
						height: inputHeight
					};
				}
				refs.push({
					attachmentId,
					mediaType,
					bytes,
					width,
					height,
					...name === void 0 ? {} : { name },
					...inputDimensions === void 0 ? {} : { originalDimensions: inputDimensions }
				});
			}
			return refs.length > 0 ? refs : null;
		}
		/**
		* Join the text blocks other than the image envelope, in order. A post-execute
		* hook that appends further text blocks keeps them visible under the gallery
		* instead of being dropped.
		* @param content - the settled result's text blocks.
		* @returns the joined text, or null when there is none.
		*/
		function extraTexts(content) {
			const parts = content.flatMap((part) => part.type === "text" && typeof part.text === "string" && !IMAGE_ENVELOPE.test(part.text) ? [part.text] : []);
			return parts.length > 0 ? parts.join("\n") : null;
		}
		/**
		* Whether the content carries only blocks the card consumes.
		*
		* `ContentBlock` is a merge-extensible union, so a post-execute hook could
		* append a block of a type this card does not render (reasoning, an extension
		* type, or a non-object). Rendering the card anyway would silently hide that
		* block, so anything beyond a well-formed text or image object declines to the
		* generic card, which shows the flattened content.
		* @param content - the settled result's content blocks.
		* @returns true when every block is a text or image object with usable fields.
		*/
		function fullyRendered(content) {
			return content.every((part) => {
				if (typeof part !== "object" || part === null) return false;
				const { type, text } = part;
				return type === "image" || type === "text" && typeof text === "string";
			});
		}
		/**
		* Derive a settled image card after validating the call head, persisted
		* metadata (or its argument fallback), and the model-facing image envelope.
		*
		* The card is result-side only: a call carries no content until `execute`
		* returns, so a running `read_image` has none and this returns null for it.
		* Both root and nested calls settle as ToolResultNode. Historical nested
		* records without presentation metadata fall back to the call's own
		* `file_path` argument for the path.
		* @param block - running or settled Tool block.
		* @returns the image-card props, or null for the generic path.
		*/
		function imageCardModel(block) {
			if (!("kind" in block) || block.isError) return null;
			const call = parsedToolCall(block);
			if (call?.name !== "read_image") return null;
			const { file_path: filePath } = call.args;
			if (typeof filePath !== "string" || filePath.trim() === "") return null;
			const path = imageMeta(block.meta)?.path ?? (block.parentCallId !== void 0 ? filePath : null);
			if (path === null) return null;
			if (!fullyRendered(block.content)) return null;
			const refs = imageReferences(block.content);
			if (refs === null) return null;
			if (!block.content.some((part) => part.type === "text" && typeof part.text === "string" && IMAGE_ENVELOPE.test(part.text))) return null;
			return {
				path,
				images: refs.map((ref) => ({ attachment: ref })),
				extraText: extraTexts(block.content)
			};
		}
		//#endregion
		//#region lib/types/client/tool/toolviews/read-image-row.js
		/**
		* read_image row: the read-family chrome with the durably committed image as the
		* row's collapsed-by-default card body, rendered through the `tool.call.images`
		* slot this entry declares.
		*/
		function ReadImageRow(props) {
			const { block, renderSlot, loadImage } = props;
			return readFamilyRow(props, {
				image: imageCardModel(block),
				renderSlot,
				loadImage
			});
		}
		/**
		* The read_image row as a plain registrant plugin following the atomic Tool-view
		* declaration across independent activation and reload lifetimes. Declaring
		* `tool.call.images` as a child slot authorizes this entry's `renderSlot` to
		* dispatch the gallery.
		*/
		const readImageToolview = {
			name: "read-image-toolview",
			inject: ["slots"],
			/**
			* Register the read_image row into the Tool-owned keyed view slot.
			* @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
			*/
			apply(ctx) {
				ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
					name: "tool.call.toolview",
					key: "read_image",
					locale: CONVERSATION_NS,
					children: { "tool.call.images": {
						kind: "single",
						scope: "session"
					} }
				}, ReadImageRow));
			}
		};
		//#endregion
		//#region lib/types/client/tool/toolviews/search-row.js
		const SEARCH_TITLE_KEYS = {
			grep: "tool.title.grep",
			glob: "tool.title.glob"
		};
		/** Lets users expand grep or glob results and recover capped searches. */
		function SearchRow({ toolName, block, inspect, useDisclosure, t }) {
			const model = toolRowModel(toolName, block);
			const search = searchCardModel(block);
			return (0, react_jsx_runtime.jsx)(ToolRow, {
				useDisclosure,
				t,
				variant: model.variant,
				toolName,
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: 14 }),
				title: t(toolName === "grep" ? SEARCH_TITLE_KEYS.grep : toolName === "glob" ? SEARCH_TITLE_KEYS.glob : model.titleKey),
				summary: model.summary,
				output: model.output,
				errorSummary: model.errorSummary,
				search,
				state: model.state,
				inspect
			});
		}
		/** Registers the grep and glob conversation rows. */
		const searchToolview = {
			name: "search-toolview",
			inject: ["slots"],
			apply(ctx) {
				ctx.slots.inject("tool.call.toolview", function* () {
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "grep",
						locale: CONVERSATION_NS
					}, SearchRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "glob",
						locale: CONVERSATION_NS
					}, SearchRow);
				});
			}
		};
		//#endregion
		//#region lib/types/client/tool/models/detail-model-shared.js
		/**
		* Narrow parsed JSON to an object record.
		* @param value - Parsed result or argument value.
		* @returns Whether named fields can be read.
		*/
		function detailRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		/**
		* Check a recorded string field that must contain visible text.
		* @param value - Parsed field value.
		* @returns Whether the field is a non-empty string after trimming.
		*/
		function nonempty(value) {
			return typeof value === "string" && value.trim() !== "";
		}
		/**
		* Decode an entire JSON result without accepting a partial prefix.
		* @param text - Recorded text.
		* @returns Parsed JSON, or undefined for non-JSON output.
		*/
		function detailJson(text) {
			try {
				return JSON.parse(text);
			} catch {
				return;
			}
		}
		const STATUS_KEYS = {
			running: "detail.status.running",
			idle: "detail.status.idle",
			ready: "detail.status.ready",
			inactive: "detail.status.inactive",
			provisioning: "detail.status.provisioning",
			failed: "detail.status.failed",
			error: "detail.status.failed",
			completed: "detail.status.completed",
			complete: "detail.status.completed",
			done: "detail.status.completed",
			pending: "detail.todo.pending",
			in_progress: "detail.todo.in_progress",
			deleted: "detail.status.deleted",
			killed: "detail.status.killed",
			blocked: "detail.goal.blocked",
			accepted: "detail.status.accepted",
			queued: "detail.status.queued"
		};
		/**
		* Give a recorded status its localized name and a static semantic color.
		* @param status - Result status, retained verbatim when the vocabulary is unknown.
		* @param t - Conversation translator.
		* @returns A badge that does not imply a live subscription.
		*/
		function detailBadge(status, t) {
			const key = Object.hasOwn(STATUS_KEYS, status) ? STATUS_KEYS[status] : void 0;
			const tone = [
				"completed",
				"complete",
				"done",
				"accepted"
			].includes(status) ? "success" : ["failed", "error"].includes(status) ? "error" : [
				"blocked",
				"killed",
				"pending",
				"queued",
				"inactive"
			].includes(status) ? "warning" : [
				"running",
				"in_progress",
				"provisioning"
			].includes(status) ? "info" : "neutral";
			return {
				label: key === void 0 ? status : t(key),
				tone
			};
		}
		const FIELD_KEYS = {
			id: "detail.field.id",
			revision: "detail.field.revision",
			platform: "detail.field.platform",
			provider: "detail.field.provider",
			model: "detail.field.model",
			role: "detail.field.role",
			context: "detail.field.context",
			ownerName: "detail.field.owner",
			ready: "detail.field.ready",
			blockedBy: "detail.field.dependencies",
			writeScopes: "detail.field.writeScopes",
			writeScopeWarnings: "detail.field.warnings",
			diagnostics: "detail.field.diagnostics",
			methods: "detail.field.methods",
			inputSchema: "detail.field.inputSchema",
			outputSchema: "detail.field.outputSchema",
			currentPackageId: "detail.field.currentPackage",
			nextPackageId: "detail.field.nextPackage",
			latestRun: "detail.field.latestRun",
			packages: "detail.field.packages",
			registrations: "detail.field.registrations",
			props: "detail.field.props",
			data: "detail.field.data",
			source: "detail.field.source",
			arguments: "row.input",
			content: "detail.field.content",
			message: "detail.field.message",
			messageId: "detail.field.messageId",
			status: "detail.state",
			root: "detail.field.root",
			pid: "detail.field.pid",
			type: "detail.field.type",
			time: "detail.field.time",
			seq: "detail.field.seq",
			turn: "detail.field.turn",
			step: "detail.field.step",
			callId: "detail.field.callId",
			agentsStarted: "detail.field.agents",
			output: "row.output",
			result: "detail.field.result"
		};
		/**
		* Name a known tool field while preserving extension-owned field names.
		* @param key - Recorded JSON property name.
		* @param t - Conversation translator.
		* @returns Localized known label or the original property name.
		*/
		function detailLabel(key, t) {
			const label = Object.hasOwn(FIELD_KEYS, key) ? FIELD_KEYS[key] : void 0;
			return label === void 0 ? key : t(label);
		}
		function scalar(value, t) {
			if (value === null) return t("detail.none");
			if (typeof value === "boolean") return t(value ? "detail.yes" : "detail.no");
			return typeof value === "string" ? value : JSON.stringify(value);
		}
		const INSPECTION_KEY_ORDER = [
			"subject",
			"title",
			"name",
			"pluginId",
			"packageId",
			"id",
			"summary"
		];
		const INSPECTION_DETAIL_KEYS = ["description", "purpose"];
		const MAX_INSPECTION_ITEMS = 40;
		/**
		* Project open inspection records into readable fields and named disclosures.
		* @param value - Parsed JSON, including provider-owned extension fields.
		* @param t - Conversation translator.
		* @param depth - Current disclosure depth; deeper records remain available as code.
		* @returns Entity rows preserving the order of visible values.
		*/
		function inspectionItems(value, t, depth = 0) {
			if (depth > 4 && value !== null && typeof value === "object") return [{
				code: {
					text: JSON.stringify(value, null, 2),
					language: "json"
				},
				fields: []
			}];
			if (Array.isArray(value)) {
				const items = value.slice(0, MAX_INSPECTION_ITEMS).flatMap((entry) => inspectionItems(entry, t, depth + 1));
				if (value.length > MAX_INSPECTION_ITEMS) items.push({
					description: t("detail.moreInInspect", { count: value.length - MAX_INSPECTION_ITEMS }),
					fields: []
				});
				return items.length === 0 ? [{
					description: t("detail.empty"),
					fields: []
				}] : items;
			}
			if (!detailRecord(value)) return [{
				description: scalar(value, t),
				fields: []
			}];
			const titleKey = INSPECTION_KEY_ORDER.find((key) => typeof value[key] === "string" && value[key] !== "");
			const descriptionKey = INSPECTION_DETAIL_KEYS.find((key) => typeof value[key] === "string" && value[key] !== "");
			const title = titleKey === void 0 ? void 0 : String(value[titleKey]);
			const fields = [];
			const groups = [];
			for (const [key, field] of Object.entries(value)) {
				if (key === titleKey || key === descriptionKey || key === "status" && typeof field === "string") continue;
				if (key === "inputSchema" || key === "outputSchema") {
					groups.push({
						label: detailLabel(key, t),
						items: [{
							fields: [],
							code: {
								text: JSON.stringify(field, null, 2),
								language: "json"
							}
						}]
					});
					continue;
				}
				if (Array.isArray(field) && field.length === 0) continue;
				if (key === "arguments" && typeof field === "string") {
					const args = detailJson(field);
					if (detailRecord(args)) {
						groups.push({
							label: detailLabel(key, t),
							items: inspectionItems(args, t, depth + 1)
						});
						continue;
					}
				}
				if (field !== null && typeof field === "object") groups.push({
					label: detailLabel(key, t),
					items: inspectionItems(field, t, depth + 1)
				});
				else fields.push({
					label: detailLabel(key, t),
					value: scalar(field, t)
				});
			}
			return [{
				...title === void 0 && typeof value.status !== "string" ? {} : { title: title ?? t("detail.field.result") },
				...descriptionKey === void 0 ? {} : { description: String(value[descriptionKey]) },
				...typeof value.status === "string" ? { badge: detailBadge(value.status, t) } : {},
export {};
