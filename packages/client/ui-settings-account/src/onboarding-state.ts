/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bo dieu khien tien do gioi thieu Desktop: ghi truoc tuy chon dang dung roi moi ghi dau hoan thanh ben vung
 */

import type { AccountSnapshot, ObservableStore } from "./contracts.ts";
import { hasOnboardingCredit } from "./onboarding-balance.ts";
import type { SnapshotStore, StoreModule } from "./store.ts";

/** Tien do cua mot lan cai dat — nguyen van hinh dang cua Host. */
export interface OnboardingProgress {
  /** Phien ban so do. */
  version: number;
  /** Buoc dang o: welcome · credit · purpose · process · done. */
  step: string;
  /** Muc dich lam viec: office · development · both · null. */
  purpose: string | null;
  /** Muc do chi tiet: compact · standard · detailed · null. */
  process: string | null;
  /** Cach ket thuc: completed · skipped · api-key · null. */
  completion: string | null;
  /** Muc hien thi hieu nang: compact · detailed. */
  usage: string;
  /** Bat bo cong cu phat trien. */
  developerTools: boolean;
}

/** Trang thai ma lop phu shell doc. */
export interface OnboardingState {
  /** loading · saving · ready · error. */
  status: string;
  /** Lop phu co dang hien khong. */
  visible: boolean;
  /** Tien do hien tai. */
  progress: OnboardingProgress;
  /** Loi dang hien: "settings" hoac null. */
  error: string | null;
  /** Vi nap tien da co tin dung chua. */
  creditFunded: boolean;
}

/** Mot pham vi settings cua kernel (progress hoac ui-chat). */
export interface SettingsScope<T> extends ObservableStore<{ status: string; value?: T; writable?: boolean }> {
  /** Ghi mot lo thao tac; tra true khi Host chap nhan. */
  mutate(ops: ReadonlyArray<{ op: string; path: readonly string[]; value: unknown }>): Promise<boolean>;
}

/** Pham vi trang thai doc cua settings (de biet loi doc dau tien va thu lai). */
export interface SettingsReader extends ObservableStore<{ error: string | null }> {
  /** Thu doc lai. */
  ensure(): Promise<void>;
}

/**
 * Tien do cua mot lan cai dat moi — nguyen van ban goc.
 * @returns tien do mac dinh.
 */
export function freshProgress(): OnboardingProgress {
  return { version: 1, step: "welcome", purpose: null, process: null, completion: null, usage: "compact", developerTools: false };
}

/** Tuy chon chat ma buoc hoan thanh ghi truoc dau hoan thanh. */
export interface OnboardingChatSettings {
  /** Muc hien thi ban ghi hoi thoai — chinh la "process". */
  transcriptView: string;
  /** Muc hien thi hieu nang — chinh la "usage". */
  performanceUsage: string;
}

/**
 * Tien do do Host giu; viec hoan thanh ghi tuy chon dang dung truoc roi moi ghi dau "done" ben vung.
 */
