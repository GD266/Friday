use tauri::Manager;

#[tauri::command]
fn greet(name: String) -> String {
  format!("Hello, {}! Friday is ready. �Friday", name)
}

#[tauri::command]
fn get_version() -> String {
  env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![greet, get_version])
    .setup(|app| {
      if cfg!(debug_assertions) {
        let window = app.get_webview_window("main").unwrap();
        window.open_devtools();
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Friday desktop application");
}
