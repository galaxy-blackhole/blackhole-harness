/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Sổ chính sách truy cập + quyết định của Gateway + lọc danh sách + ảnh chụp quyền theo Peer — bản
 *      viết lại 1:1 `RemoteAccessService` của `@deepseek-ai/dsh-api-remote-access` (nửa host).
 */

import type { Context } from "@deepseek-ai/cordis";
import { Remote, TypertRemoteService, principalOf } from "@deepseek-ai/dsh-typert-protocol";
import type {
  Principal,
  PrincipalMap,
  RemoteAccessResource,
} from "@deepseek-ai/dsh-typert-protocol";

import { abortion, assertNever, canonicalJson, sameActions, sameResource } from "./compare.ts";
import { AccessFollower } from "./follower.ts";
import type { RemoteAccessContext } from "./seams.ts";
import { REMOTE_ACCESS_SNAPSHOT_KEY } from "./snapshot.ts";
import type {
  RemoteAccessAction,
  RemoteAccessBaseline,
  RemoteAccessBinding,
  RemoteAccessDecision,
  RemoteAccessFrame,
  RemoteAccessGrant,
  RemoteAccessPolicy,
  RemoteAccessRequest,
} from "./types.ts";

/** Điểm cuối ảnh chụp mà MỌI Peer được đọc cho chính mình. */
const FOLLOW_ACTION = "remoteAccess/follow";

/** Câu trả lời ALLOW dùng chung (bất biến). */
const ALLOW = Object.freeze({ kind: "allow" }) as RemoteAccessDecision;
/** Từ chối vì KHÔNG chính sách/ràng buộc nào cho phép. */
const NO_ALLOW = Object.freeze({ kind: "deny", reason: "no-allow" }) as RemoteAccessDecision;
/** Từ chối vì chính sách/điều kiện/explain NÉM lỗi. */
const POLICY_FAILED = Object.freeze({ kind: "deny", reason: "policy-failed" }) as RemoteAccessDecision;
/** Danh tính CHỦ của Host. */
const OWNER = Object.freeze({ kind: "owner" }) as Principal;
/** Baseline một dòng mà trang của CHỦ mở đầu. */
const OWNER_BASELINE = Object.freeze({ type: "baseline", owner: true }) as RemoteAccessBaseline;
/** Kết quả đánh giá của MỘT điều kiện/ràng buộc: cho phép. */
const ALLOWED = Object.freeze({ kind: "allow" as const });
/** Kết quả đánh giá: chính sách NÉM lỗi. */
const FAILED = Object.freeze({ kind: "failed" as const });

/** Một chính sách đã đăng ký, kèm loại principal mà nó phục vụ. */
interface PolicyEntry {
  /** Loại principal mà chính sách phục vụ. */
  readonly kind: string;
  /** Luật nghiệp vụ do gói nghiệp vụ sở hữu. */
  readonly policy: RemoteAccessPolicy<Principal>;
}

/** Kết quả đánh giá MỘT tài nguyên của `evaluate`. */
type Evaluation =
  | { readonly kind: "allow" }
  | { readonly kind: "failed" }
  | { readonly kind: "refuse"; readonly refusal?: RemoteAccessDecision };

/**
 * Sổ chính sách truy cập, quyết định truy cập của Gateway, lọc danh sách, và ảnh chụp quyền theo Peer.
 * Mọi composition mount Gateway đều mount luôn service này.
 */
export class RemoteAccessService extends TypertRemoteService {
  /** Chính sách theo loại principal. */
  private readonly policies = new Map<string, PolicyEntry>();

  /** Chính sách đã ghi log lỗi kể từ lần `invalidate()` gần nhất; lỗi sau đó im lặng. */
  private readonly reported = new Set<PolicyEntry>();

  /** Các thế hệ ảnh chụp đang mở. */
  private readonly followers = new Set<AccessFollower>();

  /** Huỷ khi service này unload; mọi thế hệ ảnh chụp đang mở kết thúc theo nó. */
  private readonly lifetime = new AbortController();

  /** Seam của context (khai theo cấu trúc — không phụ thuộc augmentation của gói khác). */
  private readonly seam: RemoteAccessContext;

