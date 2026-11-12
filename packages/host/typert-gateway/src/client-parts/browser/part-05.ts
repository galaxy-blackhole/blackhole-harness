/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @deepseek-ai/dsh-api-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/stream-client.js
		/** Client owner for the Gateway multiplexed Remote stream socket. */
		/** Physical Remote stream socket failure that may be retried by a domain transport. */
		var RemoteStreamCarrierError = class extends Error {
			/**
			* @param message - physical carrier failure description.
			* @param options - optional causal error.
			*/
			constructor(message, options) {
				super(message, options);
				this.name = "RemoteStreamCarrierError";
			}
		};
		const UPLINK_DONE = {
			value: void 0,
			done: true
		};
		/**
		* Keep one physical WebSocket and share it among independently cancellable
		* Remote streams. A carrier that supplies an in-process stream opener never
		* starts one.
		*/
		var RemoteStreamMuxClient = class {
			openSocket;
			waitForReconnect;
			socket;
			cancelCandidate;
			keepAlive;
			revision = 0;
			streams = /* @__PURE__ */ new Map();
			waiters = /* @__PURE__ */ new Set();
			socketClosures = /* @__PURE__ */ new Set();
			running = false;
			disposed = false;
			failure;
			/**
			* @param openSocket - selected authenticated carrier; omission uses the browser socket.
			* @param waitForReconnect - answering Clients wait for Connection to replace a lost socket; passive Clients fail later opens immediately.
			*/
			constructor(openSocket = () => new WebSocket(remoteStreamUrl()), waitForReconnect = false) {
				this.openSocket = openSocket;
				this.waitForReconnect = waitForReconnect;
			}
			/** Ensure a physical attempt exists, following the current attempt once if needed. */
			start() {
				if (this.disposed) return;
				this.running = true;
				if (this.socket?.readyState === 1) return;
				const pending = this.keepAlive;
				if (pending === void 0) this.maintain();
				else pending.then(() => {
					this.maintain();
				});
			}
			/** Cancel the current socket or retry wait and start a fresh attempt immediately. */
			reconnect() {
				if (!this.running || this.disposed) return;
				const failure = new RemoteStreamCarrierError("api gateway: Remote stream reconnect requested");
				const pending = this.keepAlive;
				this.revision++;
				this.failure = void 0;
				this.cancelCandidate?.(failure);
				const socket = this.socket;
				if (socket !== void 0) {
					this.socket = void 0;
					this.failAll(failure);
					socket.close(4e3, "reconnect requested");
				}
				if (pending === void 0) this.maintain();
				else pending.then(() => {
					this.maintain();
				});
			}
			/**
			* Open one logical stream on the persistent physical connection.
			* After an established socket is lost, answering Clients wait for Connection
			* to reconnect or for their signal to abort; passive Clients reject immediately.
			* An initial socket failure rejects both modes.
			* @param endpoint - Typert Remote stream endpoint.
			* @param payload - endpoint request encoded on the wire.
			* @param signal - cancellation for this logical stream.
			* @param uplink - the Client's items: each is sent as an `item` frame, its end as `end`; its `return()`
			* runs when the stream finishes, and its failure cancels the stream and fails the downlink.
			* @returns Host items until completion, cancellation, or failure.
			*/
			async *open(endpoint, payload, signal, uplink) {
				signal.throwIfAborted();
				const streamId = randomUUID();
				const inbox = new StreamInbox();
				const stream = {
					inbox,
					pump: void 0
				};
				let carrier;
				let opened = false;
				let terminal = false;
				const abort = () => {
					inbox.fail(signal.reason);
				};
				signal.addEventListener("abort", abort, { once: true });
				try {
					const socket = await this.waitForSocket(signal);
					signal.throwIfAborted();
					carrier = socket;
					this.streams.set(streamId, stream);
					this.send(socket, {
						type: "open",
						streamId,
						endpoint,
						payload
					});
					opened = true;
					if (uplink !== void 0) stream.pump = this.pumpUplink(socket, streamId, uplink, signal, inbox);
					while (true) {
						const frame = await inbox.next();
						signal.throwIfAborted();
						if (frame.type === "item") {
							yield frame.value;
							continue;
						}
						terminal = true;
						if (frame.type === "error") throw new RemoteError(frame.error.code, frame.error.message, frame.error.details);
						return;
					}
				} finally {
					signal.removeEventListener("abort", abort);
					this.streams.delete(streamId);
					stream.pump?.stop();
					if (opened && !terminal && carrier?.readyState === 1) this.send(carrier, {
						type: "cancel",
						streamId
					});
					if (stream.pump !== void 0) await stream.pump.done;
				}
			}
			/**
			* Send the caller's uplink items on this generation's socket. `stop()`
			* interrupts a pump blocked on `uplink.next()` and releases the iterator: a
			* handle's queue closes at once, so `send()` throws from then on, and any
			* other iterator's `return()` is invoked without being awaited because a
			* generator blocked in `next()` only completes it once it yields.
			*/
			pumpUplink(socket, streamId, uplink, signal, inbox) {
				let stopped;
				const interruption = {
					value: void 0,
					done: true
				};
				const uplinkIterator = uplink[Symbol.asyncIterator]();
				const state = {
					stopping: false,
					exhausted: false,
					released: false
				};
				const release = () => {
					if (state.released || state.exhausted) return;
					state.released = true;
					if (uplink instanceof ClientUplinkQueue) uplink.close();
					Promise.resolve().then(() => uplinkIterator.return?.()).catch(() => void 0);
				};
				return {
					done: (async () => {
						try {
							while (true) {
								if (state.stopping) return;
								stopped = Promise.withResolvers();
								const next = await Promise.race([uplinkIterator.next(), stopped.promise]);
								stopped = void 0;
								if (state.stopping || next === interruption || signal.aborted || this.socket !== socket) return;
								if (next.done === true) {
									state.exhausted = true;
									break;
								}
								this.send(socket, {
									type: "item",
									streamId,
									value: next.value
								});
							}
							this.send(socket, {
								type: "end",
								streamId
							});
						} catch (error) {
							inbox.fail(error);
						} finally {
							stopped = void 0;
							release();
						}
					})(),
					stop: () => {
						if (state.stopping) return;
						state.stopping = true;
						stopped?.resolve(interruption);
						release();
					}
				};
			}
			/**
			* Permanently stop the carrier, close the physical socket, and fail every
			* active logical stream.
			* @returns once the connection attempt and every physical socket have closed.
			*/
			async close() {
				if (!this.disposed) {
					this.disposed = true;
					this.running = false;
					const error = /* @__PURE__ */ new Error("api gateway: Remote stream client disposed");
					this.failAll(error);
					for (const waiter of [...this.waiters]) waiter.reject(error);
					this.cancelCandidate?.(error);
					const socket = this.socket;
					this.socket = void 0;
					socket?.close(1e3, "disposed");
				}
				await this.keepAlive;
				await Promise.all(this.socketClosures);
			}
			async connect() {
				const socket = this.openSocket(REMOTE_STREAM_MUX_PATH);
				const closed = new Promise((resolve) => {
					socket.addEventListener("close", () => {
						resolve();
					}, { once: true });
				});
				this.socketClosures.add(closed);
				closed.then(() => {
					this.socketClosures.delete(closed);
				});
				return new Promise((resolve, reject) => {
					let settled = false;
					const rejectCandidate = (error) => {
						settled = true;
						socket.removeEventListener("open", opened);
						socket.removeEventListener("message", received);
						this.cancelCandidate = void 0;
						if (socket.readyState < 2) socket.close();
						reject(error);
					};
					const opened = () => {
						settled = true;
						this.cancelCandidate = void 0;
						this.socket = socket;
						for (const waiter of [...this.waiters]) waiter.resolve(socket);
						resolve(socket);
					};
					const failed = () => {
						if (!settled) {
							rejectCandidate(new RemoteStreamCarrierError("api gateway: Remote stream WebSocket failed to open"));
							return;
						}
						const error = new RemoteStreamCarrierError("api gateway: Remote stream WebSocket failed");
						this.lost(socket, error);
						if (socket.readyState < 2) socket.close();
					};
					const closed = () => {
						socket.removeEventListener("open", opened);
						socket.removeEventListener("error", failed);
						socket.removeEventListener("message", received);
						if (!settled) {
							rejectCandidate(new RemoteStreamCarrierError("api gateway: Remote stream WebSocket closed before opening"));
							return;
						}
						this.lost(socket);
					};
					const received = (event) => {
						this.receive(socket, event.data);
					};
					this.cancelCandidate = rejectCandidate;
					socket.addEventListener("open", opened, { once: true });
					socket.addEventListener("error", failed);
					socket.addEventListener("message", received);
					socket.addEventListener("close", closed, { once: true });
				});
			}
			waitForSocket(signal) {
				signal.throwIfAborted();
				if (this.socket?.readyState === 1) return Promise.resolve(this.socket);
				if (this.disposed) return Promise.reject(/* @__PURE__ */ new Error("api gateway: Remote stream client disposed"));
				if (!this.running) return Promise.reject(/* @__PURE__ */ new Error("api gateway: Remote stream client not started"));
				if (this.failure !== void 0) return Promise.reject(this.failure);
				return new Promise((resolve, reject) => {
					const aborted = () => {
						waiter.reject(signal.reason);
					};
					const cleanup = () => {
						this.waiters.delete(waiter);
						signal.removeEventListener("abort", aborted);
					};
					const waiter = {
						revision: this.revision,
						resolve: (socket) => {
							cleanup();
							resolve(socket);
						},
						reject: (error) => {
							cleanup();
							reject(error);
						}
					};
					this.waiters.add(waiter);
					signal.addEventListener("abort", aborted, { once: true });
				});
			}
			receive(socket, data) {
				if (socket !== this.socket) return;
				try {
					if (typeof data !== "string") throw new Error("api gateway: Remote stream WebSocket requires text messages");
					const frame = parseRemoteStreamServerMessage(data);
					const stream = this.streams.get(frame.streamId);
					if (stream === void 0) return;
					stream.inbox.push(frame);
					if (frame.type !== "item") stream.pump?.stop();
				} catch (error) {
					const failure = new RemoteStreamCarrierError("api gateway: invalid Remote stream frame", { cause: error });
					this.failAll(failure);
					this.lost(socket, failure);
					socket.close(4002, "invalid Remote stream frame");
				}
			}
			lost(socket, error = new RemoteStreamCarrierError("api gateway: Remote stream WebSocket closed")) {
				if (this.socket !== socket) return;
				this.socket = void 0;
				if (!this.waitForReconnect) this.failure = error;
				this.failAll(error);
				if (!this.waitForReconnect) for (const waiter of [...this.waiters]) waiter.reject(error);
			}
			maintain() {
				if (!this.running || this.disposed) return;
				if (this.socket?.readyState === 1 || this.keepAlive !== void 0) return;
				const revision = this.revision;
				this.failure = void 0;
				const task = this.connect().then(() => void 0, (error) => {
					if (!this.running) return;
					const failure = error instanceof RemoteStreamCarrierError ? error : new RemoteStreamCarrierError("api gateway: Remote stream WebSocket failed to open", { cause: error });
					if (this.revision === revision) this.failure = failure;
					for (const waiter of [...this.waiters]) if (waiter.revision <= revision) waiter.reject(failure);
				});
				this.keepAlive = task;
				task.then(() => {
					this.keepAlive = void 0;
				});
			}
			failAll(error) {
				for (const stream of this.streams.values()) {
					stream.inbox.fail(error);
					stream.pump?.stop();
				}
			}
			send(socket, message) {
				socket.send(JSON.stringify(message));
			}
		};
		var StreamInbox = class {
			frames = new Deque();
			wake;
			failure;
			push(frame) {
				if (this.failure !== void 0) return;
				this.frames.pushBack(frame);
				this.wake?.();
				this.wake = void 0;
			}
			fail(error) {
				if (this.failure !== void 0) return;
				this.failure = error instanceof Error ? error : new Error(String(error), { cause: error });
				this.frames.clear();
				this.wake?.();
				this.wake = void 0;
			}
			async next() {
				while (this.frames.size === 0) {
					if (this.failure !== void 0) throw this.failure;
					await new Promise((resolve) => {
						this.wake = resolve;
					});
				}
				return this.frames.popFront();
			}
		};
		/**
		* Uplink items a stream handle queues for its carrier: the mux pump or the
		* in-process Host decoder iterates it as the stream's uplink. `end()` is the
		* Client half-close; `close()` marks the stream terminated, after which
		* `push()` throws. One consumer reads it, one read at a time.
		*/
		var ClientUplinkQueue = class {
			endpoint;
			items = new Deque();
			ended = false;
			closed = false;
			wake;
			/** @param endpoint - canonical Remote endpoint named by failures. */
			constructor(endpoint) {
				this.endpoint = endpoint;
			}
			/**
			* Queue one item for the carrier.
			* @param item - item the Host validates against the method's uplink codec.
			* @throws {Error} after `end()` or once the stream has terminated.
			*/
			push(item) {
				if (this.closed) throw new Error(`client api: ${this.endpoint} stream has terminated`);
				if (this.ended) throw new Error(`client api: ${this.endpoint} uplink was ended`);
				this.items.pushBack(item);
				this.signal();
			}
			/** Half-close: the carrier reads the queued items, then `end`. Idempotent; ignored after termination. */
			end() {
				if (this.ended || this.closed) return;
				this.ended = true;
				this.signal();
			}
			/** The carrier stopped reading: the logical stream terminated or was disposed. Idempotent. */
			close() {
				if (this.closed) return;
				this.closed = true;
				this.items.clear();
				this.signal();
			}
			[Symbol.asyncIterator]() {
				return this;
			}
			/**
			* Take the next queued item, waiting for one; ends after `end()` or `close()`.
			* @returns the next item, or the end of the uplink.
			* @throws {Error} when a read is already pending.
			*/
			async next() {
				while (true) {
					if (this.closed) return UPLINK_DONE;
					if (this.items.size > 0) return {
						value: this.items.popFront(),
						done: false
					};
					if (this.ended) return UPLINK_DONE;
					if (this.wake !== void 0) throw new Error(`client api: ${this.endpoint} uplink has one pending read`);
					await new Promise((resolve) => {
						this.wake = resolve;
					});
				}
			}
			/**
			* The carrier is done with the uplink: close it.
			* @returns the end of the uplink.
			*/
			return() {
				this.close();
				return Promise.resolve(UPLINK_DONE);
			}
			signal() {
				const wake = this.wake;
				this.wake = void 0;
				wake?.();
			}
		};
		function remoteStreamUrl() {
			const globals = globalThis;
			const url = new URL(REMOTE_STREAM_MUX_PATH.slice(1), globals.__GBH_TRANSPORT__?.streamBaseUrl ?? document.baseURI);
			url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
			return url.href;
		}
		//#endregion

export {};
