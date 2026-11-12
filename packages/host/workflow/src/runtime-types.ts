/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tay nắm CHỈ-HOST cho seam workflow: yêu cầu khởi chạy và lượt chạy đang sống.
 *      Từ vựng an toàn cho browser vẫn nằm ở `./types.ts` để chương trình Client không bao giờ
 *      phải kéo theo khai báo Context/Agent của host.
 */

import type { Agent } from "@deepseek-ai/dsh-agent";
import type { WorkflowMeta, WorkflowResult, WorkflowRunId } from "./types.ts";

/**
 * Thứ người gọi yêu cầu khi khởi chạy một lượt workflow. `meta` và `args` là dữ liệu JSON
 * thuần theo hợp đồng của seam. `parent` bắt buộc vì MỌI `agent()` do script sinh ra đều được
 * quy về agent đang sống đó.
 */
export interface WorkflowStartRequest {
  /** Thân script JS thuần (cho phép `await` mức cao nhất; kết thúc bằng `return <json-value>`). */
  script: string;
  /** Khối danh tính của workflow, dưới dạng dữ liệu JSON thuần (engine kiểm hình dạng). */
  meta: WorkflowMeta;
  /** Đầu vào tuỳ chọn, phơi NGUYÊN VĂN cho script qua biến toàn cục `args`. */
  args?: unknown;
  /** Ghi đè provider agent con cho riêng lượt chạy này (tuỳ chọn). */
  subagentProvider?: string;
  /** Trần tổng số agent con của riêng lượt chạy này (tuỳ chọn). */
  maxTotalAgents?: number;
  /** Agent mà lượt chạy thi hành thay mặt (cha của mọi agent con). */
  parent: Agent;
  /** Huỷ lượt chạy khi bị abort. */
  signal?: AbortSignal;
}

/**
 * Lượt workflow đang sống do NGƯỜI GIỮ sở hữu. `result` không bao giờ reject; bên tiêu thụ được
 * phép huỷ và PHẢI gọi `dispose()` (idempotent) để chờ script và các agent con lặng hẳn.
 */
export interface WorkflowRun {
  readonly id: WorkflowRunId;
  /** Khối meta đã kiểm, có sẵn TRƯỚC khi thân script chạy. */
  readonly meta: WorkflowMeta;
  readonly result: Promise<WorkflowResult>;
  /** Huỷ lượt chạy và mọi agent con của nó. */
  cancel(reason?: string): void;
  /** Huỷ nếu cần rồi chờ script và agent con dọn xong. */
  dispose(): Promise<void>;
}
