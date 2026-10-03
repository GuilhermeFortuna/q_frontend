//! Backtest CSV export: writes the market-data and trades CSV files produced by
//! the backend into a folder the user picks.

use std::fs;
use std::path::{Path, PathBuf};

const DEFAULT_BASE_NAME: &str = "backtest";

/// Write both CSV files into `dir` and return their paths, market data first.
fn write_csv_files(
    dir: &Path,
    base_name: &str,
    market_data_csv: &str,
    trades_csv: &str,
) -> Result<Vec<PathBuf>, String> {
    let files = [
        (format!("{base_name}-market-data.csv"), market_data_csv),
        (format!("{base_name}-trades.csv"), trades_csv),
    ];

    let mut written = Vec::with_capacity(files.len());
    for (file_name, contents) in files {
        let path = dir.join(file_name);
        fs::write(&path, contents)
            .map_err(|e| format!("failed to write {}: {e}", path.display()))?;
        written.push(path);
    }
    Ok(written)
}

/// Tauri command: open a native folder dialog and write the two CSV files
/// there. Returns the saved paths, or `None` if the user cancelled the dialog.
#[tauri::command]
pub async fn export_backtest_csv(
    app: tauri::AppHandle,
    market_data_csv: String,
    trades_csv: String,
    base_name: Option<String>,
) -> Result<Option<Vec<String>>, String> {
    use tauri_plugin_dialog::DialogExt;

    let Some(folder) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };
    let dir = folder
        .into_path()
        .map_err(|e| format!("invalid export folder: {e}"))?;

    let base_name = base_name.unwrap_or_else(|| DEFAULT_BASE_NAME.to_string());
    let written = write_csv_files(&dir, &base_name, &market_data_csv, &trades_csv)?;
    Ok(Some(
        written
            .iter()
            .map(|path| path.display().to_string())
            .collect(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("q-csv-export-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create scratch dir");
        dir
    }

    #[test]
    fn writes_both_files_with_base_name() {
        let dir = scratch_dir("writes");
        let market = "time,open,close,atr_14\n2024-01-01T13:00:00Z,1,2,0.5\n";
        let trades = "trade_id,symbol,side\nt1,WIN$,BUY\n";

        let written = write_csv_files(&dir, "WIN-M5-backtest-2024-01-02", market, trades)
            .expect("write csv files");

        assert_eq!(
            written,
            vec![
                dir.join("WIN-M5-backtest-2024-01-02-market-data.csv"),
                dir.join("WIN-M5-backtest-2024-01-02-trades.csv"),
            ]
        );
        assert_eq!(fs::read_to_string(&written[0]).unwrap(), market);
        assert_eq!(fs::read_to_string(&written[1]).unwrap(), trades);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn reports_the_path_that_failed() {
        let missing = scratch_dir("missing").join("does-not-exist");

        let err = write_csv_files(&missing, "run", "a\n", "b\n").unwrap_err();

        assert!(err.contains("run-market-data.csv"), "{err}");
    }
}
