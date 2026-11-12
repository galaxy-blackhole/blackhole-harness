/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @deepseek-ai/dsh-api-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/remote-events.js
		/** Client owner for forwarded Remote Event subscriptions and deliveries. */
		/** Private end-of-chain marker that cannot collide with a JSON listener result. */
		const REMOTE_EVENT_NEXT = Symbol("api-gateway.remote-event.next");
		/** Own Cordis registrations, generation pumping, waterfall dispatch, and HTTP replies. */
		var ClientRemoteEvents = class {
			ownerCtx;
			connection;
			openStream;
			eventPrefix = `internal/api-gateway/remote-event/${randomUUID()}/`;
			unregisterGeneration;
			activeGeneration;
			/**
			* @param ownerCtx - Client Gateway root used for Agent Context resolution.
			* @param connection - Connection carrier used for HTTP result calls.
			* @param openStream - selected in-process or WebSocket stream opener.
			*/
			constructor(ownerCtx, connection, openStream) {
				this.ownerCtx = ownerCtx;
				this.connection = connection;
				this.openStream = openStream;
				this.unregisterGeneration = connection.registerGenerationSource(this.runGeneration);
			}
			/**
			* Register one typed Remote Event listener in its calling fiber.
			* @param callerCtx - fiber Context owning the registration.
			* @param event - selected forwarded event.
			* @param listener - listener derived from that event's declaration.
			* @returns disposer for this exact registration.
			*/
			subscribe(callerCtx, event, listener) {
				const dispose = privateEvents(callerCtx).on(this.eventKey(event), listener);
				return () => {
					dispose();
				};
			}
			/** Withdraw the generation source and wait for active listener work to quiesce. */
			async dispose() {
				this.unregisterGeneration();
				await Promise.allSettled([this.activeGeneration]);
			}
			/** Track the current generation so plugin disposal waits for listener work to stop. */
			runGeneration = (signal, ready) => {
				const tracked = this.pumpEvents(signal, ready).finally(() => {
					if (this.activeGeneration === tracked) this.activeGeneration = void 0;
				});
				this.activeGeneration = tracked;
				return tracked;
			};
			/** Deliver one notification through Cordis while containing listener failures. */
			deliver(frame) {
				privateEvents(this.ownerCtx).parallel(this.eventKey(frame.event), ...frame.args).catch((error) => {
					this.reportError(frame.event, error);
				});
			}
			/** Run one Connection generation over the forwarded-event logical stream. */
			async pumpEvents(signal, ready) {
				let clientId;
				const failed = new AbortController();
				const generationSignal = AbortSignal.any([signal, failed.signal]);
				const active = /* @__PURE__ */ new Map();
				const tasks = /* @__PURE__ */ new Set();
				const source = this.openStream(REMOTE_EVENT_STREAM_ENDPOINT, REMOTE_EVENT_STREAM_PAYLOAD, generationSignal);
				let streamFailed = false;
				let streamError;
				try {
					for await (const value of source) {
						if (clientId === void 0) {
							const opening = parseRemoteEventReady(value);
							clientId = opening.clientId;
							ready(opening.host);
							continue;
						}
						const frame = parseRemoteEventFrame(value);
						if (frame.type === "cancel") {
							active.get(frame.eventId)?.abort(/* @__PURE__ */ new Error("client api: Remote event was cancelled by the Host"));
							continue;
						}
						if (frame.type === "emit") {
							this.deliver(frame);
							continue;
						}
						const controller = new AbortController();
						active.set(frame.eventId, controller);
						const deliverySignal = AbortSignal.any([generationSignal, controller.signal]);
						const task = this.answer(frame, clientId, deliverySignal).catch((error) => {
							if (!deliverySignal.aborted) failed.abort(error);
						}).finally(() => {
							active.delete(frame.eventId);
							tasks.delete(task);
						});
						tasks.add(task);
					}
				} catch (error) {
					streamFailed = true;
					streamError = error;
				} finally {
					for (const controller of active.values()) controller.abort(/* @__PURE__ */ new Error("client api: Remote event generation ended"));
					await Promise.allSettled(tasks);
				}
				if (failed.signal.aborted) throw toError(failed.signal.reason, "client api: Remote event result delivery failed");
				if (signal.aborted) return;
				if (streamFailed) throw streamError;
				throw new Error("client api: forwarded Remote event stream ended unexpectedly");
			}
			async answer(frame, clientId, signal) {
				const adapter = this.ownerCtx.typert.contexts.getClient("agent");
				let resolved;
				try {
					resolved = adapter?.resolve(frame.agentId);
				} catch (error) {
					this.reportError(frame.event, error);
				}
				const owned = isTypertOwnedValue(resolved) ? resolved : void 0;
				try {
					const target = isTypertOwnedValue(resolved) ? resolved.value : resolved;
					let outcome = { kind: "next" };
					if (target !== void 0) try {
						outcome = await this.dispatchWaterfall(target, frame, signal);
					} catch (error) {
						if (signal.aborted) return;
						outcome = {
							kind: "rejected",
							error: projectRemoteEventRejection(error)
						};
					}
					if (signal.aborted) return;
					const result = {
						clientId,
						eventId: frame.eventId,
						outcome: outcome.kind === "result" && outcome.value === void 0 ? { kind: "result" } : outcome
					};
					const response = await this.connection.rpc.call("/api", REMOTE_EVENT_RESULT_ENDPOINT, { args: result }, signal);
					if (!response.ok) throw new Error(response.error.message);
				} finally {
					owned?.[Symbol.dispose]();
				}
			}
			async dispatchWaterfall(target, frame, signal) {
				const request = {
					...frame.request,
					agent: target,
					signal
				};
				const value = await privateEvents(target).waterfall(target, this.eventKey(frame.event), request, () => Promise.resolve(REMOTE_EVENT_NEXT));
				if (value !== REMOTE_EVENT_NEXT && value !== void 0 && !isRemoteJsonValue(value)) throw new TypeError("Remote event listener result is not lossless JSON data");
				return value === REMOTE_EVENT_NEXT ? { kind: "next" } : {
					kind: "result",
					value
				};
			}
			eventKey(event) {
				return `${this.eventPrefix}${event}`;
			}
			reportError(event, error) {
				console.error(`client api: Remote event ${JSON.stringify(event)} listener threw:`, error);
			}
		};
		/** Validate and return one generation's Client identity and Host facts. */
		function parseRemoteEventReady(value) {
			if (!isRemoteEventRecord(value) || !hasExactRemoteEventKeys(value, [
				"type",
				"clientId",
				"host"
			]) || value.type !== "ready" || !isRemoteEventClientId(value.clientId) || !isRemoteEventRecord(value.host) || !hasExactRemoteEventKeys(value.host, ["home"]) || typeof value.host.home !== "string") throw new TypeError("client api: forwarded Remote event stream did not begin with ready");
			return {
				clientId: value.clientId,
				host: { home: value.host.home }
			};
		}
		/** Validate one untrusted value from the Gateway-internal forwarded-event stream. */
		function parseRemoteEventFrame(value) {
			if (!isRemoteEventRecord(value)) invalidRemoteEventFrame();
			if (value.type === "cancel" && hasExactRemoteEventKeys(value, ["type", "eventId"]) && isRemoteEventId(value.eventId)) return {
				type: "cancel",
				eventId: value.eventId
			};
			if (value.type === "emit" && hasExactRemoteEventKeys(value, [
				"type",
				"event",
				"args"
			]) && validRemoteEventName(value.event) && Array.isArray(value.args) && isRemoteJsonValue(value.args)) return {
				type: "emit",
				event: value.event,
				args: value.args
			};
			if (value.type === "waterfall" && hasExactRemoteEventKeys(value, [
				"type",
				"event",
				"eventId",
				"agentId",
				"request"
			]) && validRemoteEventName(value.event) && isRemoteEventId(value.eventId) && isRemoteEventAgentId(value.agentId) && isRemoteEventRecord(value.request) && !Object.hasOwn(value.request, "agent") && !Object.hasOwn(value.request, "signal") && isRemoteJsonValue(value.request)) return {
				type: "waterfall",
				event: value.event,
				eventId: value.eventId,
				agentId: value.agentId,
				request: value.request
			};
			invalidRemoteEventFrame();
		}
		function isRemoteEventRecord(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
			const prototype = Object.getPrototypeOf(value);
			return prototype === Object.prototype || prototype === null;
		}
		function hasExactRemoteEventKeys(value, keys) {
			return Reflect.ownKeys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
		}
		function validRemoteEventName(value) {
			return typeof value === "string" && value.length > 0;
		}
		function invalidRemoteEventFrame() {
			throw new TypeError("client api: invalid forwarded Remote event frame");
		}
		function privateEvents(ctx) {
			return ctx;
		}
		function toError(reason, message) {
			return reason instanceof Error ? reason : new Error(message, { cause: reason });
		}
		//#endregion

export {};
