//! FRIDAY AI provider client (Phase 2).
//!
//! Security posture:
//! - The API key is read ONLY from process environment (`FRIDAY_API_KEY`,
//!   falling back to `OPENAI_API_KEY`). It is never accepted from the
//!   frontend, never logged, and never included in any response.
//! - `provider_status` reports configuration WITHOUT secrets so the UI can
//!   render "not configured" guidance instead of crashing.
//! - Outbound traffic is limited to a single OpenAI-compatible
//!   `/chat/completions` endpoint. No shell, filesystem, or process access.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::State;

/// Message Hub: user-provided conversation message (mirrors the frontend type).
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ProviderMessage {
    pub role: String,
    pub content: String,
}

/// Streaming chunk sent back through the Tauri Channel. Mirrors the
/// frontend `ChatChunk` union 1:1.
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ChatChunk {
    Delta { text: String },
    Done,
    Failed { error: String, code: String },
}

/// Public provider status — contains NO secrets by construction.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub configured: bool,
    pub model: String,
    pub label: String,
}

pub struct AiConfig {
    api_key: Option<String>,
    base_url: String,
    model: String,
    timeout: Duration,
}

impl AiConfig {
    fn from_env() -> Self {
        let api_key = std::env::var("FRIDAY_API_KEY")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| {
                std::env::var("OPENAI_API_KEY")
                    .ok()
                    .filter(|value| !value.trim().is_empty())
            });
        let base_url = std::env::var("FRIDAY_API_BASE")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .map(|value| value.trim_end_matches('/').to_string())
            .unwrap_or_else(|| "https://api.openai.com/v1".to_string());
        let model = std::env::var("FRIDAY_MODEL")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "gpt-4o-mini".to_string());
        let timeout_secs = std::env::var("FRIDAY_TIMEOUT_SECS")
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(90);
        Self {
            api_key,
            base_url,
            model,
            timeout: Duration::from_secs(timeout_secs.max(10)),
        }
    }
}

pub struct AiState {
    client: reqwest::Client,
    cancellations: tauri::async_runtime::Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl AiState {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            cancellations: tauri::async_runtime::Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub async fn provider_status() -> ProviderStatus {
    let config = AiConfig::from_env();
    ProviderStatus {
        configured: config.api_key.is_some(),
        model: config.model,
        label: "OpenAI-compatible".to_string(),
    }
}

#[tauri::command]
pub async fn cancel_chat(
    state: State<'_, AiState>,
    request_id: String,
) -> Result<(), String> {
    let flags = state.cancellations.lock().await;
    if let Some(flag) = flags.get(&request_id) {
        flag.store(true, Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
pub async fn chat_stream(
    state: State<'_, AiState>,
    request_id: String,
    messages: Vec<ProviderMessage>,
    on_chunk: Channel<ChatChunk>,
) -> Result<(), String> {
    let config = AiConfig::from_env();

    let api_key = match config.api_key.clone() {
        Some(key) => key,
        None => {
            let _ = on_chunk.send(ChatChunk::Failed {
                error: "AI provider is not configured.".to_string(),
                code: "not_configured".to_string(),
            });
            return Ok(());
        }
    };

    let cancel_flag = Arc::new(AtomicBool::new(false));
    state
        .cancellations
        .lock()
        .await
        .insert(request_id.clone(), Arc::clone(&cancel_flag));

    let outcome = run_stream(&state.client, &config, &api_key, &messages, &on_chunk, &cancel_flag).await;

    state.cancellations.lock().await.remove(&request_id);
    outcome
}

async fn run_stream(
    client: &reqwest::Client,
    config: &AiConfig,
    api_key: &str,
    messages: &[ProviderMessage],
    on_chunk: &Channel<ChatChunk>,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<(), String> {
    let url = format!("{}/chat/completions", config.base_url);
    let body = serde_json::json!({
        "model": config.model,
        "stream": true,
        "messages": messages,
    });

    let response = client
        .post(url)
        .timeout(config.timeout)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|error| {
            let _ = on_chunk.send(ChatChunk::Failed {
                error: classify_request_error(&error),
                code: classify_request_code(&error),
            });
            "provider request failed".to_string()
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let detail = response
            .text()
            .await
            .unwrap_or_default()
            .chars()
            .take(300)
            .collect::<String>();
        let code = if status.as_u16() == 401 || status.as_u16() == 403 {
            "auth"
        } else {
            "unknown"
        };
        let _ = on_chunk.send(ChatChunk::Failed {
            error: format!("Provider rejected the request (HTTP {}). {}", status, detail),
            code: code.to_string(),
        });
        return Ok(());
    }

    let mut stream = response.bytes_stream();
    let mut pending = String::new();

    while let Some(item) = stream.next().await {
        if cancel_flag.load(Ordering::SeqCst) {
            let _ = on_chunk.send(ChatChunk::Failed {
                error: "Request cancelled.".to_string(),
                code: "cancelled".to_string(),
            });
            return Ok(());
        }
        let bytes = item.map_err(|_| "provider stream interrupted".to_string())?;
        let text = String::from_utf8_lossy(&bytes);
        pending.push_str(&text);

        // Drain complete SSE lines, keeping the partial tail buffered.
        while let Some(index) = pending.find('\n') {
            let line: String = pending.drain(..=index).collect();
            if let Some(delta) = parse_sse_delta(line.trim()) {
                if !delta.is_empty() {
                    let _ = on_chunk.send(ChatChunk::Delta { text: delta });
                }
            }
        }
    }

    if cancel_flag.load(Ordering::SeqCst) {
        let _ = on_chunk.send(ChatChunk::Failed {
            error: "Request cancelled.".to_string(),
            code: "cancelled".to_string(),
        });
        return Ok(());
    }

    let _ = on_chunk.send(ChatChunk::Done);
    Ok(())
}

/// Extracts `choices[0].delta.content` from a single SSE `data:` line.
/// Returns `None` for control lines (`[DONE]`, keep-alives, malformed JSON).
fn parse_sse_delta(line: &str) -> Option<String> {
    let payload = line.strip_prefix("data:")?.trim();
    if payload.is_empty() || payload == "[DONE]" {
        return None;
    }
    let json: serde_json::Value = serde_json::from_str(payload).ok()?;
    json.pointer("/choices/0/delta/content")
        .and_then(|value| value.as_str())
        .map(|content| content.to_string())
}

fn classify_request_error(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        return "The AI provider did not respond in time.".to_string();
    }
    if error.is_connect() || error.is_body() || error.is_decode() {
        return "Network failure while contacting the AI provider.".to_string();
    }
    "AI provider request failed.".to_string()
}

fn classify_request_code(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        return "timeout".to_string();
    }
    if error.is_connect() || error.is_body() || error.is_decode() {
        return "network".to_string();
    }
    "unknown".to_string()
}

#[cfg(test)]
mod tests {
    use super::parse_sse_delta;

    #[test]
    fn extracts_delta_content() {
        let line = r#"data: {"choices":[{"delta":{"content":"Hello"}}]}"#;
        assert_eq!(parse_sse_delta(line).as_deref(), Some("Hello"));
    }

    #[test]
    fn ignores_control_lines() {
        assert_eq!(parse_sse_delta("data: [DONE]"), None);
        assert_eq!(parse_sse_delta(": keep-alive"), None);
        assert_eq!(parse_sse_delta("data: not-json{"), None);
        assert_eq!(parse_sse_delta("event: message"), None);
    }
}