export class DesktopOnboardingController {
  /** Tien do ben vung theo lan cai dat. */
  private readonly progress: SettingsScope<OnboardingProgress>;
  /** Chu so huu settings ui-chat da co. */
  private readonly chat: SettingsScope<OnboardingChatSettings>;
  /** Ghi viec bat bo cong cu phat trien qua tuy chon dung chung. */
  private readonly setDeveloperTools: (enabled: boolean) => void | Promise<void>;
  /** Trang thai tai khoan an toan, ban dau chua phan giai. */
  private readonly account: ObservableStore<AccountSnapshot>;
  /** Doc metadata credential cua model da cau hinh, khong co bi mat. */
  private readonly readApiKeyPresence: () => Promise<boolean>;
  /** Trinh doc settings dung chung (loi doc dau tien va thu lai). */
  private readonly settings: SettingsReader;
  /** Observable rieng, duoc chieu vao hook cua lop phu shell. */
  readonly state: SnapshotStore<OnboardingState>;
  /** Cac ham huy dang ky. */
  private readonly disposers: ReadonlyArray<() => void>;
  /** Dang ghi. */
  private saving = false;
  /** Dang hoan thanh. */
  private completing = false;
  /** Ban nhap dang cho ghi. */
  private draft: OnboardingProgress | undefined;
  /** Hang doi ghi, tuan tu. */
  private updates: Promise<boolean> = Promise.resolve(true);
  /** Da bi go chua. */
  private disposed = false;
  /** The he credential, de lan doc cu khong ghi de lan moi. */
  private credentialGeneration = 0;
  /** Co API key khong (undefined = chua biet). */
  private hasApiKey: boolean | undefined;
  /** Dang doc credential khong. */
  private checkingKeys = false;
  /** Loi dang hien. */
  private error: string | null = null;
  /** Lan ghi that bai gan nhat. */
  private failedWrite: { next: OnboardingProgress; applyPreferences: boolean } | undefined;
  /** Vi nap tien da co tin dung chua. */
  private creditFunded: boolean | undefined;
  /** Seed kho cua vo (createSnapshotStore + shallowEqual). */
  private readonly storeModule: StoreModule;

  /**
   * @param progress - tien do ben vung theo lan cai dat.
   * @param chat - chu so huu settings ui-chat da co.
   * @param setDeveloperTools - ghi viec bat bo cong cu phat trien qua tuy chon dung chung.
   * @param account - trang thai tai khoan an toan, ban dau chua phan giai.
   * @param readApiKeyPresence - doc metadata credential cua model da cau hinh, khong co bi mat.
   * @param settings - trinh doc settings dung chung (loi doc dau tien va thu lai).
   * @param storeModule - seed kho cua vo.
   */
  constructor(
    progress: SettingsScope<OnboardingProgress>,
    chat: SettingsScope<OnboardingChatSettings>,
    setDeveloperTools: (enabled: boolean) => void | Promise<void>,
    account: ObservableStore<AccountSnapshot>,
    readApiKeyPresence: () => Promise<boolean>,
    settings: SettingsReader,
    storeModule: StoreModule,
  ) {
    this.progress = progress;
    this.chat = chat;
    this.setDeveloperTools = setDeveloperTools;
    this.account = account;
    this.readApiKeyPresence = readApiKeyPresence;
    this.settings = settings;
    this.storeModule = storeModule;
    this.state = storeModule.createSnapshotStore<OnboardingState>({
      status: "loading",
      visible: false,
      progress: freshProgress(),
      error: null,
      creditFunded: false,
    });
    /** Chay lai phan suy dien khi bat ky nguon nao doi. */
    const derive = (): void => {
      this.derive();
    };
    this.disposers = [
      settings.subscribe(derive),
      progress.subscribe(derive),
      chat.subscribe(derive),
      account.subscribe(derive),
    ];
    this.derive();
  }

  /** Doc lai metadata credential sau khi provider hoac credential bi doi. */
  invalidateCredentials(): void {
    this.credentialGeneration++;
    this.checkingKeys = false;
    this.hasApiKey = undefined;
    if (this.failedWrite?.next.completion === "api-key") {
      this.error = null;
      this.failedWrite = undefined;
    }
    this.derive();
  }

  /**
   * Xem truoc mot buoc hoac mot lua chon ngay lap tuc va ghi tuan tu; lan ghi bi tu choi cuoi cung
   * phuc hoi tien do da luu.
   * @param change - cac truong tien do nguoi dung chon.
   * @returns Host settings co chap nhan tron gia tri tien do ke tiep khong.
   */
  async update(change: Partial<OnboardingProgress>): Promise<boolean> {
    if (this.completing || (this.saving && this.draft === undefined) || this.disposed || this.account.getSnapshot().view?.status !== "credential-stored") return false;
    const current = this.draft ?? this.readProgress();
    if (current === undefined || current.step === "done") return false;
    const next: OnboardingProgress = { ...current, ...change };
    this.draft = next;
    this.error = null;
    const pending = this.updates
      .then(async () => {
        if (this.disposed || this.account.getSnapshot().view?.status !== "credential-stored") return false;
        return this.save(next, false);
      })
      .finally(() => {
        if (this.draft === next) this.draft = undefined;
        this.derive();
      });
    this.updates = pending;
    this.derive();
    return pending;
  }

