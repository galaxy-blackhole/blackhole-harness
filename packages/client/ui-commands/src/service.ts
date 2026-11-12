/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Service commandUi: nguon lenh '/', so dang ky dong gop cua trang, va the chon theo tung phien
 */

import { CATALOG_SOURCE, CONSUME_EVENT, EFFECT, EVENTS, EXECUTED_EVENT, LOCALE_NS, RUNTIME_INJECT } from "./ids.ts";
import { CommandDirectory } from "./directory.ts";
import { PopupSelectController } from "./popup.ts";
import { builtinRowFace, createHostFaces, sectionRows, type HostFace } from "./presentation.ts";
import { claimToken } from "./resolution.ts";
import type {
  ClientContextLike,
  CommandDescriptorLike,
  MenuRowLike,
  PrimitivesLike,
  ServiceCtorLike,
  SessionsServiceLike,
  StoreSeamLike,
  TokenSegmentLike,
  Translate,
} from "./types.ts";
import { WeakMapWithValues } from "./weak-map-with-values.ts";

/** Phien phia client ma the chon duoc mo cho (hinh dang toi thieu ma row nay dung). */
export interface ClientSessionLike {
  /** Id phien. */
  readonly sessionId: string;
}

/** Spec nghiep vu kieu 'action': mot lenh tran tieu thu token va chay mot callback phia client. */
export interface ActionSpecLike {
  /** Loai hanh vi. */
  readonly kind: "action";
  /** Chay hanh dong cho mot phien. */
  run(session: ClientSessionLike): void;
}

/** Spec nghiep vu kieu 'popupSelect'. */
export interface PopupSelectSpecLike {
  /** Loai hanh vi. */
  readonly kind: "popupSelect";
  /** Che do tim kiem; mac dinh substring. */
  readonly searchMode?: "substring" | "fuzzy-label";
  /** Nhan tim kiem cho lan mo nay. */
  searchLabels?(): { readonly placeholder: string; readonly empty: string; readonly noResults: string };
  /** Nap danh sach dong. */
  options(session: ClientSessionLike, signal: AbortSignal): Promise<readonly import("./types.ts").SelectOptionLike[]>;
  /** Chot mot dong. */
  onSelect(option: import("./types.ts").SelectOptionLike, session: ClientSessionLike): void | Promise<void>;
}

/** Hanh vi giao dien cua mot dong gop hoac mot trang tri. */
export type CommandUiSpecLike = PopupSelectSpecLike | ActionSpecLike;

/** Mot dong gop lenh do phia client so huu (khong co descriptor Host). */
export interface CommandContributionLike {
  /** Ten lenh khong co dau '/'. */
  readonly name: string;
  /** Nhan dong thuc don da ban dia hoa. */
  label?(): string;
  /** Mo ta dong thuc don da ban dia hoa. */
  description?(): string;
  /** Bieu tuong cua dong. */
  readonly icon?: unknown;
  /** Bo loc nang luc, goi voi mot chieu moi cho moi lan chay ung vien. */
  available(session: ClientSessionLike): boolean;
  /** Hanh vi giao dien cua lenh. */
  readonly ui: CommandUiSpecLike;
}

/** Trang tri gan tren MOT lenh Host: lan goi TRAN cua no lam gi tren trang nay. */
export interface CommandDecorationLike {
  /** Ten lenh Host duoc trang tri (khong co dau '/'). */
  readonly name: string;
  /** Bo loc nang luc, goi voi mot chieu moi cho moi lan goi tran. */
  available(session: ClientSessionLike): boolean;
  /** Hanh vi giao dien cho lan goi tran. */
  readonly ui: CommandUiSpecLike;
}

/** Yeu cau sinh ung vien cua tang nguon kich hoat. */
export interface CandidateRequestLike {
  /** Van ban da go sau dau '/'. */
  readonly query: string;
  /** Vi tri con tro ('leading' = ngay sau dau '/'). */
  readonly position: string;
  /** Tin hieu huy cua lan thu. */
  readonly signal: AbortSignal;
}

/** Mot lan chon tu menu. */
export interface MenuPickLike {
  /** Dong duoc chon. */
  readonly candidate: MenuRowLike;
  /** Phien tai thoi diem chon. */
  readonly session: ClientSessionLike;
  /** Doan van ban ma token chiem trong ban nhap. */
  readonly span: unknown;
}

