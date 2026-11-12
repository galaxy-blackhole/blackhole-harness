/*
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Đẩy trạng thái/lỗi từ Rust vào trang splash đã đóng gói, để cửa sổ không bao giờ trắng
 */

//! Cầu trạng thái giữa vỏ Rust và trang splash.
//!
//! Trang `ui/index.html` tự vẽ được hai trạng thái: đang chờ host (kèm dòng log host gần nhất) và lỗi tiếng
//! Việt có nút "Thử lại". Rust chỉ cần gọi `window.__GBH_SHELL__.apply({...})` với đúng gói dữ liệu mà lệnh
//! `boot_status` trả về, nên một lần `eval` bị mất (trang chưa nạp xong) vẫn không làm hỏng giao diện: trang
//! tự gọi `boot_status` khi nạp lại.

use tauri::WebviewWindow;

use crate::logfile;

/**
 * Gửi một gói trạng thái vào trang splash.
 * Nhận: `window` — cửa sổ chính; `payload` — JSON cùng hình dạng với lệnh `boot_status`.
 * Trả: không (mọi lỗi chỉ ghi log: trạng thái không được phép làm sập app).
 */
pub fn eval_state(window: &WebviewWindow, payload: &serde_json::Value) {
  let script = format!("window.__GBH_SHELL__&&window.__GBH_SHELL__.apply({payload});");
  if let Err(error) = window.eval(&script) {
    logfile::line("ui", &format!("không đẩy được trạng thái vào trang splash: {error}"));
  }
}

/**
 * Đưa trang splash về trạng thái đang chờ, dùng khi người dùng bấm "Thử lại".
 * Nhận: `window` — cửa sổ chính.
 * Trả: không.
 */
pub fn reset(window: &WebviewWindow) {
  let _ = window.eval("window.__GBH_SHELL__&&window.__GBH_SHELL__.reset();");
}
