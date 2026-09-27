use serde_json::Value;

#[path = "revision.rs"]
mod revision;
pub fn revision() -> &'static str {
    env!("MPE_DESKTOP_REVISION")
}
pub use revision::parse as parse_revision;
pub fn needs_update(manifest: &Value, current: &str) -> Result<bool, String> {
    Ok(parse_revision(&manifest["desktopIdentifier"])? > parse_revision(&Value::from(current))?)
}

// Transitional integer metadata is retained for existing installed environments.
pub fn legacy_revision() -> u32 {
    env!("MPE_DESKTOP_LEGACY_REVISION").parse().unwrap()
}
pub fn parse_legacy_revision(value: &Value) -> Result<u32, String> {
    value
        .as_u64()
        .and_then(|v| u32::try_from(v).ok())
        .filter(|v| *v > 0)
        .ok_or_else(|| "桌面兼容修订号缺失或无效".into())
}
pub fn require_supported(value: &Value) -> Result<(), String> {
    let minimum = parse_legacy_revision(&value["minimumDesktopRevision"])?;
    if minimum > legacy_revision() {
        return Err(format!(
            "请先更新 MPE Desktop，需要桌面兼容修订号 {minimum} 或更高"
        ));
    }
    Ok(())
}

pub fn check_environment(mut value: Value) -> Value {
    if value["ready"] == true {
        if let Err(error) = require_supported(&value) {
            value["ready"] = false.into();
            if !value["problems"].is_array() {
                value["problems"] = serde_json::json!([]);
            }
            value["problems"].as_array_mut().unwrap().push(error.into());
        }
    }
    value
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn transition_metadata_serves_old_and_new_updaters() {
        let manifest = json!({"desktopRevision":8,"desktopIdentifier":"2.0.2"});
        assert!(parse_legacy_revision(&manifest["desktopRevision"]).unwrap() > 7);
        assert!(needs_update(&manifest, "2.0.1").unwrap());
        assert!(!needs_update(&manifest, "2.0.2").unwrap());
        assert!(require_supported(&json!({"minimumDesktopRevision":7})).is_ok());
        assert!(needs_update(
            &json!({"desktopRevision":9,"desktopIdentifier":"bad"}),
            "2.0.2"
        )
        .is_err());
    }

    #[test]
    fn revision_controls_updates_independently_of_product_version() {
        assert!(!needs_update(
            &json!({"version":"99.0.0", "desktopIdentifier":"2.0.2"}),
            "2.0.2"
        )
        .unwrap());
        assert!(!needs_update(&json!({"desktopIdentifier":"2.0.1"}), "2.0.2").unwrap());
        assert!(needs_update(
            &json!({"version":"1.10.1", "desktopIdentifier":"2.0.10"}),
            "2.0.9"
        )
        .unwrap());
    }

    #[test]
    fn malformed_metadata_never_triggers_a_download() {
        for value in [
            Value::Null,
            json!(0),
            json!(-1),
            json!(1.5),
            json!("8"),
            json!(4294967296_u64),
        ] {
            assert!(needs_update(&json!({"desktopIdentifier":value}), "2.0.2").is_err());
        }
    }

    #[test]
    fn installed_environment_also_requires_a_compatible_host() {
        let ready =
            json!({"ready":true,"version":"99.0.0","minimumDesktopRevision":1,"problems":[]});
        assert_eq!(check_environment(ready.clone())["ready"], true);
        let mut future = ready;
        future["minimumDesktopRevision"] = (legacy_revision() + 1).into();
        let checked = check_environment(future);
        assert_eq!(checked["ready"], false);
        assert!(checked["problems"][0]
            .as_str()
            .unwrap()
            .contains("请先更新 MPE Desktop"));
        assert_eq!(check_environment(json!({"ready":true}))["ready"], false);
        let broken = json!({"ready":false,"problems":["未安装"]});
        assert_eq!(check_environment(broken.clone()), broken);
    }
}
