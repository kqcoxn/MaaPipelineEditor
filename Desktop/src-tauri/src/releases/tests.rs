use super::*;
use serde_json::json;
use std::{
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};

static ID: AtomicU64 = AtomicU64::new(0);
struct Directory(PathBuf);
impl Directory {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!(
            "mpe-releases-{}-{}",
            std::process::id(),
            ID.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir_all(&path).unwrap();
        Self(path)
    }
}
impl Drop for Directory {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn fixture(version: &str) -> Index {
    let artifact = json!({"url":"https://example.com/resource", "sha256":"a".repeat(64)});
    serde_json::from_value(json!({"schemaVersion":1,"generatedAt":100,"releases":[{
        "manifestUrl":format!("{}/download/v{version}/mpe-manifest.json", engine::RELEASES),
        "manifest":{"version":version,"minimumDesktopRevision":1,"managementProtocol":1,"editor":artifact,
            "platforms":{crate::settings::platform():{"binary":artifact,"bundle":artifact}}}
    }]}))
    .unwrap()
}
fn fetched(version: &str) -> Result<(Index, String, Option<String>), String> {
    Ok((fixture(version), "static".into(), None))
}
#[test]
fn cache_ttl_manual_refresh_and_invalidated_credentials() {
    let dir = Directory::new();
    resolve(&dir.0, false, 100, || fetched("1.9.0")).unwrap();
    let result = resolve(&dir.0, false, 200, || {
        panic!("fresh cache should avoid network")
    })
    .unwrap();
    assert!(result.cached && !result.stale);
    let result = resolve(&dir.0, true, 201, || fetched("1.10.0")).unwrap();
    assert_eq!(result.versions, ["1.10.0"]);
    let mut cache = read_cache(&dir.0).unwrap();
    cache.invalidated = true;
    write_cache(&dir.0, &cache).unwrap();
    let result = resolve(&dir.0, false, 202, || fetched("1.11.0")).unwrap();
    assert_eq!(result.versions, ["1.11.0"]);
    assert!(!result.cached);
}
#[test]
fn offline_and_malformed_responses_preserve_last_valid_cache() {
    let dir = Directory::new();
    resolve(&dir.0, false, 100, || fetched("1.9.0")).unwrap();
    let stale = resolve(&dir.0, false, 4000, || Err("offline".into())).unwrap();
    assert!(stale.stale);
    assert_eq!(stale.checked_at, 100);
    let mut invalid = fixture("1.10.0");
    invalid.releases[0]["manifest"]["platforms"][crate::settings::platform()]["binary"]["sha256"] =
        "bad".into();
    assert!(
        resolve(&dir.0, true, 5000, || Ok((invalid, "static".into(), None)))
            .unwrap()
            .stale
    );
    assert_eq!(read_cache(&dir.0).unwrap().index.versions(), ["1.9.0"]);
    let empty = Directory::new();
    assert!(resolve(&empty.0, false, 100, || Err("offline".into())).is_err());
}
#[test]
fn compatibility_filter_sorting_and_corrupt_cache() {
    let mut index = fixture("1.9.0");
    index.releases.extend(fixture("1.10.0").releases);
    index.releases.extend(fixture("1.9.0").releases);
    let mut incompatible = fixture("99.0.0");
    incompatible.releases[0]["manifest"]["minimumDesktopRevision"] =
        (crate::desktop_release::revision() + 1).into();
    index.releases.extend(incompatible.releases);
    assert_eq!(index.versions(), ["1.10.0", "1.9.0"]);
    let dir = Directory::new();
    std::fs::write(dir.0.join("versions.json"), b"broken").unwrap();
    assert!(
        !resolve(&dir.0, false, 100, || fetched("1.9.0"))
            .unwrap()
            .cached
    );
}
#[test]
fn delayed_site_deployment_does_not_hide_new_release() {
    let site = fixture("1.9.0");
    let mut release = fixture("1.10.0");
    release.generated_at = 200;
    assert_eq!(
        transport::newest(Ok(site), Ok(release)).unwrap().versions(),
        ["1.10.0"]
    );
    assert!(transport::newest(Err("offline".into()), Ok(fixture("1.9.0"))).is_ok());
    assert!(transport::newest(Err("offline".into()), Err("offline".into())).is_err());
}

#[test]
fn token_priority_and_failure_fallback_without_anonymous_api() {
    let (_, source, warning) = discover(
        Ok(Some("fixture".into())),
        |token| {
            assert_eq!(token, "fixture");
            Ok(fixture("1.9.0"))
        },
        || panic!("valid token must take priority"),
    )
    .unwrap();
    assert_eq!(source, "github");
    assert!(warning.is_none());
    let (_, source, warning) = discover(
        Ok(Some("fixture".into())),
        |_| Err("Token 无效".into()),
        || Ok(fixture("1.9.0")),
    )
    .unwrap();
    assert_eq!(source, "static");
    assert!(warning.unwrap().contains("Token 无效"));
    discover(
        Ok(None),
        |_| panic!("no token must not call GitHub API"),
        || Ok(fixture("1.9.0")),
    )
    .unwrap();
    let dir = Directory::new();
    std::fs::write(dir.0.join("github-retry.json"), (now() + 60).to_string()).unwrap();
    assert!(transport::github(&dir.0, "fixture")
        .err()
        .unwrap()
        .contains("等待期"));
}