  /**
   * Đăng ký service dưới khoá `remoteAccess`, gắn vòng đời thế hệ ảnh chụp, và chèn baseline vào chỉ mục.
   * Nhận: context của plugin Host sở hữu.
   * Trả: không.
   */
  constructor(ctx: Context) {
    super(ctx, "remoteAccess");
    const seam = ctx as unknown as RemoteAccessContext;
    this.seam = seam;
    seam.effect(
      () => () => {
        this.lifetime.abort();
      },
      "remoteAccess: snapshot generations",
    );
    seam.inject(["webServer"], (webCtx) => {
      webCtx.on("webserver/index-inject", (table) => {
        table.push({ kind: "global", name: REMOTE_ACCESS_SNAPSHOT_KEY, value: OWNER_BASELINE });
      });
    });
  }

  /**
   * Đăng ký chính sách của MỘT loại principal không-phải-chủ trong fiber của bên gọi; ảnh chụp đang mở
   * được tính lại khi đăng ký và khi gỡ.
   * Nhận: loại principal mà chính sách phục vụ (không bao giờ là `owner`); chính sách do nghiệp vụ sở hữu.
   * Trả: hàm dọn gỡ chính sách này.
   * Ném: khi `kind` đã có chính sách.
   */
  registerPolicy<K extends Exclude<keyof PrincipalMap, "owner">>(
    kind: K,
    policy: RemoteAccessPolicy<PrincipalMap[K]>,
  ): () => void {
    const policies = this.policies;
    if (policies.has(kind)) {
      throw new Error("remote access: principal kind " + JSON.stringify(kind) + " already has a policy");
    }
    const entry: PolicyEntry = { kind, policy: policy as RemoteAccessPolicy<Principal> };
    const dispose = this.seam.effect(() => {
      policies.set(kind, entry);
      this.invalidate();
      return () => {
        policies.delete(kind);
        this.invalidate();
      };
    }, "remoteAccess.registerPolicy(" + JSON.stringify(kind) + ")");
    return () => {
      dispose();
    };
  }

  /**
   * Báo rằng ràng buộc/điều kiện cho `principal` có thể đã đổi. Gói nghiệp vụ gọi ở MỌI lần cấp, thu hồi,
   * đổi chế độ và hết hạn; ảnh chụp đang mở đẩy lại, và lỗi kế tiếp của mỗi chính sách được ghi lại.
   * Nhận: principal bị ảnh hưởng; bỏ trống nghĩa là MỌI principal.
   * Trả: không.
   */
  invalidate(principal?: Principal): void {
    this.reported.clear();
    const key = principal === undefined ? undefined : canonicalJson(principal);
    for (const follower of this.followers) {
      if (key === undefined || canonicalJson(follower.principal) === key) follower.touch();
    }
  }

  /**
   * Chỉ Gateway: quyết định MỘT yêu cầu mà Gateway đã phân giải tài nguyên. Chủ được phép, và
   * `remoteAccess/follow` cũng vậy (mọi Peer đọc ảnh chụp của chính mình). Ngoài ra hành động chỉ được phép
   * khi, trên MỌI tài nguyên được nêu, có một ràng buộc của chính sách principal nêu tài nguyên đó, có vai
   * liệt kê hành động, và không có điều kiện hoặc có điều kiện cho phép. `bindings()` gọi MỘT lần mỗi quyết định.
   * Nhận: bên gọi/bên nhận, hành động, các tài nguyên nó chạm, và tham số của lời gọi.
   * Trả: `allow`; hoặc `deny` với `no-allow` khi loại principal không có chính sách, lý do của điều kiện từ
   *       chối ĐẦU TIÊN trên tài nguyên ĐẦU TIÊN không ràng buộc nào cho phép, ngược lại lý do của
   *       `explain()`, ngược lại `no-allow`; `policy-failed` khi `bindings()`, một điều kiện, hoặc
   *       `explain()` ném — ghi log MỘT lần mỗi chính sách cho tới `invalidate()` kế tiếp.
   */
  decide(request: RemoteAccessRequest<Principal>): RemoteAccessDecision {
    const { principal, action } = request;
    if (principal.kind === "owner" || action === FOLLOW_ACTION) return ALLOW;
    const entry = this.policies.get(principal.kind);
    if (entry === undefined) return NO_ALLOW;
    const bindings = this.bindingsOf(entry, principal, action);
    if (bindings === undefined) return POLICY_FAILED;
    for (const resource of request.resources) {
      const evaluation = this.evaluate(entry, bindings, action, resource, request.args);
      switch (evaluation.kind) {
        case "allow":
          continue;
        case "failed":
          return POLICY_FAILED;
        case "refuse":
          return evaluation.refusal ?? this.explain(entry, request);
        default:
          return assertNever(evaluation);
      }
    }
    return ALLOW;
  }

