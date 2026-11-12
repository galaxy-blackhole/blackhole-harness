/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc UUID v4 cho dia chi tab nhieu ban sao — thay util/crypto ma ban goc bundle vao
 *
 * ⚠️ 18/10/2026 — DOI CHIEU HANH VI: ban goc bundle ca goi util/crypto (vung
 * `../../util/crypto/src/index.ts`) chi de dung MOT ham: randomUUID(). Ham do chi xuat hien o
 * tab-domain.ts va service.ts, trong bieu thuc `\${pageAddress(kind)}/\${randomUUID()}` — dia chi cua
 * tab thu hai tro di khi mot loai tab khai multiple: true. Ban port dung crypto.getRandomValues cua
 * trinh duyet (co san, khong them phu thuoc) va giu nguyen dinh dang UUID v4 chu thuong.
 * Nhan: khong co.
 * Tra: khong co.
 */

/**
 * Sinh mot UUID phien ban 4 dang chuoi chu thuong.
 * Nhan: khong co.
 * Tra: chuoi UUID v4 (vi du "3f1c8f0e-9a5b-4c2d-8e1f-0a1b2c3d4e5f").
 */
export function randomUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
  const hex: string[] = [];
  for (const byte of bytes) hex.push(byte.toString(16).padStart(2, "0"));
  const s = hex.join("");
  return s.slice(0, 8) + "-" + s.slice(8, 12) + "-" + s.slice(12, 16) + "-" + s.slice(16, 20) + "-" + s.slice(20);
}
