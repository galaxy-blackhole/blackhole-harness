/*
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Test của vỏ shell: cổng mặc định, tách URL token từ log host, vòng đời BootState, khối lỗi của snapshot
 *      11/11/2026: tách khỏi main.rs để main.rs giữ dưới 1000 dòng (luật repo), không đổi hành vi
 */

//! Test của vỏ desktop, tách khỏi `main.rs` cho vừa ngưỡng 1000 dòng.

use crate::*;

#[test]
fn default_port_is_the_preview_port() {
  // 11/11/2026: app desktop ở 55907, blackhole web ở 55906, host của Lead ở 5439.
  assert_eq!(DEFAULT_PORT, 55907);
  assert_eq!(DEFAULT_PORT + PORT_SCAN_SPAN, 55917);
}

#[test]
fn a_token_url_is_extracted_from_a_host_log_line() {
  let line = "[bh] ready http://127.0.0.1:55907/?token=abc123";
  assert_eq!(extract_url(line, "http://127.0.0.1:55907"), Some("http://127.0.0.1:55907/?token=abc123".to_string()));
}

#[test]
fn a_relative_token_url_is_joined_onto_the_base() {
  let line = "ready /?token=abc123";
  assert_eq!(extract_url(line, "http://127.0.0.1:55907"), Some("http://127.0.0.1:55907/?token=abc123".to_string()));
}

#[test]
fn lines_without_a_token_are_not_urls() {
  assert_eq!(extract_url("[bh] booting harness", "http://127.0.0.1:55907"), None);
  assert_eq!(extract_url("", "http://127.0.0.1:55907"), None);
}

#[test]
fn a_boot_state_starts_hidden_and_resets_back_to_the_start() {
  let shell = Shell {
    state: Mutex::new(BootState::new(55907, Instant::now(), PathBuf::from("/tmp/x.log"))),
    smoke: false,
  };
  {
    let mut state = lock_state(&shell);
    state.shown = true;
    state.failure = Some(Failure { title: "t".into(), reason: "r".into(), details: vec![] });
    state.remember("mot");
    state.remember("hai");
    state.reset();
  }
  let state = lock_state(&shell);
  // "Thử lại" chạy khi cửa sổ ĐANG hiện khối lỗi, nên reset không được làm nó biến mất.
  assert!(state.shown);
  assert!(state.failure.is_none());
  assert!(state.recent.is_empty());
  assert_eq!(state.phase, Phase::Selecting);
}

#[test]
fn recent_host_lines_are_capped() {
  let mut state = BootState::new(55907, Instant::now(), PathBuf::from("/tmp/x.log"));
  for index in 0..40 {
    state.remember(&format!("dong {index}"));
  }
  assert_eq!(state.recent.len(), KEEP_LINES);
  assert_eq!(state.recent.last().map(String::as_str), Some("dong 39"));
}

#[test]
fn the_snapshot_carries_the_failure_block_for_the_error_window() {
  let shell = Shell {
    state: Mutex::new(BootState::new(55907, Instant::now(), PathBuf::from("/tmp/x.log"))),
    smoke: false,
  };
  fail(&shell, "Không tìm thấy node hoặc gốc host", "đã thử hết", vec!["node: /a → không có".to_string()]);
  let payload = snapshot(&shell);
  assert_eq!(payload["failure"]["title"], "Không tìm thấy node hoặc gốc host");
  assert_eq!(payload["failure"]["details"][0], "node: /a → không có");
  assert_eq!(payload["phase"], "failed");
}
