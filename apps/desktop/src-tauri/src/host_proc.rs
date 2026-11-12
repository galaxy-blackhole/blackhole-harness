/*
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Spawn host thành process group riêng và dọn CẢ NHÓM đúng một lần khi app thoát (SIGTERM → 3s → SIGKILL)
 */

//! Vòng đời tiến trình host của vỏ desktop.
//!
//! Hai lỗi có thật, cùng một gốc (11/11/2026):
//!
//! 1. Host con sống lâu hơn app. Máy dev đã thấy 3 tiến trình cùng listen 55906 và 2 cùng 55907; lượt mở
//!    sau gặp cổng bận rồi thoát. Vì vậy host được spawn bằng `setpgid` (`process_group(0)`) và khi app
//!    thoát ta gửi SIGTERM tới CẢ NHÓM, chờ tối đa 3 s, rồi SIGKILL.
//! 2. App chết không kịp dọn. `std::process::exit` bỏ qua mọi destructor, và SIGTERM của `kill` giết tiến
//!    trình ngay tại chỗ. Vì vậy có ba đường dọn: `RunEvent::Exit` (thoát bình thường), `HostGuard` (Drop),
//!    và handler SIGTERM/SIGINT/SIGHUP chỉ dùng các hàm async-signal-safe (`kill`, `nanosleep`, `_exit`).
//!
//! Tất cả đi qua một `Once` nên nhóm chỉ bị dọn một lần, dù ba đường cùng chạy.

use std::io::{BufRead, BufReader};
use std::os::unix::process::CommandExt;
use std::process::{Child, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::{Mutex, Once, OnceLock};
use std::time::{Duration, Instant};

use crate::host_command::HostPlan;
use crate::logfile;
use crate::ports;

/// Thời gian chờ host thoát sau SIGTERM trước khi SIGKILL cả nhóm.
pub const TERM_WAIT_MS: u64 = 3_000;

/// Chờ tối đa bao lâu để cổng được nhả sau khi dọn, trước khi app kết thúc.
const PORT_RELEASE_WAIT_MS: u64 = 2_000;

/// Một host đang chạy: tiến trình con, nhóm tiến trình của nó, và cổng nó phục vụ.
struct HostProcess {
  /// Tiến trình node chạy `apps/cli/src/main.ts host`.
  child: Child,
  /// Pid của tiến trình đó, đồng thời là pgid vì nó được spawn bằng `process_group(0)`.
  pid: u32,
  /// Cổng host phục vụ, để chờ cổng nhả sau khi dọn.
  port: u16,
}

/// Ô giữ host duy nhất của tiến trình.
static HOST: OnceLock<Mutex<Option<HostProcess>>> = OnceLock::new();

/// Bảo đảm việc dọn chỉ chạy một lần.
static SHUTDOWN: Once = Once::new();

/// Pgid đang sống, đọc được từ cả signal handler (chỉ một phép nạp nguyên tử).
static HOST_PGID: AtomicI32 = AtomicI32::new(0);

/**
 * Ô giữ host, khởi tạo ở lần gọi đầu.
 * Nhận: không.
 * Trả: tham chiếu tới `Mutex<Option<HostProcess>>` toàn cục.
 */
fn slot() -> &'static Mutex<Option<HostProcess>> {
  HOST.get_or_init(|| Mutex::new(None))
}

/**
 * Spawn host trong một process group riêng, với cwd và PATH tuyệt đối.
 *
 * 11/11/2026 — MỘT runtime: `node <entry> host --port N`. Không còn `bun run`: harness boot bằng native
 * addon `node-addon-require-builtin` (cần symbol V8 của Node) nên bun ném "Unsupported/no-context" ngay
 * ở lượt nạp đầu. Cờ `--experimental-strip-types` chỉ thêm khi entry là `.ts` (bản nhúng chạy mã nguồn
 * TypeScript trực tiếp, không cần bước build).
 * Nhận: `plan` — node + entry + gốc host đã giải; `port` — cổng host phải bind.
 * Trả: pid của host khi spawn được, lỗi io khi node không chạy được.
 */
pub fn spawn(plan: &HostPlan, port: u16) -> std::io::Result<u32> {
  let args = command_line(plan, port);
  let mut command = Command::new(&plan.node);
  command
    .args(&args)
    .current_dir(&plan.repo)
    .env("PATH", &plan.path_env)
    .env("GBH_DESKTOP_PORT", port.to_string())
    // Ghim cả hai biến về đúng runtime + gốc host vừa giải: bên trong host, `bh host` phải dò ra CHÍNH
    // runtime này (không phải bản nào khác trên PATH) và gốc host này (không phải repo của máy dev).
    .env("GBH_NODE", &plan.node)
    .env("GBH_REPO_ROOT", &plan.repo)
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());
  command.process_group(0);
  let mut child = command.spawn()?;
  let pid = child.id();
  HOST_PGID.store(pid as i32, Ordering::SeqCst);
  if let Some(stderr) = child.stderr.take() {
    std::thread::spawn(move || relay(stderr, "host:err"));
  }
  if let Ok(mut held) = slot().lock() {
    *held = Some(HostProcess { child, pid, port });
  }
  logfile::line(
    "shell",
    &format!(
      "spawn host pid {pid} (nhóm {pid}) · cwd {} · {} --experimental-strip-types {} host --port {port}",
      plan.repo.display(),
      plan.node.display(),
      plan.cli.display()
    ),
  );
  Ok(pid)
}