/** Claim leadingInput ma tang nguon kich hoat dung (nguyen van hinh dang cua ban goc). */
export interface LeadingClaimLike {
  /** Ten lenh trong danh muc. */
  readonly name: string;
  /** Cach viet ma ban nhap se mang. */
  readonly token: string;
  /** Goi y tham so cua lenh Host. */
  readonly hint?: string;
  /** Lenh nhan tep dinh kem. */
  readonly attachments?: true;
  /** Giao dich nop lenh. */
  submit(args: string, actx: unknown, attachments: readonly unknown[]): Promise<{ readonly kind: string; readonly text?: string }>;
}

/** Phong bi cua mot lan nop bang nut enter. */
export interface EnterEnvelopeLike {
  /** So tep dinh kem di kem. */
  readonly attachments: number;
}

/** Cac seam ma lop service can (lay tu bang module + tham so). */
export interface CommandUiRuntimeDeps {
  /** Seam dsh-client-store. */
  readonly store: StoreSeamLike;
  /** Ham xep hang cua ui-primitives. */
  readonly rankByName: PrimitivesLike["rankByName"];
  /** Sau mat chu cua lenh Host built-in. */
  readonly faces: ReadonlyMap<string, HostFace>;
}

/**
 * Lay ten lenh tu mot dong ma Host da xac nhan la da thuc thi.
 * Nhan: line — dong lenh da nop.
 * Tra: ten lenh khong co dau '/'.
 */
export function submittedCommandName(line: string): string {
  const trimmed = line.trim();
  const separator = trimmed.search(/\s/u);
  return (separator === -1 ? trimmed : trimmed.slice(0, separator)).slice(1);
}

/**
 * Dung LOP service commandUi that (ke thua Service cua cordis — lop do chi co o runtime qua bang module).
 * Nhan: Service — lop co so cordis; deps — seam store/primitives/mat chu.
 * Tra: lop service de ctx.plugin nap vao.
 */
