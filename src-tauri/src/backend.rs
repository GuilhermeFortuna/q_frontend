use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct BackendState {
    pub api_process: Mutex<Option<Child>>,
    pub worker_process: Mutex<Option<Child>>,
}

impl Default for BackendState {
    fn default() -> Self {
        Self {
            api_process: Mutex::new(None),
            worker_process: Mutex::new(None),
        }
    }
}

impl Drop for BackendState {
    fn drop(&mut self) {
        if let Ok(mut api_guard) = self.api_process.lock() {
            if let Some(child) = api_guard.take() {
                kill_child_tree(child);
            }
        };
        if let Ok(mut worker_guard) = self.worker_process.lock() {
            if let Some(child) = worker_guard.take() {
                kill_child_tree(child);
            }
        };
    }
}

/// Resolves the absolute path to the backend directory containing pyproject.toml and docker-compose.yml.
fn resolve_backend_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;

    // 1. Check if direct subfolder in resource_dir exists (packaged / target structure)
    let path1 = resource_dir.join("q_backend");
    if path1.join("docker-compose.yml").exists() {
        return Ok(path1);
    }

    // 2. Check if Tauri escaped relative path mapping exists
    let path2 = resource_dir.join("_up_/_up_/q_backend");
    if path2.join("docker-compose.yml").exists() {
        return Ok(path2);
    }

    // 3. Fallback for local development execution: trace parent directories of current executable
    if let Ok(current_exe) = std::env::current_exe() {
        let mut p = current_exe.clone();
        for _ in 0..6 {
            if let Some(parent) = p.parent() {
                p = parent.to_path_buf();
                let check_path = p.join("q_backend");
                if check_path.join("docker-compose.yml").exists() {
                    return Ok(check_path);
                }
            }
        }
    }

    Err("Could not locate backend directory (q_backend) containing docker-compose.yml".to_string())
}

enum ComposeRuntime {
    DockerV2,
    DockerV1,
    PodmanV2,
    PodmanV1,
}

fn command_succeeds(command: &str, args: &[&str]) -> bool {
    Command::new(command)
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn resolve_podman_compose() -> Result<ComposeRuntime, String> {
    if command_succeeds("podman", &["compose", "version"]) {
        return Ok(ComposeRuntime::PodmanV2);
    }
    if command_succeeds("podman-compose", &["version"]) {
        return Ok(ComposeRuntime::PodmanV1);
    }
    Err(
        "Podman Compose is not available. On Fedora: sudo dnf install -y podman-compose"
            .to_string(),
    )
}

fn resolve_docker_compose() -> Result<ComposeRuntime, String> {
    if command_succeeds("docker", &["compose", "version"]) {
        return Ok(ComposeRuntime::DockerV2);
    }
    if command_succeeds("docker-compose", &["version"]) {
        return Ok(ComposeRuntime::DockerV1);
    }
    Err(
        "Docker Compose is not available. Install docker-compose-plugin or use Podman."
            .to_string(),
    )
}

fn resolve_compose_runtime() -> Result<ComposeRuntime, String> {
    let preference =
        std::env::var("QUANT_CONTAINER_RUNTIME").unwrap_or_else(|_| "auto".to_string());

    match preference.as_str() {
        "podman" => resolve_podman_compose(),
        "docker" => resolve_docker_compose(),
        "auto" => {
            if command_succeeds("podman", &["info"]) {
                if let Ok(runtime) = resolve_podman_compose() {
                    return Ok(runtime);
                }
            }
            resolve_docker_compose()
        }
        other => Err(format!(
            "Unsupported QUANT_CONTAINER_RUNTIME: {other} (use auto, podman, or docker)"
        )),
    }
}

fn container_cli(runtime: &ComposeRuntime) -> &'static str {
    match runtime {
        ComposeRuntime::DockerV2 | ComposeRuntime::DockerV1 => "docker",
        ComposeRuntime::PodmanV2 | ComposeRuntime::PodmanV1 => "podman",
    }
}

fn container_runtime_label(runtime: &ComposeRuntime) -> &'static str {
    match runtime {
        ComposeRuntime::DockerV2 | ComposeRuntime::DockerV1 => "Docker",
        ComposeRuntime::PodmanV2 | ComposeRuntime::PodmanV1 => "Podman",
    }
}

