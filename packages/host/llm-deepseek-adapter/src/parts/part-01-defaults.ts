/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-llm-deepseek — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/defaults.js
/** Shared provider limits and Chat Files API defaults. */
/** Default maximum idle interval while an adapter stream read is outstanding. */
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 3e5;
/** Default combined request/response context capacity. */
const DEFAULT_CONTEXT_WINDOW = 1e6;
/** Default per-request output-token cap. */
const DEFAULT_MAX_TOKENS = 256e3;
/** Default bound on accumulated base64 image payload after Files API fallback. */
const DEFAULT_MAX_INLINE_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024;
/** Deterministic raw-byte removal step. */
const DEFAULT_IMAGE_OFFLOAD_BYTE_QUANTUM = 64 * 1024 * 1024;
/** Deterministic base64-byte removal step after Files API fallback. */
const DEFAULT_INLINE_IMAGE_OFFLOAD_BYTE_QUANTUM = 10 * 1024 * 1024;
/** Deterministic image-count removal step. */
const DEFAULT_IMAGE_OFFLOAD_COUNT_QUANTUM = 20;
/** Default explicit lifetime for uploaded images. */
const DEFAULT_FILE_EXPIRY_SECONDS = 10080 * 60;
/** Default proactive refresh window for indexed file ids. */
const DEFAULT_FILE_REFRESH_MARGIN_SECONDS = 3600;
/** Default number of oldest harness-owned files removed on quota recovery. */
const DEFAULT_FILE_QUOTA_CLEANUP_BATCH = 100;
/** Default deadline for resolving one request image through the Files API. */
const DEFAULT_FILES_API_TIMEOUT_MS = 6e4;
//#endregion

export {};