export function createCommandUiRuntimeClass(
  Service: ServiceCtorLike,
  deps: CommandUiRuntimeDeps,
): new (ctx: ClientContextLike) => { readonly ctx: ClientContextLike } {
  /**
   * Be mat lenh: danh muc theo phien + nguon '/' + so dang ky dong gop + the chon theo tung phien.
   */
  class CommandUiRuntime extends Service {
    /** Bon dich vu bat buoc — nguyen van static inject cua ban goc. */
    static inject: readonly string[] = RUNTIME_INJECT;

    /** Cache danh muc theo phien. */
    private readonly directory: CommandDirectory;

    /** So dang ky song: dong gop, trang tri, va the chon theo phien. */
    private readonly live = {
      contributions: new Map<string, CommandContributionLike>(),
      decorations: new Map<string, CommandDecorationLike>(),
      popups: new WeakMapWithValues<object, PopupSelectController<ClientSessionLike>>(),
    };

    /** Ham dich namespace 'command' (cho cac thong bao tu choi cua hop soan tin). */
    private readonly t: Translate;

    /**
     * @param ctx - context goc so huu (fiber cua plugin; service tu dang ky ten 'commandUi' va theo vong doi fiber do).
     */
    constructor(ctx: ClientContextLike) {
      super(ctx, "commandUi");
      const locale = ctx.get("locale");
      if (locale === undefined) throw new Error("ui-commands: locale service unavailable");
      this.t = locale.bind(LOCALE_NS);
      this.directory = new CommandDirectory(async (sessionId: string) => {
        const sessions = this.sessions();
        if (sessions.subagentAddress(sessionId) !== undefined) return [];
        if (sessions.binding(sessionId) === undefined) {
          throw new Error('command catalog requires a retained session "' + sessionId + '"');
        }
        return sessions.using(sessionId, { source: CATALOG_SOURCE }, async (reference) => {
          const state = reference.binding.session.getSnapshot();
          if (state.openState !== "open") throw state.openError ?? new Error('session "' + sessionId + '" is not open');
          const result = await ctx.remote.commands.list(sessionId);
          if (result.ok === false) throw new Error("command.list failed: " + result.error.code + ": " + result.error.message);
          return result.value;
        });
      });
      const inputTriggers = ctx.get("inputTriggers");
      if (inputTriggers === undefined) throw new Error("ui-commands: slash service unavailable");
      ctx.effect(
        () =>
          inputTriggers.registerSource({
            trigger: "/",
            name: "command",
            candidates: (session: ClientSessionLike, req: CandidateRequestLike) => this.candidates(session, req),
            onPick: (pick: MenuPickLike) => this.dispatch(pick),
            matchSpace: (session: ClientSessionLike, token: string) => this.matchSpace(session, token),
            matchClaim: (session: ClientSessionLike, token: string, signal: AbortSignal) => this.matchClaim(session, token, signal),
            matchEnter: (session: ClientSessionLike, line: string, signal: AbortSignal, envelope: EnterEnvelopeLike) => this.matchEnter(session, line, signal, envelope),
            warm: (session: ClientSessionLike) => {
              this.directory.warm(session.sessionId);
            },
          }),
        EFFECT.source,
      );
      ctx.remote.$on(EVENTS.commandsChange, () => {
        this.directory.invalidateAll();
      });
      ctx.remote.$on(EVENTS.presetSelected, (sessionId: string) => {
        this.directory.resetSession(sessionId);
      });
      ctx.on(EVENTS.connectionReset, () => {
        this.directory.resetConnected();
      });
    }

    /**
     * Dang ky mot dong gop lenh cua client; ham huy theo hieu ung (di theo fiber cua nguoi goi). Ten trung thi nem.
     * Nhan: contribution — dong gop (descriptor + nang luc + spec giao dien).
     * Tra: ham huy bo dang ky.
     */
    register(contribution: CommandContributionLike): () => void {
      const dispose = this.ctx.effect(() => {
        const { contributions } = this.live;
        if (contributions.has(contribution.name)) throw new Error("ui-commands: duplicate contribution for /" + contribution.name);
        contributions.set(contribution.name, contribution);
        return () => {
          contributions.delete(contribution.name);
        };
      }, EFFECT.register);
      return () => {
        dispose();
      };
    }

    /**
     * Treo mot trang tri cho lan goi TRAN cua mot lenh Host; ham huy theo hieu ung (di theo fiber cua nguoi goi).
     * Nhan: decoration — ten lenh Host + nang luc + spec giao dien.
     * Tra: ham huy bo dang ky.
     */
    decorate(decoration: CommandDecorationLike): () => void {
      const dispose = this.ctx.effect(() => {
        const { decorations } = this.live;
        if (decorations.has(decoration.name)) throw new Error("ui-commands: duplicate decoration for /" + decoration.name);
        decorations.set(decoration.name, decoration);
        return () => {
          decorations.delete(decoration.name);
        };
      }, EFFECT.decorate);
      return () => {
        dispose();
      };
    }

    /**
     * Dong moi the dang mo cua mot lenh co danh sach dong da cu. Lan nap dang cho va cong xac nhan mat quyen
     * rang buoc; ban nhap duoc giu nguyen.
     * Nhan: name — ten lenh khong co dau '/'.
     * Tra: khong co.
     */
    dismiss(name: string): void {
      for (const popup of this.live.popups.values) {
        if (popup.state.getSnapshot().command === name) popup.dismiss({ focusComposer: true });
      }
    }

    /**
     * Lay bo dieu khien the chon cua mot phien (muon; chet cung pham vi phien). Callback consume cua no phat
     * su kien tieu thu token ve dung phien nay; focusComposer cham toi hop soan tin qua mat input cua hoi thoai.
     * Nhan: actx — context cua pham vi phien.
     * Tra: bo dieu khien thuong tru.
     */
    popupFor(actx: ClientContextLike): PopupSelectController<ClientSessionLike> {
      const sessions = this.sessions();
      const session = sessions.sessionOf(actx);
      const binding = session === undefined ? undefined : sessions.binding(session.sessionId);
      if (binding === undefined || binding.session !== session) throw new Error("command.popupFor requires a retained Session scope");
      const { popups } = this.live;
      const key: object = binding;
      const existing = popups.get(key);
      if (existing !== undefined) return existing;
      const controller = new PopupSelectController<ClientSessionLike>(
        {
          consume: (segment: TokenSegmentLike) =>
            binding.ctx.bail(binding.ctx, CONSUME_EVENT, {
              guard: segment.via === "menu" ? { kind: "span", span: segment.span } : { kind: "bare-token", token: segment.token },
            }) === true,
          focusComposer: () => {
            binding.ctx.get("conversation")?.input.for(binding.ctx).focus();
          },
        },
        deps.store,
        deps.rankByName,
      );
      popups.set(key, controller);
      binding.ctx.effect(
        () => () => {
          controller.dispose();
          popups.delete(key);
        },
        EFFECT.popup,
      );
      return controller;
    }

    /**
     * Ung vien cua thuc don: danh muc Host + nang luc cua dong gop, dong built-in duoc ban dia hoa, roi loc
     * theo vi tri; o tim kiem rong thi chia muc, khi da go thi xep hang theo ten-va-nhan dung chung.
     * Nhan: session — phien dang soan; req — yeu cau sinh ung vien.
     * Tra: cac dong ung vien theo thu tu hien thi.
     */
    private async candidates(session: ClientSessionLike, req: CandidateRequestLike): Promise<readonly MenuRowLike[]> {
      const list = await this.directory.ensureReady(session.sessionId, req.signal);
      const rows: MenuRowLike[] = [];
      const seen = new Set<string>();
      for (const descriptor of list) {
        seen.add(descriptor.name);
        rows.push({
          name: descriptor.name,
          ...(builtinRowFace(descriptor, this.t, deps.faces) ?? { description: descriptor.description }),
          ...(descriptor.input !== undefined ? { hint: descriptor.input.hint } : {}),
        });
      }
      for (const contribution of this.live.contributions.values()) {
        if (!contribution.available(session)) continue;
        if (seen.has(contribution.name)) throw new Error("ui-commands: contribution /" + contribution.name + " collides with a host command");
        rows.push({
          name: contribution.name,
          ...(contribution.label === undefined ? {} : { label: contribution.label() }),
          ...(contribution.description === undefined ? {} : { description: contribution.description() }),
          ...(contribution.icon === undefined ? {} : { icon: contribution.icon }),
        });
      }
      const visible = rows.filter((row) => req.position === "leading" || row.hint === undefined);
      return req.query === "" ? sectionRows(visible, this.t) : deps.rankByName(visible, req.query);
    }

    /**
     * Bang quyet dinh, cot menu: dong gop/lenh Host duoc trang tri thi mo the hoac chay hanh dong; lenh Host
     * co input thi nhan token; lenh Host tran thi thuc thi tach roi.
     * Nhan: pick — dong duoc chon tu menu.
     * Tra: 'handled' khi da xu ly, mot claim khi nhan token, undefined khi khong phai lenh.
     */
    private dispatch(pick: MenuPickLike): "handled" | { readonly claim: LeadingClaimLike } | undefined {
      const name = pick.candidate.name;
      const contribution = this.live.contributions.get(name);
      if (contribution !== undefined && contribution.available(pick.session)) {
        this.invoke(name, contribution.ui, pick.session, { via: "menu", span: pick.span });
        return "handled";
      }
      const descriptor = this.directory.resolve(pick.session.sessionId, name);
      if (descriptor === undefined) return undefined;
      const decoration = this.live.decorations.get(name);
      if (decoration !== undefined && decoration.available(pick.session)) {
        this.invoke(name, decoration.ui, pick.session, { via: "menu", span: pick.span });
        return "handled";
      }
      if (descriptor.input !== undefined) return { claim: this.leadingClaim(descriptor, pick.session, claimToken(descriptor, this.t)) };
      this.consumeVia(pick.session.sessionId, { via: "menu", span: pick.span });
      this.runDetached(descriptor, pick.session, "/" + name);
      return "handled";
    }

    /**
     * Bang quyet dinh, cot dau cach: kiem tra dong bo tren danh muc nong; chi lenh Host co leadingInput moi nhan.
     * Nhan: session — phien dang soan; token — doan van ban sau dau '/'.
     * Tra: claim khi nhan duoc token, nguoc lai undefined.
     */
    private matchSpace(session: ClientSessionLike, token: string): { readonly claim: LeadingClaimLike } | undefined {
      const claim = this.claimOf(session, token);
      return claim === undefined ? undefined : { claim };
    }

    /**
     * Cot khoi phuc: cau tra loi cua cot dau cach mot khi danh muc cua phien san sang (don truoc that bai thi
     * nem). No chi tra ve; khong goi va khong thuc thi gi.
     * Nhan: session — phien dang soan; token — doan van ban sau dau '/'; signal — tin hieu huy cua lan thu.
     * Tra: claim khi nhan duoc token, nguoc lai undefined.
     */
    private async matchClaim(session: ClientSessionLike, token: string, signal: AbortSignal): Promise<LeadingClaimLike | undefined> {
      await this.directory.ensureReady(session.sessionId, signal);
      // NGUYEN VAN ban goc: cot khoi phuc tra claim TRAN (khong boc { claim }) — giu dung hanh vi goc.
      return this.claimOf(session, token);
    }

    /**
     * Claim leadingInput ma mot token goi ten trong danh muc nong; kieu popup va action khong bao gio nhan.
     * Nhan: session — phien dang soan; token — doan van ban sau dau '/'.
     * Tra: claim, hoac undefined khi khong nhan.
     */
    private claimOf(session: ClientSessionLike, token: string): LeadingClaimLike | undefined {
      if (!token.startsWith("/")) return undefined;
      if (this.live.contributions.has(token.slice(1))) return undefined;
      const descriptor = this.directory.resolve(session.sessionId, token.slice(1));
      if (descriptor === undefined || descriptor.input === undefined) return undefined;
      return this.leadingClaim(descriptor, session, token.slice(1));
    }

    /**
     * Bang quyet dinh, cot enter. Cho MANH danh muc cua phien (don truoc that bai thi nem — khong bao gio ha
     * cap im lang). Dong gop va lenh Host tran chi hanh dong tren token TRAN; claim leadingInput chap nhan
     * ca phan tham so.
     *
     * Chinh sach phong bi: mot lan nop bang enter co tep dinh kem chi duoc giai quyet qua lenh khai bao nhan
     * tep dinh kem. Moi duong nop khac — the chon, claim khong nhan, hay thuc thi tran tach roi — deu nem
     * loi tu choi de may hien MOT thong bao o hop soan tin va giu nguyen ban nhap lan tep dinh kem; khong
     * thuc thi gi va khong mat gi. Mot action thi khong nop gi va van chay.
     *
     * Mot token da go duoc giai qua cach viet da ban dia hoa, nen mot dong viet la '/计划' van toi duoc
     * descriptor 'plan' va thuc thi nhu '/plan'.
     * Nhan: session — phien dang soan; line — toan bo dong da nop; signal — tin hieu huy; envelope — phong bi cua lan nop.
     * Tra: 'handled', mot claim, hoac undefined khi khong phai lenh.
     */
    private async matchEnter(
      session: ClientSessionLike,
      line: string,
      signal: AbortSignal,
      envelope: EnterEnvelopeLike,
    ): Promise<"handled" | { readonly claim: LeadingClaimLike } | undefined> {
      const trimmed = line.trim();
      if (!trimmed.startsWith("/")) return undefined;
      const ws = trimmed.search(/\s/);
      const token = ws === -1 ? trimmed : trimmed.slice(0, ws);
      const bare = ws === -1;
      const typedName = token.slice(1);
      if (typedName === "") return undefined;
      const refuseAttachments = (): never => {
        throw new Error(this.t("notice.attachmentsUnsupported", { command: typedName }));
      };
      const contribution = this.live.contributions.get(typedName);
      if (contribution !== undefined && contribution.available(session)) {
        if (!bare) return undefined;
        if (envelope.attachments > 0 && contribution.ui.kind !== "action") refuseAttachments();
        this.invoke(typedName, contribution.ui, session, { via: "enter", token });
        return "handled";
      }
      await this.directory.ensureReady(session.sessionId, signal);
      const descriptor = this.directory.resolve(session.sessionId, typedName);
      if (descriptor === undefined) return undefined;
      const name = descriptor.name;
      const canonical = "/" + name + trimmed.slice(token.length);
      if (bare) {
        const decoration = this.live.decorations.get(name);
        if (decoration !== undefined && decoration.available(session)) {
          if (envelope.attachments > 0 && decoration.ui.kind !== "action") refuseAttachments();
          this.invoke(name, decoration.ui, session, { via: "enter", token });
          return "handled";
        }
      }
      if (descriptor.input !== undefined) {
        if (envelope.attachments > 0 && descriptor.input.attachments !== true) refuseAttachments();
        return { claim: this.leadingClaim(descriptor, session, token.slice(1)) };
      }
      if (!bare) return undefined;
      if (envelope.attachments > 0) refuseAttachments();
      this.consumeVia(session.sessionId, { via: "enter", token });
      this.runDetached(descriptor, session, canonical);
      return "handled";
    }

    /**
     * Goi mot dong gop hoac mot trang tri (chon tu menu / enter tran): mo the cua phien, hoac tieu thu token
     * va chay hanh dong.
     * Nhan: name — ten lenh; ui — spec giao dien; session — phien; segment — doan token chup luc goi.
     * Tra: khong co.
     */
    private invoke(name: string, ui: CommandUiSpecLike, session: ClientSessionLike, segment: TokenSegmentLike): void {
      if (ui.kind === "action") {
        this.consumeVia(session.sessionId, segment);
        ui.run(session);
        return;
      }
      const actx = this.scopeFor(session.sessionId);
      if (actx === undefined) return;
      this.popupFor(actx).open(name, ui, session, segment);
    }

    /**
     * Dung claim leadingInput. Hop soan tin giu token da nhan trong ban nhap va doc phan tham so sau no, nen
     * token chinh la cach viet ma ban nhap se mang: cach viet cua tu dien khi chon tu menu, cach viet da go khi
     * dung dau cach va enter. Giao dich nop command.execute luon gui TEN trong danh muc.
     * Nhan: descriptor — descriptor Host; session — phien; shown — cach viet hien ra cho nguoi dung.
     * Tra: doi tuong claim ma tang nguon kich hoat dung.
     */
    private leadingClaim(descriptor: CommandDescriptorLike, session: ClientSessionLike, shown: string): LeadingClaimLike {
      const token = "/" + shown + " ";
      const line = "/" + descriptor.name + " ";
      return {
        name: descriptor.name,
        token,
        ...(descriptor.input !== undefined ? { hint: descriptor.input.hint } : {}),
        ...(descriptor.input?.attachments === true ? { attachments: true } : {}),
        submit: (args: string, _actx: unknown, attachments: readonly unknown[]) => this.execute(session, line + args, attachments),
      };
    }

    /**
     * Giao dich command.execute, gui toi agent cua phien — ngu nghia thu nhan thuan. Mot dong khong khop thi
     * bao ket qua loi (phan hoi thu nhan tuc thi cua hop soan tin); mot lenh duoc thu nhan thi bao thanh cong
     * don gian bat ke ket cuc cua handler, vi bo thuc thi Host da ghi vong doi ben vung va ket cuc hien ra
     * nhu mot node luong. Ket qua loi cua handler thi bao ket qua loi de hop soan tin giu ban nhap va tep
     * dinh kem cho lan sua. Mot lan goi bi tu choi thi nem.
     * Nhan: session — phien dich; line — dong lenh day du; attachments — tep dinh kem di kem.
     * Tra: ket cuc thu nhan { kind: 'success' } hoac { kind: 'error', text }.
     */
    private async execute(session: ClientSessionLike, line: string, attachments: readonly unknown[] = []): Promise<{ readonly kind: string; readonly text?: string }> {
      const result = await this.ctx.remote.commands.execute(session.sessionId, line, attachments);
      if (result.ok === false) throw new Error("command.execute failed: " + result.error.code + ": " + result.error.message);
      if (result.value === undefined) return { kind: "error", text: "unknown or malformed command: " + line };
      this.notifyExecuted(session.sessionId, submittedCommandName(line), result.value.result);
      if (attachments.length > 0 && result.value.result.kind === "error") return { kind: "error", text: result.value.result.text };
      return { kind: "success" };
    }

    /**
     * Phat loi xac nhan cuc bo ma khong de observer doi duoc viec thu nhan lenh.
     * Nhan: sessionId — phien duoc nop; name — ten lenh da chay; result — ket qua cua handler.
     * Tra: khong co.
     */
    private notifyExecuted(sessionId: string, name: string, result: unknown): void {
      const args = [EXECUTED_EVENT, sessionId, name, result];
      for (const listener of this.ctx.events.dispatch("emit", args)) {
        try {
          const returned = listener(sessionId, name, result);
          if (returned != null && typeof (returned as PromiseLike<unknown>).then === "function") {
            Promise.resolve(returned).then(undefined, (error: unknown) => {
              this.warnExecutedListenerFailure(name, error);
            });
          }
        } catch (error) {
          this.warnExecutedListenerFailure(name, error);
        }
      }
    }

    /**
     * Ghi log mot lan hong cua observer command/executed da duoc chan lai.
     * Nhan: name — ten lenh; error — loi bi nem.
     * Tra: khong co.
     */
    private warnExecutedListenerFailure(name: string, error: unknown): void {
      this.ctx.logger.warn('client command: a command/executed listener for "%s" failed', name);
      this.ctx.logger.warn(error);
    }

    /**
     * Thuc thi kieu ban-di cho cac duong 'da xu ly'. Ket cuc KHONG lo ra o day: bo thuc thi Host da ghi vong
     * doi lenh ben vung, va su kien mux-broadcast hien ra nhu mot node luong tren moi tab. Chi loi thu nhan —
     * thu chua bao gio vao handler nen chua bao gio duoc ghi log — moi roi ve thong bao cua hop soan tin.
     * Nhan: descriptor — descriptor Host; session — phien; line — dong lenh day du.
     * Tra: khong co.
     */
    private runDetached(descriptor: CommandDescriptorLike, session: ClientSessionLike, line: string): void {
      this.execute(session, line).then(
        (outcome) => {
          if (outcome.kind === "error") this.noticeFor(session.sessionId, "error", outcome.text ?? "/" + descriptor.name + " failed");
        },
        (error: unknown) => {
          this.noticeFor(session.sessionId, "error", error instanceof Error ? error.message : String(error));
        },
      );
    }

    /**
     * Phat su kien tieu thu token toi mot phien (duong thuc thi chon-tu-menu / enter-tran).
     * Nhan: id — id phien; segment — doan token chup luc goi.
     * Tra: khong co.
     */
    private consumeVia(id: string, segment: TokenSegmentLike): void {
      const actx = this.scopeFor(id);
      if (actx === undefined) return;
      actx.bail(actx, CONSUME_EVENT, {
        guard: segment.via === "menu" ? { kind: "span", span: segment.span } : { kind: "bare-token", token: segment.token },
      });
    }

    /**
     * Dua mot loi thu nhan ve kenh thong bao cua hop soan tin cua phien (pham vi mat = lan thu chet theo no).
     * Nhan: id — id phien; level — muc thong bao; text — noi dung.
     * Tra: khong co.
     */
    private noticeFor(id: string, level: string, text: string): void {
      const actx = this.scopeFor(id);
      if (actx === undefined) return;
      const conversation = actx.get("conversation");
      if (conversation === undefined) return;
      conversation.input.for(actx).notify(level, text);
    }

    /**
     * Diem trao doi id -> actx (diem trao doi da dang ky: service nay dieu phoi cho cac nguon chi chieu).
     * Nhan: id — id phien.
     * Tra: context cua pham vi phien, hoac undefined.
     */
    private scopeFor(id: string): ClientContextLike | undefined {
      return this.sessions().scope(id);
    }

    /**
     * Lay service sessions cua tang goc.
     * Nhan: khong co.
     * Tra: seam sessions; nem khi thieu.
     */
    private sessions(): SessionsServiceLike {
      const sessions = this.ctx.get("sessions");
      if (sessions === undefined) throw new Error("ui-commands: sessions service unavailable");
      return sessions;
    }
  }
  return CommandUiRuntime;
}

/**
 * Dung bang mat chu cua lenh built-in tu seam ui-primitives.
 * Nhan: primitives — seam ui-primitives.
 * Tra: anh xa ten built-in -> mat chu.
 */
export function hostFacesOf(primitives: PrimitivesLike): ReadonlyMap<string, HostFace> {
  return createHostFaces(primitives);
}
