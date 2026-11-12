/*
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Vỏ Tauri: dựng cửa sổ ẨN trước, spawn host bằng đường dẫn tuyệt đối trong process group riêng, chỉ
 *      hiện cửa sổ khi trang host nạp xong — hết giờ thì hiện splash có trạng thái, hỏng thì hiện lỗi tiếng
 *      Việt kèm nút "Thử lại", không bao giờ để cửa sổ trắng và không thoát im lặng
 *      11/11/2026: cổng mặc định 55907; cổng bận thì dọn host mồ côi của chính app rồi mới đi tiếp
 *      55908..55917; log ra ~/Library/Logs/Galaxy Blackhole/desktop-<cổng>.log để mở từ Finder vẫn đọc được;
 *      host bị dọn theo cả nhóm khi cửa sổ đóng, khi app thoát, khi panic và khi bị kill
 *      11/11/2026: snapshot() gửi thêm "recent" (log host gần nhất) — màn hình chờ chỉ còn MỘT dòng trạng
 *      thái, toàn bộ log/mốc thô chuyển vào khung "Chi tiết" của trang splash
 */
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! The Tauri shell for Galaxy Blackhole Desktop.
//!
//! Ba bệnh đã đo (11/11/2026) và cách sửa ở đây:
//!
//! 1. **Mở từ Finder thì app chết im lặng.** LaunchServices đặt cwd = `/` và PATH tối thiểu, nên cách giải
//!    lệnh cũ không tìm ra runtime/entry. Nay mọi đường dẫn đều
//!    tuyệt đối (xem `host_command`) và tiến trình con nhận PATH mở rộng; không giải được thì hiện cửa sổ
//!    lỗi tiếng Việt kèm danh sách đã thử, không thoát im lặng.
//! 2. **Host con mồ côi.** Host được spawn trong process group riêng và cả nhóm bị dọn khi app thoát
//!    (xem `host_proc`); cổng bận vì host của chính app thì dọn rồi bind lại (xem `ports`).
//! 3. **Cửa sổ trắng.** Cửa sổ tạo với `visible(false)` và chỉ hiện khi `on_page_load` báo đúng URL của host;
//!    hết {@link SPLASH_REVEAL_MS} mà chưa có host thì hiện splash kèm trạng thái "Đang chờ host…"; quá
//!    {@link HOST_WAIT_MS} hoặc spawn hỏng thì hiện khối lỗi có nút "Thử lại".
//!
//! `--smoke` vẫn in một dòng JSON các mốc khi trang host nạp xong, rồi thoát.

mod bridge;
mod host_command;
mod host_proc;
mod logfile;
mod ports;

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::ChildStdout;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};

use tauri::Manager;

use host_command::HostEnv;

/// Port the host listens on unless the environment overrides it.
///
/// 11/11/2026 (Lead): 5439 → **55907**. Hai lý do: (a) app desktop và `blackhole web` (55906) phải chạy
/// SONG SONG được, (b) 5439 là host dùng chung của Lead nên app không được chiếm. Đổi cổng KHÔNG đổi
/// identifier `com.galaxyblackhole.desktop` hay home `~/.galaxy/blackhole`; file ready của app là
/// `ready-url-55907.txt`.
const DEFAULT_PORT: u16 = 55907;

/// How many consecutive ports the shell tries before it gives up: 55907 → 55917.
const PORT_SCAN_SPAN: u16 = 10;

/// How long the shell waits for the host's URL marker before showing the error window.
///
/// 10/11/2026 (Lead): nâng 45 s → 120 s. Máy dev đo được boot host **37,9–38,0 s** khi đang tải nặng, nên
/// 45 s quá sát ngưỡng. Chờ rộng tay hơn là đổi sang trạng thái sai.
const HOST_WAIT_MS: u64 = 120_000;

/// Bao lâu thì hiện splash thay vì để app vô hình.
///
/// Một cửa sổ ẩn 40 s bị người dùng đọc là "app không mở". Splash nền tối kèm dòng trạng thái không phải
/// "cửa sổ trắng", nên hiện nó sớm là lựa chọn đúng — và đúng yêu cầu: hết thời gian chờ mà vẫn còn splash
/// thì hiện splash kèm "Đang chờ host…".
const SPLASH_REVEAL_MS: u64 = 6_000;

/// Nếu đã điều hướng sang host mà webview không báo nạp xong, vẫn phải hiện cửa sổ.
const NAVIGATE_FALLBACK_MS: u64 = 15_000;

/// Watchdog cho `--smoke`: phải dài hơn ngân sách host cộng một lần nạp trang.
const SMOKE_WATCHDOG_MS: u64 = HOST_WAIT_MS + 30_000;

/// Nhịp hỏi lại trạng thái host khi đang chờ URL.
const TICK_MS: u64 = 200;

/// Giãn cách tối thiểu giữa hai lần đẩy trạng thái vào splash (log host có thể dày).
const PAINT_EVERY_MS: u64 = 400;

