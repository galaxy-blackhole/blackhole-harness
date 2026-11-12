/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			"thumb": "_7yHdaG_thumb"
		};
		//#endregion
		//#region lib/types/client/queue/QueueDock.js
		const EMPTY_QUEUE = [];
		const QUEUE_TEXT_FACTS = {
			collapseWhitespace: true,
			trimWhitespace: true
		};
		function textOf(content) {
			if (!content.every((block) => block.type === "text")) return null;
			return content.map((block) => block.text).join("");
		}
		/**
		* Durable references carried by one queued row. Inbox projections are wire data
		* despite their typed face, so an image block without a reference is skipped
		* rather than trusted.
		* @param content - the row's wire content blocks.
		* @returns the row's durable image references in block order.
		*/
		function queueAttachments(content) {
			const attachments = [];
			for (const block of content) {
				if (block.type === "image") {
					const { attachment } = block;
					if (attachment !== void 0) attachments.push({
						type: "image",
						attachment
					});
				}
				if (block.type === "file") {
					const { attachment } = block;
					if (attachment !== void 0) attachments.push({
						type: "file",
						attachment
					});
				}
			}
			return attachments;
		}
		/** Compact file identity used beside queue thumbnails. */
		function QueueFile({ attachment, label }) {
			return (0, react_jsx_runtime.jsxs)("span", {
				className: QueueDock_module_css_default.file,
				"aria-label": label,
				title: attachment.name,
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: QueueDock_module_css_default.fileIcon,
						"aria-hidden": true,
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
							path: attachment.name,
							size: 16
						})
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: QueueDock_module_css_default.fileName,
						children: attachment.name
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: QueueDock_module_css_default.fileSize,
						children: (0, _deepseek_ai_dsh_client_ui_primitives.fileSizeText)(attachment.bytes)
					})
				]
			});
		}
		/** One durable queued image as a fixed-size thumbnail; a load failure keeps the empty placeholder. */
		function QueueThumb({ attachment, loadImage, label }) {
			const [url, setUrl] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				loadImage(attachment).then((resolved) => {
					if (alive) setUrl(resolved);
				}, () => {});
				return () => {
					alive = false;
				};
			}, [attachment, loadImage]);
			return url === null ? (0, react_jsx_runtime.jsx)("span", {
				className: QueueDock_module_css_default.thumb,
				"aria-hidden": true
			}) : (0, react_jsx_runtime.jsx)("img", {
				className: QueueDock_module_css_default.thumb,
				src: url,
				alt: label
			});
		}
		/**
		* Queue strip: one item renders directly; multiple items default to a
		* collapsible count header; an empty queue renders nothing. Local queued submissions
		* show sending status and disabled actions until their Host queue rows arrive.
		*/
		function QueueDock({ useSession, useProjection, updateQueue, notify, loadImage, renderFactorySlot, t }) {
			const inbox = useProjection("inbox");
			const pendingSubmissions = useSession((s) => s.pendingSubmissions);
			const queue = (0, react.useMemo)(() => {
				const rows = inbox?.["next-turn"] ?? EMPTY_QUEUE;
				const inChat = new Set(pendingSubmissions.filter((item) => item.placement === "transcript").map((item) => item.requestId));
				return inChat.size === 0 ? rows : rows.filter(({ source }) => source.kind !== "user" || !("rpcId" in source) || !inChat.has(source.rpcId));
			}, [inbox, pendingSubmissions]);
			const pendingQueue = (0, react.useMemo)(() => {
				const admitted = new Set(queue.flatMap(({ source }) => source.kind === "user" && "rpcId" in source ? [source.rpcId] : []));
				return pendingSubmissions.filter((submission) => submission.placement === "queued" && !admitted.has(submission.requestId));
			}, [pendingSubmissions, queue]);
			const rowCount = queue.length + pendingQueue.length;
			const running = useSession((s) => s.running);
			const queueMutable = useSession((s) => s.subagent === null || s.subagent.address.mode === "continuable");
			const [editing, setEditing] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(null);
			const [collapsed, setCollapsed] = (0, react.useState)(true);
			const listId = (0, react.useId)();
			(0, react.useEffect)(() => {
				if (rowCount === 0 && !collapsed) setCollapsed(true);
				if (editing !== null && (!queueMutable || !queue.some((row) => row.id === editing.id))) setEditing(null);
			}, [
				collapsed,
				editing,
				queue,
				queueMutable,
				rowCount
			]);
			if (rowCount === 0) return null;
			const interactionActive = queueMutable && (editing !== null || busy !== null);
			const expanded = !collapsed || interactionActive;
			const listVisible = rowCount === 1 || expanded;
			const applyAction = async (itemId, action, failure) => {
				setBusy(itemId);
				try {
					await updateQueue(itemId, action);
					return true;
				} catch {
					notify("error", failure);
					return false;
				} finally {
					setBusy((current) => current === itemId ? null : current);
				}
			};
			const saveEdit = async () => {
				if (editing === null || editing.text.trim() === "") return;
				if (await applyAction(editing.id, {
					kind: "edit",
					content: [{
						type: "text",
						text: editing.text
					}]
				}, t("queue.editFailed"))) setEditing(null);
			};
			return (0, react_jsx_runtime.jsx)("div", {
				className: QueueDock_module_css_default.dock,
				"data-queue-dock": "",
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: QueueDock_module_css_default.panel,
					children: [rowCount > 1 && (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: QueueDock_module_css_default.header,
						"aria-controls": listId,
						"aria-expanded": expanded,
						disabled: interactionActive,
						onClick: () => {
							setCollapsed((value) => !value);
						},
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: QueueDock_module_css_default.lead,
								"aria-hidden": true,
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconQueueOutlineRegular, {})
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: QueueDock_module_css_default.count,
								children: t("queue.count", { n: rowCount })
							}),
							!listVisible && pendingQueue.length > 0 && (0, react_jsx_runtime.jsx)("span", {
								className: QueueDock_module_css_default.status,
								role: "status",
								children: t("queue.sending")
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: QueueDock_module_css_default.chevron,
								"aria-hidden": true,
								children: expanded ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronUpOutlineRegular, {})
							})
						]
					}), (0, react_jsx_runtime.jsxs)("ul", {
						id: listId,
						className: QueueDock_module_css_default.list,
						hidden: !listVisible,
						children: [listVisible && queue.map((row) => {
							const attachments = queueAttachments(row.content);
							const text = textOf(row.content);
							return (0, react_jsx_runtime.jsxs)("li", {
								className: QueueDock_module_css_default.row,
								children: [
									rowCount === 1 && (0, react_jsx_runtime.jsx)("span", {
										className: QueueDock_module_css_default.lead,
										"aria-hidden": true,
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconQueueOutlineRegular, {})
									}),
									editing?.id === row.id ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.InlineEditor, {
										value: editing.text,
										label: t("queue.edit"),
										onChange: (text) => {
											setEditing({
												id: row.id,
												text
											});
										},
										onSave: () => {
											saveEdit();
										},
										onCancel: () => {
											setEditing(null);
										}
									}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [attachments.length > 0 && (0, react_jsx_runtime.jsx)("span", {
										className: QueueDock_module_css_default.attachments,
										children: attachments.map((item, index) => item.type === "image" ? (0, react_jsx_runtime.jsx)(QueueThumb, {
											attachment: item.attachment,
											loadImage,
											label: t("queue.image")
										}, `${item.attachment.attachmentId}:${index}`) : (0, react_jsx_runtime.jsx)(QueueFile, {
											attachment: item.attachment,
											label: t("queue.file", { name: item.attachment.name })
										}, `${item.attachment.attachmentId}:${item.attachment.name}:${index}`))
									}), (0, react_jsx_runtime.jsx)("span", {
										className: QueueDock_module_css_default.preview,
										children: renderFactorySlot("conversation.user.text", {
											text: row.content.filter((block) => block.type === "text").map((block) => block.text).join(""),
											facts: QUEUE_TEXT_FACTS,
											interactive: false,
											ellipsis: true
										})
									})] }),
									queueMutable && (0, react_jsx_runtime.jsx)("div", {
										className: QueueDock_module_css_default.actions,
										children: editing?.id === row.id ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											portal: true,
											label: t("queue.save"),
											side: "bottom",
											delayMs: 500,
											children: (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: QueueDock_module_css_default.action,
												"aria-label": t("queue.save"),
												disabled: busy !== null || editing.text.trim() === "",
												onClick: () => {
													saveEdit();
												},
												children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 14 })
											})
										}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											portal: true,
											label: t("queue.cancelEdit"),
											side: "bottom",
											delayMs: 500,
											children: (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: QueueDock_module_css_default.action,
												"aria-label": t("queue.cancelEdit"),
												disabled: busy !== null,
												onClick: () => {
													setEditing(null);
												},
												children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 })
											})
										})] }) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
											(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
												portal: true,
												label: t("queue.edit"),
												side: "bottom",
												delayMs: 500,
												disabled: text === null,
												children: (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: QueueDock_module_css_default.action,
													"aria-label": t("queue.edit"),
													title: text === null ? t("queue.edit.unsupported") : void 0,
													disabled: busy !== null || text === null,
													onClick: () => {
														if (text !== null) setEditing({
															id: row.id,
															text
														});
													},
													children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 14 })
												})
											}),
											(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
												portal: true,
												label: t("queue.remove"),
												side: "bottom",
												delayMs: 500,
												children: (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: QueueDock_module_css_default.action,
													"aria-label": t("queue.remove"),
													disabled: busy !== null,
													onClick: () => {
														applyAction(row.id, { kind: "remove" }, t("queue.removeFailed"));
													},
													children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
												})
											}),
											(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
												portal: true,
												label: t("queue.steer"),
												side: "bottom",
												delayMs: 500,
												disabled: !running,
												children: (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: QueueDock_module_css_default.action,
													"aria-label": t("queue.steer"),
													title: running ? void 0 : t("queue.steer.unavailable"),
													disabled: busy !== null || !running,
													onClick: () => {
														applyAction(row.id, { kind: "steer" }, t("queue.steerFailed"));
													},
													children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSendOutlineRegular, {})
												})
											})
										] })
									})
								]
							}, row.id);
						}), listVisible && pendingQueue.map((submission) => {
							return (0, react_jsx_runtime.jsxs)("li", {
								className: `${QueueDock_module_css_default.row} ${QueueDock_module_css_default.pendingRow}`,
								"data-submission-echo": "",
								children: [
									rowCount === 1 && (0, react_jsx_runtime.jsx)("span", {
										className: QueueDock_module_css_default.lead,
										"aria-hidden": true,
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconQueueOutlineRegular, {})
									}),
									submission.attachments.length > 0 && (0, react_jsx_runtime.jsx)("span", {
										className: QueueDock_module_css_default.attachments,
										children: submission.attachments.map((attachment, index) => attachment.type === "image" ? (0, react_jsx_runtime.jsx)("img", {
											className: QueueDock_module_css_default.thumb,
											src: attachment.value.previewUrl,
											alt: t("queue.image")
										}, `${attachment.value.previewUrl}:${index}`) : (0, react_jsx_runtime.jsx)(QueueFile, {
											attachment: attachment.value,
											label: t("queue.file", { name: attachment.value.name })
										}, `${attachment.value.attachmentId}:${attachment.value.name}:${index}`))
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: QueueDock_module_css_default.preview,
										children: renderFactorySlot("conversation.user.text", {
											text: submission.text,
											facts: QUEUE_TEXT_FACTS,
											interactive: false,
											ellipsis: true
										})
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: QueueDock_module_css_default.status,
										role: "status",
										children: t("queue.sending")
									}),
									queueMutable && (0, react_jsx_runtime.jsxs)("div", {
										className: QueueDock_module_css_default.actions,
										children: [
											(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: QueueDock_module_css_default.action,
												"aria-label": t("queue.edit"),
												title: t("queue.sending"),
												disabled: true,
												children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 14 })
											}),
											(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: QueueDock_module_css_default.action,
												"aria-label": t("queue.remove"),
												title: t("queue.sending"),
												disabled: true,
												children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
											}),
											(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: QueueDock_module_css_default.action,
												"aria-label": t("queue.steer"),
												title: t("queue.sending"),
												disabled: true,
												children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSendOutlineRegular, {})
											})
										]
									})
								]
							}, submission.requestId);
						})]
					})]
				})
			});
		}
		/** Registers queue actions backed by the session-scoped conversation service. */
		const queueDockEntry = {
			name: "conversation-queue-dock",
			inject: [
				"slots",
				"conversation",
export {};
