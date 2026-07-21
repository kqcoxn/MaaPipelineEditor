use serde::{Deserialize, Serialize};

pub const PACKAGE_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const PROTOCOL_VERSION: &str = "2.3.0";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalBridgeBootstrap {
    pub port: u16,
    pub protocol_version: String,
    pub package_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BridgeStatus {
    pub phase: BridgePhase,
    pub message: String,
    pub restart_attempt: u8,
    pub bootstrap: Option<LocalBridgeBootstrap>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BridgePhase {
    PreparingEnvironment,
    Starting,
    Ready,
    Restarting,
    RepairRequired,
    Stopped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DesktopPreferences {
    pub workspace: Option<String>,
    pub background_mode: bool,
    pub autostart: bool,
    pub start_hidden: bool,
    pub show_hide_shortcut: String,
    pub stop_debug_shortcut: String,
}

impl Default for DesktopPreferences {
    fn default() -> Self {
        Self {
            workspace: None,
            background_mode: false,
            autostart: false,
            start_hidden: false,
            show_hide_shortcut: "CommandOrControl+Shift+Alt+M".into(),
            stop_debug_shortcut: "CommandOrControl+Shift+Alt+S".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityStatus {
    pub tray: bool,
    pub autostart: bool,
    pub global_shortcut: bool,
    pub updater: bool,
    pub notes: Vec<String>,
}
