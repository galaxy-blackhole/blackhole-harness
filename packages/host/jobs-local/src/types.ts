/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu NỘI BỘ của sổ đăng ký job: bản ghi sống, trạng thái soạn thảo của producer, và phần
 *      dữ liệu settlement ghi vào vết phiên. Không xuất ra artifact (chỉ dùng trong `src/`).
 */

import type { Agent } from "@deepseek-ai/dsh-agent";
import type { JobId, JobKind, JobOutcome, JobSettleCause, JobToolCall } from "@deepseek-ai/dsh-jobs";
import type { PumpHandle } from "./pump.ts";
import type { OutputRing } from "./ring.ts";

/** Trạng thái soạn thảo mà producer ghi qua mặt `JobHandle` trước khi bản ghi được đăng ký. */
export interface JobState {
  /** Dòng tiến độ sống, hoặc `undefined` khi chưa ghi/chưa bị xoá. */
  progress: string | undefined;
  /** Bản ghi job, hoặc `undefined` khi producer còn đang trong chính lời gọi `start`. */
  job: JobRecord | undefined;
}

/** Phần dữ liệu settlement ghi thêm vào vết phiên, ngoài phần đăng ký. */
export interface SettlementRecord {
  /** Mốc thời gian (ms) sổ đăng ký chốt bản ghi kết thúc. */
  finishedAt: number;
  /** Kết cục đã ghi. */
  status: JobOutcome["status"];
  /** Nguồn phát sinh yêu cầu kết thúc, hoặc producer tự xong. */
  cause: JobSettleCause;
  /** true khi `done` thoả; false khi bị từ chối hoặc bị ép hỏng. Không chứng nhận tài nguyên đã nhả. */
  producerReported: boolean;
  /** Lý do kết thúc, gồm cả lý do kill khi có. */
  detail?: string;
}

/** Kết quả `done` của producer sau khi đã chuẩn hoá về dạng sổ đăng ký luôn xử lý được. */
export interface ProducerSettlement {
  /** Kết cục để chốt bản ghi. */
  outcome: JobOutcome;
  /** true khi `done` thoả (producer tự báo); false khi `done` ném hoặc bị ép hỏng. */
  producerReported: boolean;
}

/**
 * Bản ghi SỐNG của một job. Sổ đăng ký là chủ sở hữu duy nhất; mọi thứ trao ra ngoài đều là bản
 * chiếu mới (xem `LocalJobRegistry#view`), không bao giờ là chính bản ghi này.
 */
export interface JobRecord {
  /** Id do sổ đăng ký cấp (`<kind>-<16 hex>`). */
  id: JobId;
  /** Lời gọi tool đã tạo job, giữ nguyên trong vết vòng đời. */
  toolCall: JobToolCall | undefined;
  /** Loại producer. */
  kind: JobKind;
  /** Nhãn một dòng mà producer khai. */
  label: string;
  /** Trần byte cho phần thông báo/đọc phía model, nếu producer khai. */
  outputLimitBytes: number | undefined;
  /** Agent đang sở hữu, hoặc `undefined` với job không chủ. */
  owner: Agent | undefined;
  /** Yêu cầu dừng công việc; do producer cấp qua `JobHooks.cancel`. */
  cancel: (reason?: string) => void;
  /** Trạng thái vòng đời hiện tại. */
  status: "running" | "stopping" | "completed" | "killed" | "failed";
  /** Vòng đệm đầu ra của riêng job này. */
  ring: OutputRing;
  /** Con trỏ đọc của model: offset byte đã tiêu thụ. */
  modelCursor: number;
  /** true khi `result` đã được trao một lần cho model. */
  resultDelivered: boolean;
  /** Trạng thái soạn thảo dùng chung với mặt `JobHandle` đã trao cho producer. */
  state: JobState;
  /** Lý do kết thúc (`exit code: 3`); lý do kill được ghép vào khi job bị kill. */
  detail: string | undefined;
  /** Giá trị trả về của producer, trao một lần ở lần đọc đầu sau khi kết thúc. */
  result: string | undefined;
  /** Mốc thời gian (ms) lúc đăng ký. */
  startedAt: number;
  /** Mốc thời gian (ms) lúc kết thúc; `undefined` khi còn sống. */
  finishedAt: number | undefined;
  /** Lý do kill do người gọi cấp, ghép vào `detail` khi job kết thúc là `killed`. */
  killReason: string | undefined;
  /** Nguồn kết thúc đã chốt (`producer` · `kill` · `teardown`). */
  settleCause: JobSettleCause | undefined;
  /** Thoả khi bản ghi đã chốt kết cục (kể cả bị ép hỏng lúc dọn dẹp). */
  settled: Promise<void>;
  /** Chốt `settled`; chỉ gọi một lần bởi `settle`. */
  markSettled: () => void;
  /** Người chờ đang treo trên job này; `settle` giải phóng hết rồi xoá sạch. */
  waitResolvers: Set<() => void>;
  /** Bơm nguồn kéo của sổ đăng ký, khi spec có `output`. */
  pump: PumpHandle | undefined;
  /** Đường dẫn file tràn mà từng nguồn kéo khai ở lần đọc gần nhất, theo chỉ số nguồn. */
  spillPaths: (string | undefined)[];
}
