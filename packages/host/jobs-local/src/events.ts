/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Định tuyến sự kiện cho sổ đăng ký cục bộ: subscription xếp theo bộ lọc, và mỗi lần chốt
 *      trạng thái phát đúng một lần tới từng listener khớp, có bọc lỗi.
 */

import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import type { JobEvent, JobEventFilter, JobEventListener } from "@deepseek-ai/dsh-jobs";
import { AnonymousEntries, ScopedLayers, scopeOf } from "@deepseek-ai/dsh-scope";
import type { ScopeLayer } from "@deepseek-ai/dsh-scope";

/** Một listener đã đăng ký cùng bộ lọc mà nó khai. */
interface Subscription {
  /** Bộ lọc quyết định owner nào được nghe. */
  filter: JobEventFilter;
  /** Hàm nhận sự kiện. */
  listener: JobEventListener;
}

/**
 * Phần đóng góp của MỘT scope: các controller job gắn từ đó và các subscription
 * `{ owners: 'scope' }` đăng ký tại đó. Cả hai bảng đều ẩn danh vì một đóng góp được nhận diện
 * bằng chính disposer của nó, không bằng cái tên mà người đăng ký thứ hai có thể che mất.
 */
export class JobLayer implements ScopeLayer {
  /** Token của các controller job gắn từ scope này. */
  readonly controllers = new AnonymousEntries<symbol>();
  /** Các subscription `{ owners: 'scope' }` đăng ký từ scope này. */
  readonly scoped = new AnonymousEntries<Subscription>();

  /**
   * Cho biết lớp này không còn đóng góp nào.
   * Nhận: không.
   * Trả: true khi cả hai bảng đều rỗng.
   */
  isEmpty(): boolean {
    return this.controllers.isEmpty() && this.scoped.isEmpty();
  }
}

/**
 * Định tuyến sự kiện tới các subscription. Subscription `{ owner }` và `{ owners: 'all' }` được
 * đánh giá trên MỌI sự kiện bất kể đăng ký ở đâu; subscription `{ owners: 'scope' }` xếp vào lớp
 * scope của context đăng ký và chỉ nhận các owner được ghép bên dưới nó — lớp toàn cục, đạt tới từ
 * một context không scope, nhận mọi owner.
 */
export class JobEventHub {
  /** Bảng lớp scope dùng chung với tay bắt controller. */
  private readonly layers: ScopedLayers<JobLayer>;
  /** Nơi ghi lỗi bị bọc của listener. */
  private readonly warn: (message: string) => void;
  /** Subscription đăng ký từ context không scope — nhận mọi owner. */
  private readonly unscoped = new Set<Subscription>();

  /**
   * Nhận: bảng lớp scope dùng chung với tay bắt controller, và nơi ghi lỗi của listener.
   * Trả: đối tượng hub (không tác dụng phụ ngoài việc giữ hai tham chiếu).
   */
  constructor(layers: ScopedLayers<JobLayer>, warn: (message: string) => void) {
    this.layers = layers;
    this.warn = warn;
  }

  /**
   * Đăng ký một listener như một effect của `ctx`.
   * Nhận: context đăng ký (sở hữu effect và, với `'scope'`, định danh scope), bộ lọc owner, listener.
   * Trả: disposer để huỷ đăng ký.
   */
  subscribe(ctx: Context, filter: JobEventFilter, listener: JobEventListener): () => void {
    const subscription: Subscription = { filter, listener };
    if ("owners" in filter && filter.owners === "scope") {
      return this.layers.effect(ctx, (layer) => layer.scoped.append(subscription), { label: "jobs.events.subscribe()" });
    }
    return ctx.effect(() => {
      this.unscoped.add(subscription);
      return () => {
        this.unscoped.delete(subscription);
      };
    }, "jobs.events.subscribe()");
  }

  /**
   * Phát một sự kiện tới mọi subscription khớp, bọc từng listener để một người quan sát không thể
   * phá lần chốt đã xảy ra.
   * Nhận: sự kiện cần phát, và owner chính xác của job (hoặc `undefined` với việc không chủ).
   * Trả: không.
   */
  emit(event: JobEvent, owner: Agent | undefined): void {
    const ownerId = owner?.id;
    for (const subscription of this.unscoped) {
      const { filter } = subscription;
      if ("owner" in filter && ownerId !== undefined && ownerId !== filter.owner) continue;
      this.deliver(subscription, event);
    }
    for (const subscription of this.layers.global.scoped.values()) this.deliver(subscription, event);
    const scope = owner === undefined ? undefined : scopeOf(owner.ctx);
    for (const layer of this.layers.chainLayers(scope)) {
      for (const subscription of layer.scoped.values()) this.deliver(subscription, event);
    }
  }

  /**
   * Giao một sự kiện cho một listener, bọc lỗi để không làm hỏng việc phát.
   * Nhận: subscription cần giao và sự kiện.
   * Trả: không (lỗi của listener được ghi qua `warn`).
   */
  private deliver(subscription: Subscription, event: JobEvent): void {
    try {
      subscription.listener(event);
    } catch (error) {
      this.warn(`jobs: event listener threw on ${event.type}: ${String(error)}`);
    }
  }
}
