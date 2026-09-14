use std::fs;
use std::path::{Path, PathBuf};

fn collect_rs_files(dir: &Path, acc: &mut Vec<PathBuf>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_rs_files(&path, acc);
            } else if path.extension().and_then(|s| s.to_str()) == Some("rs") {
                acc.push(path);
            }
        }
    }
}

#[test]
fn shell_source_spawns_no_processes() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
        .unwrap_or_else(|_| ".".to_string());
    let src_dir = Path::new(&manifest_dir).join("src");

    let mut rs_files = Vec::new();
    collect_rs_files(&src_dir, &mut rs_files);
    assert!(!rs_files.is_empty(), "Expected to find .rs files in {:?}", src_dir);

    // Forbidden tokens per Q-019 specification and plan:
    // std::process, Command::new, compose, alembic, "uv", podman, docker,
    // QUANT_EXTERNAL_BACKEND, QUANT_CONTAINER_RUNTIME
    let forbidden_patterns: &[(&str, bool)] = &[
        ("std::process", false),
        ("Command::new", false),
        ("compose", true),
        ("alembic", true),
        ("\"uv\"", false),
        ("'uv'", false),
        ("podman", true),
        ("docker", true),
        ("QUANT_EXTERNAL_BACKEND", false),
        ("QUANT_CONTAINER_RUNTIME", false),
    ];

    let mut violations = Vec::new();

    for file_path in rs_files {
        let content = fs::read_to_string(&file_path)
            .unwrap_or_else(|err| panic!("Failed to read {:?}: {}", file_path, err));
        let content_lower = content.to_lowercase();
        let relative_path = file_path
            .strip_prefix(&manifest_dir)
            .unwrap_or(&file_path)
            .display()
            .to_string();

        for &(pattern, case_insensitive) in forbidden_patterns {
            let matches = if case_insensitive {
                content_lower.contains(&pattern.to_lowercase())
            } else {
                content.contains(pattern)
            };

            if matches {
                violations.push(format!("{}: contains forbidden token {:?}", relative_path, pattern));
            }
        }
    }

    assert!(
        violations.is_empty(),
        "Found process ownership violations in shell source:\n{}",
        violations.join("\n")
    );
}
