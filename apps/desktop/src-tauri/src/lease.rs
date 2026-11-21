/*
 * author Galaxy Blackhole
 * create 2026-11-22
 * desc One-host-per-home lease. A desktop window attaches to an already live
 *      web/desktop host instead of spawning a rival host and killing the
 *      process that currently serves the user's session.
 */

use std::fs;
use std::path::PathBuf;

use serde_json::Value;

use crate::instance;

/// A live host written by the CLI or another desktop shell.
#[derive(Debug, Clone)]
pub struct Lease {
  /// Host process id.
  pub pid: u32,
  /// Host TCP port.
  pub port: u16,
  /// Authenticated URL including token.
  pub url: String,
}

/**
 * Lease file for the current instance home.
 * @returns `<home>/run/host.json`, or None when HOME/GBH_HOME is unknown.
 */
pub fn path() -> Option<PathBuf> {
  instance::home().map(|home| home.join("run").join("host.json"))
}

/**
 * Whether a process id still exists, without delivering a terminating signal.
 * @param pid - process id.
 * @returns true when the process exists.
 */
fn pid_alive(pid: u32) -> bool {
  if pid == 0 { return false; }
  #[cfg(unix)]
  {
    // SAFETY: kill(pid, 0) only probes existence; it does not dereference memory.
    unsafe { libc::kill(pid as libc::pid_t, 0) == 0 }
  }
  #[cfg(windows)]
  {
    let filter = format!("PID eq {pid}");
    std::process::Command::new("tasklist")
      .args(["/FI", &filter, "/FO", "CSV", "/NH"])
      .output()
      .map(|out| String::from_utf8_lossy(&out.stdout).contains(&pid.to_string()))
      .unwrap_or(false)
  }
}

/**
 * Read the live lease, removing a stale one.
 * @returns a live lease, or None when absent/stale.
 */
pub fn read_live() -> Option<Lease> {
  let file = path()?;
  let text = fs::read_to_string(&file).ok()?;
  let value: Value = serde_json::from_str(&text).ok()?;
  let pid = value.get("pid")?.as_u64()? as u32;
  let port = value.get("port")?.as_u64()? as u16;
  let url = value.get("url")?.as_str()?.to_string();
  if port == 0 || url.is_empty() || !pid_alive(pid) {
    let _ = fs::remove_file(&file);
    return None;
  }
  Some(Lease { pid, port, url })
}

/**
 * Atomically write the lease for a host that has printed its ready URL.
 * @param pid - host process id.
 * @param port - host port.
 * @param url - authenticated URL.
 */
pub fn write(pid: u32, port: u16, url: &str) -> std::io::Result<()> {
  let file = path().ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "no HOME/GBH_HOME"))?;
  if let Some(parent) = file.parent() {
    fs::create_dir_all(parent)?;
  }
  let temporary = file.with_extension(format!("json.tmp-{}", std::process::id()));
  fs::write(&temporary, serde_json::json!({
    "pid": pid,
    "port": port,
    "url": url,
    "home": file.parent().and_then(|path| path.parent()).map(|path| path.display().to_string()),
    "startedAt": "now",
  }).to_string())?;
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    let _ = fs::set_permissions(&temporary, fs::Permissions::from_mode(0o600));
  }
  fs::rename(&temporary, &file)
}

/**
 * Remove the lease only when it still belongs to the host this shell spawned.
 * @param pid - host pid.
 */
pub fn clear_owned(pid: u32) {
  if let Some(lease) = read_live() {
    if lease.pid == pid {
      if let Some(file) = path() {
        let _ = fs::remove_file(file);
      }
    }
  }
}
