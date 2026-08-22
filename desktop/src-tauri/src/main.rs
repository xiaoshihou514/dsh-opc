#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{collections::BTreeSet, env, fs, path::PathBuf, sync::Mutex, time::Duration};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;

const DEFAULT_URL: &str = "http://127.0.0.1:3080";

struct PetState { url: String, seen: Mutex<BTreeSet<String>>, ledger_path: PathBuf }

fn ledger_path() -> PathBuf {
  let home = env::var("DSH_OPC_PET_HOME").ok().or_else(|| env::var("HOME").ok()).or_else(|| env::var("USERPROFILE").ok()).unwrap_or_else(|| ".".into());
  PathBuf::from(home).join(".dsh").join("dsh-opc-pet").join("notification-ledger.json")
}
fn load_ledger(path: &PathBuf) -> BTreeSet<String> { fs::read_to_string(path).ok().and_then(|text| serde_json::from_str(&text).ok()).unwrap_or_default() }
fn save_ledger(path: &PathBuf, entries: &BTreeSet<String>) { if let Some(parent) = path.parent() { let _ = fs::create_dir_all(parent); } let _ = fs::write(path, serde_json::to_string(entries).unwrap_or_default()); }

fn loopback_url(value: &str) -> Result<String, String> {
  let url = reqwest::Url::parse(value).map_err(|_| "Invalid DSH URL")?;
  if !matches!(url.scheme(), "http" | "https") || !matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "::1")) { return Err("DSH URL must be an HTTP(S) loopback address".into()) }
  Ok(url.as_str().trim_end_matches('/').to_string())
}
fn configured_url() -> Result<String, String> {
  let args: Vec<String> = env::args().collect();
  let supplied = args.iter().position(|arg| arg == "--dsh-url").and_then(|index| args.get(index + 1)).cloned().or_else(|| env::var("DSH_URL").ok()).unwrap_or_else(|| DEFAULT_URL.into());
  loopback_url(&supplied)
}
async fn fetch(state: &PetState) -> Result<Value, String> {
  reqwest::Client::new().get(format!("{}/dsh-opc/v1/state", state.url)).timeout(Duration::from_secs(5)).send().await.map_err(|e| e.to_string())?.error_for_status().map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())
}
async fn fetch_manifest(state: &PetState) -> Result<Value, String> {
  reqwest::Client::new().get(format!("{}/dsh-opc/v1/assets/manifest.json", state.url)).timeout(Duration::from_secs(5)).send().await.map_err(|e| e.to_string())?.error_for_status().map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())
}
fn alert_key(session: &Value, now: i64) -> Option<(String, String)> {
  let id = session.get("id")?.as_str()?;
  match session.get("state")?.as_str()? {
    "waiting_permission" => Some((format!("{id}:permission:{}", session.get("approval")?.get("id")?.as_str()?), "DSH needs your permission".into())),
    "error" => Some((format!("{id}:error:{}", session.get("error")?.get("id")?.as_str()?), "A DSH session errored".into())),
    _ => {
      let since = session.get("runningSince")?.as_i64()?;
      let elapsed = now - since;
      let milestone = if elapsed >= 60 * 60_000 { Some((elapsed / 3_600_000) * 60) } else { [5, 10, 20, 30, 45].into_iter().filter(|minutes| elapsed >= minutes * 60_000).last() }?;
      Some((format!("{id}:running:{milestone}"), format!("DSH session running for {milestone} minutes")))
    }
  }
}
async fn poll(app: AppHandle) {
  loop {
    let state = app.state::<PetState>();
    if let Ok(snapshot) = fetch(&state).await {
      let _ = app.emit("opc:snapshot", &snapshot);
      let now = snapshot.get("serverTime").and_then(Value::as_i64).unwrap_or(0);
      if let Some(sessions) = snapshot.get("sessions").and_then(Value::as_array) {
        for session in sessions {
          if let Some((key, title)) = alert_key(session, now) {
            let mut seen = state.seen.lock().expect("notification ledger lock");
            if seen.insert(key) { save_ledger(&state.ledger_path, &seen); let _ = app.notification().builder().title(title).body(session.get("title").and_then(Value::as_str).unwrap_or("DSH session")).show(); }
          }
        }
      }
    }
    tokio::time::sleep(Duration::from_secs(10)).await;
  }
}
#[tauri::command] async fn snapshot(state: State<'_, PetState>) -> Result<Value, String> { fetch(&state).await }
#[tauri::command] async fn manifest(state: State<'_, PetState>) -> Result<Value, String> { fetch_manifest(&state).await }
#[tauri::command] fn open_dsh(app: AppHandle) -> Result<(), String> { tauri_plugin_opener::open_url(&app.state::<PetState>().url, None::<&str>).map_err(|e| e.to_string()) }
fn main() {
  let url = configured_url().unwrap_or_else(|error| { eprintln!("{error}"); std::process::exit(2) });
  let ledger_path = ledger_path();
  let seen = load_ledger(&ledger_path);
  tauri::Builder::default().plugin(tauri_plugin_opener::init()).plugin(tauri_plugin_notification::init()).manage(PetState { url, seen: Mutex::new(seen), ledger_path }).setup(|app| { tauri::async_runtime::spawn(poll(app.handle().clone())); Ok(()) }).invoke_handler(tauri::generate_handler![snapshot, manifest, open_dsh]).run(tauri::generate_context!()).expect("Tauri application error")
}
