fn main() {
    println!("cargo:rerun-if-changed=../desktop-release.json");
    let config: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string("../desktop-release.json").expect("desktop release configuration"),
    )
    .expect("valid desktop release JSON");
    #[path = "src/revision.rs"]
    mod revision;
    let revision = revision::parse(&config["desktopIdentifier"]).expect("valid desktopIdentifier");
    let minimum = revision::parse(&config["minimumDesktopIdentifier"])
        .expect("valid minimumDesktopIdentifier");
    assert!(
        minimum <= revision,
        "minimumDesktopIdentifier exceeds desktopIdentifier"
    );
    println!("cargo:rustc-env=MPE_DESKTOP_REVISION={revision}");
    let legacy = config["desktopRevision"]
        .as_u64()
        .filter(|v| *v > 0 && *v <= u32::MAX as u64)
        .expect("valid legacy revision");
    let minimum_legacy = config["minimumDesktopRevision"]
        .as_u64()
        .filter(|v| *v > 0 && *v <= legacy)
        .expect("valid legacy minimum");
    let _ = minimum_legacy;
    println!("cargo:rustc-env=MPE_DESKTOP_LEGACY_REVISION={legacy}");
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "snapshot",
            "launcher_ready",
            "save_settings",
            "add_project",
            "remove_project",
            "relocate_project",
            "check_environment",
            "install_environment",
            "start_editor",
            "stop_conflict",
            "open_config",
            "open_link",
            "choose_background",
            "homepage",
            "release_versions",
            "github_token_status",
            "save_github_token",
            "update_desktop",
            "quit_desktop",
            "desktop_reply",
            "desktop_open_devtools",
            "desktop_open_recovery",
            "desktop_heartbeat",
            "desktop_save_path",
            "desktop_save_archive",
            "list_logs",
            "read_log",
            "export_logs",
            "open_logs_directory",
        ]),
    ))
    .expect("Tauri build configuration");
}
