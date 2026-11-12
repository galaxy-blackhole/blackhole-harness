/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-llm-deepseek — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/adapter.js
/** Direct Messages transport with one cancellable lifecycle per model request. */
var __addDisposableResource = function(env, value, async) {
	if (value !== null && value !== void 0) {
		if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
		var dispose, inner;
		if (async) {
			if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
			dispose = value[Symbol.asyncDispose];
		}
		if (dispose === void 0) {
			if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
			dispose = value[Symbol.dispose];
			if (async) inner = dispose;
		}
		if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
		if (inner) dispose = function() {
			try {
				inner.call(this);
			} catch (e) {
				return Promise.reject(e);
			}
		};
		env.stack.push({
			value,
			dispose,
			async
		});
	} else if (async) env.stack.push({ async: true });
	return value;
};
var __disposeResources = (function(SuppressedError) {
	return function(env) {
		function fail(e) {
			env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
			env.hasError = true;
		}
		var r, s = 0;
		function next() {
			while (r = env.stack.pop()) try {
				if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
				if (r.dispose) {
					var result = r.dispose.call(r.value);
					if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
						fail(e);
						return next();
					});
				} else s |= 1;
			} catch (e) {
				fail(e);
			}
			if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
			if (env.hasError) throw env.error;
		}
		return next();
	};
})(typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
	var e = new Error(message);
	return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
/** DeepSeek provider using Messages content and native thinking replay. */
var DeepSeekAdapter = class extends LlmAdapter {
	dependencies;
	files;
	imageAccess = (ref) => {
		const attachments = this.dependencies.resolveAttachments?.();
		return attachments === void 0 ? void 0 : this.dependencies.resolveImageAccess?.(attachments, ref);
	};
	constructor(dependencies) {
		super();
		this.dependencies = dependencies;
		this.files = dependencies.resolveFiles?.() ?? new DeepSeekFileStore();
	}
	providerInfo(provider) {
		return {
			id: provider,
			name: this.dependencies.providerName ?? "DeepSeek"
		};
	}
	providerRetryPolicy(_provider) {
		return this.dependencies.options().retryPolicy;
	}
	async listModels(provider) {
		return this.dependencies.discoverModels?.(provider) ?? [];
	}
	async resolveModel(provider, model, signal) {
		return modelInfo(await this.connection(signal), provider, model);
	}
	imageRequestPricing(_provider, model) {
		return deepSeekImageRequestPricing(this.dependencies.options(), model, this.imageAccess);
	}
	imageRequestTarget(_provider, model, image) {
		const entry = this.dependencies.options().models.find((entry) => entry.id === model);
		if (entry === void 0) throw new LlmError(`DeepSeek model "${model}" has no declared image projection`, "UNKNOWN_MODEL");
		return resolveRequestImageTarget(entry, image);
	}
	async prepareCall(provider, model, signal) {
		const connection = await this.connection(signal);
		this.dependencies.admit?.(connection, model);
		return {
			model: modelInfo(connection, provider, model),
			stream: (options) => this.generate(options, connection)
		};
	}
	stream(options) {
		const connection = this.dependencies.options();
		this.dependencies.admit?.(connection, options.model);
		return this.generate(options, connection);
	}
	connection(signal) {
		return this.dependencies.connect?.(signal) ?? Promise.resolve(this.dependencies.options());
	}
	async *generate(options, connection) {
		const env_1 = {
			stack: [],
			error: void 0,
			hasError: false
		};
		try {
			const consumer = new AbortController();
			const watchdog = __addDisposableResource(env_1, idleWatchdog(options.signal === void 0 ? consumer.signal : AbortSignal.any([consumer.signal, options.signal]), connection.streamIdleTimeoutMs, "MESSAGES_IDLE"), false);
			const iterator = this.request(options, connection, watchdog.signal, () => {
				watchdog.pulse();
			});
			try {
				while (true) {
					const next = await watchdog.next(iterator);
					if (next.done) return;
					yield next.value;
				}
			} catch (error) {
				if (timeoutOf(watchdog.signal, "MESSAGES_IDLE") !== void 0) throw new LlmError("DeepSeek Messages stream idle timeout", "TIMEOUT", { cause: error });
				if (options.signal?.aborted) throw new LlmError("DeepSeek Messages request aborted", "ABORTED", { cause: error });
				if (error instanceof LlmError) throw error;
				throw new LlmError("DeepSeek Messages transport failed", "TRANSPORT", { cause: error });
			} finally {
				consumer.abort();
				/* v8 ignore next -- the detached drain only rejects while unwinding an abandoned request. */
				iterator.return(void 0).catch(() => {});
			}
		} catch (e_1) {
			env_1.error = e_1;
			env_1.hasError = true;
		} finally {
			__disposeResources(env_1);
		}
	}
	async *request(options, connection, signal, activity) {
		signal.throwIfAborted();
		const { messages, versions } = await prepareImages(options.messages, connection, options.model, this.dependencies.resolveAttachments?.(), this.imageAccess, signal);
		const auth = await this.dependencies.resolveAuth(connection);
		try {
			const files = new RequestFiles(this.files, {
				baseURL: connection.baseURL,
				headers: auth.headers
			}, connection.filePolicy, connection.filesApiTimeoutMs, signal, activity);
			let inline = false;
			while (true) {
				signal.throwIfAborted();
				files.beginAttempt();
				let fileIds;
				if (!inline) try {
					fileIds = await prepareFileIds(messages, versions, files);
				} catch (error) {
					if (!(error instanceof FileResolutionFailure)) throw error;
					inline = true;
					continue;
				}
				const body = serialize(options, connection, inline ? inlineImages(messages, versions, connection) : messages, versions, this.imageAccess, (reason) => {
					this.dependencies.onReplayDegrade?.({
						provider: options.provider,
						model: options.model,
						reason
					});
				}, fileIds);
				const extensions = await prepareRequestExtensions(body, {
					signal,
					...options.sessionId === void 0 ? {} : { sessionId: String(options.sessionId) },
					...options.purpose === void 0 ? {} : { purpose: options.purpose }
				}, this.dependencies.prepareExtensions, (fields, error) => {
					this.dependencies.onExtensionsOmitted?.({
						provider: options.provider,
						model: options.model,
						fields,
						error
					});
				}, (error) => {
					this.dependencies.onExtensionsUnaccepted?.({
						provider: options.provider,
						model: options.model,
						error
					});
				});
				signal.throwIfAborted();
				const betas = [...fileIds !== void 0 && fileIds.size > 0 ? [MESSAGES_FILES_BETA] : [], ...body.messages.some((message) => message.content.some((block) => block.type === "tool_addition" || block.type === "tool_removal")) ? [MESSAGES_TOOL_CHANGES_BETA] : []];
				const response = await fetch(`${messagesApiRoot(connection.baseURL)}/messages`, {
					method: "POST",
					signal,
					body: extensions.payload,
					redirect: "error",
					headers: {
						...attributionHeaders(),
						"content-type": "application/json",
						"accept": "text/event-stream",
						...auth.headers,
						"anthropic-version": "2023-06-01",
						...betas.length === 0 ? {} : { "anthropic-beta": betas.join(",") },
						"x-deepseek-harness-user-id": this.dependencies.resolveUserId(),
						...options.sessionId === void 0 ? {} : { "x-deepseek-harness-session-id": String(options.sessionId) },
						...options.purpose === "compaction" ? { "x-deepseek-harness-compact": "1" } : {}
					}
				});
				if (!response.ok) {
					const text = await response.text();
					let raw;
					try {
						raw = JSON.parse(text);
					} catch (_nonJsonGatewayError) {}
					const detail = providerErrorDetail(raw);
					if (await files.retry(detail)) continue;
					const failure = providerError(raw, response.status, response.headers);
					throw new LlmError(files.errorMessage(response.status, failure.message, detail), failure.code, {
						...failure.failure,
						cause: new Error(text)
					});
				}
				await extensions.accept();
				if (response.body === null) throw new LlmError("DeepSeek Messages returned no response body", "EMPTY_RESPONSE");
				yield* translate(parseSse(response.body, activity), options.model);
				return;
			}
		} catch (error) {
			if (auth.onRequestError !== void 0) {
				let mapped;
				try {
					mapped = await auth.onRequestError(error);
				} catch (_credentialUpdateFailed) {
					throw error;
				}
				throw mapped;
			}
			throw error;
		}
	}
};
//#endregion

export {};