/// Số dòng log host gần nhất giữ lại để đưa vào cửa sổ lỗi.
const KEEP_LINES: usize = 12;

/// Pha của một lượt boot, đúng thứ tự người dùng đi qua.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Phase {
  /// Đang chọn cổng.
  Selecting,
  /// Đang giải runtime Node + gốc host + entry CLI.
  Starting,
  /// Đã spawn host, đang chờ marker URL.
  Waiting,
  /// Đã có URL host.
  Ready,
  /// Đã bỏ cuộc; `BootState::failure` nói vì sao.
  Failed,
}

impl Phase {
  /// Tên pha để trang splash biết đang ở đâu.
  fn as_str(self) -> &'static str {
    match self {
      Phase::Selecting => "selecting",
      Phase::Starting => "starting",
      Phase::Waiting => "waiting",
      Phase::Ready => "ready",
      Phase::Failed => "failed",
    }
  }
}

/// Một lần hỏng: tiêu đề tiếng Việt, lý do, và mọi thứ đã thử.
struct Failure {
  /// Tiêu đề người dùng đọc, ví dụ "Không tìm thấy node hoặc gốc host".
  title: String,
  /// Một câu lý do.
  reason: String,
  /// Danh sách đường dẫn/ghi chú đã thử — chính là thứ biến lỗi thành hành động được.
  details: Vec<String>,
}

/// Toàn bộ trạng thái một lượt boot, đọc được từ cả luồng boot lẫn lệnh IPC.
struct BootState {
  /// Cổng người vận hành yêu cầu.
  requested: u16,
  /// Cổng đang phục vụ (bằng `requested` khi không phải nhảy).
  port: u16,
  /// `http://127.0.0.1:<cổng>` — tiền tố nhận diện "URL của host".
  base: String,
  /// Tệp log của lượt này.
  log_path: PathBuf,
  /// Pha hiện tại.
  phase: Phase,
  /// Dòng trạng thái chính trên splash.
  status: String,
  /// Dòng chi tiết (log host gần nhất, hoặc đường dẫn node/host).
  detail: String,
  /// Ghi chú chọn cổng (đã dọn host mồ côi nào, cổng nào bị tiến trình lạ giữ).
  notes: Vec<String>,
  /// Các đường đã thử khi giải node/host.
  attempts: Vec<String>,
  /// Lỗi, khi `phase` là {@link Phase::Failed}.
  failure: Option<Failure>,
  /// Pid host đang chạy.
  host_pid: Option<u32>,
  /// URL có token của host.
  url: Option<String>,
  /// Cửa sổ đã được hiện chưa (để luồng hiện splash không hiện lại lần nữa).
  shown: bool,
  /// Vài dòng log host gần nhất, để cửa sổ lỗi nói được host đã làm gì.
  recent: Vec<String>,
  /// Mốc bắt đầu lượt này (dùng cho `elapsedMs`).
  started: Instant,
}

impl BootState {
  /**
   * Trạng thái ban đầu của một lượt boot.
   * Nhận: `requested` — cổng yêu cầu; `started` — mốc bắt đầu; `log_path` — tệp log.
   * Trả: {@link BootState} ở pha {@link Phase::Selecting}.
   */
  fn new(requested: u16, started: Instant, log_path: PathBuf) -> Self {
    BootState {
      requested,
      port: requested,
      base: String::new(),
      log_path,
      phase: Phase::Selecting,
      status: "Đang khởi động…".to_string(),
      detail: "Đang nạp plugin…".to_string(),
      notes: Vec::new(),
      attempts: Vec::new(),
      failure: None,
      host_pid: None,
      url: None,
      shown: false,
      recent: Vec::new(),
      started,
    }
  }

  /**
   * Đưa trạng thái về đầu lượt, giữ cổng đã yêu cầu và cửa sổ đang hiện.
   * Nhận: không.
   * Trả: không.
   */
  fn reset(&mut self) {
    self.phase = Phase::Selecting;
    self.failure = None;
    self.attempts.clear();
    self.notes.clear();
    self.host_pid = None;
    self.url = None;
    self.recent.clear();
    self.status = "Đang thử lại…".to_string();
    self.detail = "Đang nạp plugin…".to_string();
    self.started = Instant::now();
  }

  /**
   * Ghi nhớ một dòng log host, giữ tối đa {@link KEEP_LINES} dòng.
   * Nhận: `line` — dòng vừa đọc từ host.
   * Trả: không.
   */
  fn remember(&mut self, line: &str) {
    self.recent.push(line.to_string());
    while self.recent.len() > KEEP_LINES {
      self.recent.remove(0);
    }
  }
}

/// Nguồn dữ liệu dùng chung giữa các lệnh IPC và luồng boot.
struct Shell {
  /// Trạng thái boot.
  state: Mutex<BootState>,
  /// Có phải lượt chạy `--smoke` không.
  smoke: bool,
}

