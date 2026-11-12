/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @galaxy-blackhole/gbh-host-typert-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/transport.js
		/** Session-specific adapters for Gateway-owned Remote stream lifecycles. */
		function toSessionJournalChange(change) {
			switch (change.type) {
				case "replace":
				case "prepend": return {
					...change,
					entries: historyEntries(change.entries)
				};
				case "append": return {
					type: "append",
					entry: change.entry
				};
				case "notification": return {
					type: "assistant-stream",
					frame: change.notification
				};
			}
		}
		/**
		* Create the Host-wide Session control snapshot stream.
		* @param remote - generated Session namespace and Gateway stream factory.
		* @param options - Session state destinations.
		* @returns an unstarted stream owned by the Client Session runtime.
		*/
		function createSessionControlStream(remote, options) {
			return new _deepseek_ai_dsh_api_gateway_client.RemoteSnapshotStream(remote.$stream({
				name: "session control stream",
				open: (signal) => remote.session.control(signal),
				ended: (accepted) => accepted ? new _deepseek_ai_dsh_api_gateway_client.RemoteStreamCarrierError("session control stream ended without a terminal result") : /* @__PURE__ */ new Error("session control stream ended before its opening snapshot"),
				...options.carrierFailed === void 0 ? {} : { carrierFailed: options.carrierFailed }
			}), {
				name: "session control stream",
				isSnapshot: (frame) => frame.type === "baseline",
				replace: options.accept,
				update: options.accept,
				failed: options.failed
			});
		}
		/** Gateway-owned event journal bound to one ordinary or direct-subagent Session address. */
		var SessionEventStream = class extends _deepseek_ai_dsh_api_gateway_client.RemoteJournalStream {
			remote;
			address;
			/**
			* @param remote - generated Session namespace and Gateway stream factory.
			* @param address - durable ordinary-Session or direct-subagent address.
			* @param options - Session event-window destinations.
			*/
			constructor(remote, address, options) {
				super(remote, {
					name: "session event stream",
					emptyCursor: -1,
					entries: (page) => page.records,
					hasMore: (page) => page.hasMore,
					first: historyRecordFirstSeq,
					last: historyRecordLastSeq,
					compare: (left, right) => left - right,
					follows: (left, right) => right === left + 1,
					publish: (change) => {
						options.publish(toSessionJournalChange(change));
					},
					...options.carrierFailed === void 0 ? {} : { carrierFailed: options.carrierFailed },
					failed: options.failed
				});
				this.remote = remote;
				this.address = address;
			}
			/** @inheritdoc */
			async *follow(request, signal) {
				let assistantRevision;
				for await (const frame of this.remote.session.follow({
					address: this.address,
					assistantStream: true,
					...this.repairRequest(request)
				}, signal)) {
					if (frame.type === "snapshot") {
						for (const record of frame.records) assertSessionWireEvent(record.event);
						if (frame.assistantStream === void 0) throw new RemoteError("gateway/internal", "session assistant stream omitted its opted-in opening baseline", {});
						assistantRevision = frame.assistantStream.revision;
						yield {
							type: "opened",
							cursor: frame.cursor,
							page: {
								records: frame.records,
								hasMore: frame.hasMore,
								projections: frame.projections,
								assistantStream: frame.assistantStream
							}
						};
						continue;
					}
					if (frame.type === "assistant-stream") {
						const expected = (assistantRevision ?? 0) + 1;
						if (frame.frame.revision !== expected) throw new _deepseek_ai_dsh_api_gateway_client.RemoteStreamCarrierError(`session assistant stream skipped revision ${String(expected)}`);
						assistantRevision = frame.frame.revision;
						yield {
							type: "notification",
							notification: frame.frame
						};
						continue;
					}
					assertSessionWireEvent(frame.event);
					yield {
						type: "entry",
						entry: frame
					};
				}
			}
			/** @inheritdoc */
			async readPage(request, throughSeq, signal) {
				const result = await this.remote.session.page({
					address: this.address,
					throughSeq,
					...request
				}, signal);
				if (!result.ok) throw result.error;
				for (const record of result.value.records) assertSessionWireEvent(record.event);
				return result.value;
			}
			/** @inheritdoc */
			repairRequest(request) {
				return {
					...request.maxMessages === void 0 ? {} : { maxMessages: request.maxMessages },
					...request.turnWindow === void 0 ? {} : { turnWindow: request.turnWindow }
				};
			}
		};
		//#endregion

export {};
