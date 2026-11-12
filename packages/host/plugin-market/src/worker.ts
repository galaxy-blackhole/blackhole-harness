/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 'lib/types/worker.js' của @deepseek-ai/dsh-plugin-market (vùng worker.cjs dòng 1754–1759):
 *      entry Worker Thread — đọc workerData {body: Uint8Array, url: string}, validate, rồi
 *      postMessage(parseIndexBody(body, url)) về luồng cha.
 */
import { parentPort, workerData } from "node:worker_threads";
import { parseIndexBody, type IndexParseRequest } from "./parse.ts";

/** Yêu cầu thô luồng cha gửi sang — chưa tin được, phải validate trước khi dùng. */
const request = workerData as IndexParseRequest | undefined;
if (!(request?.body instanceof Uint8Array) || typeof request.url !== "string") throw new Error("index parser request is malformed");
parentPort?.postMessage(parseIndexBody(request.body, request.url));
