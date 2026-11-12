/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ngôn ngữ SenseVoice + lỗi đầu vào dùng chung cho CẢ HAI entry — port 1:1 phần đầu region
 *      lib/types/input.js (stock lib/index.js:12–24 và lib/worker.js:37–49).
 */
/** Gợi ý ngôn ngữ được cả metadata provider lẫn suy luận native chấp nhận (stock lib/index.js:14–21). */
// 25/10/2026 (yêu cầu chủ dự án): chỉ để Tự phát hiện + Tiếng Anh.
// Vì sao không có "vi": SenseVoiceSmall (FunAudioLLM) chỉ hỗ trợ zh/en/yue/ja/ko — KHÔNG có tiếng Việt;
// bày ra lựa chọn "vi" sẽ nhận dạng sai mà không báo lỗi. Muốn tiếng Việt phải thêm provider model khác.
export const languages: readonly string[] = ["auto", "en"];

/** Yêu cầu bị từ chối TRƯỚC suy luận native; worker đã nạp vẫn dùng lại được (stock lib/index.js:23). */
export class SpeechInputError extends Error {}