/**
 * Đúng argv đưa cho runtime Node — tách khỏi {@link spawn} để test khoá được hành vi.
 * Nhận: `plan` — node + entry đã giải; `port` — cổng host phải bind.
 * Trả: argv sau tên binary, ví dụ ["--experimental-strip-types", "<cli>", "host", "--port", "55907"].
 */
pub fn command_line(plan: &HostPlan, port: u16) -> Vec<String> {
  let mut args: Vec<String> = Vec::new();
  // Bản nhúng chạy mã nguồn TypeScript trực tiếp; Node >= 22.6 cần cờ này (Node 26 vẫn nhận).
  if plan.cli.extension().is_some_and(|ext| ext == "ts") {
    args.push("--experimental-strip-types".to_string());
  }
  args.push(plan.cli.display().to_string());
  args.push("host".to_string());
  args.push("--port".to_string());
  args.push(port.to_string());
  args
}

/**
 * Chuyển stdout/stderr của host vào log của vỏ, từng dòng.
 * Nhận: `stream` — ống đọc được; `tag` — tiền tố log (`host` hoặc `host:err`).
 * Trả: không (kết thúc khi host đóng ống).
 */
fn relay<R: std::io::Read + Send + 'static>(stream: R, tag: &'static str) {
  let mut reader = BufReader::new(stream);
  let mut raw = String::new();
  loop {
    raw.clear();
    match reader.read_line(&mut raw) {
      Ok(0) | Err(_) => return,
      Ok(_) => {
        let line = raw.trim_end_matches(['\r', '\n']);
        if !line.is_empty() {
          logfile::line(tag, line);
        }
      }
    }
  }
}

/**
 * Lấy ống stdout của host để người gọi tự đọc (đường chờ URL).
 * Nhận: không.
 * Trả: ống stdout, None khi host chưa spawn hoặc đã bị lấy.
 */
pub fn take_stdout() -> Option<ChildStdout> {
  let mut held = slot().lock().ok()?;
  held.as_mut().and_then(|process| process.child.stdout.take())
}

/**
 * Hỏi host đã thoát chưa, không chặn.
 * Nhận: không.
 * Trả: mã thoát khi host đã thoát, None khi còn chạy hoặc chưa spawn.
 */
pub fn poll_exit() -> Option<i32> {
  let mut held = match slot().lock() {
    Ok(guard) => guard,
    Err(_) => return None,
  };
  let process = held.as_mut()?;
  match process.child.try_wait() {
    Ok(Some(status)) => Some(status.code().unwrap_or(-1)),
    Ok(None) => None,
    Err(_) => Some(-1),
  }
}

/**
 * Gửi một tín hiệu tới cả nhóm tiến trình của host.
 * Nhận: `pgid` — mã nhóm; `signal` — SIGTERM hoặc SIGKILL.
 * Trả: không.
 */
fn signal_group(pgid: i32, signal: libc::c_int) {
  if pgid <= 1 {
    return;
  }
  // SAFETY: kill(2) chỉ đọc hai số nguyên; không có bộ nhớ nào bị giải tham chiếu.
  unsafe {
    libc::kill(-pgid, signal);
  }
}

/**
 * Dọn host: SIGTERM cả nhóm, chờ tối đa 3 s, rồi SIGKILL. Chạy đúng một lần cho cả tiến trình.
 * Nhận: không.
 * Trả: không.
 */
pub fn shutdown() {
  SHUTDOWN.call_once(|| {
    let taken = match slot().lock() {
      Ok(mut held) => held.take(),
      Err(_) => None,
    };
    let Some(mut process) = taken else {
      HOST_PGID.store(0, Ordering::SeqCst);
      return;
    };
    HOST_PGID.store(0, Ordering::SeqCst);
    let pid = process.pid;
    let pgid = process.pid as i32;
    let began = Instant::now();
    logfile::line("shell", &format!("dọn host pid {pid} · nhóm {pgid} · cổng {}", process.port));
    signal_group(pgid, libc::SIGTERM);
    let deadline = began + Duration::from_millis(TERM_WAIT_MS);
    // Điều kiện dừng ĐẦU TIÊN là cổng đã nhả: host mồ côi chỉ có nghĩa khi cổng còn bị giữ. Chờ mỗi
    // "tiến trình con đã thoát" có thể dài hơn 3 s (harness đang đóng phiên), mà người dùng chỉ thấy app
    // treo. Vì vậy: nhả cổng là xong, phần còn lại SIGKILL dọn nốt.
    let outcome = loop {
      match process.child.try_wait() {
        Ok(Some(status)) => break format!("host đã thoát ({status}) sau {} ms", began.elapsed().as_millis()),
        Ok(None) => {}
        Err(error) => break format!("không hỏi được trạng thái host: {error}"),
      }
      if ports::is_free(process.port) {
        break format!("cổng {} đã nhả sau {} ms", process.port, began.elapsed().as_millis());
      }
      if Instant::now() >= deadline {
        break format!("host không nhả cổng sau {TERM_WAIT_MS} ms → SIGKILL cả nhóm");
      }
      std::thread::sleep(Duration::from_millis(50));
    };
    logfile::line("shell", &outcome);
    // Tiến trình dẫn đầu chỉ thành zombie khi chưa reaped ⇒ pgid chưa thể bị cấp lại ⇒ lệnh dưới an toàn.
    signal_group(pgid, libc::SIGKILL);
    let _ = process.child.wait();
    let deadline = Instant::now() + Duration::from_millis(PORT_RELEASE_WAIT_MS);
    while Instant::now() < deadline && !ports::is_free(process.port) {
      std::thread::sleep(Duration::from_millis(100));
    }
    logfile::line("shell", &format!("đã dọn xong host pid {pid}"));
  });
}