/// Asserts that the selected container runtime daemon is active and reachable.
fn check_container_runtime_running(runtime: &ComposeRuntime) -> Result<(), String> {
    let cli = container_cli(runtime);
    let label = container_runtime_label(runtime);
    if command_succeeds(cli, &["info"]) {
        return Ok(());
    }
    Err(format!(
        "{label} is not running or the {cli} CLI is not installed. Start {label} and try again."
    ))
}

/// Starts PostgreSQL and Redis database containers.
fn start_compose_services(runtime: &ComposeRuntime, backend_dir: &Path) -> Result<(), String> {
    let compose_file = backend_dir.join("docker-compose.yml");
    let file = compose_file
        .to_str()
        .ok_or("Invalid compose file path")?;

    let status = match runtime {
        ComposeRuntime::DockerV2 => Command::new("docker")
            .args([
                "compose",
                "-f",
                file,
                "up",
                "-d",
                "--remove-orphans",
                "postgres",
                "redis",
            ])
            .status(),
        ComposeRuntime::DockerV1 => Command::new("docker-compose")
            .args([
                "-f",
                file,
                "up",
                "-d",
                "--remove-orphans",
                "postgres",
                "redis",
            ])
            .status(),
        ComposeRuntime::PodmanV2 => Command::new("podman")
            .args([
                "compose",
                "-f",
                file,
                "up",
                "-d",
                "--remove-orphans",
                "postgres",
                "redis",
            ])
            .status(),
        ComposeRuntime::PodmanV1 => Command::new("podman-compose")
            .args([
                "-f",
                file,
                "up",
                "-d",
                "--remove-orphans",
                "postgres",
                "redis",
            ])
            .status(),
    }
    .map_err(|e| format!("Failed to run compose: {e}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(
            "Failed to start Postgres and Redis database containers via compose.".to_string(),
        )
    }
}

fn external_backend_enabled() -> bool {
    matches!(
        std::env::var("QUANT_EXTERNAL_BACKEND")
            .ok()
            .map(|value| value.to_ascii_lowercase())
            .as_deref(),
        Some("1" | "true" | "yes")
    )
}

/// Asserts that Astral 'uv' is installed and available in the system PATH.
fn check_uv_installed() -> Result<(), String> {
    let status = Command::new("uv")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    match status {
        Ok(s) if s.success() => Ok(()),
        _ => Err("Astral 'uv' is not installed or not in PATH. Please install it to run backend services natively. Installation: powershell -c \"irm https://astral.sh/uv/install.ps1 | iex\" (Windows) or curl -LsSf https://astral.sh/uv/install.sh | sh (Linux/macOS)".to_string()),
    }
}

/// Synchronizes Python virtual environment dependencies.
fn sync_dependencies(backend_dir: &Path) -> Result<(), String> {
    let is_debug = cfg!(debug_assertions);
    let mut args = vec!["sync"];
    if is_debug {
        args.push("--group");
        args.push("dev");
    } else {
        args.push("--no-dev");
    }

    let status = Command::new("uv")
        .args(&args)
        .current_dir(backend_dir)
        .status()
        .map_err(|e| format!("Failed to sync dependencies via uv: {}", e))?;

    if status.success() {
        Ok(())
    } else {
        Err("uv sync failed to synchronize python dependencies.".to_string())
    }
}

/// Runs database migrations using Alembic.
fn run_migrations(backend_dir: &Path, envs: &HashMap<String, String>) -> Result<(), String> {
    let status = Command::new("uv")
        .args(&["run", "alembic", "upgrade", "head"])
        .current_dir(backend_dir)
        .envs(envs)
        .status()
        .map_err(|e| format!("Failed to run database migrations: {}", e))?;

    if status.success() {
        Ok(())
    } else {
        Err("Database migrations failed to apply schema updates.".to_string())
    }
}

/// Loads a key-value list of environment variables from a .env file.
fn load_env_file(path: &Path) -> HashMap<String, String> {
    let mut envs = HashMap::new();
    if let Ok(content) = fs::read_to_string(path) {
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }
            if let Some((key, val)) = trimmed.split_once('=') {
                let key = key.trim().to_string();
                let val = val.trim().trim_matches('"').trim_matches('\'').to_string();
                envs.insert(key, val);
            }
        }
    }
    envs
}

