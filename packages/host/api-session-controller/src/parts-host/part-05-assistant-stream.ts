/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-session-controller — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/assistant-stream.js
/** Process-local assistant state retained for reconnecting Web followers. */
const EMPTY_BASELINE = { revision: 0 };
/**
* Folds dense Agent frames and materializes one shared immutable reconnect
* baseline per accepted revision.
*/
var SessionAssistantStreamAccumulator = class {
	activeAttempt;
	revision = 0;
	snapshotValue = EMPTY_BASELINE;
	dirty = false;
	/**
	* Fold one trusted frame from the current attached Agent lifecycle.
	* @param frame - next dense process-local Assistant frame.
	* @param durableCursor - last committed Session seq when this frame was observed.
	*/
	accept(frame, durableCursor) {
		if (frame.type === "start" && frame.revision === 1 && this.revision !== 0) {
			this.activeAttempt = void 0;
			this.revision = 0;
		}
		if (frame.revision !== this.revision + 1) {
			this.activeAttempt = void 0;
			this.revision = frame.revision;
			this.dirty = true;
			return;
		}
		this.revision = frame.revision;
		switch (frame.type) {
			case "start":
				this.activeAttempt = {
					attemptId: frame.attemptId,
					startedAfterSeq: durableCursor,
					turn: frame.turn,
					step: frame.step,
					stream: new AssistantStreamAccumulator(),
					nextIndex: 0
				};
				break;
			case "chunk": {
				const attempt = this.activeAttempt;
				if (attempt === void 0 || attempt.attemptId !== frame.attemptId || frame.index !== attempt.nextIndex) {
					this.activeAttempt = void 0;
					break;
				}
				attempt.stream.push({
					time: frame.time,
					chunk: frame.chunk
				});
				attempt.nextIndex += 1;
				break;
			}
			case "end":
				this.activeAttempt = void 0;
				break;
		}
		this.dirty = true;
	}
	/**
	* Read the cached reconnect baseline, materializing it after a state change.
	* @returns the identity-stable baseline for the latest accepted revision.
	*/
	snapshot() {
		if (!this.dirty) return this.snapshotValue;
		this.snapshotValue = {
			revision: this.revision,
			...this.activeAttempt === void 0 ? {} : { activeAttempt: {
				attemptId: this.activeAttempt.attemptId,
				startedAfterSeq: this.activeAttempt.startedAfterSeq,
				turn: this.activeAttempt.turn,
				step: this.activeAttempt.step,
				nextIndex: this.activeAttempt.nextIndex,
				stream: this.activeAttempt.stream.snapshot()
			} }
		};
		this.dirty = false;
		return this.snapshotValue;
	}
};
//#endregion

export {};