  /**
   * Ap cac tuy chon hien thi va bo cong cu phat trien da chon roi ket thuc phan gioi thieu cua lan cai dat nay.
   * @param reason - hoan thanh thong thuong hay bo qua ro rang o buoc hien tai.
   * @returns tuy chon va dau hoan thanh co duoc ghi khong.
   */
  async complete(reason: string): Promise<boolean> {
    if (this.completing || this.disposed || this.account.getSnapshot().view?.status !== "credential-stored") return false;
    this.completing = true;
    this.derive();
    try {
      if (!(await this.updates)) return false;
      return await this.finish(reason);
    } finally {
      this.completing = false;
      this.derive();
    }
  }

  /**
   * Ghi buoc cuoi cung.
   * @param reason - ly do ket thuc.
   * @returns co ghi duoc khong.
   */
  private async finish(reason: string): Promise<boolean> {
    if (this.saving || this.disposed || this.account.getSnapshot().view?.status !== "credential-stored") return false;
    const current = this.readProgress();
    if (current === undefined || current.step === "done" || current.step === "welcome") return false;
    const office = reason === "completed" && current.purpose === "office";
    const development = reason === "completed" && !office;
    if (development && current.process === null) return false;
    return this.save(
      {
        ...current,
        step: "done",
        completion: reason,
        process: office ? "compact" : reason === "skipped" ? "standard" : current.process,
        usage: development ? "detailed" : "compact",
        developerTools: development,
      },
      true,
    );
  }

  /**
   * Thu lai mot lan doc settings dau tien hoac lua chon that bai cuoi cung, ke ca tuy chon dang dung.
   * @returns lan doc hoac lan ghi co thanh cong khong; false khi khong con gi de thu.
   */
  async retry(): Promise<boolean> {
    if (this.saving || this.completing || this.draft !== undefined || this.disposed || this.account.getSnapshot().view?.status !== "credential-stored") return false;
    if (this.settings.getSnapshot().error !== null && this.progress.getSnapshot().status === "loading") {
      await this.settings.ensure();
      return this.progress.getSnapshot().status === "ready";
    }
    const pending = this.failedWrite;
    if (pending === undefined) return false;
    const saved = await this.save(pending.next, pending.applyPreferences);
    this.updates = Promise.resolve(saved);
    return saved;
  }

  /** Go cac dang ky va chan cac lan doc metadata cham ghi vao tien do. */
  dispose(): void {
    this.disposed = true;
    this.credentialGeneration++;
    for (const dispose of this.disposers) dispose();
  }

  /**
   * Doc tien do da luu voi ba truong null duoc chuan hoa.
   * @returns tien do, hoac undefined khi Host chua co gia tri.
   */
  private readProgress(): OnboardingProgress | undefined {
    const value = this.progress.getSnapshot().value;
    if (value === undefined) return undefined;
    return { ...value, purpose: value.purpose ?? null, process: value.process ?? null, completion: value.completion ?? null };
  }

