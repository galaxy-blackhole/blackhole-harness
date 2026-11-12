/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Ghi/đọc artifact của parity trong .parity (JSON, text, PNG) và đường dẫn chuẩn
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { PARITY_DIR, REPO_ROOT, parityPath } from "./paths.ts";

/** Phiên bản định dạng artifact; tăng khi đổi shape để report cũ không bị hiểu sai. */
export const ARTIFACT_FORMAT = 1;

/** Một dòng trong bảng hạng mục của report parity. */
export interface ReportItem {
  /** Tên hạng mục. */
  name: string;
  /** PASS / FAIL / SKIP / CHƯA CÓ. */
  status: string;
  /** Số liệu kèm theo. */
  detail: string;
  /** Đường dẫn bằng chứng (tương đối repo). */
  evidence: string;
}

/**
 * Ghi một file JSON (tạo thư mục cha nếu cần).
 * @param file đường dẫn đích.
 * @param value giá trị cần ghi.
 * @returns đường dẫn đã ghi.
 */
export function writeJsonFile(file: string, value: unknown): string {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
  return file;
}

/**
 * Ghi một file văn bản.
 * @param file đường dẫn đích.
 * @param text nội dung.
 * @returns đường dẫn đã ghi.
 */
export function writeTextFile(file: string, text: string): string {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text.endsWith("\n") ? text : text + "\n");
  return file;
}

/**
 * Ghi một file nhị phân (ảnh PNG).
 * @param file đường dẫn đích.
 * @param data nội dung nhị phân.
 * @returns đường dẫn đã ghi.
 */
export function writeBinaryFile(file: string, data: Buffer): string {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  return file;
}

/**
 * Đọc một file JSON.
 * @param file đường dẫn.
 * @returns giá trị đã parse, hoặc null nếu thiếu/hỏng.
 */
export function readJsonFile<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * Đường dẫn file tổng hợp mới nhất mà report đọc.
 * @returns đường dẫn tuyệt đối `.parity/latest.json`.
 */
export function latestPath(): string {
  return parityPath("latest.json");
}

/**
 * Thư mục dump của một lần chạy.
 * @param stamp dấu thời gian.
 * @returns đường dẫn tuyệt đối `.parity/dumps/<stamp>`.
 */
export function dumpsDir(stamp: string): string {
  return parityPath("dumps", stamp);
}

/**
 * Thư mục ảnh của một lần chạy.
 * @param stamp dấu thời gian.
 * @returns đường dẫn tuyệt đối `.parity/shots/<stamp>`.
 */
export function shotsDir(stamp: string): string {
  return parityPath("shots", stamp);
}

/**
 * Đổi đường dẫn tuyệt đối thành đường dẫn tương đối repo để in trong report.
 * @param file đường dẫn tuyệt đối.
 * @returns đường dẫn tương đối (giữ `.parity/...` cho dễ mở).
 */
export function relativeToRepo(file: string): string {
  return relative(REPO_ROOT, file).split("\\").join("/");
}

/**
 * Đường dẫn tương đối của `.parity` so với repo (dùng trong bảng report).
 * @param parts các thành phần trong `.parity`.
 * @returns chuỗi ví dụ `.parity/report.md`.
 */
export function parityRelative(...parts: string[]): string {
  return relativeToRepo(join(PARITY_DIR, ...parts));
}
