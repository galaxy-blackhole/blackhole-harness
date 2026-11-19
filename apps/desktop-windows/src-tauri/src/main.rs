/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/11/2026
 * desc Vỏ Tauri Windows tối giản: spawn node.exe + host nhúng, chờ URL, điều hướng webview, dọn cây process
 */

use std::env;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::thread;

use tauri::{AppHandle, Manager, RunEvent};

/** Ô giữ tiến trình host duy nhất; cleanup lấy ra và kill cả cây. */
static HOST: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

/**
 * Ô host toàn cục.
 * @returns Mutex chứa child đang chạy.
 */
fn host_slot() -> &'static Mutex<Option<Child>> {
  HOST.get_or_init(|| Mutex::new(None))
}

/**
 * Ghi một dòng log vào %LOCALAPPDATA%\Galaxy Blackhole\logs\desktop.log.
 * @param tag - tiền tố (shell/host/host:err).
 * @param message - nội dung.
 */
fn log(tag: &str, message: &str) {
  let Some(dir) = log_dir() else { return };
  if fs::create_dir_all(&dir).is_err() {
    return;
  }
  if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(dir.join("desktop.log")) {
    let _ = writeln!(file, "[{tag}] {message}");
  }
}

/**
 * Thư mục log Windows: %LOCALAPPDATA%\Galaxy Blackhole\logs (fallback APPDATA).
 * @returns đường dẫn hoặc None khi không có môi trường.
 */
fn log_dir() -> Option<PathBuf> {
  let base = env::var("LOCALAPPDATA").ok().or_else(|| env::var("APPDATA").ok())?;
  Some(PathBuf::from(base).join("Galaxy Blackhole").join("logs"))
}

/**
 * Tìm một thư mục tài nguyên trong gói cài.
 * @param app - handle Tauri.
 * @param name - host hoặc runtime.
 * @returns đường dẫn tồn tại, ưu tiên resources/<name> rồi resources/resources/<name>.
 */
fn resource_dir(app: &AppHandle, name: &str) -> Option<PathBuf> {
  let root = app.path().resource_dir().ok()?;
  for candidate in [root.join(name), root.join("resources").join(name)] {
    if candidate.exists() {
      return Some(candidate);
    }
  }
  None
}

/**
 * Xác định node.exe nhúng (hoặc GBH_NODE khi người vận hành chỉ định).
 * @param app - handle Tauri.
 * @returns đường dẫn node.exe.
 * @throws chuỗi lỗi khi không tìm thấy.
 */
fn node_path(app: &AppHandle) -> Result<PathBuf, String> {
  if let Ok(value) = env::var("GBH_NODE") {
    if !value.trim().is_empty() && Path::new(&value).exists() {
      return Ok(PathBuf::from(value));
    }
  }
  let runtime = resource_dir(app, "runtime").ok_or_else(|| "thiếu resources/runtime (node.exe chưa được đóng gói)".to_string())?;
  for name in ["node.exe", "node"] {
    let candidate = runtime.join(name);
    if candidate.exists() {
      return Ok(candidate);
    }
  }
  Err(format!("không thấy node.exe trong {}", runtime.display()))
}

/**
 * Điều hướng webview sang URL host.
 * @param app - handle Tauri.
 * @param url - URL đã có token.
 */
fn navigate(app: &AppHandle, url: &str) {
  let Some(window) = app.get_webview_window("main") else { return };
  let Ok(encoded) = serde_json::to_string(url) else { return };
  let _ = window.eval(&format!("window.location.replace({encoded});"));
}

/**
 * Hiện lỗi khởi động trong chính cửa sổ (không có terminal trên Windows).
 * @param app - handle Tauri.
 * @param message - lỗi đầy đủ.
 */
fn show_error(app: &AppHandle, message: &str) {
  log("shell", message);
  let Some(window) = app.get_webview_window("main") else { return };
  let html = format!(
    "<div style=\"font:14px/1.6 Segoe UI,sans-serif;color:#e8edf2;background:#0b0d10;padding:28px\"><h2>Galaxy Blackhole không khởi động được</h2><pre style=\"white-space:pre-wrap;color:#fca5a5\">{}</pre></div>",
    message.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
  );
  let Ok(encoded) = serde_json::to_string(&html) else { return };
  let _ = window.eval(&format!("document.body.innerHTML = {encoded};"));
}

