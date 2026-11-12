/*
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Giải đường dẫn TUYỆT ĐỐI của runtime Node + gốc host + entry CLI, không phụ thuộc PATH hay cwd của app
 *      11/11/2026: BỎ bun khỏi vỏ — harness chỉ boot được bằng Node (native addon node-addon-require-builtin
 *      cần symbol V8 của Node: bun ném "Unsupported/no-context"). Thứ tự: Resources/runtime/node → GBH_NODE
 *      → nvm/PATH; host: Resources/host → GBH_REPO → repo nhúng lúc build → dò ngược từ binary
 */

//! Giải lệnh chạy host cho vỏ desktop — MỘT runtime duy nhất: Node.
//!
//! Bệnh đã đo: app cài trong /Applications, mở bằng Finder thì LaunchServices đặt cwd = `/` và
//! PATH = `/usr/bin:/bin:/usr/sbin:/sbin`; máy người dùng không có node >= 26 (và không có bun chạy được
//! harness). Vì vậy bản .app tự chứa runtime Node và host, và phép giải dưới đây chỉ trả về đường dẫn
//! tuyệt đối, theo đúng thứ tự vận hành:
//!
//! 1. Node: `Contents/Resources/runtime/node` (nhúng) → `GBH_NODE` (người vận hành chỉ định) → bản mới nhất
//!    của nvm → quét PATH + các vị trí hệ thống. Một `GBH_NODE` trỏ vào chỗ không có tệp là LỖI RÕ RÀNG,
//!    không bị bỏ qua im lặng.
//! 2. Host: `Contents/Resources/host` (nhúng) → `GBH_REPO` → `GBH_CLI` → repo nhúng lúc build → dò ngược
//!    từ vị trí binary tìm `apps/cli/src/main.ts`.
//! 3. PATH cho tiến trình con: thư mục của runtime đã chọn đứng ĐẦU, nên lệnh `node` bên trong host luôn
//!    trỏ về đúng bản đang chạy, không phải bản nào đó của LaunchServices.

use std::path::{Path, PathBuf};

/// Node major thấp nhất mà `bh host` chấp nhận (xem `apps/cli/src/paths.ts`); dưới ngưỡng này nó từ chối boot.
pub const MIN_NODE_MAJOR: u32 = 26;

/// PATH mở rộng dùng cho bước "quét PATH" cuối cùng, đúng thứ tự đã chốt 11/11/2026.
const SYSTEM_DIRS: [&str; 4] = ["/usr/bin", "/bin", "/usr/sbin", "/sbin"];

/// Những nơi node thường được cài, ngoài nvm và PATH.
const NODE_FALLBACKS: [&str; 2] = ["/opt/homebrew/bin/node", "/usr/local/bin/node"];

/**
 * Toàn bộ đầu vào của phép giải, tách khỏi môi trường thật để test được.
 */
pub struct HostEnv {
  /// `$HOME`, hoặc None khi môi trường không có.
  pub home: Option<PathBuf>,
  /// `GBH_CLI` — đường dẫn `apps/cli/src/main.ts` do người vận hành chỉ định.
  pub gbh_cli: Option<String>,
  /// `GBH_REPO` — gốc host do người vận hành chỉ định.
  pub gbh_repo: Option<String>,
  /// `GBH_NODE` — runtime Node do người vận hành chỉ định; có rồi thì không đoán nữa.
  pub gbh_node: Option<String>,
  /// `PATH` của app, thường rất ngắn khi mở từ Finder.
  pub path: Option<String>,
  /// Thư mục chứa binary đang chạy (đã canonicalize), dùng để tìm `Contents/Resources` và dò ngược repo.
  pub exe_dir: Option<PathBuf>,
  /// Gốc repo nhúng lúc build (build.rs phát `cargo:rustc-env=GBH_BUILD_REPO`).
  pub built_repo: PathBuf,
}

