/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc So dang ky ban xem theo hau to tep — observable registry voi getSnapshot/subscribe/register/candidates
 */

import { documentFileName, matchedSuffixLength } from "./suffix.ts";

/** Mot ban cai dat ban xem tai lieu. */
export interface DocumentPreviewDefinition {
  /** Ten duy nhat cua ban cai dat trong goi nay. */
  id: string;
  /** Cac hau to tep ma ban cai dat nhan. */
  extensions: readonly string[];
  /** Cac hau to nhi phan, phai nam trong extensions. */
  binaryExtensions?: readonly string[];
  /** Muc uu tien: 'builtin' xep truoc moi ban ngoai. */
  priority?: string;
  /** Ten do tu dien so huu. */
  title: () => string;
  /** Che do nap: 'text-pages' · 'bytes-complete' · 'renderer'. */
  loading: string;
  /** Ban cai dat co tu lo viec ngat dong khong. */
  wrap: boolean;
}

/** Mot ung vien khop, kem thu tu dang ky. */
interface RankedCandidate {
  /** Ban cai dat. */
  definition: DocumentPreviewDefinition;
  /** Thu tu dang ky. */
  order: number;
  /** Bang: 0 cho builtin, 1 cho phan con lai. */
  rank: number;
  /** Do dai hau to khop. */
  length: number;
}

/**
 * Xep hang mot anh chup danh sach dang ky ma khong doc trang thai service co the doi.
 * Nhan: definitions — cac ban cai dat theo thu tu dang ky; path — ten tep hoac duong dan.
 * Tra: cac ban cai dat khop, bang builtin truoc, roi hau to dai nhat.
 */
export function matchingDocumentPreviews(definitions: readonly DocumentPreviewDefinition[], path: string): DocumentPreviewDefinition[] {
  const name = documentFileName(path);
  return definitions
    .map((definition, order) => ({
      definition,
      order,
      rank: definition.priority === "builtin" ? 0 : 1,
      length: matchedSuffixLength(name, definition.extensions),
    }))
    .filter((candidate) => candidate.length > 0)
    .sort((left, right) => right.rank - left.rank || right.length - left.length || left.order - right.order)
    .map((candidate: RankedCandidate) => candidate.definition);
}

/**
 * Co ban cai dat nao da khai hau to nhi phan cua ten tep khong.
 * Nhan: definitions — cac ban cai dat da dang ky; path — ten tep hoac duong dan.
 * Tra: true khi co hau to nhi phan da khai khop.
 */
export function binaryDocumentPath(definitions: readonly DocumentPreviewDefinition[], path: string): boolean {
  const name = documentFileName(path);
  return definitions.some((definition) => matchedSuffixLength(name, definition.binaryExtensions ?? []) > 0);
}

/** So dang ky quan sat duoc cua MOI ban cai dat dang song, ke ca cac lua chon uu tien thap hon. */
export class DocumentPreviewRegistry {
  /** Ban cai dat theo id, theo thu tu dang ky. */
  private readonly registered = new Map<string, DocumentPreviewDefinition>();
  /** Nguoi quan sat thay doi dang ky. */
  private readonly listeners = new Set<() => void>();
  /** Anh chup on dinh — tra cung mot doi tuong cho toi khi co thay doi. */
  private snapshot: readonly DocumentPreviewDefinition[] = [];

  /**
   * Doc cac dang ky hien tai.
   * Nhan: khong.
   * Tra: cung mot anh chup cho toi khi mot dang ky thay doi.
   */
  readonly getSnapshot = (): readonly DocumentPreviewDefinition[] => this.snapshot;

  /**
   * Quan sat thay doi dang ky.
   * Nhan: listener — nguoi quan sat.
   * Tra: ham huy dang ky.
   */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /**
   * Dang ky metadata TACH RIENG khoi component cua slot keyed.
   * Nhan: definition — ban cai dat duy nhat kem cac hau to nhan dang.
   * Tra: ham huy idempotent; trung id hoac hau to nhi phan ngoai extensions thi nem.
   */
  register(definition: DocumentPreviewDefinition): () => void {
    if (this.registered.has(definition.id)) throw new Error('documentPreviews: duplicate implementation "' + definition.id + '"');
    const declared = new Set(definition.extensions.map(normalizeKey));
    for (const extension of definition.binaryExtensions ?? []) {
      if (!declared.has(normalizeKey(extension))) throw new Error('documentPreviews: "' + definition.id + '" declares binary suffix "' + extension + '" outside its extensions');
    }
    this.registered.set(definition.id, definition);
    this.publish();
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.registered.delete(definition.id);
      this.publish();
    };
  }

  /**
   * Liet ke moi ban cai dat khop theo thu tu tu chon.
   * Nhan: path — duong dan tep da giai ma.
   * Tra: bang hau to truoc, roi hau to dai nhat, roi thu tu dang ky.
   */
  candidates(path: string): DocumentPreviewDefinition[] {
    return matchingDocumentPreviews(this.snapshot, path);
  }

  /**
   * Phat hanh anh chup moi cho nguoi quan sat.
   * Nhan: khong.
   * Tra: khong.
   */
  private publish(): void {
    this.snapshot = [...this.registered.values()];
  }
}

/**
 * Chuan hoa hau to lam khoa so sanh noi bo cua so dang ky.
 * Nhan: extension — hau to da khai.
 * Tra: hau to viet thuong, bo dau cham dau.
 */
function normalizeKey(extension: string): string {
  return extension.toLowerCase().replace(/^\./u, "");
}
