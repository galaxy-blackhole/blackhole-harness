/*
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Dò cổng trống, nhận diện host mồ côi của chính app đang giữ cổng và dọn nó trước khi bind
 */

//! Chủ quyền cổng của vỏ desktop.
//!
//! 11/11/2026: máy dev đã thấy 3 host con cùng listen 55906 và 2 cùng 55907 — di sản của những lượt app
//! thoát mà không dọn. Cổng bận làm lượt mở sau chết trong im lặng. Module này phân biệt hai loại chủ cổng:
//!
//! * host của CHÍNH app (dòng lệnh chứa `apps/cli/src/main.ts` và tham số `host`) — mồ côi của lượt
//!   trước, dọn rồi bind lại đúng cổng;
//! * tiến trình LẠ — không được giết; đi tiếp dải 55908..55917 và ghi lý do.
//!
//! Mọi phép đọc hệ thống đều qua `lsof`/`ps` với đường dẫn tuyệt đối: app mở từ Finder có PATH tối thiểu.

use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// Địa chỉ vòng lặp host bind; harness từ chối mọi địa chỉ khác.
pub const LOOPBACK: &str = "127.0.0.1";

/// Công cụ hệ thống liệt kê pid đang listen (macOS).
const LSOF: &str = "/usr/sbin/lsof";

/// Công cụ hệ thống đọc dòng lệnh của một pid (macOS).
const PS: &str = "/bin/ps";

/// Chờ tối đa bao lâu để một cổng được nhả sau khi dọn host mồ côi.
const RELEASE_WAIT_MS: u64 = 5_000;

/// Chờ thêm bao lâu sau SIGKILL trước khi kết luận cổng vẫn bận.
const KILL_WAIT_MS: u64 = 2_000;

/**
 * Cổng có bind được ngay bây giờ không.
 * Nhận: `port` — cổng cần thử; 0 nghĩa là OS tự cấp nên luôn coi là trống.
 * Trả: true khi bind được (rồi nhả ngay).
 */
pub fn is_free(port: u16) -> bool {
  if port == 0 {
    return true;
  }
  std::net::TcpListener::bind((LOOPBACK, port)).is_ok()
}

/**
 * Chạy một lệnh hệ thống, lấy stdout.
 * Nhận: `program` — đường dẫn tuyệt đối; `args` — tham số.
 * Trả: stdout khi lệnh thoát 0, None khi thiếu lệnh hoặc lệnh lỗi.
 */
fn run(program: &str, args: &[&str]) -> Option<String> {
  if !Path::new(program).exists() {
    return None;
  }
  let output = Command::new(program)
    .args(args)
    .stdin(Stdio::null())
    .stderr(Stdio::null())
    .output()
    .ok()?;
  if !output.status.success() {
    return None;
  }
  Some(String::from_utf8_lossy(&output.stdout).to_string())
}

/**
 * Tách danh sách pid từ stdout của `lsof -t`.
 * Nhận: `text` — mỗi dòng một pid.
 * Trả: các pid hợp lệ, theo thứ tự xuất hiện.
 */
fn parse_pids(text: &str) -> Vec<u32> {
  let mut pids = Vec::new();
  for line in text.lines() {
    if let Ok(pid) = line.trim().parse::<u32>() {
      if pid > 0 && !pids.contains(&pid) {
        pids.push(pid);
      }
    }
  }
  pids
}

/**
 * Các pid đang listen trên một cổng.
 * Nhận: `port` — cổng cần hỏi.
 * Trả: danh sách pid (rỗng khi không có `lsof` hoặc cổng trống).
 */
pub fn listener_pids(port: u16) -> Vec<u32> {
  let spec = format!("-iTCP:{port}");
  match run(LSOF, &["-nP", &spec, "-sTCP:LISTEN", "-t"]) {
    Some(text) => parse_pids(&text),
    None => Vec::new(),
  }
}

