/*
 * author Galaxy Blackhole
 * create 2026-11-22
 * desc Compile-time instance identity: preview vs test use separate name,
 *      home, port and logs so they can run side by side without sharing a host.
 */

use std::path::PathBuf;

/// True for the `Galaxy Blackhole (Test)` build.
pub fn is_test() -> bool {
  option_env!("GBH_INSTANCE") == Some("test")
}

/// Human-readable product name for the window and logs.
pub fn is_preview() -> bool {
  option_env!("GBH_INSTANCE") == Some("preview")
}

pub fn display_name() -> &'static str {
  if is_test() { "Galaxy Blackhole (Test)" }
  else if is_preview() { "Galaxy Blackhole (Preview)" }
  else { "Galaxy Blackhole" }
}

/// Log directory name under `~/Library/Logs`.
pub fn log_name() -> &'static str {
  if is_test() { "Galaxy Blackhole (Test)" }
  else if is_preview() { "Galaxy Blackhole (Preview)" }
  else { "Galaxy Blackhole" }
}

/// Default TCP port: test 55908, preview 55907.
pub fn default_port() -> u16 {
  if is_test() { 55908 } else { 55907 }
}

/// Harness home/profile root: test `~/.galaxy/blackhole-test`, preview `~/.galaxy/blackhole`.
pub fn home() -> Option<PathBuf> {
  // The test build must never inherit the working preview's GBH_HOME/DSH_HOME
  // (a shell launched from the current session exports them). Its home is fixed
  // so it can run side by side with the preview without touching its profile.
  if is_test() {
    let user_home = std::env::var("HOME").ok().filter(|value| !value.is_empty())?;
    return Some(PathBuf::from(user_home).join(".galaxy").join("blackhole-test"));
  }
  let explicit = std::env::var("GBH_HOME").ok().map(|value| value.trim().to_string()).filter(|value| !value.is_empty());
  if let Some(value) = explicit {
    return Some(PathBuf::from(value));
  }
  let user_home = std::env::var("HOME").ok().filter(|value| !value.is_empty())?;
  Some(PathBuf::from(user_home).join(".galaxy").join("blackhole"))
}

/// Profile directory name; the harness profile stays `blackhole` under a separate home.
pub fn profile_name() -> &'static str {
  "blackhole"
}
