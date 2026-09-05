//! FRIDAY backend — Phase 2: AI brain + agent engine.
//!
//! Security posture:
//! - Small allowlist of commands: `ping`, `get_app_info` (read-only),
//!   plus the AI provider surface (`provider_status`, `chat_stream`,
//!   `cancel_chat`) implemented in `ai.rs`.
//! - The API key lives ONLY in backend process environment and is never
//!   accepted from, or returned to, the frontend.
//! - Still NO shell execution, NO filesystem access, NO process spawning.
//!   Every future system capability MUST be an explicit Tauri command gated
//!   by a permission check and mirrored by a frontend `Tool` definition.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;

use ai::AiState;
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
        .manage(AiState::new())
        .invoke_handler(tauri::generate_handler![
            ping,
            get_app_info,
            ai::provider_status,
            ai::chat_stream,
            ai::cancel_chat
        ])
        .run(tauri::generate_context!())
        .expect("failed to run FRIDAY application");
}
