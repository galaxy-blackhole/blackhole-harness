/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN (1138–1403) của bundle gốc — ba module zstd: private decoder + public decoder + zstd · KHÔNG sửa tay
 */
// @ts-nocheck

//#region lib/types/zstd-private-decoder.js
/**
* Node-private synchronous Zstandard frame decoder optimization.
* @module dsh-session-persistence-jsonl/zstd-private-decoder
*/
const DECODE_CHUNK_SIZE = 1024 * 1024;
/** Return the stream with its observed private Node contract, or reject that optimization. */
function privateZstdStream(stream) {
	const candidate = stream;
	const handle = candidate._handle;
	const errorKey = Reflect.ownKeys(stream).find((key) => typeof key === "symbol" && key.description === "kError");
	/* v8 ignore next -- one test runtime exposes one Node-private shape; the Node 22/24/26 matrix checks compatibility. */
	if (typeof handle !== "object" || handle === null || typeof handle.writeSync !== "function" || !(candidate._writeState instanceof Uint32Array) || candidate._writeState.length < 2 || typeof candidate._defaultFlushFlag !== "number" || errorKey === void 0 || candidate[errorKey] !== null) return void 0;
	return {
		stream,
		errorKey
	};
}
/**
* Synchronous multi-frame decoder backed by one Node Zstd stream handle. Node
* exposes synchronous decoding only as a one-shot API, so this adapter uses
* the stream's private handle contract to reuse its native context and output
* chunks across frames.
*/
var NodePrivateZstdFrameDecoder = class NodePrivateZstdFrameDecoder {
	stream;
	errorKey;
	output = Buffer.allocUnsafe(DECODE_CHUNK_SIZE);
	decoderError;
	started = false;
	closed = false;
	constructor(stream, errorKey) {
		this.stream = stream;
		this.errorKey = errorKey;
		this.stream.on("error", (error) => {
			this.decoderError ??= error;
		});
	}
	/**
	* Create the optimized decoder when this Node release exposes the expected
	* private stream shape.
	* @returns a shared decoder, or `undefined` when callers must use the public fallback.
	*/
	static create() {
		const stream = createZstdDecompress({ chunkSize: DECODE_CHUNK_SIZE });
		const privateAccess = privateZstdStream(stream);
		/* v8 ignore next -- reached only when a supported Node release changes its private stream shape. */
		if (privateAccess !== void 0) return new NodePrivateZstdFrameDecoder(privateAccess.stream, privateAccess.errorKey);
		/* v8 ignore next -- the active Node runtime passed the private-shape probe above. */
		stream.close();
	}
	/** @inheritdoc */
	*decode(source, frames) {
		if (this.started) throw new Error("Zstandard frame decoder was already started");
		if (this.closed) throw new Error("cannot start a closed Zstandard frame decoder");
		this.started = true;
		try {
			for (const frame of frames) try {
				yield this.decodeFrame(source.subarray(frame.start, frame.end));
			} catch (error) {
				throw new Error(`corrupt Zstandard session log: frame at byte ${frame.start} failed validation`, { cause: error });
			}
		} finally {
			this.close();
		}
	}
	/** Decode one frame; its returned scratch view remains valid until the next call. */
	decodeFrame(input) {
		const handle = this.stream._handle;
		/* v8 ignore next -- decode() rejects closed instances before entering this private frame operation. */
		if (this.closed || handle === null) throw new Error("cannot decode with a closed Zstandard frame decoder");
		let inputOffset = 0;
		let inputRemaining = input.length;
		let outputBytes = 0;
		const fullChunks = [];
		for (;;) {
			handle.writeSync(this.stream._defaultFlushFlag, input, inputOffset, inputRemaining, this.output, 0, this.output.length);
			if (this.decoderError !== void 0) throw this.decoderError;
			const internalError = this.stream[this.errorKey];
			if (internalError !== null) {
				if (internalError instanceof Error) throw internalError;
				throw new Error("Zstandard decoder exposed a non-Error internal failure");
			}
			const outputAfter = this.stream._writeState[0];
			const inputAfter = this.stream._writeState[1];
			const consumed = inputRemaining - inputAfter;
			const produced = this.output.length - outputAfter;
			if (produced > 0) {
				outputBytes += produced;
				/* v8 ignore next -- Buffer cannot materialize a frame beyond its own process-wide maximum length. */
				if (outputBytes > constants$1.MAX_LENGTH) throw new Error(`Zstandard frame output exceeds ${constants$1.MAX_LENGTH} bytes`);
			}
			if (outputAfter !== 0) {
				/* v8 ignore next -- structurally scanned ranges contain exactly one complete frame and no trailing bytes. */
				if (inputAfter !== 0) throw new Error("Zstandard frame decoder left trailing input");
				const finalChunk = this.output.subarray(0, produced);
				if (fullChunks.length === 0) return finalChunk;
				if (produced > 0) fullChunks.push(Buffer.from(finalChunk));
				const onlyChunk = fullChunks[0];
				return fullChunks.length === 1 ? onlyChunk : Buffer.concat(fullChunks, outputBytes);
			}
			fullChunks.push(Buffer.from(this.output));
			inputOffset += consumed;
			inputRemaining = inputAfter;
		}
	}
	/** @inheritdoc */
	close() {
		if (this.closed) return;
		this.closed = true;
		this.stream.close();
	}
};
//#endregion
//#region lib/types/zstd-public-decoder.js
/**
* Public-API synchronous Zstandard frame decoder fallback.
* @module dsh-session-persistence-jsonl/zstd-public-decoder
*/
/** Multi-frame adapter built exclusively from Node's supported one-shot API. */
var PublicZstdFrameDecoder = class {
	started = false;
	closed = false;
	/** @inheritdoc */
	*decode(source, frames) {
		if (this.started) throw new Error("Zstandard frame decoder was already started");
		if (this.closed) throw new Error("cannot start a closed Zstandard frame decoder");
		this.started = true;
		try {
			for (const { start, end } of frames) {
				let decoded;
				try {
					decoded = zstdDecompressSync(source.subarray(start, end));
				} catch (error) {
					throw new Error(`corrupt Zstandard session log: frame at byte ${start} failed validation`, { cause: error });
				}
				yield decoded;
			}
		} finally {
			this.close();
		}
	}
	/** @inheritdoc */
	close() {
		this.closed = true;
	}
};
//#endregion
//#region lib/types/zstd.js
/**
* Zstandard frame primitives for the JSONL persistence backend. The backend
* owns a concatenated-frame container so it can append and recover batches
* without exposing compression mechanics through the persistence seam.
* @module dsh-session-persistence-jsonl/zstd
*/
const ZSTD_MAGIC = 4247762216;
const zstdCompressAsync = promisify(zstdCompress);
const zstdDecompressAsync = promisify(zstdDecompress);
const CHECKSUM_OPTIONS = { params: { [constants.ZSTD_c_checksumFlag]: 1 } };
const INCOMPLETE_FRAME_OPTIONS = { finishFlush: constants.ZSTD_e_flush };
/**
* Locate complete frames without decompressing their blocks. Invalid complete
* structure rejects; EOF inside the final frame returns its start for repair.
* @param buffer - complete bytes currently present in the session artifact.
* @param maxFrames - optional complete-frame limit for metadata-only readers.
* @returns complete frame ranges and an optional incomplete-final-frame start.
*/
function scanZstdFrames(buffer, maxFrames = Number.POSITIVE_INFINITY) {
	const frames = [];
	let offset = 0;
	while (offset < buffer.length) {
		const start = offset;
		if (buffer.length - offset < 4) return {
			frames,
			tornStart: start
		};
		if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error(`corrupt Zstandard session log: invalid frame magic at byte ${offset}`);
		offset += 4;
		if (offset === buffer.length) return {
			frames,
			tornStart: start
		};
		const descriptor = buffer.readUInt8(offset);
		offset += 1;
		if ((descriptor & 24) !== 0) throw new Error(`corrupt Zstandard session log: reserved frame-header bit at byte ${offset - 1}`);
		const contentSizeFlag = descriptor >>> 6;
		const singleSegment = (descriptor & 32) !== 0;
		const checksum = (descriptor & 4) !== 0;
		const dictionaryFlag = descriptor & 3;
		const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
		const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag;
		const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
		if (buffer.length - offset < remainingHeaderBytes) return {
			frames,
			tornStart: start
		};
		offset += remainingHeaderBytes;
		for (;;) {
			if (buffer.length - offset < 3) return {
				frames,
				tornStart: start
			};
			const blockHeader = buffer.readUIntLE(offset, 3);
			offset += 3;
			const lastBlock = (blockHeader & 1) !== 0;
			const blockType = blockHeader >>> 1 & 3;
			const blockSize = blockHeader >>> 3;
			if (blockType === 3) throw new Error(`corrupt Zstandard session log: reserved block type at byte ${offset - 3}`);
			const payloadBytes = blockType === 1 ? 1 : blockSize;
			if (buffer.length - offset < payloadBytes) return {
				frames,
				tornStart: start
			};
			offset += payloadBytes;
			if (lastBlock) break;
		}
		if (checksum) {
			if (buffer.length - offset < 4) return {
				frames,
				tornStart: start
			};
			offset += 4;
		}
		frames.push({
			start,
			end: offset
		});
		if (frames.length === maxFrames) return { frames };
	}
	return { frames };
}
/**
* Compress one independently decodable, checksummed Zstandard frame.
* @param input - JSONL bytes for a header or durable event batch.
* @returns the complete encoded frame.
*/
async function compressZstdFrame(input) {
	return zstdCompressAsync(input, CHECKSUM_OPTIONS);
}
/**
* Decompress one complete frame and validate its checksum.
* @param input - one structurally complete Zstandard frame.
* @returns the frame plaintext.
*/
async function decompressZstdFrame(input) {
	return zstdDecompressAsync(input);
}
/**
* Select the shared private decoder when the running Node 22/24/26 shape is
* compatible, otherwise preserve correctness with the public one-shot API.
* @returns a synchronous decoder with an implementation-independent lifecycle.
*/
function createZstdFrameDecoder() {
	return NodePrivateZstdFrameDecoder.create() ?? new PublicZstdFrameDecoder();
}
/**
* Recover available plaintext from a structurally incomplete final frame.
* `ZSTD_e_flush` deliberately suppresses final-frame and checksum completion;
* callers must establish the torn frame boundary before using this helper.
* @param input - available bytes from a known incomplete Zstandard frame.
* @returns plaintext produced from the available input.
*/
async function decompressZstdPrefix(input) {
	return zstdDecompressAsync(input, INCOMPLETE_FRAME_OPTIONS);
}
//#endregion

export {};