/**
 * Khoá trạng thái, chịu được mutex bị poison.
 * Nhận: `shell` — nguồn dùng chung.
 * Trả: guard tới {@link BootState}.
 */
fn lock_state(shell: &Shell) -> MutexGuard<'_, BootState> {
  shell.state.lock().unwrap_or_else(|poison| poison.into_inner())
}

/// Marks recorded during a launch; `--smoke` prints them as one JSON line.
#[derive(Default)]
struct Marks {
  /// When the process started; every mark is an offset from here in milliseconds.
  started: Option<Instant>,
  /// When the host URL was known (or when the shell gave up waiting).
  host_ms: u128,
  /// When the window was created.
  window_ms: u128,
  /// When the host page finished loading in the webview.
  loaded_ms: u128,
  /// Whether the authenticated URL marker was found. A smoke run without it is not evidence.
  token_found: bool,
  /// So node trong DOM ma WEBVIEW CUA NGUOI DUNG da render.
  nodes: u32,
  /// Trang co `__DSH_BOOT__` trong webview khong.
  booted: bool,
  /// `nodes` co PHAI la so do that khong; khi khong, `nodes: 0` chi la gia tri mac dinh.
  nodes_measured: bool,
}

/**
 * Reads an environment variable, falling back when it is unset or empty.
 * @param key - tên biến.
 * @param fallback - giá trị dùng khi biến trống.
 * @returns giá trị của biến, hoặc `fallback`.
 */
fn env_or(key: &str, fallback: &str) -> String {
  match std::env::var(key) {
    Ok(value) if !value.is_empty() => value,
    _ => fallback.to_string(),
  }
}

/**
 * Cổng người vận hành yêu cầu, kèm nguồn đã đọc.
 *
 * `GBH_DESKTOP_PORT` là tên CHUẨN từ 11/11/2026; `GBH_PORT` giữ lại cho các script cũ (`smoke`, `dev`).
 * Giá trị rác KHÔNG bị bỏ qua im lặng: in cảnh báo rồi dùng cổng mặc định.
 * @returns (cổng, nguồn) — nguồn là "mac dinh" · "GBH_DESKTOP_PORT" · "GBH_PORT".
 */
fn requested_port() -> (u16, &'static str) {
  for key in ["GBH_DESKTOP_PORT", "GBH_PORT"] {
    let Ok(value) = std::env::var(key) else { continue };
    let trimmed = value.trim();
    if trimmed.is_empty() {
      continue;
    }
    return match trimmed.parse::<u16>() {
      Ok(port) => (port, if key == "GBH_DESKTOP_PORT" { "GBH_DESKTOP_PORT" } else { "GBH_PORT" }),
      Err(_) => {
        logfile::line("shell", &format!("{key}={trimmed} khong phai so cong hop le — dung mac dinh {DEFAULT_PORT}"));
        (DEFAULT_PORT, "mac dinh")
      }
    };
  }
  (DEFAULT_PORT, "mac dinh")
}

/**
 * Tìm URL có token trong một dòng log của host.
 * Nhận: `line` — dòng vừa đọc; `base` — `http://127.0.0.1:<cổng>` để ghép khi dòng chỉ có đường dẫn.
 * Trả: URL đầy đủ, None khi dòng không có marker `?token=`.
 */
fn extract_url(line: &str, base: &str) -> Option<String> {
  let index = line.find("?token=")?;
  // Đường dẫn tuyệt đối thì cắt từ "http"; dòng chỉ có đường dẫn tương đối thì cắt từ dấu '/' cuối cùng
  // trước marker — nếu không, tiền tố log ("[bh] ready ") sẽ dính vào URL và cửa sổ điều hướng vào hư không.
  let start = match line[..index].rfind("http") {
    Some(position) => position,
    None => line[..index].rfind('/').unwrap_or(index),
  };
  let mut url = line[start..].trim().to_string();
  if !url.starts_with("http") {
    url = format!("{base}{url}");
  }
  Some(url)
}

/**
 * Gói trạng thái gửi cho trang splash và cho lệnh `boot_status`.
 * Nhận: `shell` — nguồn dùng chung.
 * Trả: JSON với pha, trạng thái, chi tiết, cổng, log, vài dòng log host gần nhất, và khối lỗi khi có.
 */
fn snapshot(shell: &Shell) -> serde_json::Value {
  let state = lock_state(shell);
  let failure = state.failure.as_ref().map(|failure| {
    serde_json::json!({
      "title": failure.title,
      "reason": failure.reason,
      "details": failure.details,
    })
  });
  serde_json::json!({
    "phase": state.phase.as_str(),
    "status": state.status,
    "detail": state.detail,
    "port": state.port,
    "requestedPort": state.requested,
    "elapsedMs": state.started.elapsed().as_millis() as u64,
    "logPath": state.log_path.display().to_string(),
    "hostPid": state.host_pid,
    "url": state.url,
    "notes": state.notes,
    "attempts": state.attempts,
    // 11/11/2026: vài dòng log host gần nhất — khung "Chi tiết" của splash cuộn được chúng, còn mặt
    // trước chỉ có MỘT dòng trạng thái (trước đây chính những dòng này bị in thô ra màn hình chờ).
    "recent": state.recent,
    "failure": failure,
  })
}

