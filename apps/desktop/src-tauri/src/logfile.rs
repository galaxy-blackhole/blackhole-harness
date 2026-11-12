/*
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Ghi log của vỏ desktop ra ~/Library/Logs/Galaxy Blackhole/desktop-<cổng>.log và xoay vòng khi quá 5MB
 */

//! Desktop-shell log file.
//!
//! Vì sao có tệp này (11/11/2026): khi người dùng mở app bằng Finder/LaunchServices, stdout KHÔNG đi đâu cả
//! — không Terminal, không Console.app, không crash report. Mọi chẩn đoán sau đó đều là phỏng đoán. Ghi
//! thẳng ra `~/Library/Logs/Galaxy Blackhole/desktop-<cổng>.log` biến "app thoát im lặng" thành một tệp
//! đọc được ở lần mở sau, và đó cũng là nơi nghiệm thu đọc dòng `[bh] ready http://127.0.0.1:55907/`.
//!
//! Tên tệp theo CỔNG đang phục vụ: hai lượt chạy ở hai cổng khác nhau không ghi đè log của nhau.

use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

/// Ngưỡng xoay vòng: 5 MB. Log của một lượt boot là vài chục KB, nên 5 MB là hàng trăm lượt mở app.
const MAX_BYTES: u64 = 5 * 1024 * 1024;

/// Đích ghi: đường dẫn hiện tại + tệp đang mở (None khi chưa khởi tạo hoặc không mở được).
struct Sink {
  /// Tệp log của cổng đang phục vụ.
  path: PathBuf,
  /// Tay cầm ghi nối; None nghĩa là chỉ in ra stdout.
  file: Option<File>,
}

/// Ô log duy nhất của tiến trình.
static SINK: OnceLock<Mutex<Sink>> = OnceLock::new();

/**
 * Ô log dùng chung, khởi tạo ở lần gọi đầu.
 * Nhận: không.
 * Trả: tham chiếu tới `Mutex<Sink>` toàn cục.
 */
fn sink() -> &'static Mutex<Sink> {
  SINK.get_or_init(|| Mutex::new(Sink { path: PathBuf::new(), file: None }))
}

/**
 * Thư mục log của app.
 * Nhận: không (đọc `$HOME`).
 * Trả: `~/Library/Logs/Galaxy Blackhole`, hoặc None khi không biết HOME.
 */
pub fn log_dir() -> Option<PathBuf> {
  let home = std::env::var("HOME").ok()?;
  Some(PathBuf::from(home).join("Library").join("Logs").join("Galaxy Blackhole"))
}

/**
 * Định dạng một mốc thời gian UTC từ epoch giây.
 * Nhận: `secs` — giây kể từ 1970-01-01T00:00:00Z.
 * Trả: chuỗi `YYYY-MM-DDTHH:MM:SSZ` (đủ để đối chiếu hai lượt boot, không cần múi giờ).
 */
fn timestamp(secs: u64) -> String {
  let days = (secs / 86_400) as i64;
  let rem = secs % 86_400;
  // Howard Hinnant, "chrono-Compatible Low-Level Date Algorithms": đổi số ngày thành Y/M/D dương lịch.
  let z = days + 719_468;
  let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
  let doe = z - era * 146_097;
  let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
  let y = yoe + era * 400;
  let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  let mp = (5 * doy + 2) / 153;
  let d = doy - (153 * mp + 2) / 5 + 1;
  let m = if mp < 10 { mp + 3 } else { mp - 9 };
  let year = if m <= 2 { y + 1 } else { y };
  format!(
    "{year:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
    rem / 3_600,
    (rem % 3_600) / 60,
    rem % 60
  )
}

/**
 * Có nên xoay vòng tệp log không.
 * Nhận: `len` — kích thước hiện tại tính bằng byte.
 * Trả: true khi vượt {@link MAX_BYTES}.
 */
fn should_rotate(len: u64) -> bool {
  len > MAX_BYTES
}

/**
 * Xoay vòng `desktop-<cổng>.log` → `desktop-<cổng>.log.1` khi đã quá lớn.
 * Nhận: `path` — tệp log hiện tại.
 * Trả: không (mọi lỗi đều bỏ qua: log không được phép làm hỏng lượt boot).
 */
fn rotate_if_needed(path: &Path) {
  let Ok(meta) = fs::metadata(path) else { return };
  if !should_rotate(meta.len()) {
    return;
  }
  let rotated = path.with_extension("log.1");
  let _ = fs::remove_file(&rotated);
  let _ = fs::rename(path, rotated);
}

/**
 * Mở (hoặc chuyển sang) tệp log của một cổng.
 * Nhận: `port` — cổng đang phục vụ, dùng làm tên tệp.
 * Trả: đường dẫn tệp log khi mở được, None khi không có HOME hoặc không ghi được.
 */
pub fn init(port: u16) -> Option<PathBuf> {
  let dir = log_dir()?;
  fs::create_dir_all(&dir).ok()?;
  let path = dir.join(format!("desktop-{port}.log"));
  rotate_if_needed(&path);
  let file = OpenOptions::new().create(true).append(true).open(&path).ok()?;
  if let Ok(mut held) = sink().lock() {
    held.path = path.clone();
    held.file = Some(file);
  }
  Some(path)
}

/**
 * Đường dẫn tệp log đang mở.
 * Nhận: không.
 * Trả: đường dẫn tuyệt đối, hoặc None khi chưa {@link init}.
 */
pub fn path() -> Option<PathBuf> {
  let held = sink().lock().ok()?;
  if held.path.as_os_str().is_empty() {
    return None;
  }
  Some(held.path.clone())
}

/**
 * Ghi một dòng log ra cả stdout và tệp.
 * Nhận: `tag` — tiền tố ngắn (`shell`, `host`, `ui`); `message` — nội dung một dòng.
 * Trả: không.
 */
pub fn line(tag: &str, message: &str) {
  let stamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|value| value.as_secs())
    .unwrap_or(0);
  let text = format!("{} [{tag}] {message}", timestamp(stamp));
  println!("{text}");
  let _ = std::io::stdout().flush();
  if let Ok(mut held) = sink().lock() {
    if let Some(file) = held.file.as_mut() {
      let _ = writeln!(file, "{text}");
      let _ = file.flush();
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn rotation_trigger_is_five_megabytes() {
    assert!(!should_rotate(MAX_BYTES));
    assert!(should_rotate(MAX_BYTES + 1));
  }

  #[test]
  fn timestamps_are_iso_utc() {
    // 2026-11-11T00:00:00Z = 1_794_355_200 giây kể từ epoch (đối chiếu: date -u -r 1794355200).
    assert_eq!(timestamp(1_794_355_200), "2026-11-11T00:00:00Z");
    assert_eq!(timestamp(0), "1970-01-01T00:00:00Z");
  }
}