impl HostEnv {
  /**
   * Đọc môi trường thật của tiến trình.
   * Nhận: không.
   * Trả: {@link HostEnv} đã điền, với `exe_dir` lấy từ `current_exe` đã canonicalize.
   */
  pub fn from_process() -> Self {
    let home = std::env::var("HOME").ok().filter(|value| !value.is_empty()).map(PathBuf::from);
    let exe_dir = std::env::current_exe()
      .ok()
      .and_then(|exe| exe.canonicalize().ok())
      .and_then(|exe| exe.parent().map(Path::to_path_buf));
    HostEnv {
      home,
      gbh_cli: non_empty("GBH_CLI"),
      gbh_repo: non_empty("GBH_REPO"),
      gbh_node: non_empty("GBH_NODE"),
      path: std::env::var("PATH").ok(),
      exe_dir,
      built_repo: built_repo(),
    }
  }

  /**
   * Các thư mục tài nguyên của gói cài, theo thứ tự dò.
   * Nhận: không (đọc exe_dir đã đọc từ môi trường).
   * Trả: Contents/Resources cạnh binary (macOS), rồi <exe>/resources, rồi chính thư mục binary.
   */
  pub fn resources_dirs(&self) -> Vec<PathBuf> {
    let Some(dir) = &self.exe_dir else { return Vec::new() };
    let mut out: Vec<PathBuf> = Vec::new();
    if let Some(parent) = ancestor(dir, 1) {
      out.push(parent.join("Resources"));
    }
    out.push(dir.join("resources"));
    out.push(dir.clone());
    out
  }
}

/**
 * Đọc một biến môi trường, coi chuỗi rỗng như không đặt.
 * Nhận: `key` — tên biến.
 * Trả: giá trị đã trim, hoặc None.
 */
fn non_empty(key: &str) -> Option<String> {
  std::env::var(key).ok().map(|value| value.trim().to_string()).filter(|value| !value.is_empty())
}

/**
 * Gốc repo harness nhúng lúc build.
 * Nhận: không.
 * Trả: đường dẫn build.rs đã phát, hoặc suy ra từ `CARGO_MANIFEST_DIR` khi build.rs không phát.
 */
pub fn built_repo() -> PathBuf {
  match option_env!("GBH_BUILD_REPO") {
    Some(value) if !value.is_empty() => PathBuf::from(value),
    _ => PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("..").join(".."),
  }
}

/**
 * Phép giải đã thành công: mọi đường dẫn đều tuyệt đối và đã kiểm tồn tại.
 */
pub struct HostPlan {
  /// Runtime Node tuyệt đối, thi hành được.
  pub node: PathBuf,
  /// Quy tắc đã tìm ra node: `nhung` · `env` · `path` (in vào log).
  pub node_source: String,
  /// Entry CLI tuyệt đối (`.../apps/cli/src/main.ts`).
  pub cli: PathBuf,
  /// Quy tắc đã tìm ra entry CLI.
  pub cli_source: String,
  /// Gốc host — cũng là `current_dir` khi spawn.
  pub repo: PathBuf,
  /// Quy tắc đã tìm ra gốc host: `nhung` · `env` · `path`.
  pub repo_source: String,
  /// PATH đưa cho tiến trình con (thư mục của runtime đứng đầu).
  pub path_env: String,
}

/**
 * Kết quả một lượt giải: hoặc có {@link HostPlan}, hoặc có lý do hỏng kèm danh sách đã thử.
 */
pub struct HostResolution {
  /// Kế hoạch chạy host khi giải xong.
  pub plan: Option<HostPlan>,
  /// Từng đường đã thử, theo thứ tự — đây là nội dung cửa sổ lỗi và log.
  pub attempts: Vec<String>,
  /// Lý do hỏng bằng tiếng Việt khi `plan` là None.
  pub failure: Option<String>,
}

/**
 * Thêm một dòng "đã thử" vào danh sách.
 * Nhận: `attempts`; `label` — mục đã thử; `result` — kết quả ngắn.
 * Trả: không.
 */
fn note(attempts: &mut Vec<String>, label: String, result: &str) {
  attempts.push(format!("{label} → {result}"));
}