  /**
   * Ghi mot gia tri tien do, truoc do ghi tuy chon dang dung neu duoc yeu cau.
   * @param next - gia tri tien do ke tiep.
   * @param applyPreferences - co ghi tuy chon chat va bo cong cu phat trien truoc khong.
   * @returns Host co nhan tron gia tri khong.
   */
  private async save(next: OnboardingProgress, applyPreferences: boolean): Promise<boolean> {
    const accountStatus = this.account.getSnapshot().view?.status;
    this.saving = true;
    this.error = null;
    this.derive();
    try {
      if (applyPreferences) {
        const mode = next.process;
        const accepted = await this.chat.mutate([
          { op: "set", path: ["transcriptView"], value: mode },
          { op: "set", path: ["performanceUsage"], value: next.usage },
        ]);
        const saved = this.chat.getSnapshot().value;
        if (!accepted || saved?.transcriptView !== mode || saved.performanceUsage !== next.usage) throw new Error("Chat preferences were not saved");
        if (this.disposed || this.account.getSnapshot().view?.status !== accountStatus) return false;
        await this.setDeveloperTools(next.developerTools);
      }
      if (this.disposed || this.account.getSnapshot().view?.status !== accountStatus) return false;
      const fields = Object.keys(next) as Array<keyof OnboardingProgress>;
      const accepted = await this.progress.mutate(fields.map((field) => ({ op: "set", path: [field], value: next[field] })));
      const saved = this.readProgress();
      if (!accepted || saved === undefined || Object.entries(next).some(([field, value]) => (saved as unknown as Record<string, unknown>)[field] !== value)) {
        throw new Error("onboarding progress was not saved");
      }
      this.failedWrite = undefined;
      return true;
    } catch {
      this.error = "settings";
      this.failedWrite = { next, applyPreferences };
      return false;
    } finally {
      this.saving = false;
      this.derive();
    }
  }

  /** Suy dien trang thai lop phu tu bon nguon va phat khi co thay doi. */
  private derive(): void {
    if (this.disposed) return;
    const host = this.progress.getSnapshot();
    const snapshot = this.account.getSnapshot();
    const account = snapshot.view;
    const signedIn = account?.status === "credential-stored";
    const progress = this.draft ?? this.readProgress() ?? freshProgress();
    if (!signedIn) this.creditFunded = undefined;
    else if (this.creditFunded === undefined && host.status === "ready" && progress.step === "credit") this.creditFunded = hasOnboardingCredit(snapshot.details?.balance);
    if (signedIn && this.failedWrite?.next.completion === "api-key") {
      this.failedWrite = undefined;
      this.error = null;
    }
    const done = progress.step === "done";
    const unavailable = host.status === "unavailable" || (host.status === "ready" && !host.writable);
    const readFailed = host.status === "loading" && this.settings.getSnapshot().error !== null;
    const accountFailed = account === undefined && snapshot.failed;
    const previous = this.state.getSnapshot();
    const next: OnboardingState = {
      progress: this.storeModule.shallowEqual(previous.progress, progress) ? previous.progress : progress,
      creditFunded: this.creditFunded ?? false,
      visible: !done && signedIn && !unavailable,
      status: this.completing || (this.saving && this.draft === undefined) ? "saving" : unavailable || readFailed || accountFailed || this.error !== null ? "error" : host.status === "loading" || account === undefined ? "loading" : "ready",
      error: unavailable || readFailed ? "settings" : this.error,
    };
    if (!this.storeModule.shallowEqual(previous, next)) this.state.set(next);
    if (done || this.saving || this.completing || this.draft !== undefined || unavailable || host.status !== "ready" || this.chat.getSnapshot().status !== "ready" || account?.status !== "signed-out") return;
    if (this.hasApiKey === true && this.error === null) {
      void this.save({ ...progress, step: "done", process: "standard", usage: "detailed", developerTools: true, completion: "api-key" }, true);
    } else if (this.hasApiKey === undefined && !this.checkingKeys) {
      this.checkingKeys = true;
      const generation = this.credentialGeneration;
      this.readApiKeyPresence()
        .then((present) => {
          if (this.disposed || generation !== this.credentialGeneration) return;
          this.hasApiKey = present;
          this.checkingKeys = false;
          this.derive();
        })
        .catch(() => {
          if (this.disposed || generation !== this.credentialGeneration) return;
          this.checkingKeys = false;
          this.hasApiKey = false;
        });
    }
  }
}