/**
 * Dòng lệnh đầy đủ của một pid.
 * Nhận: `pid` — tiến trình cần đọc.
 * Trả: chuỗi lệnh (đã cắt xuống dòng), None khi tiến trình đã chết.
 */
pub fn command_line(pid: u32) -> Option<String> {
  let pid_text = pid.to_string();
  let text = run(PS, &["-ww", "-o", "command=", "-p", &pid_text])?;
  let line = text.trim_end_matches(['\r', '\n']).trim().to_string();
  if line.is_empty() {
    None
  } else {
    Some(line)
  }
}

/**
 * Dòng lệnh này có phải host do app tự spawn không.
 * Nhận: `command` — dòng lệnh đầy đủ của một tiến trình.
 * Trả: true khi có cả entry `apps/cli/src/main.ts` lẫn tham số con `host`.
 */
pub fn is_our_host(command: &str) -> bool {
  let mentions_entry = command.contains("apps/cli/src/main.ts") || command.contains("apps\\cli\\src\\main.ts");
  // Cổng do tiến trình CON giữ: node chạy harness (apps/host/.../dsh/lib/bin.js --port N).
  // 11/11/2026 đo được: lsof chỉ trả về node của tiến trình harness — nếu chỉ khớp "apps/cli/src/main.ts host"
  // thì host mồ côi của chính app bị đọc thành "tiến trình lạ" và app nhảy sang 55908 vô ích.
  let mentions_harness = command.contains("dsh/lib/bin.js") || command.contains("dsh\\lib\\bin.js");
  let mentions_host = command.split_whitespace().any(|token| token == "host");
  let mentions_port = command.split_whitespace().any(|token| token == "--port");
  (mentions_entry && mentions_host) || (mentions_harness && mentions_port)
}

/**
 * Gửi tín hiệu cho MỘT pid.
 * Nhận: `pid`; `force` — true để SIGKILL, false để SIGTERM.
 * Trả: true khi tín hiệu đã gửi được.
 */
pub fn terminate(pid: u32, force: bool) -> bool {
  let signal = if force { libc::SIGKILL } else { libc::SIGTERM };
  // SAFETY: kill(2) chỉ đọc số hiệu tiến trình và tín hiệu; không có con trỏ nào bị giải tham chiếu.
  unsafe { libc::kill(pid as libc::pid_t, signal) == 0 }
}

/**
 * Nhóm tiến trình của một pid.
 * Nhận: `pid`.
 * Trả: pgid, None khi tiến trình đã chết hoặc không đọc được.
 */
fn process_group_of(pid: u32) -> Option<i32> {
  let text = run(PS, &["-o", "pgid=", "-p", &pid.to_string()])?;
  text.trim().parse::<i32>().ok().filter(|pgid| *pgid > 1)
}

/**
 * Gửi tín hiệu cho CẢ NHÓM của một pid — wrapper là node CLI, còn cổng do node harness con giữ, nên giết một mình
 * tiến trình giữ cổng sẽ để lại wrapper.
 * Nhận: `pid`; `force` — true để SIGKILL, false để SIGTERM.
 * Trả: true khi tín hiệu đã gửi được.
 */
fn terminate_group(pid: u32, force: bool) -> bool {
  let signal = if force { libc::SIGKILL } else { libc::SIGTERM };
  match process_group_of(pid) {
    // SAFETY: kill(2) với pgid âm chỉ gửi tín hiệu cho nhóm tiến trình; không giải tham chiếu bộ nhớ.
    Some(pgid) => unsafe { libc::kill(-pgid, signal) == 0 },
    None => terminate(pid, force),
  }
}

/**
 * Kết quả một lượt đòi lại cổng.
 */
pub struct Reclaim {
  /// Ghi chú cho log: cổng nào, pid nào, vì sao giết hoặc vì sao không.
  pub notes: Vec<String>,
  /// Cổng đã bind lại được chưa.
  pub released: bool,
}

