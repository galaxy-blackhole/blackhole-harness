/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-session-controller — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

import { hostname } from "node:os";
import { isAbsolute, resolve } from "node:path";
import z from "@deepseek-ai/schemastery";
import { AssistantStreamAccumulator, ReasoningEffortId, assistantStreamChunks, createUserMessage, errorChain, freezeMessage } from "@deepseek-ai/dsh-llm";
import { canOpenNativePath, nativeFileApplications, nativeFileManager, openNativeAssociatedPath, openNativeFileApplication, revealNativePath } from "@deepseek-ai/dsh-native-command";
import { SessionQueryError } from "@deepseek-ai/dsh-session-query";
import { Remote, RemoteError, TypertRemoteService, principalOf, remoteErrorOf } from "@deepseek-ai/dsh-typert-protocol";
import { canonicalClientTimeZone } from "@deepseek-ai/dsh-util-time";
import { assertNever } from "@deepseek-ai/dsh-util-values";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { installModelSelection } from "@deepseek-ai/dsh-agent";
import { brandString } from "@deepseek-ai/dsh-brand";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { AttachmentError } from "@deepseek-ai/dsh-attachment";
import { buildForkSeed } from "@deepseek-ai/dsh-session/fork";
import { SessionLogOffset, SessionSeq, isAppendSurfaceEvent } from "@deepseek-ai/dsh-session";
import { SessionTitleInvalidError } from "@deepseek-ai/dsh-session-title";
import { Deque } from "@deepseek-ai/dsh-deque";
import { performance } from "node:perf_hooks";
import { scheduler } from "node:timers/promises";
import { z as z$1 } from "zod";
import { isUserInvocable } from "@deepseek-ai/dsh-skill";
import { FsError } from "@deepseek-ai/dsh-fs";
import mime from "mime-types";

export {};