/**
 * Đẩy trạng thái hiện tại vào cửa sổ; khi có lỗi thì hiện cửa sổ luôn.
 * Nhận: `app` — handle ứng dụng; `shell` — nguồn dùng chung.
 * Trả: không.
 */
fn render(app: &tauri::AppHandle, shell: &Shell) {
  let Some(window) = app.get_webview_window("main") else { return };
  let payload = snapshot(shell);
  bridge::eval_state(&window, &payload);
  let failed = lock_state(shell).failure.is_some();
  if failed {
    if let Err(error) = window.show() {
      logfile::line("shell", &format!("không hiện được cửa sổ lỗi: {error}"));
    }
    let _ = window.set_focus();
    lock_state(shell).shown = true;
  }
}

/**
 * Đánh dấu cửa sổ đã hiện, để luồng hiện splash thôi chờ.
 * Nhận: `shell` — nguồn dùng chung.
 * Trả: không.
 */
fn mark_shown(shell: &Shell) {
  lock_state(shell).shown = true;
}

/**
 * Ghi một lần hỏng vào trạng thái và log.
 * Nhận: `shell`; `title`; `reason`; `details` — mọi thứ đã thử.
 * Trả: không.
 */
fn fail(shell: &Shell, title: &str, reason: &str, details: Vec<String>) {
  logfile::line("shell", &format!("LỖI: {title} — {reason}"));
  for detail in &details {
    logfile::line("shell", &format!("  đã thử: {detail}"));
  }
  let mut state = lock_state(shell);
  state.phase = Phase::Failed;
  state.status = title.to_string();
  state.detail = reason.to_string();
  state.failure = Some(Failure { title: title.to_string(), reason: reason.to_string(), details });
}

/**
 * Như {@link fail}, nhưng tự ghép danh sách "đã thử" từ trạng thái hiện tại.
 * Nhận: `shell`; `title`; `reason`; `extra` — các mục thêm vào đầu danh sách.
 * Trả: không.
 */
fn fail_from_state(shell: &Shell, title: &str, reason: &str, extra: Vec<String>) {
  let details = {
    let state = lock_state(shell);
    let mut details = extra;
    details.push(format!("log: {}", state.log_path.display()));
    details.push(format!("cổng: {}", state.port));
    if let Some(pid) = state.host_pid {
      details.push(format!("pid host: {pid}"));
    }
    for line in state.recent.iter().rev().take(5) {
      details.push(format!("host: {line}"));
    }
    details.extend(state.attempts.iter().cloned());
    details
  };
  fail(shell, title, reason, details);
}

/**
 * Đọc stdout của host và chuyển từng dòng về luồng boot.
 * Nhận: `stdout` — ống của host; `sender` — kênh nhận dòng.
 * Trả: không (kết thúc khi host đóng ống).
 */
fn pump(stdout: ChildStdout, sender: mpsc::Sender<String>) {
  let mut reader = BufReader::new(stdout);
  let mut raw = String::new();
  loop {
    raw.clear();
    match reader.read_line(&mut raw) {
      Ok(0) | Err(_) => return,
      Ok(_) => {
        if sender.send(raw.clone()).is_err() {
          return;
        }
      }
    }
  }
}

/**
 * Một lượt boot: chọn cổng → giải node/host → spawn host → chờ URL → điều hướng.
 * Nhận: `app` — handle ứng dụng; `shell` — nguồn dùng chung; `marks` — mốc cho `--smoke`.
 * Trả: không (mọi kết cục đều nằm trong `shell.state`).
 */
