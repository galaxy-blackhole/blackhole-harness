/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Buoc build cua Tauri: doc tauri.conf.json, dua context da bien dich cho app, va nhung goc repo
 *      harness (cargo:rustc-env=GBH_BUILD_REPO) de vo desktop tim duoc apps/cli/src/main.ts ngay ca khi
 *      duoc mo tu Finder (cwd = "/", PATH toi thieu)
 */

use std::path::Path;

/// Tauri's build step: reads `tauri.conf.json` and hands the compiled context to the app.
fn main() {
  tauri_build::build();
  // <repo>/apps/desktop/src-tauri -> <repo>. Nhúng lúc build để bản .app đã cài vẫn biết mã nguồn harness
  // nằm ở đâu; nếu checkout bị di chuyển, host_command còn dò ngược từ vị trí binary và GBH_REPO/GBH_CLI.
  let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
  if let Some(repo) = manifest.join("..").join("..").join("..").canonicalize().ok() {
    println!("cargo:rustc-env=GBH_BUILD_REPO={}", repo.display());
    println!("cargo:rerun-if-changed={}", repo.join("apps").join("cli").join("src").join("main.ts").display());
  }
}
