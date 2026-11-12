/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Đo cặp ảnh A/B: pixelmatch có mask, gom cụm pixel lệch thành toạ độ, ghép ảnh cạnh nhau
 */

import { PNG } from "pngjs";

import { type ImageDiffResult, pixelDiff } from "../../parity/lib/image.ts";
import { type ResolvedMask, buildIgnoreMask, unmaskedPixelCount } from "../../parity/lib/masks.ts";

import { elementLabel } from "./steps.ts";
import type { ElementRow, MaskRegion, Viewport } from "./types.ts";

/** Một cụm pixel lệch liền kề, kèm toạ độ để chỉ đúng chỗ khác nhau. */
export interface Cluster {
  /** Toạ độ trái của khung bao. */
  x: number;
  /** Toạ độ trên của khung bao. */
  y: number;
  /** Chiều rộng khung bao. */
  w: number;
  /** Chiều cao khung bao. */
  h: number;
  /** Số pixel lệch trong cụm. */
  pixels: number;
  /** Phần tử DOM gần nhất (nếu dò được) để người đọc biết lệch ở thành phần nào. */
  label: string;
}

/** Kết quả đo một cặp ảnh. */
export interface PairMeasurement {
  /** Số liệu pixelmatch (đã trừ vùng mask). */
  diff: ImageDiffResult;
  /** Số pixel bị mask. */
  maskedPixels: number;
  /** Các cụm pixel lệch ngoài mask, nhiều pixel nhất đứng đầu. */
  clusters: Cluster[];
  /** Ngưỡng tỉ lệ cho phép. */
  threshold: number;
  /** true khi đạt ngưỡng. */
  pass: boolean;
}

/** Độ dài cạnh ô lưới khi gom cụm pixel lệch. */
const CLUSTER_CELL = 8;

/**
 * Đo cặp ảnh: pixelmatch có mask + gom cụm pixel lệch ngoài mask.
 * Nhận: ảnh tham chiếu, ảnh của ta, vùng mask theo tỉ lệ, viewport và ngưỡng tỉ lệ.
 * Trả: số liệu pixel cùng danh sách cụm toạ độ lệch (rỗng khi hai ảnh trùng nhau).
 */
export function measurePair(
  refPng: Buffer,
  oursPng: Buffer,
  masks: readonly MaskRegion[],
  viewport: Viewport,
  threshold = 0.001,
): { measurement: PairMeasurement; diffPng: Buffer } {
  const resolved: ResolvedMask[] = masks.map((region) => ({
    name: region.name,
    kind: region.kind,
    reason: region.reason,
    x: Math.round(region.x * viewport.width),
    y: Math.round(region.y * viewport.height),
    w: Math.max(1, Math.round(region.w * viewport.width)),
    h: Math.max(1, Math.round(region.h * viewport.height)),
  }));
  const framePixels = viewport.width * viewport.height;
  const maskedPixels = framePixels - unmaskedPixelCount(viewport.width, viewport.height, resolved);
  const ignoreMask = masks.length > 0 ? buildIgnoreMask(viewport.width, viewport.height, resolved) : undefined;
  const diff = pixelDiff(refPng, oursPng, threshold, { ignoreMask, maskedPixels });
  const diffPng = diff.diffPng ?? Buffer.alloc(0);
  const clusters = diff.ok && ignoreMask !== undefined ? findClusters(diffPng, ignoreMask) : findClusters(diffPng, null);
  return {
    measurement: { diff, maskedPixels, clusters, threshold, pass: diff.pass },
    diffPng,
  };
}

/**
 * Gom các pixel lệch (tô đỏ) thành cụm liền kề bằng lưới ô vuông 8px.
 * Nhận: ảnh diff PNG do pixelmatch sinh và bảng mask (byte khác 0 là pixel đã bỏ qua, có thể null).
 * Trả: các cụm đã sắp theo số pixel giảm dần, tối đa 12 cụm.
 */
export function findClusters(diffPng: Buffer, ignoreMask: Uint8Array | null): Cluster[] {
  if (diffPng.length === 0) return [];
  const png = PNG.sync.read(diffPng);
  const width = png.width;
  const height = png.height;
  const cols = Math.ceil(width / CLUSTER_CELL);
  const buckets = new Map<number, Cluster>();
  const isDiff = (x: number, y: number): boolean => {
    if (ignoreMask !== null && ignoreMask[y * width + x] !== 0) return false;
    const offset = (y * width + x) * 4;
    const r = png.data[offset] ?? 0;
    const g = png.data[offset + 1] ?? 0;
    const b = png.data[offset + 2] ?? 0;
    return r > 150 && g < 110 && b < 110;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isDiff(x, y)) continue;
      const key = Math.floor(y / CLUSTER_CELL) * cols + Math.floor(x / CLUSTER_CELL);
      const found = buckets.get(key);
      if (found === undefined) {
        buckets.set(key, { x, y, w: 1, h: 1, pixels: 1, label: "" });
      } else {
        const right = Math.max(found.x + found.w, x + 1);
        const bottom = Math.max(found.y + found.h, y + 1);
        found.x = Math.min(found.x, x);
        found.y = Math.min(found.y, y);
        found.w = right - found.x;
        found.h = bottom - found.y;
        found.pixels += 1;
      }
    }
  }
  const merged = new Map<number, Cluster>();
  const taken = new Set<number>();
  const keys = [...buckets.keys()];
  for (const start of keys) {
    if (taken.has(start)) continue;
    const queue = [start];
    taken.add(start);
    let acc: Cluster | null = null;
    while (queue.length > 0) {
      const key = queue.pop() as number;
      const cell = buckets.get(key);
      if (cell === undefined) continue;
      acc = acc === null ? { ...cell } : mergeCluster(acc, cell);
      const cx = key % cols;
      const cy = Math.floor(key / cols);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols) continue;
          const neighbour = ny * cols + nx;
          if (taken.has(neighbour) || !buckets.has(neighbour)) continue;
          taken.add(neighbour);
          queue.push(neighbour);
        }
      }
    }
    if (acc !== null && acc.pixels >= 4) merged.set(start, acc);
  }
  return [...merged.values()].sort((a, b) => b.pixels - a.pixels).slice(0, 12);
}