fn boot_round(app: tauri::AppHandle, shell: Arc<Shell>, marks: Arc<Mutex<Marks>>) {
  let (requested, source) = requested_port();
  {
    let mut state = lock_state(&shell);
    state.requested = requested;
    state.status = "Đang chọn cổng cho host…".to_string();
    state.detail = format!("cổng yêu cầu {requested} ({source})");
  }
  render(&app, &shell);
  logfile::line("shell", &format!("chọn cổng: yêu cầu {requested} ({source})"));

  let notes = std::cell::RefCell::new(Vec::<String>::new());
  let free = |port: u16| ports::is_free(port);
  let reclaim = |port: u16| {
    let outcome = ports::reclaim_orphan_host(port);
    for note in &outcome.notes {
      logfile::line("shell", note);
    }
    let released = outcome.released;
    notes.borrow_mut().extend(outcome.notes);
    released
  };
  let Some(choice) = ports::choose_port(requested, PORT_SCAN_SPAN, &free, &reclaim) else {
    let last = requested.saturating_add(PORT_SCAN_SPAN);
    let collected = notes.borrow().clone();
    {
      let mut state = lock_state(&shell);
      state.notes = collected.clone();
    }
    fail_from_state(
      &shell,
      "Không còn cổng trống cho host",
      &format!("đã thử {requested}..{last}, cổng nào cũng bị tiến trình khác giữ"),
      collected,
    );
    render(&app, &shell);
    return;
  };
  let port = choice.port;
  let base = format!("http://{}:{port}", ports::LOOPBACK);
  let log_path = logfile::init(port)
    .or_else(logfile::path)
    .unwrap_or_else(|| PathBuf::from("(không ghi được log — kiểm tra ~/Library/Logs)"));
  {
    let mut state = lock_state(&shell);
    state.port = port;
    state.base = base.clone();
    state.log_path = log_path.clone();
    state.notes = notes.borrow().clone();
    state.phase = Phase::Starting;
    state.status = "Đang tìm node và gốc host…".to_string();
    state.detail = format!("cổng {port} · log {}", log_path.display());
  }
  logfile::line("shell", &format!("phục vụ {base} · log {}", log_path.display()));
  if let Some(previous) = choice.moved_from {
    logfile::line("shell", &format!("cổng {previous} bị tiến trình lạ giữ → dùng {port}"));
  }
  render(&app, &shell);

  let env = HostEnv::from_process();
  let resolution = host_command::resolve(&env, &|path| path.exists());
  for attempt in &resolution.attempts {
    logfile::line("shell", attempt);
  }
  let Some(plan) = resolution.plan else {
    let reason = resolution.failure.unwrap_or_else(|| "không dò được node hoặc gốc host".to_string());
    {
      let mut state = lock_state(&shell);
      state.attempts = resolution.attempts.clone();
    }
    fail_from_state(&shell, "Không tìm thấy node hoặc gốc host", &reason, resolution.attempts);
    render(&app, &shell);
    if shell.smoke {
      logfile::line("shell", "smoke: không dò được host → thoát");
      host_proc::shutdown();
      std::process::exit(3);
    }
    return;
  };
  // 11/11/2026 — hai dòng BẮT BUỘC để người đọc log biết app đã lấy runtime và host ở đâu:
  // `[shell] node: <path> (nguon: nhung|env|path)` và `[shell] host: <path> (nguon: …)`.
  // `logfile::line("shell", …)` đã tự thêm tiền tố "[shell] " ⇒ thông điệp KHÔNG lặp lại nó.
  logfile::line("shell", &format!("node: {} (nguon: {})", plan.node.display(), plan.node_source));
  logfile::line("shell", &format!("host: {} (nguon: {})", plan.repo.display(), plan.repo_source));
  logfile::line("shell", &format!("entry: {} ({})", plan.cli.display(), plan.cli_source));
  {
    let mut state = lock_state(&shell);
    state.attempts = resolution.attempts.clone();
    state.status = format!("Đang chờ host… (cổng {port})");
    state.detail = format!("node {} · host {}", plan.node.display(), plan.repo.display());
  }
  render(&app, &shell);

  match host_proc::spawn(&plan, port) {
    Ok(pid) => {
      let mut state = lock_state(&shell);
      state.host_pid = Some(pid);
      state.phase = Phase::Waiting;
      state.status = format!("Đang chờ host… (cổng {port})");
      state.detail = format!("pid {pid} · đang boot harness");
    }
    Err(error) => {
      let reason = format!("{} {} không chạy được: {error}", plan.node.display(), plan.cli.display());
      fail_from_state(&shell, "Không khởi động được host", &reason, Vec::new());
      render(&app, &shell);
      if shell.smoke {
        host_proc::shutdown();
        std::process::exit(3);
      }
      return;
    }
  }
  render(&app, &shell);

  let Some(stdout) = host_proc::take_stdout() else {
    fail_from_state(&shell, "Không đọc được đầu ra của host", "ống stdout của host không mở được", Vec::new());
    render(&app, &shell);
    return;
  };
  let (sender, receiver) = mpsc::channel::<String>();
  std::thread::spawn(move || pump(stdout, sender));

  let deadline = Instant::now() + Duration::from_millis(HOST_WAIT_MS);
  let mut found: Option<String> = None;
  let mut exited: Option<i32> = None;
  let mut last_paint = Instant::now();
  loop {
    if Instant::now() >= deadline {
      break;
    }
    match receiver.recv_timeout(Duration::from_millis(TICK_MS)) {
      Ok(raw) => {
        let line = raw.trim_end_matches(['\r', '\n']).to_string();
        if !line.is_empty() {
          logfile::line("host", &line);
          {
            let mut state = lock_state(&shell);
            let port_now = state.port;
            state.remember(&line);
            state.detail = format!("host: {line}");
            state.phase = Phase::Waiting;
            state.status = format!("Đang chờ host… (cổng {port_now})");
          }
          if last_paint.elapsed() >= Duration::from_millis(PAINT_EVERY_MS) {
            render(&app, &shell);
            last_paint = Instant::now();
          }
        }
        if let Some(url) = extract_url(&raw, &base) {
          found = Some(url);
          break;
        }
      }
      Err(RecvTimeoutError::Timeout) => {}
      Err(RecvTimeoutError::Disconnected) => {
        exited = host_proc::poll_exit().or(Some(-1));
        break;
      }
    }
    if let Some(code) = host_proc::poll_exit() {
      exited = Some(code);
      break;
    }
  }

  if let Some(url) = found {
    // Giữ ống stdout của host được đọc tiếp: dòng `[bh] ready <url>` (marker nghiệm thu) và log phiên
    // in NGAY SAU dòng URL, nên dừng đọc ở đây là mất đúng dòng cần đọc. Đây là lỗi đã đo 11/11/2026:
    // log có `gbh web: …?token=` nhưng KHÔNG có `[bh] ready …`.
    std::thread::spawn(move || {
      while let Ok(raw) = receiver.recv() {
        let line = raw.trim_end_matches(['\r', '\n']);
        if !line.is_empty() {
          logfile::line("host", line);
        }
      }
    });
    {
      let mut state = lock_state(&shell);
      state.phase = Phase::Ready;
      state.url = Some(url.clone());
      state.status = "Host đã sẵn sàng — đang mở giao diện".to_string();
      state.detail = url.clone();
    }
    logfile::line("shell", &format!("port {port} - token found · {url}"));
    if let Ok(mut held) = marks.lock() {
      held.host_ms = lock_state(&shell).started.elapsed().as_millis();
      held.token_found = true;
    }
    render(&app, &shell);
    match tauri::Url::parse(&url) {
      Ok(parsed) => {
        if let Some(window) = app.get_webview_window("main") {
          if let Err(error) = window.navigate(parsed) {
            logfile::line("shell", &format!("không điều hướng được sang host: {error}"));
          }
        }
      }
      Err(error) => logfile::line("shell", &format!("URL host không hợp lệ ({error}): {url}")),
    }
    let fallback_app = app.clone();
    let fallback_shell = shell.clone();
    std::thread::spawn(move || {
      std::thread::sleep(Duration::from_millis(NAVIGATE_FALLBACK_MS));
      if lock_state(&fallback_shell).shown {
        return;
      }
      logfile::line("shell", "trang host không báo nạp xong → vẫn hiện cửa sổ để không treo im lặng");
      if let Some(window) = fallback_app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
      }
      mark_shown(&fallback_shell);
    });
    return;
  }

  let (title, reason) = match exited.or_else(host_proc::poll_exit) {
    Some(code) => (
      "Host thoát trước khi sẵn sàng",
      format!("host thoát với mã {code} trước khi in URL `?token=`; xem log để biết nó dừng ở đâu"),
    ),
    None => (
      "Host không sẵn sàng sau 120 giây",
      format!("không thấy URL `?token=` sau {} giây; host vẫn chạy nên có thể chỉ chậm", HOST_WAIT_MS / 1000),
    ),
  };
  fail_from_state(&shell, title, &reason, Vec::new());
  render(&app, &shell);
  if shell.smoke {
    logfile::line("shell", &format!("smoke: {reason} → thoát"));
    host_proc::shutdown();
    std::process::exit(3);
  }
}