  /**
   * Lọc các mục BÊN TRONG một phương thức Remote. Lời gọi được đọc từ Context đã truy cập service này, nên
   * hãy gọi `this.ctx.remoteAccess.allows(resource)`. Mỗi lần kiểm đọc lại ràng buộc của chính sách.
   * Nhận: tài nguyên của MỘT mục kết quả.
   * Trả: true cho chủ và ngoài lời gọi Remote; ngược lại là việc hành động của điểm cuối đang phục vụ có được
   *       phép trên `resource` khi KHÔNG có tham số hay không; false khi thiếu chính sách hoặc chính sách lỗi.
   */
  allows(resource: RemoteAccessResource): boolean {
    const invocation = this.seam.invocation;
    const principal = principalOf(invocation);
    if (invocation === undefined || principal === undefined) return true;
    const action = (invocation.request.namespace + "/" + invocation.request.method) as RemoteAccessAction;
    const entry = this.policies.get(principal.kind);
    if (entry === undefined) return false;
    const bindings = this.bindingsOf(entry, principal, action);
    return bindings !== undefined && this.evaluate(entry, bindings, action, resource, undefined).kind === "allow";
  }

  /**
   * Baseline một trang mở đầu TRƯỚC khi dòng ảnh chụp nối vào.
   * Nhận: danh tính bên gọi của trang.
   * Trả: baseline của chủ khi là chủ; ngược lại là quyền HIỆN TẠI của principal.
   */
  snapshotFor(principal: Principal): RemoteAccessBaseline {
    if (principal.kind === "owner") return OWNER_BASELINE;
    return { type: "baseline", owner: false, grants: this.grantsFor(principal) };
  }

  /**
   * Phát ảnh chụp quyền của Peer đang gọi: MỘT baseline, rồi các khung `upsert`/`remove` sau MỖI
   * `invalidate()` và mỗi lần đăng ký/gỡ chính sách làm đổi quyền. Chủ chỉ nhận `{ owner: true }`. Thế hệ
   * kết thúc khi `signal` huỷ hoặc service này unload.
   * Nhận: tín hiệu huỷ của thế hệ.
   * Trả: dãy khung truy cập của MỘT thế hệ.
   */
  @Remote({ mode: "stream" })
  async *follow(signal: AbortSignal): AsyncIterable<RemoteAccessFrame> {
    signal.throwIfAborted();
    const generation = AbortSignal.any([signal, this.lifetime.signal]);
    const principal = principalOf(this.seam.invocation);
    if (principal === undefined) {
      yield this.snapshotFor(OWNER);
      await abortion(generation);
      return;
    }
    const follower = new AccessFollower(principal);
    this.followers.add(follower);
    try {
      let sent = this.grantsFor(principal);
      yield { type: "baseline", owner: false, grants: sent };
      while (await follower.changed(generation)) {
        const next = this.grantsFor(principal);
        const previous = sent;
        sent = next;
        for (const grant of next) {
          const before = previous.find((other) => sameResource(other.resource, grant.resource));
          if (before === undefined || !sameActions(before.actions as readonly RemoteAccessAction[], grant.actions as readonly RemoteAccessAction[])) {
            yield { type: "upsert", grant };
          }
        }
        for (const grant of previous) {
          if (!next.some((other) => sameResource(other.resource, grant.resource))) {
            yield { type: "remove", resource: grant.resource };
          }
        }
      }
    } finally {
      this.followers.delete(follower);
    }
  }

  /**
   * MỘT lần `bindings()`; `undefined` sau khi đã ghi log lỗi.
   * Nhận: chính sách đã đăng ký, principal, và mục đích (cho câu log).
   * Trả: các ràng buộc, hoặc `undefined` khi chính sách ném.
   */
  private bindingsOf(
    entry: PolicyEntry,
    principal: Principal,
    purpose: string,
  ): readonly RemoteAccessBinding[] | undefined {
    try {
      return entry.policy.bindings(principal);
    } catch (error) {
      this.report(entry, "list bindings for " + purpose, error);
      return undefined;
    }
  }