/**
 * Quét một chuỗi PATH tìm tệp thực thi.
 * Nhận: `path_value` — các thư mục ngăn bằng ':'; `name` — tên tệp; `exists` — vị từ tồn tại.
 * Trả: đường dẫn tuyệt đối đầu tiên tìm thấy.
 */
fn find_in_dirs(path_value: &str, name: &str, exists: &dyn Fn(&Path) -> bool) -> Option<PathBuf> {
  for dir in path_value.split(':') {
    if dir.is_empty() {
      continue;
    }
    let candidate = Path::new(dir).join(name);
    if exists(&candidate) {
      return Some(candidate);
    }
  }
  None
}

/**
 * PATH mở rộng để dò node — hệ thống trước, rồi tới nơi node hay được cài.
 * Nhận: `env` — môi trường đã đọc.
 * Trả: chuỗi PATH tuyệt đối, không phụ thuộc PATH hiện tại của app.
 */
pub fn extended_path(_env: &HostEnv) -> String {
  let mut dirs: Vec<String> = SYSTEM_DIRS.iter().map(|dir| (*dir).to_string()).collect();
  dirs.extend(NODE_FALLBACKS.iter().map(|dir| (*dir).to_string()));
  dirs.join(":")
}

/**
 * Đi lên `depth` cấp từ một thư mục.
 * Nhận: `dir` — điểm xuất phát; `depth` — số cấp.
 * Trả: thư mục tổ tiên, None khi vượt gốc.
 */
fn ancestor(dir: &Path, depth: usize) -> Option<PathBuf> {
  let mut current = dir.to_path_buf();
  for _ in 0..depth {
    current = current.parent()?.to_path_buf();
  }
  Some(current)
}

/**
 * Tách `v26.9.0` thành (26, 9, 0).
 * Nhận: `name` — tên thư mục phiên bản của nvm.
 * Trả: bộ ba số khi đúng dạng, None khi không phải phiên bản.
 */
fn parse_version(name: &str) -> Option<(u32, u32, u32)> {
  let rest = name.strip_prefix('v')?;
  let mut parts = rest.split('.');
  let major = parts.next()?.parse::<u32>().ok()?;
  let minor = parts.next()?.parse::<u32>().ok()?;
  let patch = parts.next()?.parse::<u32>().ok()?;
  Some((major, minor, patch))
}

/**
 * Thư mục bin của bản node mới nhất (>= {@link MIN_NODE_MAJOR}) trong nvm.
 * Nhận: `home` — `$HOME`, hoặc None.
 * Trả: đường dẫn `~/.nvm/versions/node/vX.Y.Z/bin`, None khi không có bản nào đủ mới.
 */
fn newest_nvm_bin(home: Option<&Path>) -> Option<PathBuf> {
  let root = home?.join(".nvm").join("versions").join("node");
  let mut best: Option<((u32, u32, u32), PathBuf)> = None;
  for entry in std::fs::read_dir(&root).ok()?.flatten() {
    let name = entry.file_name().to_string_lossy().to_string();
    let Some(version) = parse_version(&name) else { continue };
    if version.0 < MIN_NODE_MAJOR {
      continue;
    }
    let bin = entry.path().join("bin");
    if !bin.join("node").exists() {
      continue;
    }
    if best.as_ref().map(|(current, _)| version > *current).unwrap_or(true) {
      best = Some((version, bin));
    }
  }
  best.map(|(_, bin)| bin)
}

/**
 * Entry CLI bên trong một gốc host.
 * Nhận: `repo` — gốc host.
 * Trả: đường dẫn `<repo>/apps/cli/src/main.ts`.
 */
fn cli_in(repo: &Path) -> PathBuf {
  repo.join("apps").join("cli").join("src").join("main.ts")
}

