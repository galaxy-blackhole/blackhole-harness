/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-chat/lib/client.js — CẮT LẠI 08/11/2026
 *      theo MOT kieu duy nhat (region-based), gộp/cắt tiếp để mỗi lát ≤ 900 dòng.
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		//#region lib/types/client/chat/use-scroll-follow.js
		/** Independent bottom-follow intent and native scrolling, without paging or DOM observers. */
		/**
		* Read one scrollport without measuring its children.
		* @param element - scrolling element.
		* @returns current position and range.
		*/
		function scrollMetrics(element) {
			const height = element.clientHeight;
			return {
				top: element.scrollTop,
				height,
				floor: Math.max(0, element.scrollHeight - height)
			};
		}
		/** One scrollport's follow intent; native animation progress does not count as reader movement. */
		var ScrollFollow = class ScrollFollow {
			following;
			threshold;
			static owners = /* @__PURE__ */ new WeakMap();
			target = null;
			sampledTop;
			/**
			* @param following - initial follow intent.
			* @param threshold - accepted distance from the floor, in pixels.
			*/
			constructor(following, threshold) {
				this.following = following;
				this.threshold = threshold;
			}
			/**
			* Find the mounted controller for reading-position compensation.
			* @param element - scrollport with an optional follow owner.
			* @returns its controller, when bound.
			*/
			static forElement(element) {
				return this.owners.get(element);
			}
			/**
			* Share this controller with reading-position compensation for the same scrollport.
			* @param element - owned scrollport.
			* @returns release the association on unmount or close.
			*/
			bind(element) {
				ScrollFollow.owners.set(element, this);
				return () => {
					if (ScrollFollow.owners.get(element) === this) ScrollFollow.owners.delete(element);
				};
			}
			/**
			* Expose follow intent independently of the current offset.
			* @returns whether content growth should follow the floor.
			*/
			get active() {
				return this.following;
			}
			/**
			* Expose outstanding native motion before accepting reader input.
			* @returns whether a native follow animation has an outstanding target.
			*/
			get animating() {
				return this.target !== null;
			}
			/**
			* Classify bottom arrivals using this scrollport's own tolerance.
			* @param metrics - current scroll geometry.
			* @returns whether the position is within the follow threshold.
			*/
			nearBottom(metrics) {
				return Math.abs(metrics.floor - metrics.top) <= this.threshold;
			}
			/**
			* Commit caller-owned follow decisions without moving the scrollport.
			* @param active - externally committed follow intent.
			*/
			setFollowing(active) {
				this.following = active;
				if (!active) this.target = null;
			}
			/** Adopt the next visible layout as a fresh reader position. */
			reset() {
				this.setFollowing(false);
				this.sampledTop = void 0;
			}
			/**
			* Adopt delivered scrolling while retaining intent during native animation.
			* @param metrics - current geometry.
			* @param movedByReader - caller attribution; omitted callers compare the last sampled position.
			* @returns updated follow intent.
			*/
			sample(metrics, movedByReader = this.sampledTop === void 0 || Math.abs(metrics.top - this.sampledTop) > .5) {
				this.sampledTop = metrics.top;
				if (!this.animating && movedByReader) this.following = this.nearBottom(metrics);
				return this.active;
			}
			/**
			* Settle native scrolling; an off-target stop releases follow intent.
			* @param metrics - actual geometry delivered at scrollend.
			* @returns follow intent after completing or interrupting native motion.
			*/
			settle(metrics) {
				const target = this.target;
				this.target = null;
				return this.sample(metrics, target === null ? void 0 : Math.abs(metrics.top - Math.min(target, metrics.floor)) > this.threshold);
			}
			/**
			* Position immediately and adopt the resulting follow intent.
			* @param element - scrolling element.
			* @param metrics - geometry before positioning.
			* @param top - requested offset, clamped to the measured range.
			* @returns geometry after positioning.
			*/
			jump(element, metrics, top) {
				const animated = this.animating;
				this.target = null;
				const target = Math.max(0, Math.min(metrics.floor, top));
				if (animated) element.scrollTo({
					top: target,
					behavior: "instant"
				});
				else if (target !== metrics.top) element.scrollTop = target;
				const landed = {
					...metrics,
					top: element.scrollTop
				};
				this.sampledTop = landed.top;
				this.following = this.nearBottom(landed);
				return landed;
			}
			/**
			* Follow the measured floor, respecting reduced motion for smooth requests.
			* Smooth requests preserve an outstanding target; immediate follow updates
			* retarget active motion when content changes the floor.
			* Within-tolerance positioning is immediate while no animation is outstanding.
			* @param element - scrolling element.
			* @param metrics - current geometry.
			* @param behavior - native animation for growth, or immediate positioning unless motion is already active.
			* @returns current geometry; smooth requests retain their starting position until native scroll delivery.
			*/
			toBottom(element, metrics, behavior) {
				this.following = true;
				if (metrics.top === metrics.floor) return this.jump(element, metrics, metrics.floor);
				if (behavior === "instant" && this.animating) {
					if (this.target !== metrics.floor) {
						this.target = metrics.floor;
						element.scrollTo({
							top: metrics.floor,
							behavior: "smooth"
						});
					}
					return metrics;
				}
				if (behavior === "instant" || !this.animating && this.nearBottom(metrics)) return this.jump(element, metrics, metrics.floor);
				if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return this.jump(element, metrics, metrics.floor);
				if (this.target === null) {
					this.target = metrics.floor;
					element.scrollTo({
						top: metrics.floor,
						behavior: "smooth"
					});
				}
				return metrics;
			}
			/**
			* Cancel native motion before a reader gesture; only subsequent actual movement changes follow intent.
			* @param element - scrolling element.
			* @param metrics - position at interruption.
			*/
			interrupt(element, metrics) {
				if (!this.animating) return;
				this.target = null;
				this.sampledTop = metrics.top;
				element.scrollTo({
					top: metrics.top,
					behavior: "instant"
				});
			}
		};
		/**
		* Retain one independent follow controller without React updates for scroll samples.
		* @param initial - initial follow intent.
		* @param threshold - accepted distance from the floor, in pixels.
		* @returns the stable controller shared by the caller's scroll and resize handlers.
		*/
		function useScrollFollow(initial, threshold) {
			const [follow] = (0, react.useState)(() => new ScrollFollow(initial, threshold));
			return follow;
		}
		//#endregion
		//#region lib/types/client/chat/use-chat-reading.js
		/** Follow-tail ownership, saved-position restoration, and sampled reader movement. */
		const SCROLL_SAMPLE_INTERVAL_MS = 500;
		/** Owns reading policy and its cancellable sampling work, without DOM access. */
		var ChatReading = class {
			viewport;
			store;
			state;
			onChange;
			follow;
			sampleTimer = null;
			probeFrame = null;
			sampled = null;
			constructor(viewport, store, state, onChange, follow) {
				this.viewport = viewport;
				this.store = store;
				this.state = state;
				this.onChange = onChange;
				this.follow = follow;
			}
			/**
			* Expose pending reader ownership to navigation and resize handlers.
			* @returns whether reader input still awaits interval or scrollend sampling.
			*/
			get pending() {
				return this.sampleTimer !== null;
			}
			/**
			* Expose the active follow policy.
			* @returns whether content growth retains bottom-follow ownership.
			*/
			get followingTail() {
				return this.state.followingTail;
			}
			/**
			* Adopt the committed Session's scroll memory.
			* @param store - scroll memory for the current Session.
			*/
			setStore(store) {
				this.store = store;
			}
			/**
			* Connect history policy to settled reading observations.
			* @param sampled - receives settled reader positions.
			* @returns a disposer that disconnects only this listener.
			*/
			connect(sampled) {
				this.sampled = sampled;
				return () => {
					if (this.sampled === sampled) this.sampled = null;
				};
			}
			/** Cancel timers and animation frames and detach the sample listener. */
			dispose() {
				this.cancelPending();
				this.sampled = null;
			}
			/** Release bottom follow and pending sampling for an explicit navigation. */
			pauseFollowing() {
				this.cancelPending();
				this.publish({
					...this.state,
					followingTail: false
				});
			}
			/**
			* Land at the current floor and clear saved reader position.
			* @param behavior - immediate positioning, or one native animation when the reader's own input moved the tail.
			*/
			followTail(behavior = "instant") {
				const landing = this.viewport.scrollToBottom(this.follow, behavior);
				if (landing === null) return;
				this.cancelPending();
				this.commit(landing, true, this.viewport.latestTurn);
			}
			/**
			* Follow the tail on the active fold's animation clock.
			* @returns whether a fold batch owns the tail movement instead of a separate scroll animation.
			*/
			followInputFold() {
				this.cancelPending();
				return this.viewport.followInputFold(this.follow);
			}
			/**
			* Let fold batches read follow intent and commit their tail landings.
			* @returns a disposer that disconnects this reading policy from the viewport.
			*/
			bindFolds() {
				return this.viewport.bindReader({
					follow: this.follow,
					landedAtTail: (landing) => {
						this.cancelPending();
						this.commit(landing, true, this.viewport.latestTurn);
					},
					pending: () => this.pending
				});
			}
			/** Stop a native follow animation where it is; the next sampled position decides follow intent. */
			interruptFollow() {
				this.viewport.interruptFollow(this.follow);
			}
			/** Restore the Session's semantic position, or follow the tail when none is saved. */
			restore() {
				const saved = this.store.read();
				if (saved === null) {
					this.followTail();
					return;
				}
				const landing = this.viewport.restore(saved);
				if (landing === null) return;
				this.cancelPending();
				const following = this.follow.nearBottom(landing.metrics);
				this.commit(landing, following, following ? this.viewport.latestTurn : this.state.activeTurn, following);
				if (!this.state.followingTail && landing.position === null) {
					const position = this.viewport.capturePosition();
					if (position !== null) this.store.save(position);
				}
				this.refreshActiveTurn();
			}
			/**
			* Adopt a known landing without rediscovering its anchor.
			* @param landing - measured navigation result that replaces pending reader input.
			*/
			acceptNavigation(landing) {
				this.cancelPending();
				const following = this.follow.nearBottom(landing.metrics);
				this.commit(landing, following, landing.turn ?? (following ? this.viewport.latestTurn : this.state.activeTurn));
			}
			/**
			* Retain reading policy while history changes the anchor's geometry.
			* @param landing - compensated position that retains the current reading policy.
			*/
			preservePosition(landing) {
				this.cancelPending();
				this.commit(landing, this.state.followingTail, this.state.activeTurn);
			}
			/**
			* Handle pinned layout movement and reader arrivals at the floor immediately.
			* @param scroll - attributed scroll delivery; other reader movement remains pending until sampled.
			*/
			onScroll = (scroll) => {
				if (this.follow.animating) return;
				if (!scroll.movedByReader && this.state.followingTail || scroll.movedByReader && Math.abs(scroll.metrics.top - scroll.metrics.floor) < 1) {
					this.followTail();
					this.sampled?.({
						position: null,
						movedByReader: scroll.movedByReader,
						followingTail: true
					});
					return;
				}
				this.sampleTimer ??= window.setTimeout(this.flushSample, SCROLL_SAMPLE_INTERVAL_MS);
			};
			/**
			* Settle pending reader movement; only the outer scroller can finish its native follow animation.
			* @param outer - whether the event belongs to the outer scroller rather than a process body.
			*/
			onScrollEnd = (outer = true) => {
				if (this.follow.animating) {
					if (!outer) return;
					const scroll = this.viewport.readScroll();
					if (scroll === null) return;
					if (this.follow.settle(scroll.metrics)) {
						this.followTail();
						return;
					}
					this.viewport.acknowledge(scroll.metrics);
					this.publish({
						...this.state,
						followingTail: false
					});
					this.refreshActiveTurn();
					return;
				}
				this.flushSample();
			};
			/** Reconcile a layout change without overriding unsampled reader input. */
			onResize() {
				if (this.pending) return;
				if (this.state.followingTail) this.followTail();
				else this.refreshActiveTurn();
			}
			/** Resolve the active turn from tail ownership or a coalesced reading-line probe. */
			refreshActiveTurn() {
				if (this.pending) return;
				if (this.state.followingTail) {
					this.publish({
						...this.state,
						initialized: true,
						activeTurn: this.viewport.latestTurn
					});
					return;
				}
				if (this.probeFrame !== null) return;
				if (typeof requestAnimationFrame !== "function") this.probe();
				else this.probeFrame = requestAnimationFrame(this.probe);
			}
			commit(landing, followingTail, activeTurn, initialized = true) {
				if (followingTail) this.store.save(null);
				else if (landing.position !== null) this.store.save(landing.position);
				this.publish({
					initialized,
					followingTail,
					activeTurn
				});
			}
			publish(state) {
				this.follow.setFollowing(state.followingTail);
				if (state.initialized === this.state.initialized && state.followingTail === this.state.followingTail && state.activeTurn === this.state.activeTurn) return;
				this.state = state;
				this.onChange(state);
			}
			cancelPending() {
				if (this.sampleTimer !== null) window.clearTimeout(this.sampleTimer);
				if (this.probeFrame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.probeFrame);
				this.sampleTimer = null;
				this.probeFrame = null;
			}
			probe = () => {
				this.probeFrame = null;
				if (this.pending) return;
				const scroll = this.viewport.readScroll();
				if (scroll === null) return;
				const activeTurn = this.follow.nearBottom(scroll.metrics) ? this.viewport.latestTurn : this.viewport.readVisibleTurn(scroll.metrics);
				this.publish({
					...this.state,
					initialized: true,
					activeTurn
				});
			};
			flushSample = () => {
				if (!this.pending) return;
				this.cancelPending();
				const scroll = this.viewport.readScroll();
				if (scroll === null) return;
				const followingTail = this.follow.sample(scroll.metrics, scroll.movedByReader);
				let position = null;
				if (!scroll.movedByReader && followingTail) this.followTail();
				else {
					position = followingTail ? null : this.viewport.capturePosition();
					this.viewport.acknowledge(scroll.metrics);
					if (followingTail || position !== null) this.store.save(position);
					const activeTurn = this.follow.nearBottom(scroll.metrics) ? this.viewport.latestTurn : this.viewport.readVisibleTurn(scroll.metrics);
					this.publish({
						initialized: true,
						followingTail,
						activeTurn
					});
				}
				this.sampled?.({
					position,
					movedByReader: scroll.movedByReader,
					followingTail
				});
			};
		};
		/**
		* Retain reading policy and expose only changes in visible reading state.
		* @param viewport - turn-aware DOM operations.
		* @param store - Session-owned semantic scroll memory.
		* @param initialTurn - latest loaded turn before the first landing.
		* @returns the reading owner and its React-visible state.
		*/
		function useChatReading(viewport, store, initialTurn) {
			const [state, setState] = (0, react.useState)(() => ({
				initialized: false,
				followingTail: store.read() === null,
				activeTurn: initialTurn
			}));
			const follow = useScrollFollow(state.followingTail, 25);
			const [reading] = (0, react.useState)(() => new ChatReading(viewport, store, state, setState, follow));
			(0, react.useLayoutEffect)(() => {
				reading.setStore(store);
			}, [reading, store]);
			(0, react.useLayoutEffect)(() => reading.bindFolds(), [reading]);
			(0, react.useLayoutEffect)(() => () => {
				reading.dispose();
			}, [reading]);
			return {
				reading,
				state
			};
		}
		//#endregion
		//#region lib/types/client/chat/searchable-hidden.js
		/**
		* Apply searchable hidden state without unmounting a stable subtree.
		* @param hidden - whether the subtree is currently hidden.
		* @param reveal - callback for browser find's beforematch reveal.
		* @param transition - optional caller-owned visibility operation; otherwise apply synchronously.
		* @returns ref for the stable subtree root.
		*/
		function useSearchableHidden(hidden, reveal, transition) {
			const ref = (0, react.useRef)(null);
			(0, react.useLayoutEffect)(() => {
				const element = ref.current;
				if (element === null) return;
				if (hidden && element.contains(element.ownerDocument.activeElement)) {
					reveal();
					return;
				}
				const commit = () => {
					if (hidden) element.setAttribute("hidden", "until-found");
					else element.removeAttribute("hidden");
				};
				if (transition === void 0) commit();
				else transition(element, hidden, commit);
			}, [
				hidden,
				reveal,
				transition
			]);
			(0, react.useEffect)(() => {
				const element = ref.current;
				if (element === null) return;
				element.addEventListener("beforematch", reveal);
				return () => {
					element.removeEventListener("beforematch", reveal);
				};
			}, [reveal]);
			return ref;
		}
		//#endregion