/**
 * Dọn host mồ côi của chính app trên một cổng.
 * Nhận: `port` — cổng đang bận.
 * Trả: {@link Reclaim} — pid đã dọn, ghi chú, và cổng đã nhả chưa. Tiến trình lạ KHÔNG bao giờ bị giết.
 */
pub fn reclaim_orphan_host(port: u16) -> Reclaim {
  let mut notes = Vec::new();
  let pids = listener_pids(port);
  if pids.is_empty() {
    notes.push(format!("cổng {port} đang bận nhưng lsof không cho biết pid → không dọn, đi tiếp cổng sau"));
    return Reclaim { notes, released: false };
  }
  let mut orphans = Vec::new();
  for pid in &pids {
    let command = command_line(*pid).unwrap_or_else(|| "(không đọc được dòng lệnh)".to_string());
    if is_our_host(&command) {
      notes.push(format!("cổng {port}: pid {pid} là host mồ côi của chính app → dọn ({command})"));
      orphans.push(*pid);
    } else {
      notes.push(format!("cổng {port}: pid {pid} là tiến trình LẠ → không giết, đi tiếp cổng sau ({command})"));
    }
  }
  if orphans.is_empty() {
    return Reclaim { notes, released: false };
  }
  for pid in &orphans {
    let _ = terminate_group(*pid, false);
  }
  if wait_release(port, RELEASE_WAIT_MS) {
    notes.push(format!("cổng {port} đã nhả sau SIGTERM cả nhóm"));
    return Reclaim { notes, released: true };
  }
  for pid in &orphans {
    let _ = terminate_group(*pid, true);
  }
  let released = wait_release(port, KILL_WAIT_MS);
  notes.push(format!(
    "cổng {port} {} sau SIGKILL",
    if released { "đã nhả" } else { "vẫn bận" }
  ));
  Reclaim { notes, released }
}

/**
 * Chờ tới khi cổng bind lại được, hoặc hết thời gian.
 * Nhận: `port`; `budget_ms` — thời gian chờ tối đa.
 * Trả: true khi cổng đã nhả.
 */
fn wait_release(port: u16, budget_ms: u64) -> bool {
  let deadline = Instant::now() + Duration::from_millis(budget_ms);
  loop {
    if is_free(port) {
      return true;
    }
    if Instant::now() >= deadline {
      return false;
    }
    std::thread::sleep(Duration::from_millis(100));
  }
}

/**
 * Cổng được chọn cho lượt chạy này.
 */
#[derive(Debug)]
pub struct PortChoice {
  /// Cổng sẽ đưa cho host.
  pub port: u16,
  /// Cổng người dùng yêu cầu, khi phải nhảy sang cổng khác.
  pub moved_from: Option<u16>,
}

/**
 * Chọn cổng, với phép thử "cổng còn trống" và "đòi lại cổng" được TIÊM vào.
 * Nhận: `requested` — cổng người dùng muốn (0 = OS tự cấp); `span` — số cổng thử thêm;
 *      `free` — vị từ "cổng này bind được"; `reclaim` — vị từ "đã dọn được chủ cổng cũ".
 * Trả: {@link PortChoice} khi có cổng dùng được, None khi cả dải đều bận vì tiến trình lạ.
 */