  /**
   * Tìm một ràng buộc trên `resource` có vai liệt kê `action` và điều kiện (nếu có) cho phép.
   * Nhận: chính sách, các ràng buộc, hành động, tài nguyên, và tham số (khi có).
   * Trả: cho phép; hoặc lỗi chính sách; hoặc từ chối kèm lý do của điều kiện từ chối đầu tiên.
   */
  private evaluate(
    entry: PolicyEntry,
    bindings: readonly RemoteAccessBinding[],
    action: RemoteAccessAction,
    resource: RemoteAccessResource,
    args: Readonly<Record<string, unknown>> | undefined,
  ): Evaluation {
    let refusal: RemoteAccessDecision | undefined;
    for (const binding of bindings) {
      if (!sameResource(binding.resource, resource) || !binding.role.actions.includes(action)) continue;
      if (binding.condition === undefined) return ALLOWED;
      let decision: RemoteAccessDecision;
      try {
        decision = binding.condition(
          args === undefined
            ? { action, resource: binding.resource as never }
            : { action, resource: binding.resource as never, args },
        );
      } catch (error) {
        this.report(entry, "evaluate a condition for " + action, error);
        return FAILED;
      }
      if (decision.kind === "allow") return ALLOWED;
      refusal ??= decision;
    }
    return { kind: "refuse", refusal };
  }

  /**
   * Lý do từ chối mà `explain()` nêu, ngược lại `no-allow`; `policy-failed` khi nó ném lỗi.
   * Nhận: chính sách và yêu cầu bị từ chối.
   * Trả: quyết định từ chối.
   */
  private explain(entry: PolicyEntry, request: RemoteAccessRequest<Principal>): RemoteAccessDecision {
    let reason: string | undefined;
    try {
      reason = entry.policy.explain?.(request);
    } catch (error) {
      this.report(entry, "explain a refusal of " + request.action, error);
      return POLICY_FAILED;
    }
    return reason === undefined ? NO_ALLOW : { kind: "deny", reason };
  }

  /**
   * MỘT quyền cho mỗi tài nguyên được ràng buộc, theo thứ tự ràng buộc ĐẦU TIÊN: các hành động điểm cuối mà
   * `decide()` sẽ cho phép ở đó khi KHÔNG có tham số. Tài nguyên không có hành động nào như vậy thì không có
   * quyền; hành động sự kiện KHÔNG vào ảnh chụp.
   * Nhận: principal cần tính quyền.
   * Trả: danh sách quyền (bất biến).
   */
  private grantsFor(principal: Principal): readonly RemoteAccessGrant[] {
    const entry = this.policies.get(principal.kind);
    if (entry === undefined) return [];
    const bindings = this.bindingsOf(entry, principal, "a snapshot");
    if (bindings === undefined) return [];
    const grants: RemoteAccessGrant[] = [];
    const seen: RemoteAccessResource[] = [];
    for (const { resource } of bindings) {
      if (seen.some((other) => sameResource(other, resource))) continue;
      seen.push(resource);
      const candidates = new Set<RemoteAccessAction>();
      for (const binding of bindings) {
        if (!sameResource(binding.resource, resource)) continue;
        for (const action of binding.role.actions) {
          if (!action.startsWith("event:")) candidates.add(action);
        }
      }
      const actions = [...candidates]
        .filter((action) => this.evaluate(entry, bindings, action, resource, undefined).kind === "allow")
        .sort();
      if (actions.length > 0) grants.push(Object.freeze({ resource, actions: Object.freeze(actions) }));
    }
    return grants;
  }

  /**
   * Ghi log lỗi chính sách MỘT lần mỗi chính sách cho tới `invalidate()` kế tiếp.
   * Nhận: chính sách, việc nó hỏng, và lỗi.
   * Trả: không.
   */
  private report(entry: PolicyEntry, action: string, error: unknown): void {
    if (this.reported.has(entry)) return;
    this.reported.add(entry);
    this.seam.logger.warn(
      "remote access: the " +
        JSON.stringify(entry.kind) +
        " policy failed to " +
        action +
        "; its further failures are not logged until access state changes",
    );
    this.seam.logger.warn(error);
  }
}