/**
 * PATH đưa cho tiến trình host: thư mục của runtime đứng đầu, rồi nvm, hệ thống, rồi PATH gốc của app.
 * Nhận: `env` — môi trường đã đọc; `node` — runtime đã chọn (None khi chưa biết).
 * Trả: chuỗi PATH đã khử trùng, giữ thứ tự ưu tiên.
 */
pub fn child_path(env: &HostEnv, node: Option<&Path>) -> String {
  let mut dirs: Vec<String> = Vec::new();
  if let Some(bin) = node.and_then(|path| path.parent()) {
    dirs.push(bin.display().to_string());
  }
  if let Some(bin) = newest_nvm_bin(env.home.as_deref()) {
    dirs.push(bin.display().to_string());
  }
  dirs.extend(extended_path(env).split(':').map(|dir| dir.to_string()));
  if let Some(path) = &env.path {
    dirs.extend(path.split(':').filter(|dir| !dir.is_empty()).map(|dir| dir.to_string()));
  }
  let mut unique: Vec<String> = Vec::new();
  for dir in dirs {
    if !dir.is_empty() && !unique.contains(&dir) {
      unique.push(dir);
    }
  }
  unique.join(":")
}

/**
 * Dò runtime Node theo đúng thứ tự vận hành: nhúng → `GBH_NODE` → nvm → PATH mở rộng.
 * Nhận: `env`; `exists`; `attempts` — nơi ghi lại từng bước đã thử.
 * Trả: (đường dẫn node, nguồn `nhung`|`env`|`path`) hoặc lý do hỏng.
 */
fn find_node(
  env: &HostEnv,
  exists: &dyn Fn(&Path) -> bool,
  attempts: &mut Vec<String>,
) -> Result<(PathBuf, String), String> {
  // TẦNG NHÚNG đứng đầu: máy người dùng không có node >= 26 và mở app từ Finder thì PATH tối thiểu.
  for dir in env.resources_dirs() {
    let candidate = dir.join("runtime").join("node");
    let found = exists(&candidate);
    note(attempts, format!("node: {} (nhúng)", candidate.display()), if found { "có" } else { "không có" });
    if found {
      return Ok((candidate, "nhung".to_string()));
    }
  }
  if let Some(value) = &env.gbh_node {
    let path = PathBuf::from(value);
    let found = exists(&path);
    note(attempts, format!("node: GBH_NODE={}", path.display()), if found { "có" } else { "KHÔNG tồn tại" });
    if found {
      return Ok((path, "env".to_string()));
    }
    return Err(format!(
      "GBH_NODE={} không tồn tại — bỏ biến này để app tự dò, hoặc trỏ tới node v{} thật",
      path.display(),
      MIN_NODE_MAJOR
    ));
  }
  if let Some(bin) = newest_nvm_bin(env.home.as_deref()) {
    let candidate = bin.join("node");
    let found = exists(&candidate);
    note(attempts, format!("node: nvm mới nhất {}", candidate.display()), if found { "có" } else { "không có" });
    if found {
      return Ok((candidate, "path".to_string()));
    }
  }
  let path_value = extended_path(env);
  let scanned = find_in_dirs(&path_value, "node", exists);
  note(
    attempts,
    format!("node: quét PATH mở rộng ({path_value})"),
    &match &scanned {
      Some(path) => format!("tìm thấy {}", path.display()),
      None => "không có".to_string(),
    },
  );
  match scanned {
    Some(path) => Ok((path, "path".to_string())),
    None => Err(format!(
      "không tìm thấy node v{}: đã thử runtime nhúng (Contents/Resources/runtime/node), GBH_NODE, ~/.nvm/versions/node/*/bin/node, {} và PATH mở rộng ({path_value}). Đặt GBH_NODE=/đường/dẫn/node hoặc chép runtime vào gói cài",
      MIN_NODE_MAJOR,
      NODE_FALLBACKS.join(", ")
    )),
  }
}

/**
 * Dò gốc host: nhúng → `GBH_REPO` → `GBH_CLI` → repo nhúng lúc build → dò ngược từ binary.
 * Nhận: `env`; `exists`; `attempts`.
 * Trả: (gốc host, nguồn `nhung`|`env`|`path`, entry CLI, ghi chú) hoặc lý do hỏng.
 */
