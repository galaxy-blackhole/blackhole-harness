/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chương trình con TĨNH dùng để cấp phát độc quyền thư mục checkout bên trong sandbox tiến trình —
 *      nguyên văn lib/types/directory.js của bản gốc (một chuỗi, không phải mã của ta).
 */

/**
 * Chương trình con nhận gốc bể và đích đến qua argv NGUYÊN VĂN (không qua shell).
 * Gốc đã tồn tại thì giữ nguyên tệp của nó; chỉ tiến trình TẠO ra gốc mới ghi tệp .gitignore tự bỏ qua
 * chính nó. Gốc và đích đều được tạo bằng mkdir KHÔNG đệ quy ở bước cuối, nên hai lượt chạy tranh nhau
 * sẽ có đúng một lượt thắng (EEXIST) — đó là phép cấp phát ĐỘC QUYỀN.
 */
export const PREPARE_DIRECTORY = `
import fs from 'node:fs/promises';
import path from 'node:path';
async function main() {
  const [root, destination] = process.argv.slice(1);
  await fs.mkdir(path.dirname(root), { recursive: true });
  let created = false;
  try {
    await fs.mkdir(root);
    created = true;
  } catch (error) {
    if (error.code !== 'EEXIST' || !(await fs.stat(root)).isDirectory()) throw error;
  }
  if (created) await fs.writeFile(path.join(root, '.gitignore'), '*\\n', { flag: 'wx' });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.mkdir(destination);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
`;
