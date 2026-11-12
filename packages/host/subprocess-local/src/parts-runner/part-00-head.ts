/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-subprocess-local — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

import { OutputCollector, prepareManagedProcessBinding } from "./output.js";
import { accessSync, chmodSync, closeSync, constants, existsSync, lstatSync, mkdtempSync, openSync, readFileSync, readSync, readdirSync, readlinkSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join } from "node:path";
import { createLazyRequire } from "@deepseek-ai/dsh-lazy-require";
import { scrubbedParentEnv } from "@deepseek-ai/dsh-subprocess";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { setTimeout as setTimeout$1 } from "node:timers/promises";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import { SUBPROCESS_CONTROL_ENV, SUBPROCESS_CONTROL_FD } from "@deepseek-ai/dsh-subprocess/control";
import { getSystemErrorMessage, getSystemErrorName, inspect } from "node:util";
import { fileURLToPath } from "node:url";

export {};