/**
 * Gộp hai cụm thành khung bao chung.
 * Nhận: cụm đích và cụm cần gộp vào.
 * Trả: cụm mới với khung bao trùm cả hai và tổng số pixel.
 */
function mergeCluster(target: Cluster, other: Cluster): Cluster {
  const x = Math.min(target.x, other.x);
  const y = Math.min(target.y, other.y);
  const right = Math.max(target.x + target.w, other.x + other.w);
  const bottom = Math.max(target.y + target.h, other.y + other.h);
  return { x, y, w: right - x, h: bottom - y, pixels: target.pixels + other.pixels, label: "" };
}

/**
 * Gán nhãn phần tử DOM cho từng cụm pixel lệch để người đọc biết lệch ở thành phần nào.
 * Nhận: danh sách cụm, danh sách phần tử của hai bên (ưu tiên bên của ta).
 * Trả: cụm đã có nhãn, giữ nguyên thứ tự.
 */
export function annotateClusters(clusters: readonly Cluster[], rows: readonly ElementRow[]): Cluster[] {
  return clusters.map((cluster) => {
    const cx = cluster.x + cluster.w / 2;
    const cy = cluster.y + cluster.h / 2;
    let best = "";
    let bestArea = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      const inside = cx >= row.x && cx <= row.x + row.w && cy >= row.y && cy <= row.y + row.h;
      if (!inside) continue;
      const area = row.w * row.h;
      if (area < bestArea) {
        bestArea = area;
        best = elementLabel(row);
      }
    }
    return { ...cluster, label: best };
  });
}

/**
 * Ghép hai ảnh cạnh nhau thành một ảnh PNG để nhìn thẳng mức giống nhau.
 * Nhận: ảnh trái, ảnh phải, độ rộng khe ngăn cách (pixel).
 * Trả: buffer PNG đã ghép; nếu lệch kích thước thì trả về ảnh trái.
 */
export function composePair(left: Buffer, right: Buffer, gap = 6): Buffer {
  return composeMany([left, right], gap);
}

/**
 * Ghép nhiều ảnh cùng chiều cao thành một dải ngang.
 * Nhận: danh sách ảnh PNG, độ rộng khe ngăn cách.
 * Trả: buffer PNG đã ghép; trả về ảnh đầu tiên khi không ghép được.
 */
export function composeMany(images: readonly Buffer[], gap = 6): Buffer {
  if (images.length === 0) return Buffer.alloc(0);
  const decoded = images.map((buffer) => PNG.sync.read(buffer));
  const first = decoded[0] as PNG;
  const sameHeight = decoded.every((image) => image.height === first.height);
  if (!sameHeight) return images[0] as Buffer;
  const gapTotal = gap * (decoded.length - 1);
  const width = decoded.reduce((sum, image) => sum + image.width, 0) + gapTotal;
  const out = new PNG({ width, height: first.height });
  const gapRow = { start: 0, end: 0 };
  out.data.fill(255);
  let offsetX = 0;
  for (const image of decoded) {
    for (let y = 0; y < image.height; y += 1) {
      const from = y * image.width * 4;
      const to = (y * width + offsetX) * 4;
      image.data.copy(out.data, to, from, from + image.width * 4);
    }
    offsetX += image.width + gap;
    gapRow.start += image.width;
    gapRow.end += image.width;
  }
  return PNG.sync.write(out);
}

/**
 * Thu nhỏ ảnh PNG theo tỉ lệ nguyên (lấy trung bình ô) để nhúng ảnh nhỏ vào tài liệu.
 * Nhận: ảnh PNG gốc và bề rộng đích mong muốn.
 * Trả: buffer PNG đã thu nhỏ; trả về ảnh gốc khi không cần hoặc không thu được.
 */
export function scalePng(buffer: Buffer, targetWidth: number): Buffer {
  const png = PNG.sync.read(buffer);
  const factor = Math.max(1, Math.round(png.width / Math.max(1, targetWidth)));
  if (factor <= 1) return buffer;
  const width = Math.floor(png.width / factor);
  const height = Math.floor(png.height / factor);
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < factor; dy += 1) {
        for (let dx = 0; dx < factor; dx += 1) {
          const offset = ((y * factor + dy) * png.width + (x * factor + dx)) * 4;
          r += png.data[offset] ?? 0;
          g += png.data[offset + 1] ?? 0;
          b += png.data[offset + 2] ?? 0;
        }
      }
      const total = factor * factor;
      const target = (y * width + x) * 4;
      out.data[target] = Math.round(r / total);
      out.data[target + 1] = Math.round(g / total);
      out.data[target + 2] = Math.round(b / total);
      out.data[target + 3] = 255;
    }
  }
  return PNG.sync.write(out);
}