fn find_harness(
  env: &HostEnv,
  exists: &dyn Fn(&Path) -> bool,
  attempts: &mut Vec<String>,
) -> Result<(PathBuf, String, PathBuf, String), String> {
  // TẦNG NHÚNG đứng đầu: `Contents/Resources/host` là bản chạy được đã chép vào .app, nên nó không phụ
  // thuộc repo checkout của máy dev và không phụ thuộc cwd do LaunchServices đặt.
  for dir in env.resources_dirs() {
    let repo = dir.join("host");
    let cli = cli_in(&repo);
    let found = exists(&cli);
    note(attempts, format!("host: {} (nhúng)", repo.display()), if found { "có" } else { "không có" });
    if found {
      return Ok((repo, "nhung".to_string(), cli, "nhung".to_string()));
    }
  }
  if let Some(value) = &env.gbh_repo {
    let repo = PathBuf::from(value);
    let cli = cli_in(&repo);
    let found = exists(&cli);
    note(attempts, format!("host: GBH_REPO={} → apps/cli/src/main.ts", repo.display()), if found { "có" } else { "KHÔNG có" });
    if found {
      return Ok((repo, "env".to_string(), cli, "GBH_REPO".to_string()));
    }
    return Err(format!("GBH_REPO={} không có apps/cli/src/main.ts", repo.display()));
  }
  if let Some(value) = &env.gbh_cli {
    let cli = PathBuf::from(value);
    let found = exists(&cli);
    note(attempts, format!("host: GBH_CLI={}", cli.display()), if found { "có" } else { "KHÔNG tồn tại" });
    if found {
      // main.ts -> src -> cli -> apps -> <repo>: bốn cấp, không phải ba.
      let repo = ancestor(&cli, 4).unwrap_or_else(|| env.built_repo.clone());
      note(attempts, format!("host: suy ra từ GBH_CLI ({})", cli.display()), &repo.display().to_string());
      return Ok((repo, "env".to_string(), cli, "suy ra từ GBH_CLI".to_string()));
    }
    return Err(format!(
      "GBH_CLI={} không tồn tại — bỏ biến này để app tự dò, hoặc trỏ tới apps/cli/src/main.ts",
      cli.display()
    ));
  }
  let built = env.built_repo.clone();
  let built_cli = cli_in(&built);
  let built_found = exists(&built_cli);
  note(
    attempts,
    format!("host: repo nhúng lúc build {} → apps/cli/src/main.ts", built.display()),
    if built_found { "có" } else { "không có" },
  );
  if built_found {
    return Ok((built, "path".to_string(), built_cli, "repo nhúng lúc build".to_string()));
  }
  if let Some(exe_dir) = &env.exe_dir {
    for depth in 0..=5 {
      let Some(dir) = ancestor(exe_dir, depth) else { break };
      let cli = cli_in(&dir);
      if exists(&cli) {
        note(attempts, format!("host: dò ngược {depth} cấp từ {}", exe_dir.display()), &cli.display().to_string());
        return Ok((dir, "path".to_string(), cli, format!("dò ngược {depth} cấp từ vị trí binary")));
      }
    }
    note(
      attempts,
      format!("host: dò ngược 0..=5 cấp từ {}", exe_dir.display()),
      "không có apps/cli/src/main.ts",
    );
  }
  Err(format!(
    "không tìm thấy mã nguồn host (apps/cli/src/main.ts): đã thử Resources/host (nhúng), GBH_REPO, GBH_CLI, repo nhúng lúc build ({}) và dò ngược từ vị trí binary. Đặt GBH_REPO=/đường/dẫn/blackhole-tauri",
    built.display()
  ))
}

/**
 * Giải toàn bộ kế hoạch chạy host.
 * Nhận: `env` — môi trường đã đọc; `exists` — vị từ tồn tại (thật ở production, tiêm vào khi test).
 * Trả: {@link HostResolution} — kế hoạch hoặc lý do hỏng kèm danh sách đã thử.
 */
