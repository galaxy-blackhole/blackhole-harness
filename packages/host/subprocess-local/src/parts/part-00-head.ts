/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-subprocess-local — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

import { C as bindManagedProcess, D as createProcessInspector, E as validateSubprocessSpec, O as controlPipe, S as loadLinuxExecve, T as spawnSubprocess, _ as parseWindowsRunnerResult, c as runnerStdio, d as cleanupLinuxLaunchFiles, l as spawnRunnerInvocation, m as deserializeRunnerError, n as WINDOWS_RUNNER_SELECTION, o as runnerEnvironment, p as createLinuxLaunchFiles, s as runnerInvocationAvailable, u as targetEnvironment, w as childEnv, y as readLinuxStartupError } from "./runner-launch-B2zsQ1Dz.js";
import { logSpillFailure, prepareManagedProcessBinding } from "./output.js";
import { closeSync, constants, existsSync, mkdtempSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { access, stat } from "node:fs/promises";
import { constants as constants$1, devNull, tmpdir, userInfo } from "node:os";
import { basename, delimiter, extname, isAbsolute, join, resolve } from "node:path";
import { createLazyRequire } from "@deepseek-ai/dsh-lazy-require";
import { SubprocessExecutableNotFoundError, SubprocessRuntime } from "@deepseek-ai/dsh-subprocess";
import { execFile, spawn, spawnSync } from "node:child_process";
import { setTimeout as setTimeout$1 } from "node:timers/promises";
import { randomBytes } from "node:crypto";
import { loadWin32ProcessBindings, probeCurrentTokenJobSupport } from "@deepseek-ai/dsh-win32-process";
import { Buffer } from "node:buffer";
import { PassThrough } from "node:stream";

export {};
