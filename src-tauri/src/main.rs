//! FRIDAY backend — Phase 1 foundation.
//!
//! Security posture (deliberate, Phase 1):
//! - The backend exposes a small allowlist of read-only commands
//!   (`ping`, `get_app_info`). There is intentionally NO shell execution,
//!   NO filesystem access, and NO process spawning in this phase.
//! - Every future system capability MUST be added as an explicit Tauri
//!   command gated by a permission check, and mirrored by a frontend
//!   `Tool` definition in `src/agent/tools/`. Unrestricted execution
//!   must never be introduced.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;

/// Static metadata describing the running backend.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: String,
    version: String,
    backend: String,
}

/// Liveness probe used by the frontend to render connection status.
#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

/// Returns read-only application metadata. No system mutation is possible here.
#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: "FRIDAY".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        backend: "online".to_string(),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![ping, get_app_info])
        .run(tauri::generate_context!())
        .expect("failed to run FRIDAY application");
}