/**
 * Luồng hiện splash: hết {@link SPLASH_REVEAL_MS} mà host chưa sẵn sàng thì hiện cửa sổ có trạng thái.
 * Nhận: `app` — handle ứng dụng; `shell` — nguồn dùng chung.
 * Trả: không.
 */
fn spawn_reveal(app: tauri::AppHandle, shell: Arc<Shell>) {
  std::thread::spawn(move || loop {
    std::thread::sleep(Duration::from_millis(500));
    let (elapsed_ms, shown, failed) = {
      let state = lock_state(&shell);
      (state.started.elapsed().as_millis() as u64, state.shown, state.failure.is_some())
    };
    if failed {
      render(&app, &shell);
      return;
    }
    if shown {
      return;
    }
    if elapsed_ms >= SPLASH_REVEAL_MS {
      logfile::line(
        "shell",
        &format!("host chưa sẵn sàng sau {SPLASH_REVEAL_MS} ms → hiện splash (không để cửa sổ trắng)"),
      );
      render(&app, &shell);
      if let Some(window) = app.get_webview_window("main") {
        if let Err(error) = window.show() {
          logfile::line("shell", &format!("không hiện được cửa sổ: {error}"));
        }
        let _ = window.set_focus();
      }
      mark_shown(&shell);
      return;
    }
  });
}

/**
 * Xử lý một lần trang nạp xong trong webview.
 * Nhận: `window`; `url` — URL vừa nạp; `shell`; `marks`.
 * Trả: không.
 */