/// Kills a process child and all of its subprocesses (process tree) in a platform-agnostic way.
fn kill_child_tree(mut child: Child) {
    #[cfg(windows)]
    {
        let pid = child.id();
        // On Windows, taskkill /F /T kills the process and all spawned child subprocesses (tree)
        let _ = Command::new("taskkill")
            .args(&["/F", "/T", "/PID", &pid.to_string()])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(not(windows))]
    {
        // On Linux/Unix we kill the process. (For full process groups, pgid termination can be used if needed)
        let _ = child.kill();
    }
}

/// Automatically configures environment variables, starts the database, and boots the backend processes.
pub fn start_backend_services(app: &AppHandle) -> Result<(), String> {
    if external_backend_enabled() {
        return Ok(());
    }

    // 1. Locate directories
    let backend_dir = resolve_backend_dir(app)?;
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|e| format!("Failed to create AppData directory: {}", e))?;

    // 2. Manage .env configurations
    let app_env_file = app_data_dir.join(".env");
    if !app_env_file.exists() {
        let example_env = backend_dir.join(".env.example");
        if example_env.exists() {
            let _ = fs::copy(&example_env, &app_env_file);
        }
    }

    // 3. Load configurations and merge with system defaults
    let mut envs = load_env_file(&app_env_file);

    let data_lake_root = app_data_dir.join("data/lake");
    let tick_cache_dir = app_data_dir.join("data/tick_cache");
    let market_data_root = app_data_dir.join("data/market");
    let runtime_config_path = app_data_dir.join("data/runtime_config.json");

    fs::create_dir_all(&data_lake_root).map_err(|e| e.to_string())?;
    fs::create_dir_all(&tick_cache_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&market_data_root).map_err(|e| e.to_string())?;

    // Apply defaults and folder redirects
    envs.entry("Q_DATA_LAKE_ROOT".to_string())
        .or_insert_with(|| data_lake_root.to_str().unwrap().to_string());
    envs.entry("Q_TICK_CACHE_DIR".to_string())
        .or_insert_with(|| tick_cache_dir.to_str().unwrap().to_string());
    envs.entry("Q_MARKET_DATA_ROOT".to_string())
        .or_insert_with(|| market_data_root.to_str().unwrap().to_string());
    envs.entry("Q_RUNTIME_CONFIG_PATH".to_string())
        .or_insert_with(|| runtime_config_path.to_str().unwrap().to_string());

    envs.entry("Q_DATABASE_URL".to_string())
        .or_insert_with(|| "postgresql+psycopg://q:q@localhost:5432/q".to_string());
    envs.entry("Q_REDIS_URL".to_string())
        .or_insert_with(|| "redis://localhost:6380/0".to_string());

    // 4. Validate and initialize database
    let compose_runtime = resolve_compose_runtime()?;
    check_container_runtime_running(&compose_runtime)?;
    start_compose_services(&compose_runtime, &backend_dir)?;
    check_uv_installed()?;
    sync_dependencies(&backend_dir)?;
    run_migrations(&backend_dir, &envs)?;

    // 5. Spawn API server subprocess
    let api_child = Command::new("uv")
        .args(&["run", "dev"])
        .current_dir(&backend_dir)
        .envs(&envs)
        .spawn()
        .map_err(|e| format!("Failed to spawn FastAPI server: {}", e))?;

    // 6. Spawn Dramatiq worker subprocess
    let worker_child = Command::new("uv")
        .args(&["run", "worker"])
        .current_dir(&backend_dir)
        .envs(&envs)
        .spawn()
        .map_err(|e| format!("Failed to spawn Dramatiq worker pool: {}", e))?;

    // 7. Store process handles in application state for teardown orchestration
    let state = app.state::<BackendState>();
    if let Ok(mut api_guard) = state.api_process.lock() {
        *api_guard = Some(api_child);
    }
    if let Ok(mut worker_guard) = state.worker_process.lock() {
        *worker_guard = Some(worker_child);
    }

    Ok(())
}

/// Terminates the API and Worker processes cleanly.
pub fn stop_backend_services(app: &AppHandle) {
    let state = app.state::<BackendState>();

    if let Ok(mut api_guard) = state.api_process.lock() {
        if let Some(child) = api_guard.take() {
            kill_child_tree(child);
        }
    };

    if let Ok(mut worker_guard) = state.worker_process.lock() {
        if let Some(child) = worker_guard.take() {
            kill_child_tree(child);
        }
    };
}