pub fn resolve(env: &HostEnv, exists: &dyn Fn(&Path) -> bool) -> HostResolution {
  let mut attempts = Vec::new();
  let (node, node_source) = match find_node(env, exists, &mut attempts) {
    Ok(found) => found,
    Err(failure) => return HostResolution { plan: None, attempts, failure: Some(failure) },
  };
  match find_harness(env, exists, &mut attempts) {
    Ok((repo, repo_source, cli, cli_source)) => {
      let path_env = child_path(env, Some(&node));
      HostResolution {
        plan: Some(HostPlan { node, node_source, cli, cli_source, repo, repo_source, path_env }),
        attempts,
        failure: None,
      }
    }
    Err(failure) => HostResolution { plan: None, attempts, failure: Some(failure) },
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::collections::HashSet;

  /**
   * Vị từ tồn tại trên một danh sách cố định.
   * Nhận: `allow` — các đường dẫn coi như có.
   * Trả: closure dùng được cho `exists`.
   */
  fn only(allow: Vec<PathBuf>) -> impl Fn(&Path) -> bool {
    let set: HashSet<PathBuf> = allow.into_iter().collect();
    move |candidate: &Path| set.contains(candidate)
  }

  /**
   * Môi trường giả cho test.
   * Nhận: `home`; `built` — repo nhúng giả.
   * Trả: {@link HostEnv} không có biến override nào.
   */
  fn env_with(home: Option<&str>, built: &str) -> HostEnv {
    HostEnv {
      home: home.map(PathBuf::from),
      gbh_cli: None,
      gbh_repo: None,
      gbh_node: None,
      path: Some("/usr/bin:/bin".to_string()),
      exe_dir: Some(PathBuf::from("/Applications/GBH.app/Contents/MacOS")),
      built_repo: PathBuf::from(built),
    }
  }

  /// Thư mục Resources của gói cài giả trong test.
  fn resources() -> PathBuf {
    PathBuf::from("/Applications/GBH.app/Contents/Resources")
  }

  #[test]
  fn the_embedded_runtime_beats_every_other_candidate() {
    let env = env_with(Some("/Users/dev"), "/repo");
    let node = resources().join("runtime").join("node");
    let repo = resources().join("host");
    let resolved = resolve(&env, &only(vec![node.clone(), cli_in(&repo)]));
    let plan = resolved.plan.expect("phải giải được");
    assert_eq!(plan.node, node);
    assert_eq!(plan.node_source, "nhung");
    assert_eq!(plan.repo, repo);
    assert_eq!(plan.repo_source, "nhung");
  }

  #[test]
  fn gbh_node_is_used_when_the_package_embeds_no_runtime() {
    let mut env = env_with(Some("/Users/dev"), "/repo");
    env.gbh_node = Some("/opt/dev/node".to_string());
    let node = PathBuf::from("/opt/dev/node");
    let cli = PathBuf::from("/repo/apps/cli/src/main.ts");
    let plan = resolve(&env, &only(vec![node.clone(), cli.clone()])).plan.expect("phải giải được");
    assert_eq!(plan.node, node);
    assert_eq!(plan.node_source, "env");
    assert_eq!(plan.cli, cli);
    assert_eq!(plan.repo, PathBuf::from("/repo"));
    assert_eq!(plan.repo_source, "path");
  }

  #[test]
  fn gbh_node_missing_is_a_loud_failure() {
    let mut env = env_with(Some("/Users/dev"), "/repo");
    env.gbh_node = Some("/nonexistent".to_string());
    let resolved = resolve(&env, &only(vec![PathBuf::from("/usr/bin/node")]));
    assert!(resolved.plan.is_none());
    let failure = resolved.failure.expect("phải có lý do");
    assert!(failure.contains("GBH_NODE=/nonexistent"), "lý do phải nêu đường dẫn đã đặt: {failure}");
    assert!(resolved.attempts.iter().any(|line| line.contains("/nonexistent")));
  }

  #[test]
  fn the_path_scan_finds_node_when_nothing_is_embedded() {
    let mut env = env_with(Some("/Users/dev"), "/repo");
    env.home = None;
    let scanned = PathBuf::from("/usr/bin/node");
    let cli = PathBuf::from("/repo/apps/cli/src/main.ts");
    let plan = resolve(&env, &only(vec![scanned.clone(), cli])).plan.expect("phải giải được");
    assert_eq!(plan.node, scanned);
    assert_eq!(plan.node_source, "path");
  }

  #[test]
  fn no_node_reports_every_location_it_tried() {
    let mut env = env_with(Some("/Users/dev"), "/repo");
    env.home = None;
    let resolved = resolve(&env, &only(vec![PathBuf::from("/repo/apps/cli/src/main.ts")]));
    assert!(resolved.plan.is_none());
    let failure = resolved.failure.expect("phải có lý do");
    assert!(failure.contains("không tìm thấy node"), "{failure}");
    for expected in ["runtime/node", "GBH_NODE", "nvm", "/usr/local/bin/node", "PATH mở rộng"] {
      assert!(failure.contains(expected), "lý do phải nêu {expected}: {failure}");
    }
  }

  #[test]
  fn gbh_repo_wins_over_the_built_path() {
    let mut env = env_with(Some("/Users/dev"), "/built");
    env.gbh_repo = Some("/elsewhere".to_string());
    let node = resources().join("runtime").join("node");
    let cli = PathBuf::from("/elsewhere/apps/cli/src/main.ts");
    let plan = resolve(&env, &only(vec![node, cli.clone()])).plan.expect("phải giải được");
    assert_eq!(plan.repo, PathBuf::from("/elsewhere"));
    assert_eq!(plan.cli, cli);
    assert_eq!(plan.repo_source, "env");
  }

  #[test]
  fn gbh_cli_wins_and_its_repo_is_derived() {
    let mut env = env_with(Some("/Users/dev"), "/repo");
    env.gbh_cli = Some("/checkout/apps/cli/src/main.ts".to_string());
    let node = resources().join("runtime").join("node");
    let cli = PathBuf::from("/checkout/apps/cli/src/main.ts");
    let plan = resolve(&env, &only(vec![node, cli.clone()])).plan.expect("phải giải được");
    assert_eq!(plan.cli, cli);
    assert_eq!(plan.repo, PathBuf::from("/checkout"));
    assert_eq!(plan.cli_source, "suy ra từ GBH_CLI");
  }

  #[test]
  fn a_missing_harness_names_every_place_it_looked() {
    let env = env_with(Some("/Users/dev"), "/repo");
    let node = resources().join("runtime").join("node");
    let resolved = resolve(&env, &only(vec![node]));
    assert!(resolved.plan.is_none());
    let failure = resolved.failure.expect("phải có lý do");
    assert!(failure.contains("không tìm thấy mã nguồn host"), "{failure}");
    assert!(failure.contains("/repo"), "lý do phải nêu repo đã thử: {failure}");
  }

  #[test]
  fn the_child_path_puts_the_selected_runtime_first() {
    let env = env_with(None, "/repo");
    let node = resources().join("runtime").join("node");
    let path = child_path(&env, Some(&node));
    let first = path.split(':').next().unwrap_or_default();
    assert_eq!(first, resources().join("runtime").display().to_string());
    assert!(path.contains("/usr/bin"), "{path}");
    assert!(!path.contains("bun"), "không còn bun trong PATH của con: {path}");
  }

  #[test]
  fn versions_below_the_floor_are_not_nvm_candidates() {
    assert_eq!(parse_version("v26.9.0"), Some((26, 9, 0)));
    assert_eq!(parse_version("20.12.0"), None);
    let old = parse_version("v20.12.0").expect("vẫn là phiên bản");
    assert!(old.0 < MIN_NODE_MAJOR);
  }
}