pub fn choose_port(
  requested: u16,
  span: u16,
  free: &dyn Fn(u16) -> bool,
  reclaim: &dyn Fn(u16) -> bool,
) -> Option<PortChoice> {
  if requested == 0 {
    return Some(PortChoice { port: 0, moved_from: None });
  }
  if free(requested) {
    return Some(PortChoice { port: requested, moved_from: None });
  }
  if reclaim(requested) && free(requested) {
    return Some(PortChoice { port: requested, moved_from: None });
  }
  for offset in 1..=span {
    let Some(candidate) = requested.checked_add(offset) else { break };
    if free(candidate) {
      return Some(PortChoice { port: candidate, moved_from: Some(requested) });
    }
  }
  None
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::collections::HashSet;

  /// Vị từ "chỉ những cổng này còn trống".
  fn free_only(ports: Vec<u16>) -> impl Fn(u16) -> bool {
    let set: HashSet<u16> = ports.into_iter().collect();
    move |candidate: u16| set.contains(&candidate)
  }

  #[test]
  fn a_free_requested_port_is_used_as_is() {
    let choice = choose_port(55907, 10, &free_only(vec![55907]), &|_port| false).expect("phải chọn được");
    assert_eq!(choice.port, 55907);
    assert_eq!(choice.moved_from, None);
  }

  #[test]
  fn an_orphan_host_on_the_requested_port_is_reclaimed_in_place() {
    // 55907 bận nhưng chủ cổng là host mồ côi của chính app ⇒ dọn rồi vẫn dùng 55907.
    let choice = choose_port(55907, 10, &free_only(vec![55907]), &|port| port == 55907).expect("phải chọn được");
    assert_eq!(choice.port, 55907);
    assert_eq!(choice.moved_from, None);
  }

  #[test]
  fn a_foreign_owner_pushes_the_choice_to_the_next_free_port() {
    let choice = choose_port(55907, 10, &free_only(vec![55909]), &|_port| false).expect("phải chọn được");
    assert_eq!(choice.port, 55909);
    assert_eq!(choice.moved_from, Some(55907));
  }

  #[test]
  fn a_full_range_reports_failure_instead_of_guessing() {
    assert!(choose_port(55907, 10, &free_only(vec![]), &|_port| false).is_none());
    assert_eq!(choose_port(55917, 10, &free_only(vec![55917]), &|_port| false).map(|c| c.port), Some(55917));
  }

  #[test]
  fn port_zero_means_os_assigned_and_never_probes() {
    assert_eq!(choose_port(0, 10, &|_port| false, &|_port| false).map(|c| c.port), Some(0));
  }

  #[test]
  fn pid_lists_are_tolerant_of_blank_lines() {
    assert_eq!(parse_pids("123\n\n456\n"), vec![123, 456]);
    assert_eq!(parse_pids(""), Vec::<u32>::new());
  }

  #[test]
  fn the_harness_child_holding_the_port_is_recognised() {
    // lsof trả về NODE (con của wrapper); nếu chỉ khớp "apps/cli/src/main.ts host" thì host mồ côi bị đọc
    // thành tiến trình lạ và app nhảy sang 55908 vô ích.
    let node = "/Users/dev/.nvm/versions/node/v26.9.0/bin/node /Users/dev/repo/apps/host/node_modules/@deepseek-ai/dsh/lib/bin.js --profile blackhole --patch /Users/dev/.app.patch.yml --no-open --host 127.0.0.1 --port 55907";
    assert!(is_our_host(node));
    // `blackhole web` (55906) là CLI khác — không được nhận nhầm.
    assert!(!is_our_host("/usr/local/bin/node /Users/dev/galaxy-code/dist/cli.js web --port 55906"));
  }

  #[test]
  fn our_host_is_recognised_by_entry_and_subcommand() {
    let ours = "/usr/local/bin/node --experimental-strip-types /Users/dev/repo/apps/cli/src/main.ts host --port 55907";
    assert!(is_our_host(ours));
    assert!(!is_our_host("/usr/bin/node /Users/dev/other/index.js"));
    assert!(!is_our_host("/Applications/Galaxy Blackhole (Preview).app/Contents/MacOS/blackhole-desktop"));
    // Một host 5439 của người khác vẫn "là host của app", nhưng ta chỉ hỏi cổng 55907..55917 nên không chạm.
    assert!(is_our_host("/usr/local/bin/node --experimental-strip-types /Users/dev/repo/apps/cli/src/main.ts host --port 5439"));
  }
}