fn handle_page_load(window: &tauri::WebviewWindow, url: &str, shell: &Arc<Shell>, marks: &Arc<Mutex<Marks>>) {
  let (is_host, failed) = {
    let state = lock_state(shell);
    (!state.base.is_empty() && url.starts_with(&state.base), state.failure.is_some())
  };
  if is_host {
    logfile::line("shell", &format!("trang host đã nạp xong: {url}"));
    if let Ok(mut held) = marks.lock() {
      if held.loaded_ms == 0 {
        held.loaded_ms = held.started.map(|value| value.elapsed().as_millis()).unwrap_or(0);
      }
    }
    let _ = window.show();
    let _ = window.set_focus();
    mark_shown(shell);
    if shell.smoke {
      // Do DOM tren TRANG DICH truoc khi bao: script smoke co the khong bao gio chay tren trang host,
      // nen eval tu Rust moi chac chan do dung trang.
      let _ = window.eval(PROBE_SCRIPT);
      std::thread::sleep(Duration::from_millis(800));
      report_and_exit(marks, "page:finished");
    }
    return;
  }
  logfile::line("shell", &format!("splash đã nạp: {url}"));
  if failed {
    let app = window.app_handle().clone();
    render(&app, shell);
  }
}

/**
 * In các mốc của lượt `--smoke` thành một dòng JSON, dọn host, rồi thoát.
 * Nhận: `marks` — các mốc; `outcome` — kết cục ngắn.
 * Trả: không (không quay lại).
 */
fn report_and_exit(marks: &Arc<Mutex<Marks>>, outcome: &str) {
  let held = match marks.lock() {
    Ok(guard) => guard,
    Err(_) => return,
  };
  let at = held.started.map(|value| value.elapsed().as_millis()).unwrap_or(0);
  let report = serde_json::json!({
    "platform": "tauri",
    "outcome": outcome,
    "tokenFound": held.token_found,
    "nodes": if held.nodes_measured { serde_json::json!(held.nodes) } else { serde_json::Value::Null },
    "nodesMeasured": held.nodes_measured,
    "booted": held.booted,
    "marks": [
      { "name": "host", "at": held.host_ms },
      { "name": "window", "at": held.window_ms },
      { "name": "page:loaded", "at": held.loaded_ms },
      { "name": "smoke:done", "at": at },
    ],
  });
  println!("{report}");
  let _ = std::io::stdout().flush();
  host_proc::shutdown();
  std::thread::sleep(Duration::from_millis(1200));
  std::process::exit(0);
}

/// Command kept for pages that can reach the IPC bridge; reports boot state and exits.
#[tauri::command]
fn smoke_report(state: tauri::State<'_, Arc<Mutex<Marks>>>, booted: bool, nodes: u32) {
  if let Ok(mut held) = state.lock() {
    held.nodes = nodes;
    held.booted = booted;
    held.nodes_measured = true;
  }
  let outcome = if booted { format!("boot:booted nodes:{nodes}") } else { format!("boot:no-boot nodes:{nodes}") };
  report_and_exit(state.inner(), &outcome);
}

/**
 * Trả trạng thái boot cho trang splash (dùng khi trang nạp lại và mất lần `eval` trước).
 * Nhận: `shell` — nguồn dùng chung.
 * Trả: cùng hình dạng JSON với {@link snapshot}.
 */
#[tauri::command]
fn boot_status(shell: tauri::State<'_, Arc<Shell>>) -> serde_json::Value {
  snapshot(shell.inner())
}

/**
 * Chạy lại một lượt boot sau khi người dùng bấm "Thử lại".
 * Nhận: `app`; `shell`.
 * Trả: không (lượt boot chạy ở thread riêng).
 */
#[tauri::command]
fn retry_boot(app: tauri::AppHandle, shell: tauri::State<'_, Arc<Shell>>) {
  let shared = shell.inner().clone();
  let busy = {
    let state = lock_state(&shared);
    matches!(state.phase, Phase::Selecting | Phase::Starting | Phase::Waiting)
  };
  if busy {
    return;
  }
  logfile::line("shell", "người dùng bấm 'Thử lại'");
  if let Some(window) = app.get_webview_window("main") {
    bridge::reset(&window);
  }
  {
    let mut state = lock_state(&shared);
    state.reset();
  }
  render(&app, &shared);
  let retry_marks = Arc::new(Mutex::new(Marks { started: Some(Instant::now()), ..Marks::default() }));
  std::thread::spawn(move || boot_round(app, shared, retry_marks));
}

/**
 * Thoát app theo yêu cầu của trang lỗi.
 * Nhận: `app`.
 * Trả: không.
 */
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
  logfile::line("shell", "người dùng bấm 'Thoát'");
  host_proc::shutdown();
  app.exit(0);
}