/**
 * Guard giữ vòng đời dọn host: rơi khỏi `main` là dọn.
 */
pub struct HostGuard;

impl Drop for HostGuard {
  fn drop(&mut self) {
    shutdown();
  }
}

/**
 * Handler cho SIGTERM/SIGINT/SIGHUP.
 * Nhận: `_signal` — số hiệu tín hiệu.
 * Trả: không (tiến trình kết thúc bằng `_exit`).
 */
extern "C" fn on_fatal_signal(_signal: libc::c_int) {
  let pgid = HOST_PGID.load(Ordering::SeqCst);
  // Chỉ các hàm async-signal-safe: kill(2), nanosleep(2), _exit(2). Không cấp phát, không mutex, không log.
  unsafe {
    if pgid > 1 {
      libc::kill(-pgid, libc::SIGTERM);
      let step = libc::timespec { tv_sec: 0, tv_nsec: 100_000_000 };
      let mut waited_ms: u64 = 0;
      while waited_ms < TERM_WAIT_MS {
        if libc::kill(-pgid, 0) != 0 {
          break;
        }
        libc::nanosleep(&step, std::ptr::null_mut());
        waited_ms += 100;
      }
      libc::kill(-pgid, libc::SIGKILL);
    }
    libc::_exit(0);
  }
}

/**
 * Cài handler để `kill <app>` cũng dọn được host.
 * Nhận: không.
 * Trả: không.
 */
pub fn install_signal_handlers() {
  let handler = on_fatal_signal as extern "C" fn(libc::c_int);
  let address = handler as usize as libc::sighandler_t;
  // SAFETY: signal(3) chỉ ghi một con trỏ hàm cho ba tín hiệu; handler không giải tham chiếu bộ nhớ nào.
  unsafe {
    libc::signal(libc::SIGTERM, address);
    libc::signal(libc::SIGINT, address);
    libc::signal(libc::SIGHUP, address);
  }
}

/**
 * Cài panic hook để một panic trong thread phụ vẫn dọn host.
 * Nhận: không.
 * Trả: không.
 */
pub fn install_panic_hook() {
  let default_hook = std::panic::take_hook();
  std::panic::set_hook(Box::new(move |info| {
    logfile::line("shell", &format!("PANIC: {info}"));
    shutdown();
    default_hook(info);
  }));
}



#[cfg(test)]
mod tests {
  use super::*;
  use std::path::PathBuf;

  /**
   * Kế hoạch giả để test argv.
   * Nhận: `cli` — entry CLI.
   * Trả: {@link HostPlan} tối thiểu, mọi đường dẫn tuyệt đối.
   */
  fn plan_with(cli: &str) -> HostPlan {
    HostPlan {
      node: PathBuf::from("/App/Contents/Resources/runtime/node"),
      node_source: "nhung".to_string(),
      cli: PathBuf::from(cli),
      cli_source: "nhung".to_string(),
      repo: PathBuf::from("/App/Contents/Resources/host"),
      repo_source: "nhung".to_string(),
      path_env: "/usr/bin:/bin".to_string(),
    }
  }

  #[test]
  fn the_host_argv_is_node_with_the_strip_types_flag() {
    let plan = plan_with("/App/Contents/Resources/host/apps/cli/src/main.ts");
    assert_eq!(
      command_line(&plan, 55907),
      vec![
        "--experimental-strip-types".to_string(),
        "/App/Contents/Resources/host/apps/cli/src/main.ts".to_string(),
        "host".to_string(),
        "--port".to_string(),
        "55907".to_string()
      ]
    );
  }

  #[test]
  fn a_javascript_entry_gets_no_strip_types_flag() {
    let plan = plan_with("/App/host/dist/host.js");
    assert_eq!(command_line(&plan, 55920), vec!["/App/host/dist/host.js", "host", "--port", "55920"]);
  }
}