/**
 * Tìm URL ready trong một dòng stdout của host.
 * @param line - dòng host in.
 * @returns URL khi có http://127.0.0.1:<port>/?token=….
 */
fn ready_url(line: &str) -> Option<String> {
  let start = line.find("http://127.0.0.1:")?;
  let tail = &line[start..];
  let end = tail.find(char::is_whitespace).unwrap_or(tail.len());
  let url = &tail[..end];
  if url.contains("?token=") {
    Some(url.to_string())
  } else {
    None
  }
}

/**
 * Chạy host nhúng, đọc stdout tới khi ready rồi điều hướng webview.
 * @param app - handle Tauri.
 * @returns Ok khi đã điều hướng; Err khi thiếu tệp hoặc host thoát trước ready.
 */
fn start_host(app: &AppHandle) -> Result<(), String> {
  let host = resource_dir(app, "host").ok_or_else(|| "thiếu resources/host (host harness chưa được đóng gói)".to_string())?;
  let node = node_path(app)?;
  let entry = host.join("apps").join("cli").join("lib").join("main.js");
  if !entry.is_file() {
    return Err(format!("thiếu entry host: {}", entry.display()));
  }
  let home = env::var("USERPROFILE")
    .or_else(|_| env::var("HOME"))
    .map(|value| PathBuf::from(value).join(".galaxy").join("blackhole"))
    .map_err(|_| "không đọc được USERPROFILE/HOME".to_string())?;
  let _ = fs::create_dir_all(&home);
  let mut command = Command::new(&node);
  command
    .arg(&entry)
    .arg("host")
    .arg("--port")
    .arg("0")
    .current_dir(&host)
    .env("GBH_DESKTOP_PORT", "0")
    .env("GBH_NODE", &node)
    .env("GBH_REPO_ROOT", &host)
    .env("GBH_TAURI_ROOT", &host)
    .env("GBH_HOME", &home)
    .env("HOME", home.parent().and_then(Path::parent).unwrap_or(Path::new("")))
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    command.creation_flags(0x0800_0000);
  }
  let mut child = command.spawn().map_err(|error| format!("spawn node thất bại: {error}"))?;
  let pid = child.id();
  let stderr = child.stderr.take();
  if let Some(stderr) = stderr {
    thread::spawn(move || {
      let reader = BufReader::new(stderr);
      for line in reader.lines().map_while(Result::ok) {
        log("host:err", &line);
      }
    });
  }
  let stdout = child.stdout.take().ok_or_else(|| "host không mở stdout".to_string())?;
  if let Ok(mut slot) = host_slot().lock() {
    *slot = Some(child);
  }
  log("shell", &format!("spawn host pid={pid} node={} host={}", node.display(), host.display()));
  let reader = BufReader::new(stdout);
  for line in reader.lines().map_while(Result::ok) {
    log("host", &line);
    if let Some(url) = ready_url(&line) {
      navigate(app, &url);
      return Ok(());
    }
  }
  Err(format!("host thoát trước khi in URL; xem log tại {}", log_dir().map(|path| path.display().to_string()).unwrap_or_else(|| "(không có log)".to_string())))
}

/**
 * Dọn host: taskkill cả cây process (Windows) rồi chờ child.
 */
fn cleanup() {
  let Some(mut child) = host_slot().lock().ok().and_then(|mut slot| slot.take()) else { return };
  let pid = child.id();
  #[cfg(windows)]
  {
    let _ = Command::new("taskkill")
      .args(["/PID", &pid.to_string(), "/T", "/F"])
      .stdin(Stdio::null())
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .status();
  }
  let _ = child.kill();
  let _ = child.wait();
  log("shell", &format!("đã dọn host pid {pid}"));
}

/**
 * Entry point: dựng Tauri, khởi động host trong thread nền, dọn khi thoát.
 */
fn main() {
  let app = tauri::Builder::default()
    .setup(|app| {
      let handle = app.handle().clone();
      thread::spawn(move || {
        if let Err(error) = start_host(&handle) {
          show_error(&handle, &error);
        }
      });
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("không dựng được Tauri");
  app.run(|_app, event| {
    if matches!(event, RunEvent::Exit) {
      cleanup();
    }
  });
}
