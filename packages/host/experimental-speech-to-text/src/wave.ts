/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiểm WAV PCM trước khi giữ hoặc chuyển tiếp âm thanh — port 1:1 từ
 *      @deepseek-ai/dsh-experimental-speech-to-text/lib/types/wave.d.ts + wave.js.
 */

/**
 * Kiểm header WAV PCM của trình duyệt trước khi giữ hoặc chuyển tiếp âm thanh.
 * Nguyên văn điều kiện của bản gốc: một bản ghi 16 kHz mono PCM16 chuẩn tắc, mọi độ dài
 * trong header phải khớp độ dài thật, và phần dữ liệu phải chẵn byte.
 *
 * @param audio Byte trên đường truyền đã giải mã.
 * @param maxDurationSeconds Thời lượng ghi âm tối đa được nhận.
 * @returns Thời lượng bản ghi âm hoàn chỉnh, tính bằng giây.
 */
export function validateWave(audio: Uint8Array, maxDurationSeconds: number): number {
  const data = Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
  if (
    data.length < 46 ||
    data.toString("ascii", 0, 4) !== "RIFF" ||
    data.toString("ascii", 8, 12) !== "WAVE" ||
    data.toString("ascii", 12, 16) !== "fmt " ||
    data.readUInt32LE(16) !== 16 ||
    data.readUInt16LE(20) !== 1 ||
    data.readUInt16LE(22) !== 1 ||
    data.readUInt32LE(24) !== 16000 ||
    data.readUInt32LE(28) !== 32000 ||
    data.readUInt16LE(32) !== 2 ||
    data.readUInt16LE(34) !== 16 ||
    data.toString("ascii", 36, 40) !== "data" ||
    data.readUInt32LE(4) !== data.length - 8 ||
    data.readUInt32LE(40) !== data.length - 44 ||
    (data.length - 44) % 2 !== 0
  ) {
    throw new Error("Audio must be a canonical 16 kHz mono PCM16 WAV recording");
  }
  const seconds = (data.length - 44) / 32000;
  if (seconds > maxDurationSeconds) throw new Error(`Audio exceeds ${maxDurationSeconds} seconds`);
  return seconds;
}