/// Do DOM tren TRANG DICH (sau khi vo dieu huong), roi bao qua cau IPC.
const PROBE_SCRIPT: &str = r#"
(function () {
  var nodes = document.querySelectorAll("*").length;
  var booted = !!(window.__DSH_BOOT__ || window.__GBH_BOOT__);
  var b = window.__TAURI_INTERNALS__;
  if (b && b.invoke) { b.invoke("smoke_report", { booted: booted, nodes: nodes }); }
})();
"#;

/// Runs in every page before its own scripts: reports boot state once when the IPC bridge is reachable.
const SMOKE_SCRIPT: &str = r#"
(function poll() {
  var booted = !!(window.__DSH_BOOT__ || window.__GBH_BOOT__);
  var nodes = document.querySelectorAll('*').length;
  var bridge = window.__TAURI_INTERNALS__ || (window.__TAURI__ && window.__TAURI__.core);
  if ((booted || nodes > 120) && bridge) {
    bridge.invoke('smoke_report', { booted: booted, nodes: nodes }).catch(function () { setTimeout(poll, 100); });
    return;
  }
  setTimeout(poll, 50);
})();
"#;

/**
 * Entry point: dựng app + cửa sổ ẩn, rồi giao việc boot host cho một thread.
 *
 * 11/11/2026: phần chờ host được đưa RA KHỎI luồng chính. Trước đây `read_host_url` chặn luồng chính tới
 * 120 s trước khi cửa sổ tồn tại, nên người dùng chỉ thấy một app "không mở". Nay cửa sổ có ngay, trạng thái
 * chảy vào splash, và mọi kết cục đều nhìn thấy được.
 */
fn main() {
  let started = Instant::now();
  let smoke = std::env::args().any(|arg| arg == "--smoke");
  let (requested, source) = requested_port();
  let log_path = logfile::init(requested).unwrap_or_else(|| PathBuf::from("(không ghi được log — kiểm tra ~/Library/Logs)"));
  let cwd = std::env::current_dir().map(|path| path.display().to_string()).unwrap_or_else(|_| "?".to_string());
  logfile::line(
    "shell",
    &format!("Galaxy Blackhole Desktop v{} · pid {} · cwd {cwd}", env!("CARGO_PKG_VERSION"), std::process::id()),
  );
  logfile::line("shell", &format!("cổng yêu cầu {requested} ({source}) · log {}", log_path.display()));
  logfile::line("shell", &format!("HOME={} · PATH={}", env_or("HOME", "(trống)"), env_or("PATH", "(trống)")));
  host_proc::install_signal_handlers();
  host_proc::install_panic_hook();
  let _guard = host_proc::HostGuard;

  let shell = Arc::new(Shell { state: Mutex::new(BootState::new(requested, started, log_path)), smoke });
  let marks = Arc::new(Mutex::new(Marks { started: Some(started), ..Marks::default() }));

  let builder = tauri::Builder::default()
    .manage(shell.clone())
    .manage(marks.clone())
    .invoke_handler(tauri::generate_handler![smoke_report, boot_status, retry_boot, quit_app])
    .setup(move |app| {
      let handle = app.handle().clone();
      {
        let page_shell = shell.clone();
        let page_marks = marks.clone();
        tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
          .title("Galaxy Blackhole (Preview)")
          .inner_size(1280.0, 860.0)
          .min_inner_size(880.0, 620.0)
          .visible(false)
          .initialization_script(SMOKE_SCRIPT)
          .on_page_load(move |window, payload| {
            if !matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
              return;
            }
            let url = payload.url().as_str().to_string();
            handle_page_load(&window, &url, &page_shell, &page_marks);
          })
          .build()?;
      }
      if let Ok(mut held) = marks.lock() {
        held.window_ms = started.elapsed().as_millis();
      }
      spawn_reveal(handle.clone(), shell.clone());
      let boot_shell = shell.clone();
      let boot_marks = marks.clone();
      std::thread::spawn(move || boot_round(handle, boot_shell, boot_marks));
      if smoke {
        // Watchdog của `--smoke`: một lượt đo không được phép treo mãi, và không được để lại host.
        std::thread::spawn(move || {
          std::thread::sleep(Duration::from_millis(SMOKE_WATCHDOG_MS));
          logfile::line("shell", "smoke: quá hạn chờ → dọn host và thoát");
          host_proc::shutdown();
          std::process::exit(3);
        });
      }
      Ok(())
    });
  let app = match builder.build(tauri::generate_context!()) {
    Ok(app) => app,
    Err(error) => {
      logfile::line("shell", &format!("KHÔNG dựng được ứng dụng Tauri: {error}"));
      host_proc::shutdown();
      std::process::exit(1);
    }
  };
  app.run(move |handle, event| match event {
    tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. } => host_proc::shutdown(),
    tauri::RunEvent::WindowEvent { event: tauri::WindowEvent::CloseRequested { .. }, .. } => {
      logfile::line("shell", "cửa sổ chính đóng → dọn host rồi thoát app");
      host_proc::shutdown();
      handle.exit(0);
    }
    _ => {}
  });
}

#[cfg(test)]
mod boot_tests;
