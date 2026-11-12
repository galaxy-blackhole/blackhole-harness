/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-subprocess-local — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

import { S as loadLinuxExecve, a as resolveWindowsExecutable, b as serializeRunnerError, f as consumeLinuxLaunchRequest, g as linuxLaunchFilesFromLocator, h as isWindowsTerminateRequest, i as parseRunnerTargetArgv, r as consumeRunnerSelection, t as SUBPROCESS_RUNNER_ENV, v as parseWindowsStartRequest, x as writeLinuxStartupError } from "./runner-launch-B2zsQ1Dz.js";
import { closeSync } from "node:fs";
import { SUBPROCESS_CONTROL_FD } from "@deepseek-ai/dsh-subprocess/control";
import { Win32Error, closeHandleChecked, isJobEmpty, loadWin32ProcessBindings, pollProcessExit, spawnCurrentTokenJobProcess, terminateJob } from "@deepseek-ai/dsh-win32-process";

export {};
